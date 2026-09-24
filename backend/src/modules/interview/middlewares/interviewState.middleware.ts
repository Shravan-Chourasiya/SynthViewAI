import type { Request, Response, NextFunction } from "express";
import { StatusCodes } from "http-status-codes";
import { AppError } from "../../../utils/AppError.js";
import { ErrorCodes } from "../../../constants/errorCodes.js";
import type { AuthenticatedRequest } from "../../../types/request.js";
import type { interviewStatusEnum } from "../schemas/interview.schema.js";

type InterviewStatus = (typeof interviewStatusEnum.enumValues)[number];

/**
 * Must be placed after requireOwnership on the same route.
 * requireOwnership already fetches the interview and attaches it to req.resource.
 * This middleware reads req.resource and rejects the request if the interview's
 * current status is not in the allowedStatuses list.
 */
export function requireInterviewState(...allowedStatuses: InterviewStatus[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const authReq = req as AuthenticatedRequest;
    const interview = authReq.resource as { interviewStatus: string } | undefined;

    if (!interview) {
      return next(
        new AppError("Interview not found", StatusCodes.NOT_FOUND, ErrorCodes.INTERVIEW_NOT_FOUND, {
          isOperational: true,
        }),
      );
    }

    if (!allowedStatuses.includes(interview.interviewStatus as InterviewStatus)) {
      return next(
        new AppError(
          `Interview must be in one of [${allowedStatuses.join(", ")}] to perform this action (current: ${interview.interviewStatus})`,
          StatusCodes.CONFLICT,
          ErrorCodes.INTERVIEW_INVALID_STATE,
          { isOperational: true },
        ),
      );
    }

    next();
  };
}
