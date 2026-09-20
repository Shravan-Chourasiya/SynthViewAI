import { and, eq, ilike, or, desc, asc, gt, gte, lt, lte, count, sql, type SQL } from "drizzle-orm";
import { getPgDb } from "../../../db/postgres.init.js";
import { usersTable, userRoleEnum } from "../../auth/schemas/user.schema.js";
import { interviewsTable, interviewStatusEnum } from "../../interview/schemas/interview.schema.js";
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

interface PaginationOptions {
  page: number;
  limit: number;
}

interface UserListFilter {
  search?: string;
  role?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

interface InterviewListFilter {
  search?: string;
  status?: string;
  userId?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
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
  lastInterviewAt?: Date;
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

  // Build base query with filters
  let query = db
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
      interviewCount: sql<number>`COALESCE((SELECT COUNT(*) FROM interviews WHERE interviews.user_id = users.id), 0)`.as('interviewCount'),
      lastInterviewAt: sql<Date | null>`(SELECT MAX(created_at) FROM interviews WHERE interviews.user_id = users.id)`.as('lastInterviewAt')
    })
    .from(usersTable) as any; // Type assertion to bypass complex type checking

  // Apply filters. Drizzle's `.where()` *replaces* the previous predicate rather
  // than ANDing with it, so chaining `.where()` twice silently dropped the search
  // whenever a role filter was also active. Build one combined predicate instead.
  const userConditions: SQL[] = [];
  if (search) {
    // `username` is what the admin table renders, so it has to be searchable too.
    userConditions.push(
      or(
        ilike(usersTable.email, `%${search}%`),
        ilike(usersTable.username, `%${search}%`),
        ilike(usersTable.firstName, `%${search}%`),
        ilike(usersTable.lastName, `%${search}%`)
      ) as SQL
    );
  }
  if (role) {
    userConditions.push(eq(usersTable.userrole, role as any) as SQL);
  }
  if (userConditions.length > 0) {
    query = query.where(and(...userConditions)) as any; // Type assertion to bypass complex type checking
  }

  // Apply sorting
  let sortCol;
  switch (sortBy) {
    case 'userrole':
      sortCol = usersTable.userrole;
      break;
    case 'email':
      sortCol = usersTable.email;
      break;
    case 'firstName':
      sortCol = usersTable.firstName;
      break;
    case 'lastName':
      sortCol = usersTable.lastName;
      break;
    default:
      sortCol = usersTable.createdAt;
  }
  
  const sortDirection = sortOrder === 'asc' ? asc(sortCol) : desc(sortCol);
  query = query.orderBy(sortDirection) as any; // Type assertion to bypass complex type checking

  // Calculate total count with the exact same predicate as the page query —
  // otherwise the filters and the pagination count disagree.
  let countQuery = db.select({ count: count() }).from(usersTable);
  if (userConditions.length > 0) {
    countQuery = countQuery.where(and(...userConditions)) as any;
  }
  const totalResult = await countQuery;
  const total = Number(totalResult[0]?.count ?? 0);

  // Calculate pagination
  const offset = (page - 1) * limit;
  const paginatedQuery = query.limit(limit).offset(offset);

  // Get users
  const rawUsers = await paginatedQuery;

  // Map to ensure non-null values for required fields with explicit type guard
  const users = rawUsers.map((user: any) => {
    // Explicitly check if user is defined and provide defaults
    if (!user) {
      return {
        id: '',
        email: '',
        firstName: '',
        lastName: '',
        userrole: '',
        accountStatus: 'active' as const,
        isActive: false,
        createdAt: new Date(),
        updatedAt: new Date(),
        interviewCount: 0,
        lastInterviewAt: undefined
      };
    }
    
    return {
      ...user,
      firstName: user.firstName || '',
      lastName: user.lastName || ''
    };
  });

  const totalPages = Math.ceil(total / limit);

  return {
    users: users as UserSummary[],
    total,
    page,
    limit,
    totalPages
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
      interviewCount: sql<number>`COALESCE((SELECT COUNT(*) FROM interviews WHERE interviews.user_id = users.id), 0)`.as('interviewCount'),
      lastInterviewAt: sql<Date | null>`(SELECT MAX(created_at) FROM interviews WHERE interviews.user_id = users.id)`.as('lastInterviewAt')
    })
    .from(usersTable)
    .where(eq(usersTable.id, userId))
    .limit(1);

  if (!result.length) {
    throw new AppError(
      "User not found",
      StatusCodes.NOT_FOUND,
      ErrorCodes.RESOURCE_NOT_FOUND,
      { isOperational: true }
    );
  }

  const user = result[0]!;
  return {
    ...user,
    firstName: user.firstName || '',
    lastName: user.lastName || ''
  } as UserSummary;
}

/**
 * Update user role
 */
