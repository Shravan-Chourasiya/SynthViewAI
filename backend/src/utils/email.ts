import { StatusCodes } from "http-status-codes";
import { AppError } from "./appError.js";
import { ErrorCodes } from "../constants/errorCodes.js";
import { logger } from "./logger.js";

export const getRandomOtp = (length = 6): string => {
  const max = 10;
  const limit = 256 - (256 % max);
  const result: string[] = [];
  while (result.length < length) {
    const bytes = crypto.getRandomValues(new Uint8Array(length * 2));
    for (const b of bytes) {
      if (result.length === length) break;
      if (b < limit) result.push((b % max).toString());
    }
  }
  return result.join("");
};

export const getEmailTemplate = (otp: string, emailto: string, subject: string): string => {
  return `<!DOCTYPE html>
<html>
  <head><title>${subject}</title></head>
  <body>
    <h1>${subject}</h1>
    <p>Hello <strong>${emailto}</strong>,</p>
    <p>Your one-time password (OTP) is: <strong>${otp}</strong></p>
    <p>This OTP is valid for a limited time. Do not share it with anyone.</p>
  </body>
</html>`;
};

export const handlerNodeMailerError = (error: unknown): never => {
  // Pino serializes Error instances under the conventional `err` key. This
  // preserves the provider error/message for diagnostics without exposing it
  // in the HTTP response.
  logger.error({ err: error }, "Nodemailer error occurred");
  throw new AppError(
    "Failed to send email. Please try again later.",
    StatusCodes.INTERNAL_SERVER_ERROR,
    ErrorCodes.INTERNAL_SERVER_ERROR,
    { isOperational: true },
  );
};
