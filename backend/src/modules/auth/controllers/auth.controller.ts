import type { Request, Response, NextFunction } from "express";
import { StatusCodes } from "http-status-codes";
import { AppError } from "../../../utils/appError.js";
import { ErrorCodes } from "../../../constants/errorCodes.js";
import type { ValidatedRequest } from "../../../middlewares/zodValidator.middleware.js";
import type { AuthenticatedRequest } from "../../../types/request.js";
import type {
  RegisterInput,
  VerifyOtpInput,
  LoginInput,
  ForgotPasswordInput,
  ForgotPasswordOtpVerifyInput,
  RecoverAccountOtpInput,
  UpdatePasswordInput,
  UpdateEmailInput,
  UpdateProfileInput,
  EmailUpdateOtpVerifyInput,
} from "../zodschemas/auth.zschema.js";
import {
  registerUserService,
  verifyOtpService,
  loginService,
  refreshTokenService,
  logoutService,
  deleteAccountService,
  recoverAccountService,
  recoverAccountOtpService,
  forgotPasswordService,
  forgotPasswordOtpVerifyService,
  updatePasswordService,
  updateEmailService,
  emailUpdateOtpVerifyService,
  getMeService,
  updateProfileService,
  getSessionsService,
  deleteAllSessionsService,
  deleteSessionService,
} from "../services/auth.service.js";
import type { ErrorResponse, SuccessResponse } from "../../../types/response.js";
import { COOKIE_NAMES } from "../../../utils/token.util.js";
import { COOKIE_CONFIG, COOKIE_MAX_AGE } from "../../../constants/auth.constants.js";

// ── Helpers ───────────────────────────────────────────────────────────────────

function setAuthCookies(
  res: Response,
  accessToken: string,
  refreshToken: string,
  csrfToken: string,
  deviceId: string,
): void {
  res.cookie(COOKIE_NAMES.ACCESS, accessToken, {
    ...COOKIE_CONFIG.ACCESS,
    maxAge: COOKIE_MAX_AGE.ACCESS,
  });
  res.cookie(COOKIE_NAMES.REFRESH, refreshToken, {
    ...COOKIE_CONFIG.REFRESH,
    maxAge: COOKIE_MAX_AGE.REFRESH,
  });
  res.cookie(COOKIE_NAMES.CSRF, csrfToken, { ...COOKIE_CONFIG.CSRF, maxAge: COOKIE_MAX_AGE.CSRF });
  res.cookie(COOKIE_NAMES.DEVICE_ID, deviceId, {
    ...COOKIE_CONFIG.DEVICE_ID,
    httpOnly: false,
    maxAge: COOKIE_MAX_AGE.DEVICE_ID,
  });
}

function clearAuthCookies(res: Response): void {
  res.clearCookie(COOKIE_NAMES.ACCESS, COOKIE_CONFIG.ACCESS);
  res.clearCookie(COOKIE_NAMES.REFRESH, COOKIE_CONFIG.REFRESH);
  res.clearCookie(COOKIE_NAMES.DEVICE_ID, COOKIE_CONFIG.DEVICE_ID);
  // The CSRF cookie is set alongside the others, so it has to be cleared with
  // them — otherwise the token from the previous session survives logout and
  // the next login silently reuses a value the server no longer recognises.
  res.clearCookie(COOKIE_NAMES.CSRF, COOKIE_CONFIG.CSRF);
}

// ── Register ──────────────────────────────────────────────────────────────────

export const registerUserController = async (
  req: ValidatedRequest<RegisterInput>,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    await registerUserService(req.body);
    const response: SuccessResponse = {
      success: true,
      statusCode: StatusCodes.CREATED,
      message:
        "Registration successful. Please check your email for the OTP to verify your account.",
      data: null,
    };
    res.status(StatusCodes.CREATED).json(response);
  } catch (error) {
    next(error);
  }
};

// ── Verify Registration OTP ───────────────────────────────────────────────────

export const verifyOtpController = async (
  req: ValidatedRequest<VerifyOtpInput>,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    await verifyOtpService(req.body);
    const response: SuccessResponse = {
      success: true,
      statusCode: StatusCodes.OK,
      message: "Email verified successfully. Your account is now active.",
      data: null,
    };
    res.status(StatusCodes.OK).json(response);
  } catch (error) {
    next(error);
  }
};

// ── Login ─────────────────────────────────────────────────────────────────────

