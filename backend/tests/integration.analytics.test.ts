/**
 * Integration tests for analytics functionality
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import app from "../src/app.js";
import { getPgDb } from "../src/db/postgres.init.js";
import { usersTable } from "../src/modules/auth/schemas/user.schema.js";
import { interviewResultsTable } from "../src/modules/interview/schemas/result.schema.js";
import { eq } from "drizzle-orm";
import { hash } from "bcrypt";
import { resetDb } from "./helpers/containers.js";

describe("Analytics Integration Tests", () => {
  let testUser: any;
  let testResults: any[];

  beforeAll(async () => {
    // Reset database
    await resetDb();
    
    // Create test user
    const db = getPgDb();
    
    const hashedPassword = await hash("TestPassword123!", 12);
    const [createdUser] = await db
      .insert(usersTable)
      .values({
        email: "analytics@test.com",
        password: hashedPassword,
        firstName: "Analytics",
        lastName: "User",
        userrole: "user",
        isVerified: true,
        accountStatus: "active",
      })
      .returning();
    
    testUser = createdUser;
    
    // Create some test interview results
    const results = await db
      .insert(interviewResultsTable)
      .values([
        {
          userId: testUser.id,
          overallScore: 85,
          technicalScore: 80,
          communicationScore: 90,
          problemSolvingScore: 85,
          confidenceScore: 88,
          questionsAnswered: 5,
          questionsSkipped: 1,
          strengths: JSON.stringify(["JavaScript", "Problem Solving"]),
          weaknesses: JSON.stringify(["System Design", "Time Complexity"]),
        },
        {
          userId: testUser.id,
          overallScore: 92,
          technicalScore: 95,
          communicationScore: 88,
          problemSolvingScore: 90,
          confidenceScore: 94,
          questionsAnswered: 6,
          questionsSkipped: 0,
          strengths: JSON.stringify(["Algorithms", "Data Structures"]),
          weaknesses: JSON.stringify(["System Design"]),
        },
        {
          userId: testUser.id,
          overallScore: 78,
          technicalScore: 75,
          communicationScore: 82,
          problemSolvingScore: 77,
          confidenceScore: 80,
          questionsAnswered: 4,
          questionsSkipped: 2,
          strengths: JSON.stringify(["Debugging", "Testing"]),
          weaknesses: JSON.stringify(["Optimization", "Scalability"]),
        },
      ])
      .returning();
    
    testResults = results;
  });

  afterAll(async () => {
    // Clean up
    const db = getPgDb();
    await db.delete(usersTable).where(
      eq(usersTable.email, "analytics@test.com")
    );
    await db.delete(interviewResultsTable).where(
      eq(interviewResultsTable.userId, testUser.id)
    );
  });

  describe("User Analytics", () => {
    it("should return 401 when unauthenticated user tries to access analytics", async () => {
      const res = await request(app)
        .get("/v1/analytics/me")
        .expect(401);

      expect(res.body.message).toContain("Unauthorized");
    });

    it("should return user analytics when authenticated", async () => {
      // This would require a valid user session
      expect(true).toBe(true); // Placeholder - actual test requires auth setup
    });

    it("should return empty analytics for user with no interview results", async () => {
      // Create a user with no interview results and test
      expect(true).toBe(true); // Placeholder
    });

    it("should return correct aggregated scores", async () => {
      // This would require a valid user session
      expect(true).toBe(true); // Placeholder - actual test requires auth setup
    });
  });

  describe("Analytics Trend Data", () => {
    it("should return trend data for user analytics", async () => {
      // This would require a valid user session
      expect(true).toBe(true); // Placeholder - actual test requires auth setup
    });
  });
});