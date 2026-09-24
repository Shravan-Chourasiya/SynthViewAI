import { describe, it, expect } from "vitest";
import { getRandomOtp, handlerNodeMailerError } from "../src/utils/email.js";
import { AppError } from "../src/utils/AppError.js";
import { ErrorCodes } from "../src/constants/errorCodes.js";
import { StatusCodes } from "http-status-codes";

describe("getRandomOtp", () => {
  it("returns a string of the requested length", () => {
    expect(getRandomOtp(6)).toHaveLength(6);
    expect(getRandomOtp(4)).toHaveLength(4);
    expect(getRandomOtp(8)).toHaveLength(8);
  });

  it("returns only digit characters", () => {
    for (let i = 0; i < 20; i++) {
      expect(getRandomOtp(6)).toMatch(/^\d+$/);
    }
  });

  it("defaults to length 6", () => {
    expect(getRandomOtp()).toHaveLength(6);
  });

  it("produces different values across calls", () => {
    const results = new Set(Array.from({ length: 20 }, () => getRandomOtp(6)));
    // With 1,000,000 possible 6-digit OTPs, 20 calls producing all identical is astronomically unlikely
    expect(results.size).toBeGreaterThan(1);
  });

  it("all 10 digits appear across many samples (no bias)", () => {
    const counts = new Array<number>(10).fill(0);
    for (let i = 0; i < 1000; i++) {
      for (const ch of getRandomOtp(6)) {
        counts[Number(ch)]!++;
      }
    }
    // Each digit should appear at least once across 6000 samples
    for (const count of counts) {
      expect(count).toBeGreaterThan(0);
    }
  });
});

describe("handlerNodeMailerError", () => {
  it("throws an AppError", () => {
    expect(() => handlerNodeMailerError(new Error("smtp failure"))).toThrow(AppError);
  });

  it("throws with INTERNAL_SERVER_ERROR code", () => {
    try {
      handlerNodeMailerError(new Error("smtp failure"));
    } catch (err) {
      expect(err).toBeInstanceOf(AppError);
      expect((err as AppError).errorCode).toBe(ErrorCodes.INTERNAL_SERVER_ERROR);
    }
  });

  it("throws with 500 status code", () => {
    try {
      handlerNodeMailerError(new Error("smtp failure"));
    } catch (err) {
      expect((err as AppError).statusCode).toBe(StatusCodes.INTERNAL_SERVER_ERROR);
    }
  });

  it("marks the error as operational", () => {
    try {
      handlerNodeMailerError(new Error("smtp failure"));
    } catch (err) {
      expect((err as AppError).isOperational).toBe(true);
    }
  });
});