export async function updateUserRole(userId: string, newRole: string, actorId: string): Promise<void> {
  const db = getPgDb();

  // Get current user and actor to check permissions
  const [currentUser, actor] = await Promise.all([
    db.select().from(usersTable).where(eq(usersTable.id, userId)).limit(1),
    db.select().from(usersTable).where(eq(usersTable.id, actorId)).limit(1)
  ]);

  if (!currentUser.length) {
    throw new AppError(
      "User not found",
      StatusCodes.NOT_FOUND,
      ErrorCodes.RESOURCE_NOT_FOUND,
      { isOperational: true }
    );
  }

  if (!actor.length) {
    throw new AppError(
      "Actor not found",
      StatusCodes.NOT_FOUND,
      ErrorCodes.RESOURCE_NOT_FOUND,
      { isOperational: true }
    );
  }

  const targetUser = currentUser[0]!;
  const actorUser = actor[0]!;

  if (!isUserRole(newRole)) {
    throw new AppError(
      `Invalid role "${newRole}". Expected one of: ${USER_ROLES.join(", ")}`,
      StatusCodes.BAD_REQUEST,
      ErrorCodes.VALIDATION_FAILED,
      { isOperational: true }
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
      { isOperational: true }
    );
  }

  // You cannot act on a peer or a superior — only the owner may touch owners.
  if (targetRank >= actorRank && !actorIsOwner) {
    throw new AppError(
      `Cannot modify a user ranked at or above your own role (${targetUser.userrole})`,
      StatusCodes.FORBIDDEN,
      ErrorCodes.AUTH_FORBIDDEN,
      { isOperational: true }
    );
  }

  // You cannot grant a role at or above your own — only the owner may grant owner.
  if (requestedRank >= actorRank && !actorIsOwner) {
    throw new AppError(
      `Cannot assign a role ranked at or above your own role (${newRole})`,
      StatusCodes.FORBIDDEN,
      ErrorCodes.AUTH_FORBIDDEN,
      { isOperational: true }
    );
  }

  // Perform the role update
  await db.update(usersTable)
    .set({ userrole: newRole }) // narrowed by isUserRole above
    .where(eq(usersTable.id, userId));
}

/**
 * Suspend a user
 */
export async function suspendUser(userId: string, reason: string = "Administrative action"): Promise<void> {
  const db = getPgDb();

  const user = await db.select().from(usersTable).where(eq(usersTable.id, userId)).limit(1);

  if (!user.length) {
    throw new AppError(
      "User not found",
      StatusCodes.NOT_FOUND,
      ErrorCodes.RESOURCE_NOT_FOUND,
      { isOperational: true }
    );
  }

  await db.update(usersTable)
    .set({ 
      accountStatus: "suspended",
      updatedAt: new Date()
    })
    .where(eq(usersTable.id, userId));
}

/**
 * Reinstate a suspended user
 */
export async function reinstateUser(userId: string): Promise<void> {
  const db = getPgDb();

  const user = await db.select().from(usersTable).where(eq(usersTable.id, userId)).limit(1);

  if (!user.length) {
    throw new AppError(
      "User not found",
      StatusCodes.NOT_FOUND,
      ErrorCodes.RESOURCE_NOT_FOUND,
      { isOperational: true }
    );
  }

  await db.update(usersTable)
    .set({ 
      accountStatus: "active",
      updatedAt: new Date()
    })
    .where(eq(usersTable.id, userId));
}

/**
 * List interviews with pagination and filtering
 */
