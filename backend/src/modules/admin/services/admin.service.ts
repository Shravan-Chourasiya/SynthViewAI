import {
  and,
  eq,
  ilike,
  or,
  desc,
  asc,
  gt,
  gte,
  lt,
  lte,
  count,
  sql,
  type SQL,
  type SQLWrapper,
} from "drizzle-orm";
import { getPgDb } from "../../../db/postgres.init.js";
import { usersTable, userRoleEnum } from "../../auth/schemas/user.schema.js";
import { candidateReference } from "./interview-metrics.service.js";
import type { interviewStatusEnum } from "../../interview/schemas/interview.schema.js";
import { interviewsTable } from "../../interview/schemas/interview.schema.js";
import { interviewResultsTable } from "../../interview/schemas/result.schema.js";
import { AppError } from "../../../utils/AppError.js";
import { ErrorCodes } from "../../../constants/errorCodes.js";
import {
  ROLE_MANAGEMENT_MIN_ROLE,
  ROLE_RANK,
  USER_ROLES,
  getRoleRank,
  isUserRole,
} from "../../../constants/roles.constants.js";
import { StatusCodes } from "http-status-codes";
import { randomUUID } from "crypto";
import {
  sendAccountSuspendedMail,
  sendInBackground,
} from "../../../services/mail.service.js";

/**
 * Shared rank guard — reused by updateUserRole, suspendUser, reinstateUser.
 * Throws 403 when the actor cannot act on the target (peer or superior).
 * The owner is the apex and is always allowed.
 */
function assertActorOutranksOrIsOwner(
  actor: { userrole: string },
  target: { userrole: string },
  action: string,
): void {
  const actorRank = getRoleRank(actor.userrole);
  const targetRank = getRoleRank(target.userrole);
  const actorIsOwner = actor.userrole === "owner";
  if (targetRank >= actorRank && !actorIsOwner) {
    throw new AppError(
      `Cannot ${action} a user ranked at or above your own role (${target.userrole})`,
      StatusCodes.FORBIDDEN,
      ErrorCodes.AUTH_FORBIDDEN,
      { isOperational: true },
    );
  }
}

/**
 * Escapes `%`, `_` and `\` so a user's search text is matched literally
 * inside an ILIKE pattern instead of acting as wildcards.
 */
function escapeLikePattern(value: string): string {
  return value.replace(/[\\%_]/g, (char) => `\\${char}`);
}

/**
 * The owner's full name as a single SQL expression. Shared by the search
 * predicate and the projected `userName` column so the two can never disagree
 * about what "name" means, and so a change only has to happen in one place.
 */
function userFullNameSql() {
  return sql<string>`COALESCE(CONCAT(${usersTable.firstName}, ' ', ${usersTable.lastName}), '')`;
}

interface PaginationOptions {
  page: number;
  limit: number;
}

interface UserListFilter {
  search?: string;
  role?: string;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
}

interface InterviewListFilter {
  search?: string;
  status?: string;
  /**
   * Lookup keys, never returned. An admin may narrow the list by a raw user id
   * or by email/name in `search` in order to *find* a session; the response
   * carries only the anonymized candidate reference, so the lookup cannot be
   * used to read an identity back out.
   */
  userId?: string;
  /** Job role from the session's configuration metadata (e.g. "Backend Engineer"). */
  jobRole?: string;
  /** Company the session was targeted at (either the catalogue entry or the free-text one). */
  company?: string;
  /** Inclusive lower bound on `createdAt`. */
  from?: Date;
  /** Exclusive upper bound on `createdAt`. */
  to?: Date;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
}

interface UserSummary {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  userrole: string;
  isActive: boolean;
  accountStatus: string;
  createdAt: Date;
  updatedAt: Date;
  interviewCount: number;
  // The SQL projection is `SELECT MAX(...)`, which is NULL (not absent) when the
  // user has no interviews.
  lastInterviewAt: Date | null;
}

/**
 * A row of the admin interview list.
 *
 * Deliberately free of candidate identity: no name, no email, no raw user id.
 * The owning user is represented by `candidateRef`, a salted hash that is stable
 * across that person's sessions but reversible by nobody (see
 * interview-metrics.service.ts for the derivation, which is shared so the list
 * and the report can never disagree about who `C-…` is).
 */
