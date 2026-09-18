import { describe, it, expect, vi, beforeEach } from "vitest";
import { forgotPasswordService } from "../src/modules/auth/services/auth.service.js";
import { AppError } from "../src/utils/appError.js";
import { StatusCodes } from "http-status-codes";
import { otpService } from "../src/services/redis.service.js";

// Mock the database
vi.mock("../src/db/postgres.init.js", () => ({
  getPgDb: vi.fn(),
}));

// Mock email service
vi.mock("../src/services/nodemailer.service.js", () => ({
  sendPasswordResetEmail: vi.fn(),
}));

// Mock redis service
vi.mock("../src/services/redis.service.js", () => ({
  otpService: {
    storeOTP: vi.fn(),
  },
}));

describe("forgotPasswordService", () => {
  let mockDb: any;

  const mockDbSetup = (userResult: any[] = [{ id: "user-id", email: "user@example.com" }]) => {
    mockDb = {
      select: vi.fn(),
    };

    const mockSelectInterface = {
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue(userResult),
    };
    
    mockDb.select.mockReturnValue(mockSelectInterface);
    
    vi.mocked(require("../src/db/postgres.init.js").getPgDb).mockReturnValue(mockDb);
  };

// ── forgotPasswordService ─────────────────────────────────────────────────────

describe("forgotPasswordService", () => {
  beforeEach(() => {
    mockDbSetup();
    vi.clearAllMocks();
  });

  it("resolves without error when email exists and email is sent", async () => {
    mockDbSetup([{ id: "user-id", email: "user@example.com" }]);
    
    vi.mocked(require("../src/services/nodemailer.service.js").sendPasswordResetEmail)
      .mockResolvedValue({ success: true });

    await expect(forgotPasswordService({ email: "user@example.com" })).resolves.toBeUndefined();
  });

  it("generates and stores password reset token", async () => {
    mockDbSetup([{ id: "user-id", email: "user@example.com" }]);
    
    vi.mocked(require("../src/services/nodemailer.service.js").sendPasswordResetEmail)
      .mockResolvedValue({ success: true });

    await forgotPasswordService({ email: "user@example.com" });

    expect(otpService.storeOTP).toHaveBeenCalledWith(
      "user@example.com",
      expect.any(String), // OTP
      "FORGOT_PASSWORD",
      expect.any(Number), // TTL
      expect.any(String), // JSON payload with userId
    );
  });

  it("sends password reset email with the generated token", async () => {
    mockDbSetup([{ id: "user-id", email: "user@example.com" }]);
    
    vi.mocked(require("../src/services/nodemailer.service.js").sendPasswordResetEmail)
      .mockResolvedValue({ success: true });

    await forgotPasswordService({ email: "user@example.com" });

    expect(require("../src/services/nodemailer.service.js").sendPasswordResetEmail)
      .toHaveBeenCalledWith("user@example.com", expect.any(String));
  });

  it("does not throw when email does not exist (silent failure for security)", async () => {
    mockDbSetup([]); // User not found
    
    await expect(forgotPasswordService({ email: "nonexistent@example.com" })).resolves.toBeUndefined();
  });

  it("does not send email when user not found", async () => {
    mockDbSetup([]); // User not found
    
    await forgotPasswordService({ email: "nonexistent@example.com" });

    expect(require("../src/services/nodemailer.service.js").sendPasswordResetEmail)
      .not.toHaveBeenCalled();
  });

  it("throws INTERNAL_SERVER_ERROR when email sending fails", async () => {
    mockDbSetup([{ id: "user-id", email: "user@example.com" }]);
    
    vi.mocked(require("../src/services/nodemailer.service.js").sendPasswordResetEmail)
      .mockResolvedValue({ success: false, error: "SMTP error" });

    await expect(forgotPasswordService({ email: "user@example.com" })).rejects.toMatchObject({
      statusCode: StatusCodes.INTERNAL_SERVER_ERROR,
      errorCode: "INTERNAL_SERVER_ERROR",
    });
  });

  it("throws INTERNAL_SERVER_ERROR when DB update fails", async () => {
    // Create a mock that throws an error
    const mockSelectInterface = {
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockRejectedValue(new Error("Database error")),
    };
    
    const mockDbWithError = {
      select: vi.fn().mockReturnValue(mockSelectInterface),
    };
    
    vi.mocked(require("../src/db/postgres.init.js").getPgDb).mockReturnValue(mockDbWithError);

    await expect(forgotPasswordService({ email: "user@example.com" })).rejects.toMatchObject({
      statusCode: StatusCodes.INTERNAL_SERVER_ERROR,
      errorCode: "INTERNAL_SERVER_ERROR",
    });
  });
});