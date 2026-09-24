import type { Request, Response, NextFunction } from "express";
import { StatusCodes } from "http-status-codes";
import { submitContactMessage } from "../services/contact.service.js";
import type { SuccessResponse } from "../../../types/response.js";
import type { ContactSubmission } from "../zodschemas/contact.zschema.js";

/**
 * POST /contact
 *
 * Public and unauthenticated. The request body was already validated by
 * `validateBody(contactSubmissionSchema)`.
 */
export const submitContactMessageController = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const data = await submitContactMessage(req.body as ContactSubmission, {
      ipAddress: req.ip ?? "unknown",
      userAgent: String(req.headers["user-agent"] ?? "unknown"),
    });

    const response: SuccessResponse = {
      success: true,
      statusCode: StatusCodes.OK,
      message: "Thanks for reaching out — we'll reply within two business days.",
      data,
    };
    res.status(StatusCodes.OK).json(response);
  } catch (error) {
    next(error);
  }
};
