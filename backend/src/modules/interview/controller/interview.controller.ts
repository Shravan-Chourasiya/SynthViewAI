import type { NextFunction, Request, Response } from "express";
import type { AuthenticatedRequest } from "../../../types/request.js";
import type { SuccessResponse } from "../../../types/response.js";
import { StatusCodes } from "http-status-codes";
import {
  createInterviewService,
  getAllInterviewsService,
  getInterviewByIdService,
  deleteInterviewService,
  getInterviewMetricsService,
  getInterviewHistoryService,
  getInterviewReportService,
  getResumableInterviewsService,
  startInterviewService,
  pauseInterviewService,
  resumeInterviewService,
  cancelInterviewService,
  endInterviewService,
  submitAnswerService,
  createShareLinkService,
  getSharedReportService,
  revokeShareTokenService,
} from "../services/interview.service.js";

export const createInterviewController = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const authreq = req as AuthenticatedRequest;
    const data = await createInterviewService(authreq, req.body);
    const response: SuccessResponse = {
      success: true,
      statusCode: StatusCodes.OK,
      message: "Interview created successfully.",
      data,
    };
    res.status(StatusCodes.OK).json(response);
  } catch (error) {
    next(error);
  }
};

export const getAllInterviewsController = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const authreq = req as AuthenticatedRequest;
    const data = await getAllInterviewsService(authreq);
    const response: SuccessResponse = {
      success: true,
      statusCode: StatusCodes.OK,
      message: "All interviews retrieved successfully.",
      data,
    };
    res.status(StatusCodes.OK).json(response);
  } catch (error) {
    next(error);
  }
};

export const getInterviewByIdController = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const authreq = req as AuthenticatedRequest;
    const interviewId = req.params.id;
    const data = await getInterviewByIdService(authreq, String(interviewId));
    const response: SuccessResponse = {
      success: true,
      statusCode: StatusCodes.OK,
      message: "Interview retrieved successfully.",
      data,
    };
    res.status(StatusCodes.OK).json(response);
  } catch (error) {
    next(error);
  }
};

export const deleteInterviewController = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const authreq = req as AuthenticatedRequest;
    await deleteInterviewService(authreq, String(req.params.id));
    const response: SuccessResponse = {
      success: true,
      statusCode: StatusCodes.OK,
      message: "Interview deleted successfully.",
      data: null,
    };
    res.status(StatusCodes.OK).json(response);
  } catch (error) {
    next(error);
  }
};

export const startInterviewController = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const authreq = req as AuthenticatedRequest;
    const data = await startInterviewService(authreq, String(req.params.id));
    const response: SuccessResponse = {
      success: true,
      statusCode: StatusCodes.OK,
      message: "Interview started successfully.",
      data,
    };
    res.status(StatusCodes.OK).json(response);
  } catch (error) {
    next(error);
  }
};

export const pauseInterviewController = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const authreq = req as AuthenticatedRequest;
    const data = await pauseInterviewService(authreq, String(req.params.id));
    const response: SuccessResponse = {
      success: true,
      statusCode: StatusCodes.OK,
      message: "Interview paused successfully.",
      data,
    };
    res.status(StatusCodes.OK).json(response);
  } catch (error) {
    next(error);
  }
};

export const resumeInterviewController = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const authreq = req as AuthenticatedRequest;
    const data = await resumeInterviewService(authreq, String(req.params.id));
    const response: SuccessResponse = {
      success: true,
      statusCode: StatusCodes.OK,
      message: "Interview resumed successfully.",
      data,
    };
    res.status(StatusCodes.OK).json(response);
  } catch (error) {
    next(error);
  }
};

export const cancelInterviewController = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const authreq = req as AuthenticatedRequest;
    const data = await cancelInterviewService(authreq, String(req.params.id));
    const response: SuccessResponse = {
      success: true,
      statusCode: StatusCodes.OK,
      message: "Interview cancelled successfully.",
      data,
    };
    res.status(StatusCodes.OK).json(response);
  } catch (error) {
    next(error);
  }
};