export async function listInterviews(options: PaginationOptions & Partial<InterviewListFilter>): Promise<{
  interviews: InterviewSummary[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}> {
  const db = getPgDb();
  const { page, limit, search, status, userId, sortBy, sortOrder } = options;

  // Build query with joins
  let query = db
    .select({
      id: interviewsTable.id,
      title: interviewsTable.interviewTitle,
      status: interviewsTable.interviewStatus,
      userId: interviewsTable.userId,
      userName: sql<string>`COALESCE(CONCAT(${usersTable.firstName}, ' ', ${usersTable.lastName}), '')`.as('userName'),
      userEmail: sql<string>`COALESCE(${usersTable.email}, '')`.as('userEmail'), // Make sure email is never null
      createdAt: interviewsTable.createdAt,
      updatedAt: interviewsTable.updatedAt
    })
    .from(interviewsTable)
    .leftJoin(usersTable, eq(interviewsTable.userId, usersTable.id)) as any; // Type assertion to bypass complex type checking

  // Apply filters through one combined predicate: Drizzle's `.where()` replaces
  // the previous predicate, so separate calls silently dropped the status filter
  // as soon as a userId was supplied (and vice versa).
  const interviewConditions: SQL[] = [];
  if (search) {
    // Free-text search covers the title and the owning user (name + email),
    // matching what the admin table renders.
    interviewConditions.push(
      or(
        ilike(interviewsTable.interviewTitle, `%${search}%`),
        ilike(usersTable.email, `%${search}%`),
        sql`COALESCE(CONCAT(${usersTable.firstName}, ' ', ${usersTable.lastName}), '') ILIKE ${`%${search}%`}`
      ) as SQL
    );
  }
  if (status) {
    interviewConditions.push(eq(interviewsTable.interviewStatus, status as any) as SQL); // Type assertion for enum
  }
  if (userId) {
    interviewConditions.push(eq(interviewsTable.userId, userId) as SQL);
  }
  if (interviewConditions.length > 0) {
    query = query.where(and(...interviewConditions)) as any; // Type assertion to bypass complex type checking
  }

  // Apply sorting
  let sortCol;
  switch (sortBy) {
    case 'status':
      sortCol = interviewsTable.interviewStatus;
      break;
    case 'title':
      sortCol = interviewsTable.interviewTitle;
      break;
    case 'userEmail':
      sortCol = sql<string>`COALESCE(${usersTable.email}, '')`;
      break;
    default:
      sortCol = interviewsTable.createdAt;
  }
  
  const sortDirection = sortOrder === 'asc' ? asc(sortCol) : desc(sortCol);
  query = query.orderBy(sortDirection) as any; // Type assertion to bypass complex type checking

  // Calculate total count with the exact same predicate as the page query —
  // otherwise the filters and the pagination count disagree.
  let countQuery = db
    .select({ count: count() })
    .from(interviewsTable)
    .leftJoin(usersTable, eq(interviewsTable.userId, usersTable.id));

  if (interviewConditions.length > 0) {
    countQuery = countQuery.where(and(...interviewConditions)) as any;
  }

  const totalResult = await countQuery;
  const total = Number(totalResult[0]?.count ?? 0);

  // Calculate pagination
  const offset = (page - 1) * limit;
  const paginatedQuery = query.limit(limit).offset(offset);

  // Get interviews
  const rawInterviews = await paginatedQuery;

  // Map to ensure non-null values for required fields with explicit type guard
  const interviews = rawInterviews.map((interview: any) => {
    // Explicitly check if interview is defined and provide defaults
    if (!interview) {
      return {
        id: '',
        title: '',
        status: '',
        userId: '',
        userName: '',
        userEmail: '',
        createdAt: new Date(),
        updatedAt: new Date()
      };
    }
    
    return {
      ...interview,
      userEmail: interview.userEmail || ''
    };
  });

  const totalPages = Math.ceil(total / limit);

  return {
    interviews: interviews as InterviewSummary[],
    total,
    page,
    limit,
    totalPages
  };
}

/**
 * Get interview detail by ID
 */
export async function getInterviewDetail(interviewId: string): Promise<any> {
  const db = getPgDb();

  const result = await db
    .select({
      id: interviewsTable.id,
      title: interviewsTable.interviewTitle,
      description: interviewsTable.interviewDescription,
      status: interviewsTable.interviewStatus,
      userId: interviewsTable.userId,
      userName: sql<string>`COALESCE(CONCAT(${usersTable.firstName}, ' ', ${usersTable.lastName}), '')`.as('userName'),
      userEmail: sql<string>`COALESCE(${usersTable.email}, '')`.as('userEmail'),
      createdAt: interviewsTable.createdAt,
      updatedAt: interviewsTable.updatedAt,
      scheduledAt: interviewsTable.interviewScheduledDate,
      startedAt: interviewsTable.interviewStartedAt,
      duration: interviewsTable.interviewDuration
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
      { isOperational: true }
    );
  }

  const interview = result[0]!;
  return {
    ...interview,
    userEmail: interview.userEmail || ''
  };
}

/**
 * Get admin overview statistics
 */
export async function getOverviewStats(period: string = '30d'): Promise<{
  totalUsers: number;
  totalInterviews: number;
  interviewsByStatus: Record<string, number>;
  recentSignups: number;
  activeUsers: number;
}> {
  const db = getPgDb();
  
  // Parse the period to calculate the date threshold
  const now = new Date();
  let startDate = new Date(now);
  
  switch (period) {
    case '7d':
      startDate.setDate(now.getDate() - 7);
      break;
    case '30d':
      startDate.setDate(now.getDate() - 30);
      break;
    case '90d':
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
      count: count()
    })
    .from(interviewsTable)
    .groupBy(interviewsTable.interviewStatus);

  const interviewsByStatus: Record<string, number> = {};
  interviewsByStatusResult.forEach(row => {
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
    if (firstRow && typeof firstRow === 'object' && 'user_count' in firstRow) {
      activeUsers = Number((firstRow as any).user_count) || 0;
    }
  } else if (typeof activeUsersResult === 'object' && activeUsersResult && 'rows' in activeUsersResult && Array.isArray(activeUsersResult.rows) && activeUsersResult.rows.length > 0) {
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
    activeUsers
  };
}