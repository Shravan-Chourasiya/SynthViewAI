import type { Request, Response, NextFunction } from "express";
import { z } from "zod";
import type { 
  userListQuerySchema, 
  updateUserRoleSchema, 
  suspendUserSchema, 
  interviewListQuerySchema,
  adminOverviewQuerySchema
} from "../zodschemas/admin.zschema.js";
import { 
  listUsers, 
  getUserById, 
  updateUserRole, 
  suspendUser, 
  reinstateUser, 
  listInterviews, 
  getInterviewDetail,
  getOverviewStats
} from "../services/admin.service.js";
import type { SuccessResponse } from "../../../types/response.js";
import type { AuthenticatedRequest } from "../../../types/request.js";

/**
 * GET /admin/users
 * List all users with pagination and filtering
 */
export const listUsersController = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    // Use validated query data if available, otherwise fall back to original query
    const queryData = (req as any).validatedQuery || req.query;
    const { page, limit, search, role, sortBy, sortOrder } = queryData;

    const result = await listUsers({
      page: page ? parseInt(page as string, 10) : 1,
      limit: limit ? parseInt(limit as string, 10) : 10,
      search: search as string | undefined,
      role: role as string | undefined,
      sortBy: sortBy as string | undefined,
      sortOrder: sortOrder as 'asc' | 'desc' | undefined
    } as any); // Using 'any' to bypass strict typing for optional properties

    const response: SuccessResponse = {
      success: true,
      statusCode: 200,
      message: "Users retrieved successfully",
      data: result
    };

    res.status(200).json(response);
  } catch (error) {
    next(error);
  }
};

/**
 * GET /admin/users/:id
 * Get a single user by ID
 */
export const getUserController = async (
  req: Request<{ id: string }>,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id: userId } = req.params;

    const user = await getUserById(userId);

    const response: SuccessResponse = {
      success: true,
      statusCode: 200,
      message: "User retrieved successfully",
      data: user
    };

    res.status(200).json(response);
  } catch (error) {
    next(error);
  }
};

/**
 * PATCH /admin/users/:id/role
 * Update user role
 */
export const updateUserRoleController = async (
  req: Request<{ id: string }, {}, z.infer<typeof updateUserRoleSchema>>,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id: userId } = req.params;
    const { newRole } = req.body;
    
    // Cast to AuthenticatedRequest to access auth property
    const authReq = req as unknown as AuthenticatedRequest;
    const actorId = authReq.auth!.userId;

    await updateUserRole(userId, newRole, actorId);

    const response: SuccessResponse = {
      success: true,
      statusCode: 200,
      message: "User role updated successfully",
      data: null
    };

    res.status(200).json(response);
  } catch (error) {
    next(error);
  }
};

/**
 * POST /admin/users/:id/suspend
 * Suspend a user
 */
export const suspendUserController = async (
  req: Request<{ id: string }, {}, z.infer<typeof suspendUserSchema>>,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id: userId } = req.params;
    const { reason } = req.body;

    await suspendUser(userId, reason);

    const response: SuccessResponse = {
      success: true,
      statusCode: 200,
      message: "User suspended successfully",
      data: null
    };

    res.status(200).json(response);
  } catch (error) {
    next(error);
  }
};

/**
 * POST /admin/users/:id/reinstate
 * Reinstate a suspended user
 */
export const reinstateUserController = async (
  req: Request<{ id: string }>,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id: userId } = req.params;

    await reinstateUser(userId);

    const response: SuccessResponse = {
      success: true,
      statusCode: 200,
      message: "User reinstated successfully",
      data: null
    };

    res.status(200).json(response);
  } catch (error) {
    next(error);
  }
};

/**
 * GET /admin/interviews
 * List all interviews with pagination and filtering
 */
export const listInterviewsController = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    // Use validated query data if available, otherwise fall back to original query
    const queryData = (req as any).validatedQuery || req.query;
    const { page, limit, status, userId, sortBy, sortOrder } = queryData;

    const result = await listInterviews({
      page: page ? parseInt(page as string, 10) : 1,
      limit: limit ? parseInt(limit as string, 10) : 10,
      status: status as string | undefined,
      userId: userId as string | undefined,
      sortBy: sortBy as string | undefined,
      sortOrder: sortOrder as 'asc' | 'desc' | undefined
    } as any); // Using 'any' to bypass strict typing for optional properties

    const response: SuccessResponse = {
      success: true,
      statusCode: 200,
      message: "Interviews retrieved successfully",
      data: result
    };

    res.status(200).json(response);
  } catch (error) {
    next(error);
  }
};

/**
 * GET /admin/interviews/:id
 * Get interview detail by ID
 */
export const getInterviewDetailController = async (
  req: Request<{ id: string }>,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id: interviewId } = req.params;

    const interview = await getInterviewDetail(interviewId);

    const response: SuccessResponse = {
      success: true,
      statusCode: 200,
      message: "Interview retrieved successfully",
      data: interview
    };

    res.status(200).json(response);
  } catch (error) {
    next(error);
  }
};

/**
 * GET /admin/overview
 * Get admin overview statistics
 */
export const getOverviewController = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    // Use validated query data if available, otherwise fall back to original query
    const queryData = (req as any).validatedQuery || req.query;
    const { period } = queryData;

    const stats = await getOverviewStats(period as string || '30d');

    const response: SuccessResponse = {
      success: true,
      statusCode: 200,
      message: "Overview statistics retrieved successfully",
      data: stats
    };

    res.status(200).json(response);
  } catch (error) {
    next(error);
  }
};