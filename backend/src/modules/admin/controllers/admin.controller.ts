import type { Request, Response, NextFunction } from "express";
import type { z } from "zod";
import type { updateUserRoleSchema, suspendUserSchema } from "../zodschemas/admin.zschema.js";
import {
  listUsers,
  getUserById,
  updateUserRole,
  suspendUser,
  reinstateUser,
  listInterviews,
  getInterviewDetail,
  getOverviewStats,
} from "../services/admin.service.js";
import type { SuccessResponse } from "../../../types/response.js";
import type { AuthenticatedRequest } from "../../../types/request.js";

/**
 * `validateQuery` attaches the parsed query to `req.validatedQuery`. Express's
 * own `Request` type doesn't declare it, so read it through this narrow shape
 * instead of casting the request to `any` in every handler.
 */
function getValidatedQuery(req: Request): Record<string, unknown> {
  const validated = (req as Request & { validatedQuery?: Record<string, unknown> }).validatedQuery;
  return validated ?? req.query;
}

/**
 * GET /admin/users
 * List all users with pagination and filtering
 */
export const listUsersController = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    // Use validated query data if available, otherwise fall back to original query
    const { page, limit, search, role, sortBy, sortOrder } = getValidatedQuery(req);

    const result = await listUsers({
      page: page ? parseInt(page as string, 10) : 1,
      limit: limit ? parseInt(limit as string, 10) : 10,
      // Optional fields are spread conditionally: `exactOptionalPropertyTypes`
      // rejects an explicit `undefined` for a `prop?: string` target.
      ...(search ? { search: search as string } : {}),
      ...(role ? { role: role as string } : {}),
      ...(sortBy ? { sortBy: sortBy as string } : {}),
      ...(sortOrder ? { sortOrder: sortOrder as "asc" | "desc" } : {}),
    });

    const response: SuccessResponse = {
      success: true,
      statusCode: 200,
      message: "Users retrieved successfully",
      data: result,
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
  next: NextFunction,
): Promise<void> => {
  try {
    const { id: userId } = req.params;

    const user = await getUserById(userId);

    const response: SuccessResponse = {
      success: true,
      statusCode: 200,
      message: "User retrieved successfully",
      data: user,
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
  req: Request<{ id: string }, unknown, z.infer<typeof updateUserRoleSchema>>,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const { id: userId } = req.params;
    const { newRole } = req.body;

    // `requireAuth` has already attached `auth`; intersect it with the typed
    // request so the actor id is read without an `any` cast.
    const { auth } = req as typeof req & AuthenticatedRequest;
    const actorId = auth.userId;

    await updateUserRole(userId, newRole, actorId);

    const response: SuccessResponse = {
      success: true,
      statusCode: 200,
      message: "User role updated successfully",
      data: null,
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
  req: Request<{ id: string }, unknown, z.infer<typeof suspendUserSchema>>,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const { id: userId } = req.params;
    const { reason } = req.body;

    await suspendUser(userId, reason);

    const response: SuccessResponse = {
      success: true,
      statusCode: 200,
      message: "User suspended successfully",
      data: null,
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
  next: NextFunction,
): Promise<void> => {
  try {
    const { id: userId } = req.params;

    await reinstateUser(userId);

    const response: SuccessResponse = {
      success: true,
      statusCode: 200,
      message: "User reinstated successfully",
      data: null,
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
  next: NextFunction,
): Promise<void> => {
  try {
    // Use validated query data if available, otherwise fall back to original query
    const { page, limit, search, status, userId, sortBy, sortOrder } = getValidatedQuery(req);

    const result = await listInterviews({
      page: page ? parseInt(page as string, 10) : 1,
      limit: limit ? parseInt(limit as string, 10) : 10,
      // `search` must be forwarded here or the free-text filter is silently
      // dropped before the service ever sees it (the users controller already
      // does this — interviews was the odd one out).
      ...(search ? { search: search as string } : {}),
      ...(status ? { status: status as string } : {}),
      ...(userId ? { userId: userId as string } : {}),
      ...(sortBy ? { sortBy: sortBy as string } : {}),
      ...(sortOrder ? { sortOrder: sortOrder as "asc" | "desc" } : {}),
    });

    const response: SuccessResponse = {
      success: true,
      statusCode: 200,
      message: "Interviews retrieved successfully",
      data: result,
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
  next: NextFunction,
): Promise<void> => {
  try {
    const { id: interviewId } = req.params;

    // The service returns an untyped row; annotate it as `unknown` so the
    // pass-through response stays out of the unsafe-assignment rule.
    const interview: unknown = await getInterviewDetail(interviewId);

    const response: SuccessResponse = {
      success: true,
      statusCode: 200,
      message: "Interview retrieved successfully",
      data: interview,
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
  next: NextFunction,
): Promise<void> => {
  try {
    // Use validated query data if available, otherwise fall back to original query
    const { period } = getValidatedQuery(req);

    const stats = await getOverviewStats((period as string) ?? "30d");

    const response: SuccessResponse = {
      success: true,
      statusCode: 200,
      message: "Overview statistics retrieved successfully",
      data: stats,
    };

    res.status(200).json(response);
  } catch (error) {
    next(error);
  }
};