export const loginController = async (
  req: ValidatedRequest<LoginInput>,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const ipAddress = req.ip ?? req.socket.remoteAddress ?? "unknown";
    const userAgent = req.headers["user-agent"] ?? "unknown";
    const existingDeviceId = req.cookies?.[COOKIE_NAMES.DEVICE_ID] as string | undefined;

    const { accessToken, refreshToken, deviceId, csrfToken } = await loginService(
      req.body,
      ipAddress,
      userAgent,
      existingDeviceId,
    );

    setAuthCookies(res, accessToken, refreshToken, csrfToken, deviceId);

    const response: SuccessResponse = {
      success: true,
      statusCode: StatusCodes.OK,
      message: "Login successful.",
      data: null,
    };
    res.status(StatusCodes.OK).json(response);
  } catch (error) {
    next(error);
  }
};

// ── Token Refresh ─────────────────────────────────────────────────────────────

export const refreshTokenController = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const refreshToken = req.cookies?.[COOKIE_NAMES.REFRESH] as string | undefined;
    const deviceId = req.cookies?.[COOKIE_NAMES.DEVICE_ID] as string | undefined;

    if (!refreshToken) {
      throw new AppError(
        "No refresh token provided",
        StatusCodes.UNAUTHORIZED,
        ErrorCodes.AUTH_UNAUTHORIZED,
        { isOperational: true },
      );
    }

    const {
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
      csrfToken: newCsrfToken,
    } = await refreshTokenService(refreshToken);

    setAuthCookies(res, newAccessToken, newRefreshToken, newCsrfToken, deviceId ?? "");

    const response: SuccessResponse = {
      success: true,
      statusCode: StatusCodes.OK,
      message: "Tokens refreshed successfully.",
      data: null,
    };
    res.status(StatusCodes.OK).json(response);
  } catch (error) {
    next(error);
  }
};

// ── Logout ────────────────────────────────────────────────────────────────────

export const logoutController = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const authReq = req as AuthenticatedRequest;
    const refreshToken = req.cookies?.[COOKIE_NAMES.REFRESH] as string | undefined;

    if (!refreshToken) {
      throw new AppError(
        "No refresh token provided",
        StatusCodes.UNAUTHORIZED,
        ErrorCodes.AUTH_UNAUTHORIZED,
        { isOperational: true },
      );
    }

    await logoutService(authReq.auth.sessionId, authReq.auth.accessToken, refreshToken);

    clearAuthCookies(res);

    const response: SuccessResponse = {
      success: true,
      statusCode: StatusCodes.OK,
      message: "Logged out successfully.",
      data: null,
    };
    res.status(StatusCodes.OK).json(response);
  } catch (error) {
    next(error);
  }
};

// ── Delete Account ────────────────────────────────────────────────────────────

export const deleteAccountController = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const authReq = req as AuthenticatedRequest;
    const refreshToken = req.cookies?.[COOKIE_NAMES.REFRESH] as string | undefined;

    if (!refreshToken) {
      throw new AppError(
        "No refresh token provided",
        StatusCodes.UNAUTHORIZED,
        ErrorCodes.AUTH_UNAUTHORIZED,
        { isOperational: true },
      );
    }

    await deleteAccountService(authReq.auth.userId, authReq.auth.accessToken, refreshToken);

    clearAuthCookies(res);

    const response: SuccessResponse = {
      success: true,
      statusCode: StatusCodes.OK,
      message:
        "Account has been disabled. You have 30 days to recover it before permanent deletion.",
      data: null,
    };
    res.status(StatusCodes.OK).json(response);
  } catch (error) {
    next(error);
  }
};

// ── Recover Account — Send OTP ────────────────────────────────────────────────

export const recoverAccountController = async (
  req: ValidatedRequest<ForgotPasswordInput>,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    await recoverAccountService(req.body.email);
    const response: SuccessResponse = {
      success: true,
      statusCode: StatusCodes.OK,
      message: "If a disabled account exists for this email, a recovery OTP has been sent.",
      data: null,
    };
    res.status(StatusCodes.OK).json(response);
  } catch (error) {
    next(error);
  }
};

// ── Recover Account — Verify OTP ──────────────────────────────────────────────

export const recoverAccountOtpController = async (
  req: ValidatedRequest<RecoverAccountOtpInput>,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    await recoverAccountOtpService(req.body);
    const response: SuccessResponse = {
      success: true,
      statusCode: StatusCodes.OK,
      message: "Account recovered successfully. Please log in.",
      data: null,
    };
    res.status(StatusCodes.OK).json(response);
  } catch (error) {
    next(error);
  }
};

// ── Forgot Password — Send OTP ────────────────────────────────────────────────

