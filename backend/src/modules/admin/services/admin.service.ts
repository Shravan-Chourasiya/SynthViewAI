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
import type { interviewStatusEnum } from "../../interview/schemas/interview.schema.js";
import { interviewsTable } from "../../interview/schemas/interview.schema.js";
import { interviewResultsTable } from "../../interview/schemas/result.schema.js";
import { AppError } from "../../../utils/appError.js";
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
} from "../../../services/nodemailer.service.js";

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
  userId?: string;
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

interface InterviewSummary {
  id: string;
  title: string;
  status: string;
  userId: string;
  userName: string;
  userEmail: string;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * List users with pagination and filtering
 */
export async function listUsers(options: PaginationOptions & Partial<UserListFilter>): Promise<{
  users: UserSummary[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}> {
  const db = getPgDb();
  const { page, limit, search, role, sortBy, sortOrder } = options;

  // Build the filter predicate first, then apply it inside ONE chained query.
  // Drizzle's `.where()` *replaces* the previous predicate rather than ANDing
  // with it, so chaining `.where()` twice silently dropped the search whenever a
  // role filter was also active. Collecting the conditions up-front also lets
  // Drizzle infer the selected row type, which is what the previous `as any`
  // assertion on the query was suppressing.
  const userConditions: SQL<unknown>[] = [];
  if (search) {
    // `username` is what the admin table renders, so it has to be searchable too.
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
    userConditions.push(
      eq(usersTable.userrole, role as (typeof USER_ROLES)[number]),
    );
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
export async function getUserById(userId: string): Promise<UserSummary> {
  const db = getPgDb();

  const result = await db
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
    .limit(1);

  if (!result.length) {
    throw new AppError("User not found", StatusCodes.NOT_FOUND, ErrorCodes.RESOURCE_NOT_FOUND, {
      isOperational: true,
    });
  }

  const user = result[0]!;
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
  if (targetRank >= actorRank && !actorIsOwner) {
    throw new AppError(
      `Cannot modify a user ranked at or above your own role (${targetUser.userrole})`,
      StatusCodes.FORBIDDEN,
      ErrorCodes.AUTH_FORBIDDEN,
      { isOperational: true },
    );
  }

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
  reason = "Administrative action",
): Promise<void> {
  const db = getPgDb();

  const user = await db.select().from(usersTable).where(eq(usersTable.id, userId)).limit(1);

  if (!user.length) {
    throw new AppError("User not found", StatusCodes.NOT_FOUND, ErrorCodes.RESOURCE_NOT_FOUND, {
      isOperational: true,
    });
  }

  await db
    .update(usersTable)
    .set({
      accountStatus: "suspended",
      updatedAt: new Date(),
    })
    .where(eq(usersTable.id, userId));

  // Best-effort notification — the suspension has already been applied, so a
  // failing email must not roll it back.
  const suspended = user[0];
  if (suspended) {
    sendInBackground("account suspended", () =>
      sendAccountSuspendedMail(suspended.email, {
        reason,
        suspendedAt: new Date(),
      }),
    );
  }
}

/**
 * Reinstate a suspended user
 */
export async function reinstateUser(userId: string): Promise<void> {
  const db = getPgDb();

  const user = await db.select().from(usersTable).where(eq(usersTable.id, userId)).limit(1);

  if (!user.length) {
    throw new AppError("User not found", StatusCodes.NOT_FOUND, ErrorCodes.RESOURCE_NOT_FOUND, {
      isOperational: true,
    });
  }

  await db
    .update(usersTable)
    .set({
      accountStatus: "active",
      updatedAt: new Date(),
    })
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
  const { page, limit, search, status, userId, sortBy, sortOrder } = options;

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
      userId: interviewsTable.userId,
      userName: userFullNameSql().as("userName"),
      userEmail: sql<string>`COALESCE(${usersTable.email}, '')`.as("userEmail"), // Make sure email is never null
      createdAt: interviewsTable.createdAt,
      updatedAt: interviewsTable.updatedAt,
    })
    .from(interviewsTable)
    .leftJoin(usersTable, eq(interviewsTable.userId, usersTable.id))
    .where(interviewConditions.length > 0 ? and(...interviewConditions) : undefined)
    .orderBy(sortDirection)
    .limit(limit)
    .offset(offset);

  const interviews: InterviewSummary[] = rawInterviews.map((interview) => ({
    ...interview,
    userEmail: interview.userEmail || "",
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
 */
export async function getInterviewDetail(interviewId: string) {
  const db = getPgDb();

  const result = await db
    .select({
      id: interviewsTable.id,
      title: interviewsTable.interviewTitle,
      description: interviewsTable.interviewDescription,
      status: interviewsTable.interviewStatus,
      userId: interviewsTable.userId,
      userName: userFullNameSql().as("userName"),
      userEmail: sql<string>`COALESCE(${usersTable.email}, '')`.as("userEmail"),
      createdAt: interviewsTable.createdAt,
      updatedAt: interviewsTable.updatedAt,
      scheduledAt: interviewsTable.interviewScheduledDate,
      startedAt: interviewsTable.interviewStartedAt,
      duration: interviewsTable.interviewDuration,
    })
    .from(interviewsTable)
    .leftJoin(usersTable, eq(interviewsTable.userId, usersTable.id))
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

  const interview = result[0]!;
  return {
    ...interview,
    userEmail: interview.userEmail || "",
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
