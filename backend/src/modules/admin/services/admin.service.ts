import { and, eq, ilike, or, desc, asc, gt, gte, lt, lte, count, sql } from "drizzle-orm";
import { getPgDb } from "../../../db/postgres.init.js";
import { usersTable, userRoleEnum } from "../../auth/schemas/user.schema.js";
import { interviewsTable, interviewStatusEnum } from "../../interview/schemas/interview.schema.js";
import { interviewResultsTable } from "../../interview/schemas/result.schema.js";
import { AppError } from "../../../utils/appError.js";
import { ErrorCodes } from "../../../constants/errorCodes.js";
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
      createdAt: usersTable.createdAt,
      updatedAt: usersTable.updatedAt,
      interviewCount: sql<number>`COALESCE((SELECT COUNT(*) FROM interviews WHERE interviews.user_id = users.id), 0)`.as('interviewCount'),
      lastInterviewAt: sql<Date | null>`(SELECT MAX(created_at) FROM interviews WHERE interviews.user_id = users.id)`.as('lastInterviewAt')
    })
    .from(usersTable) as any; // Type assertion to bypass complex type checking

  // Apply filters
  if (search) {
    query = query.where(
      or(
        ilike(usersTable.email, `%${search}%`),
        ilike(usersTable.firstName, `%${search}%`),
        ilike(usersTable.lastName, `%${search}%`)
      )
    ) as any; // Type assertion to bypass complex type checking
  }

  if (role) {
    query = query.where(eq(usersTable.userrole, role as any)) as any; // Type assertion for enum
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

  // Calculate total count with same filters
  let countQuery = db.select({ count: count() }).from(usersTable);
  if (search) {
    countQuery = countQuery.where(
      or(
        ilike(usersTable.email, `%${search}%`),
        ilike(usersTable.firstName, `%${search}%`),
        ilike(usersTable.lastName, `%${search}%`)
      )
    ) as any;
  }
  if (role) {
    countQuery = countQuery.where(eq(usersTable.userrole, role as any)) as any;
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

  // Only owners can modify owner roles
  // Only owners can promote/demote admins
  if (targetUser.userrole === 'owner') {
    if (actorUser.userrole !== 'owner') {
      throw new AppError(
        "Only owners can modify owner roles",
        StatusCodes.FORBIDDEN,
        ErrorCodes.AUTH_FORBIDDEN,
        { isOperational: true }
      );
    }
  } else if (targetUser.userrole === 'admin' || newRole === 'admin') {
    if (actorUser.userrole !== 'owner') {
      throw new AppError(
        "Only owners can manage admin roles",
        StatusCodes.FORBIDDEN,
        ErrorCodes.AUTH_FORBIDDEN,
        { isOperational: true }
      );
    }
  }

  // Perform the role update
  await db.update(usersTable)
    .set({ userrole: newRole as any }) // Type assertion for enum
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
  const { page, limit, status, userId, sortBy, sortOrder } = options;

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

  // Apply filters
  if (status) {
    query = query.where(eq(interviewsTable.interviewStatus, status as any)) as any; // Type assertion for enum
  }

  if (userId) {
    query = query.where(eq(interviewsTable.userId, userId)) as any;
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

  // Calculate total count with same filters
  let countQuery = db
    .select({ count: count() })
    .from(interviewsTable)
    .leftJoin(usersTable, eq(interviewsTable.userId, usersTable.id));

  if (status) {
    countQuery = countQuery.where(eq(interviewsTable.interviewStatus, status as any)) as any;
  }

  if (userId) {
    countQuery = countQuery.where(eq(interviewsTable.userId, userId)) as any;
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