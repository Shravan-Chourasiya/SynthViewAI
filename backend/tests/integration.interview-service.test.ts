import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { setupTestEnvironment, resetDb, resetRedis } from "./helpers/containers.js";
import { interviewService } from "../src/modules/interview/services/interview.service.js";
import { InterviewStatus } from "../src/types/schemas.js";
import { AppError } from "../src/utils/AppError.js";

const { pool, redisClient } = await setupTestEnvironment();

describe("integration.interview-service", () => {
  beforeEach(async () => {
    await resetDb(pool);
    await resetRedis(redisClient);
  });

  afterEach(async () => {
    await resetDb(pool);
    await resetRedis(redisClient);
  });

  describe("createInterview", () => {
    it("creates a new interview with provided details", async () => {
      const interviewData = {
        candidateId: 1,
        jobId: 1,
        scheduledAt: new Date(Date.now() + 1000 * 60 * 60), // 1 hour from now
        interviewType: "technical",
      };

      const result = await interviewService.createInterview(interviewData);

      expect(result).toMatchObject({
        candidateId: 1,
        jobId: 1,
        interviewType: "technical",
        status: InterviewStatus.DRAFT,
      });
      expect(result.id).toBeDefined();
      expect(result.inviteToken).toBeDefined();
    });

    it("generates a unique invite token for each interview", async () => {
      const interviewData = {
        candidateId: 1,
        jobId: 1,
        scheduledAt: new Date(Date.now() + 1000 * 60 * 60),
        interviewType: "technical",
      };

      const result1 = await interviewService.createInterview(interviewData);
      const result2 = await interviewService.createInterview(interviewData);

      expect(result1.inviteToken).not.toBe(result2.inviteToken);
    });
  });

  describe("getInterviewByToken", () => {
    it("retrieves an interview by its invite token", async () => {
      const interviewData = {
        candidateId: 1,
        jobId: 1,
        scheduledAt: new Date(Date.now() + 1000 * 60 * 60),
        interviewType: "technical",
      };

      const created = await interviewService.createInterview(interviewData);

      const retrieved = await interviewService.getInterviewByToken(created.inviteToken);

      expect(retrieved).toMatchObject({
        id: created.id,
        candidateId: 1,
        jobId: 1,
        status: InterviewStatus.DRAFT,
      });
    });

    it("throws NOT_FOUND error for invalid token", async () => {
      await expect(
        interviewService.getInterviewByToken("invalid-token"),
      ).rejects.toThrow(AppError);
    });
  });

  describe("updateInterviewStatus", () => {
    it("updates the status of an existing interview", async () => {
      const interviewData = {
        candidateId: 1,
        jobId: 1,
        scheduledAt: new Date(Date.now() + 1000 * 60 * 60),
        interviewType: "technical",
      };

      const created = await interviewService.createInterview(interviewData);

      const updated = await interviewService.updateInterviewStatus(
        created.id,
        InterviewStatus.SCHEDULED,
      );

      expect(updated.status).toBe(InterviewStatus.SCHEDULED);
    });

    it("throws NOT_FOUND error when interview does not exist", async () => {
      await expect(
        interviewService.updateInterviewStatus(99999, InterviewStatus.CANCELLED),
      ).rejects.toThrow(AppError);
    });
  });

  describe("deleteInterview", () => {
    it("deletes an existing interview", async () => {
      const interviewData = {
        candidateId: 1,
        jobId: 1,
        scheduledAt: new Date(Date.now() + 1000 * 60 * 60),
        interviewType: "technical",
      };

      const created = await interviewService.createInterview(interviewData);

      await interviewService.deleteInterview(created.id);

      await expect(
        interviewService.getInterviewByToken(created.inviteToken),
      ).rejects.toThrow(AppError);
    });

    it("returns false when interview does not exist", async () => {
      const result = await interviewService.deleteInterview(99999);
      expect(result).toBe(false);
    });
  });
});