export const endInterviewController = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const authreq = req as AuthenticatedRequest;
    const data = await endInterviewService(authreq, String(req.params.id));
    const response: SuccessResponse = {
      success: true,
      statusCode: StatusCodes.OK,
      message: "Interview ended successfully.",
      data,
    };
    res.status(StatusCodes.OK).json(response);
  } catch (error) {
    next(error);
  }
};

export const getResumableInterviewsController = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const authreq = req as AuthenticatedRequest;
    const data = await getResumableInterviewsService(authreq);
    const response: SuccessResponse = {
      success: true,
      statusCode: StatusCodes.OK,
      message: "Resumable interviews retrieved successfully.",
      data,
    };
    res.status(StatusCodes.OK).json(response);
  } catch (error) {
    next(error);
  }
};

export const getInterviewHistoryController = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const authreq = req as AuthenticatedRequest;
    const data = await getInterviewHistoryService(authreq, String(req.params.id));
    const response: SuccessResponse = {
      success: true,
      statusCode: StatusCodes.OK,
      message: "Interview history retrieved successfully.",
      data,
    };
    res.status(StatusCodes.OK).json(response);
  } catch (error) {
    next(error);
  }
};

export const submitAnswerController = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const authreq = req as AuthenticatedRequest;
    const data = await submitAnswerService(authreq, String(req.params.id), req.body);
    const response: SuccessResponse = {
      success: true,
      statusCode: StatusCodes.OK,
      message: "Answer submitted successfully.",
      data,
    };
    res.status(StatusCodes.OK).json(response);
  } catch (error) {
    next(error);
  }
};

export const getInterviewMetricsController = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const authreq = req as AuthenticatedRequest;
    const interviewId = req.params.id;
    const data = await getInterviewMetricsService(authreq, String(interviewId));
    const response: SuccessResponse = {
      success: true,
      statusCode: StatusCodes.OK,
      message: "Interview metrics retrieved successfully.",
      data,
    };
    res.status(StatusCodes.OK).json(response);
  } catch (error) {
    next(error);
  }
};

export const getInterviewReportController = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const authreq = req as AuthenticatedRequest;
    const data = await getInterviewReportService(authreq, String(req.params.id));
    const response: SuccessResponse = {
      success: true,
      statusCode: StatusCodes.OK,
      message: "Interview report retrieved successfully.",
      data,
    };
    res.status(StatusCodes.OK).json(response);
  } catch (error) {
    next(error);
  }
};

/**
 * POST /interviews/:id/share — owner-only; returns the token + shareable URL.
 */
export const createShareLinkController = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const authreq = req as AuthenticatedRequest;
    const data = await createShareLinkService(authreq, String(req.params.id));
    const response: SuccessResponse = {
      success: true,
      statusCode: StatusCodes.CREATED,
      message: "Share link created successfully.",
      data,
    };
    res.status(StatusCodes.CREATED).json(response);
  } catch (error) {
    next(error);
  }
};

/**
 * GET /interviews/shared/:token — public, unauthenticated by design.
 */
export const getSharedReportController = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const data = await getSharedReportService(String(req.params.token));
    const response: SuccessResponse = {
      success: true,
      statusCode: StatusCodes.OK,
      message: "Shared report retrieved successfully.",
      data,
    };
    res.status(StatusCodes.OK).json(response);
  } catch (error) {
    next(error);
  }
};

/**
 * POST /interviews/:id/share/revoke — owner-only; blacklists the token.
 */
export const revokeShareLinkController = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const authreq = req as AuthenticatedRequest;
    const { token } = req.body as { token: string };
    const data = await revokeShareTokenService(authreq, String(req.params.id), token);
    const response: SuccessResponse = {
      success: true,
      statusCode: StatusCodes.OK,
      message: "Share link revoked successfully.",
      data,
    };
    res.status(StatusCodes.OK).json(response);
  } catch (error) {
    next(error);
  }
};