export const forgotPasswordController = async (
  req: ValidatedRequest<ForgotPasswordInput>,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    await forgotPasswordService(req.body);
    const response: SuccessResponse = {
      success: true,
      statusCode: StatusCodes.OK,
      message: "If an account exists for this email, a password reset OTP has been sent.",
      data: null,
    };
    res.status(StatusCodes.OK).json(response);
  } catch (error) {
    next(error);
  }
};

// ── Forgot Password — Verify OTP + Reset ─────────────────────────────────────

export const forgotPasswordOtpVerifyController = async (
  req: ValidatedRequest<ForgotPasswordOtpVerifyInput>,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    await forgotPasswordOtpVerifyService(req.body);
    const response: SuccessResponse = {
      success: true,
      statusCode: StatusCodes.OK,
      message: "Password reset successfully. Please log in with your new password.",
      data: null,
    };
    res.status(StatusCodes.OK).json(response);
  } catch (error) {
    next(error);
  }
};

// ── Update Password — Send OTP ────────────────────────────────────────────────

export const updatePasswordController = async (
  req: ValidatedRequest<UpdatePasswordInput>,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    await updatePasswordService(req.body);
    const response: SuccessResponse = {
      success: true,
      statusCode: StatusCodes.OK,
      message: "Password reset successfully. Please log in with your new password.",
      data: null,
    };
    res.status(StatusCodes.OK).json(response);
  } catch (error) {
    next(error);
  }
};

// ── Update Email — Send OTP ────────────────────────────────────────────────

export const updateEmailController = async (
  req: ValidatedRequest<UpdateEmailInput>,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    await updateEmailService(req.body);
    const response: SuccessResponse = {
      success: true,
      statusCode: StatusCodes.OK,
      message: "Email updated successfully. Please verify your new email address.",
      data: null,
    };
    res.status(StatusCodes.OK).json(response);
  } catch (error) {
    next(error);
  }
};

// ── Email Update — Verify OTP + Reset ─────────────────────────────────────

export const emailUpdateOtpVerifyController = async (
  req: ValidatedRequest<EmailUpdateOtpVerifyInput>,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    await emailUpdateOtpVerifyService(req.body);
    const response: SuccessResponse = {
      success: true,
      statusCode: StatusCodes.OK,
      message: "Email updated successfully. Please log in with your new email address.",
      data: null,
    };
    res.status(StatusCodes.OK).json(response);
  } catch (error) {
    next(error);
  }
};

export const getMeController = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const authReq = req as AuthenticatedRequest;
    const user = await getMeService(authReq.auth.userId);
    const response: SuccessResponse = {
      success: true,
      statusCode: StatusCodes.OK,
      message: "User information retrieved successfully.",
      data: user,
    };
    res.status(StatusCodes.OK).json(response);
  } catch (error) {
    next(error);
  }
};

export const updateProfileController = async (
  req: ValidatedRequest<UpdateProfileInput>,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const authReq = req as AuthenticatedRequest;
    const user = await updateProfileService(authReq.auth.userId, req.body);
    const response: SuccessResponse = {
      success: true,
      statusCode: StatusCodes.OK,
      message: "Profile updated successfully.",
      data: user,
    };
    res.status(StatusCodes.OK).json(response);
  } catch (error) {
    next(error);
  }
};

export const getSessionsController = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const authReq = req as AuthenticatedRequest;
    const sessions = await getSessionsService(authReq.auth.userId);
    const response: SuccessResponse = {
      success: true,
      statusCode: StatusCodes.OK,
      message: "User sessions retrieved successfully.",
      data: sessions,
    };
    res.status(StatusCodes.OK).json(response);
  } catch (error) {
    next(error);
  }
};

export const deleteAllSessionsController = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const authReq = req as AuthenticatedRequest;
    await deleteAllSessionsService(authReq.auth.userId);
    const response: SuccessResponse = {
      success: true,
      statusCode: StatusCodes.OK,
      message: "All user sessions deleted successfully.",
      data: null,
    };
    res.status(StatusCodes.OK).json(response);
  } catch (error) {
    next(error);
  }
};

export const deleteSessionController = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const authReq = req as AuthenticatedRequest;
    const sessionId = req.params.id;
    if (!sessionId) {
      throw new AppError(
        "Session ID is required",
        StatusCodes.BAD_REQUEST,
        ErrorCodes.AUTH_INVALID_CREDENTIALS,
        { isOperational: true },
      );
    }
    await deleteSessionService(authReq.auth.userId, String(sessionId));
    const response: SuccessResponse = {
      success: true,
      statusCode: StatusCodes.OK,
      message: "User session deleted successfully.",
      data: null,
    };
    res.status(StatusCodes.OK).json(response);
  } catch (error) {
    next(error);
  }
};