interface InterviewSummary {
  id: string;
  title: string;
  status: string;
  candidateRef: string;
  /** Session configuration, useful for triage and shown as columns. Not candidate data. */
  jobRole: string | null;
  company: string | null;
  difficulty: string | null;
  durationMinutes: number | null;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * List users with pagination and filtering
 */
export async function listUsers(actorId: string, options: PaginationOptions & Partial<UserListFilter>): Promise<{
  users: UserSummary[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}> {
  const db = getPgDb();
  const { page, limit, search, role, sortBy, sortOrder } = options;

  const [actorRow] = await db.select({ userrole: usersTable.userrole }).from(usersTable).where(eq(usersTable.id, actorId)).limit(1);
  const actorRank = getRoleRank(actorRow?.userrole);
  // Moderators may only see user/moderator accounts — never admin or owner.
  const visibilityCeiling =
    actorRank < ROLE_RANK.admin
      ? and(
          sql`${usersTable.userrole} != 'admin'`,
          sql`${usersTable.userrole} != 'owner'`,
        )
      : undefined;

  const userConditions: SQL<unknown>[] = [];
  if (search) {
    const escaped = escapeLikePattern(search);
    userConditions.push(
      or(
        ilike(usersTable.email, `%${escaped}%`),
        ilike(usersTable.username, `%${escaped}%`),
        ilike(usersTable.firstName, `%${escaped}%`),
        ilike(usersTable.lastName, `%${escaped}%`),
      )!,
    );
  }
  if (role) {
    userConditions.push(eq(usersTable.userrole, role as (typeof USER_ROLES)[number]));
  }
  if (visibilityCeiling) {
    userConditions.push(visibilityCeiling);
  }
  // Apply sorting
  let sortCol: SQLWrapper;
  switch (sortBy) {
    case "userrole":
      sortCol = usersTable.userrole;
      break;
    case "email":
      sortCol = usersTable.email;
      break;
    case "firstName":
      sortCol = usersTable.firstName;
      break;
    case "lastName":
      sortCol = usersTable.lastName;
      break;
    default:
      sortCol = usersTable.createdAt;
  }

  const sortDirection = sortOrder === "asc" ? asc(sortCol) : desc(sortCol);

  // Calculate total count with the exact same predicate as the page query —
  // otherwise the filters and the pagination count disagree.
  const countQueryBase = db.select({ count: count() }).from(usersTable);
  const countQuery =
    userConditions.length > 0
      ? (countQueryBase.where(and(...userConditions)) as typeof countQueryBase)
      : countQueryBase;
  const totalResult = await countQuery;
  const total = Number(totalResult[0]?.count ?? 0);

  // Calculate pagination
  const offset = (page - 1) * limit;

  // Get users
  const rawUsers = await db
    .select({
      id: usersTable.id,
      email: usersTable.email,
      firstName: usersTable.firstName,
      lastName: usersTable.lastName,
      userrole: usersTable.userrole,
      isActive: usersTable.isVerified,
      accountStatus: usersTable.accountStatus,
      createdAt: usersTable.createdAt,
      updatedAt: usersTable.updatedAt,
      interviewCount:
        sql<number>`COALESCE((SELECT COUNT(*) FROM interviews WHERE interviews.user_id = users.id), 0)`.as(
          "interviewCount",
        ),
      lastInterviewAt:
        sql<Date | null>`(SELECT MAX(created_at) FROM interviews WHERE interviews.user_id = users.id)`.as(
          "lastInterviewAt",
        ),
    })
    .from(usersTable)
    .where(userConditions.length > 0 ? and(...userConditions) : undefined)
    .orderBy(sortDirection)
    .limit(limit)
    .offset(offset);

  const users: UserSummary[] = rawUsers.map((user) => ({
    ...user,
    firstName: user.firstName ?? "",
    lastName: user.lastName ?? "",
  }));

  const totalPages = Math.ceil(total / limit);

  return {
    users,
    total,
    page,
    limit,
    totalPages,
  };
}

/**
 * Get a single user by ID with interview summary
 */
export async function getUserById(userId: string, actorId: string): Promise<UserSummary> {
  const db = getPgDb();

  const [[actorRow], result] = await Promise.all([
    db.select({ userrole: usersTable.userrole }).from(usersTable).where(eq(usersTable.id, actorId)).limit(1),
    db
      .select({
      id: usersTable.id,
      email: usersTable.email,
      firstName: usersTable.firstName,
      lastName: usersTable.lastName,
      userrole: usersTable.userrole,
      isActive: usersTable.isVerified,
      accountStatus: usersTable.accountStatus,
      createdAt: usersTable.createdAt,
      updatedAt: usersTable.updatedAt,
      interviewCount:
        sql<number>`COALESCE((SELECT COUNT(*) FROM interviews WHERE interviews.user_id = users.id), 0)`.as(
          "interviewCount",
        ),
      lastInterviewAt:
        sql<Date | null>`(SELECT MAX(created_at) FROM interviews WHERE interviews.user_id = users.id)`.as(
          "lastInterviewAt",
        ),
    })
    .from(usersTable)
    .where(eq(usersTable.id, userId))
    .limit(1),
  ]);

  if (!result.length) {
    throw new AppError("User not found", StatusCodes.NOT_FOUND, ErrorCodes.RESOURCE_NOT_FOUND, {
      isOperational: true,
    });
  }

  const user = result[0]!;
  // Moderators cannot see admin/owner accounts — return 404 to avoid leaking existence.
  const actorRank = getRoleRank(actorRow?.userrole);
  const targetRank = getRoleRank(user.userrole);
  if (actorRank < ROLE_RANK.admin && targetRank >= ROLE_RANK.admin) {
    throw new AppError("User not found", StatusCodes.NOT_FOUND, ErrorCodes.RESOURCE_NOT_FOUND, {
      isOperational: true,
    });
  }

  return {
    ...user,
    firstName: user.firstName ?? "",
    lastName: user.lastName ?? "",
  };
}

/**
 * Update user role
 */
export async function updateUserRole(
  userId: string,
  newRole: string,
  actorId: string,
): Promise<void> {
  const db = getPgDb();

  // Get current user and actor to check permissions
  const [currentUser, actor] = await Promise.all([
    db.select().from(usersTable).where(eq(usersTable.id, userId)).limit(1),
    db.select().from(usersTable).where(eq(usersTable.id, actorId)).limit(1),
  ]);

  if (!currentUser.length) {
    throw new AppError("User not found", StatusCodes.NOT_FOUND, ErrorCodes.RESOURCE_NOT_FOUND, {
      isOperational: true,
    });
  }

  if (!actor.length) {
    throw new AppError("Actor not found", StatusCodes.NOT_FOUND, ErrorCodes.RESOURCE_NOT_FOUND, {
      isOperational: true,
    });
  }

  const targetUser = currentUser[0]!;
  const actorUser = actor[0]!;

  if (!isUserRole(newRole)) {
    throw new AppError(
      `Invalid role "${newRole}". Expected one of: ${USER_ROLES.join(", ")}`,
      StatusCodes.BAD_REQUEST,
      ErrorCodes.VALIDATION_FAILED,
      { isOperational: true },
    );
  }

  const actorRank = getRoleRank(actorUser.userrole);
  const targetRank = getRoleRank(targetUser.userrole);
  const requestedRank = ROLE_RANK[newRole];
  // The owner is the apex: it is the only role allowed to act on a peer,
  // which is what lets owners manage other owners.
  const actorIsOwner = actorUser.userrole === "owner";

  // Only the admin tier and above may change roles at all.
  if (actorRank < ROLE_RANK[ROLE_MANAGEMENT_MIN_ROLE]) {
    throw new AppError(
      `Access denied. Changing roles requires the "${ROLE_MANAGEMENT_MIN_ROLE}" role or above`,
      StatusCodes.FORBIDDEN,
      ErrorCodes.AUTH_FORBIDDEN,
      { isOperational: true },
    );
  }

  // You cannot act on a peer or a superior — only the owner may touch owners.
  assertActorOutranksOrIsOwner(actorUser, targetUser, "modify");

  // You cannot grant a role at or above your own — only the owner may grant owner.
  if (requestedRank >= actorRank && !actorIsOwner) {
    throw new AppError(
      `Cannot assign a role ranked at or above your own role (${newRole})`,
      StatusCodes.FORBIDDEN,
      ErrorCodes.AUTH_FORBIDDEN,
      { isOperational: true },
    );
  }

  // Perform the role update
  await db
    .update(usersTable)
    .set({ userrole: newRole }) // narrowed by isUserRole above
    .where(eq(usersTable.id, userId));
}

/**
 * Suspend a user
 */
export async function suspendUser(
  userId: string,
  actorId: string,
  reason = "Administrative action",
): Promise<void> {
  const db = getPgDb();

  const [[target], [actor]] = await Promise.all([
    db.select().from(usersTable).where(eq(usersTable.id, userId)).limit(1),
    db.select().from(usersTable).where(eq(usersTable.id, actorId)).limit(1),
  ]);

  if (!target) throw new AppError("User not found", StatusCodes.NOT_FOUND, ErrorCodes.RESOURCE_NOT_FOUND, { isOperational: true });
  if (!actor) throw new AppError("Actor not found", StatusCodes.NOT_FOUND, ErrorCodes.RESOURCE_NOT_FOUND, { isOperational: true });

  assertActorOutranksOrIsOwner(actor, target, "suspend");

  await db
    .update(usersTable)
    .set({ accountStatus: "suspended", updatedAt: new Date() })
    .where(eq(usersTable.id, userId));

  sendInBackground("account suspended", () =>
    sendAccountSuspendedMail(target.email, { reason, suspendedAt: new Date() }),
  );
}

/**
 * Reinstate a suspended user
 */
export async function reinstateUser(userId: string, actorId: string): Promise<void> {
  const db = getPgDb();

  const [[target], [actor]] = await Promise.all([
    db.select().from(usersTable).where(eq(usersTable.id, userId)).limit(1),
    db.select().from(usersTable).where(eq(usersTable.id, actorId)).limit(1),
  ]);

  if (!target) throw new AppError("User not found", StatusCodes.NOT_FOUND, ErrorCodes.RESOURCE_NOT_FOUND, { isOperational: true });
  if (!actor) throw new AppError("Actor not found", StatusCodes.NOT_FOUND, ErrorCodes.RESOURCE_NOT_FOUND, { isOperational: true });

  assertActorOutranksOrIsOwner(actor, target, "reinstate");

  await db
    .update(usersTable)
    .set({ accountStatus: "active", updatedAt: new Date() })
    .where(eq(usersTable.id, userId));
}

/**
 * List interviews with pagination and filtering
 */
export async function listInterviews(
  options: PaginationOptions & Partial<InterviewListFilter>,
): Promise<{
  interviews: InterviewSummary[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}> {
  const db = getPgDb();
  const { page, limit, search, status, userId, jobRole, company, from, to, sortBy, sortOrder } =
    options;

  // Apply filters through one combined predicate: Drizzle's `.where()` replaces
  // the previous predicate, so separate calls silently dropped the status filter
  // as soon as a userId was supplied (and vice versa).
  const interviewConditions: SQL<unknown>[] = [];
  if (search) {
    // Free-text search covers the title and the owning user (name + email),
    // matching what the admin table renders.
    const escapedSearch = escapeLikePattern(search);
    const fullName = userFullNameSql();
    interviewConditions.push(
      or(
        ilike(interviewsTable.interviewTitle, `%${escapedSearch}%`),
        ilike(usersTable.email, `%${escapedSearch}%`),
        sql`${fullName} ILIKE ${`%${escapedSearch}%`}`,
      )!,
    );
  }
  if (status) {
    // Statuses match the zod enum on the route, so this is a safe
    // string→enum comparison at runtime.
    const interviewStatus = status as (typeof interviewStatusEnum.enumValues)[number];
    interviewConditions.push(eq(interviewsTable.interviewStatus, interviewStatus));
  }
  if (userId) {
    interviewConditions.push(eq(interviewsTable.userId, userId));
  }
  if (jobRole) {
    // Session configuration, stored in the metadata jsonb. Matched with ILIKE so
    // "backend" finds "Backend Engineer" — an admin narrowing a list should not
    // have to guess the exact casing the session was created with.
    interviewConditions.push(
      sql`${interviewsTable.interviewMetaData}->>'jobRole' ILIKE ${`%${escapeLikePattern(jobRole)}%`}`,
    );
  }
  if (company) {
    // `targetedCompanyOther` is the free-text company chosen when the session
    // was not built for a catalogue entry; either one may be the answer.
    const escapedCompany = escapeLikePattern(company);
    interviewConditions.push(
      or(
        sql`${interviewsTable.interviewMetaData}->>'targetedCompany' ILIKE ${`%${escapedCompany}%`}`,
        sql`${interviewsTable.interviewMetaData}->>'targetedCompanyOther' ILIKE ${`%${escapedCompany}%`}`,
      )!,
    );
  }
  if (from) {
    interviewConditions.push(gte(interviewsTable.createdAt, from));
  }
  if (to) {
    // Exclusive upper bound: the zod schema turns a date-only `to` into the start
    // of the following day, so "up to the 5th" includes the 5th.
    interviewConditions.push(lt(interviewsTable.createdAt, to));
  }
  // Apply sorting
  let sortCol: SQLWrapper;
  switch (sortBy) {
    case "status":
      sortCol = interviewsTable.interviewStatus;
      break;
    case "title":
      sortCol = interviewsTable.interviewTitle;
      break;
    case "userEmail":
      sortCol = sql<string>`COALESCE(${usersTable.email}, '')`;
      break;
    default:
      sortCol = interviewsTable.createdAt;
  }

  const sortDirection = sortOrder === "asc" ? asc(sortCol) : desc(sortCol);

  // Calculate total count with the exact same predicate as the page query —
  // otherwise the filters and the pagination count disagree.
  const countQueryBase = db
    .select({ count: count() })
    .from(interviewsTable)
    .leftJoin(usersTable, eq(interviewsTable.userId, usersTable.id));

  const countQuery =
    interviewConditions.length > 0
      ? (countQueryBase.where(and(...interviewConditions)) as typeof countQueryBase)
      : countQueryBase;

  const totalResult = await countQuery;
  const total = Number(totalResult[0]?.count ?? 0);

  // Calculate pagination
  const offset = (page - 1) * limit;

  // Get interviews
  const rawInterviews = await db
    .select({
      id: interviewsTable.id,
      title: interviewsTable.interviewTitle,
      status: interviewsTable.interviewStatus,
      // Read for the reference hash only — never returned. This is the one
      // identity field that crosses the boundary, and it is transformed in the
      // same statement that would otherwise carry it out.
      userId: interviewsTable.userId,
      jobRole: sql<string | null>`(${interviewsTable.interviewMetaData}->>'jobRole')`,
      company: sql<
        string | null
      >`COALESCE(${interviewsTable.interviewMetaData}->>'targetedCompany', ${interviewsTable.interviewMetaData}->>'targetedCompanyOther')`,
      difficulty: interviewsTable.interviewDifficulty,
      durationMinutes: interviewsTable.interviewDuration,
      createdAt: interviewsTable.createdAt,
      updatedAt: interviewsTable.updatedAt,
    })
    .from(interviewsTable)
    // Still joined for the name/email search predicate above; no user column is
    // projected into the result.
    .leftJoin(usersTable, eq(interviewsTable.userId, usersTable.id))
    .where(interviewConditions.length > 0 ? and(...interviewConditions) : undefined)
    .orderBy(sortDirection)
    .limit(limit)
    .offset(offset);

  const interviews: InterviewSummary[] = rawInterviews.map((interview) => ({
    id: interview.id,
    title: interview.title,
    status: interview.status,
    candidateRef: candidateReference(interview.userId),
    jobRole: interview.jobRole,
    company: interview.company,
    difficulty: interview.difficulty,
    durationMinutes: interview.durationMinutes,
    createdAt: interview.createdAt,
    updatedAt: interview.updatedAt,
  }));

  const totalPages = Math.ceil(total / limit);

  return {
    interviews,
    total,
    page,
    limit,
    totalPages,
  };
}

/**
 * Get interview detail by ID
 *
 * Session metadata only. This used to return the owner's name and email, which
 * is exactly the identity the admin interview area is not allowed to see — the
 * owner is now represented by the same anonymized reference the list and the
 * metrics report use. Scores live on `GET /admin/interviews/:id/metrics`; this
 * endpoint is the lightweight metadata lookup.
 *
 * `interviewDescription` is deliberately not projected: it is free text written
 * at creation time and may quote material the candidate provided.
 */
export async function getInterviewDetail(interviewId: string) {
  const db = getPgDb();

  const result = await db
    .select({
      id: interviewsTable.id,
      title: interviewsTable.interviewTitle,
      status: interviewsTable.interviewStatus,
      // Read only to derive the anonymized reference below.
      userId: interviewsTable.userId,
      createdAt: interviewsTable.createdAt,
      updatedAt: interviewsTable.updatedAt,
      scheduledAt: interviewsTable.interviewScheduledDate,
      startedAt: interviewsTable.interviewStartedAt,
      duration: interviewsTable.interviewDuration,
    })
    .from(interviewsTable)
    .where(eq(interviewsTable.id, interviewId))
    .limit(1);

  if (!result.length) {
    throw new AppError(
      "Interview not found",
      StatusCodes.NOT_FOUND,
      ErrorCodes.RESOURCE_NOT_FOUND,
      { isOperational: true },
    );
  }

  const { userId, ...interview } = result[0]!;
  return {
    ...interview,
    candidateRef: candidateReference(userId),
  };
}

/**
 * Get admin overview statistics
 */
export async function getOverviewStats(period = "30d"): Promise<{
  totalUsers: number;
  totalInterviews: number;
  interviewsByStatus: Record<string, number>;
  recentSignups: number;
  activeUsers: number;
}> {
  const db = getPgDb();

  // Parse the period to calculate the date threshold
  const now = new Date();
  const startDate = new Date(now);

  switch (period) {
    case "7d":
      startDate.setDate(now.getDate() - 7);
      break;
    case "30d":
      startDate.setDate(now.getDate() - 30);
      break;
    case "90d":
      startDate.setDate(now.getDate() - 90);
      break;
    default:
      startDate.setDate(now.getDate() - 30);
  }

  // Total users
  const totalUsersResult = await db.select({ count: count() }).from(usersTable);
  const totalUsers = Number(totalUsersResult[0]?.count ?? 0);

  // Total interviews
  const totalInterviewsResult = await db.select({ count: count() }).from(interviewsTable);
  const totalInterviews = Number(totalInterviewsResult[0]?.count ?? 0);

  // Interviews by status
  const interviewsByStatusResult = await db
    .select({
      status: interviewsTable.interviewStatus,
      count: count(),
    })
    .from(interviewsTable)
    .groupBy(interviewsTable.interviewStatus);

  const interviewsByStatus: Record<string, number> = {};
  interviewsByStatusResult.forEach((row) => {
    interviewsByStatus[row.status] = Number(row.count);
  });

  // Recent signups
  const recentSignupsResult = await db
    .select({ count: count() })
    .from(usersTable)
    .where(gte(usersTable.createdAt, startDate));

  const recentSignups = Number(recentSignupsResult[0]?.count ?? 0);

  // Active users (users who have completed interviews)
  // Count distinct users who have interviews with status COMPLETED
  const activeUsersResult = await db.execute(sql`
    SELECT COUNT(DISTINCT ${interviewsTable.userId}) as user_count
    FROM ${interviewsTable}
    WHERE ${interviewsTable.interviewStatus} = 'COMPLETED'
  `);

  let activeUsers = 0;
  if (Array.isArray(activeUsersResult) && activeUsersResult.length > 0) {
    const firstRow = activeUsersResult[0];
    if (firstRow && typeof firstRow === "object" && "user_count" in firstRow) {
      activeUsers = Number((firstRow).user_count) || 0;
    }
  } else if (
    typeof activeUsersResult === "object" &&
    activeUsersResult &&
    "rows" in activeUsersResult &&
    Array.isArray(activeUsersResult.rows) &&
    activeUsersResult.rows.length > 0
  ) {
    // Handle result with rows property
    activeUsers = Number(activeUsersResult.rows[0]?.user_count) || 0;
  } else {
    // Default fallback
    activeUsers = 0;
  }

  return {
    totalUsers,
    totalInterviews,
    interviewsByStatus,
    recentSignups,
    activeUsers,
  };
}
