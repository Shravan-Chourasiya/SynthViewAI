import * as z from "zod";
import { TARGET_COMPANIES } from "../../../constants/interview.constants.js";

export const createInterviewSchema = z
  .object({
    jobrole: z.string().max(60, "Job role must be at most 60 characters long"),
    domain: z.string().max(100).optional(),
    experience: z
      .enum(
        ["fresher", "junior", "mid-level", "senior"],
        "Experience must be one of: fresher, junior, mid-level, senior",
      )
      .default("fresher"),
    jobSkills: z.array(z.string().max(50)).max(10, "Maximum of 10 skills allowed").optional(),
    difficulty: z
      .enum(["EASY", "MEDIUM", "HARD"], "Difficulty must be one of: EASY, MEDIUM, HARD")
      .default("MEDIUM"),
    isAdaptive: z.boolean().default(false),
    interviewStyle: z
      .enum(
        ["MANGOS", "FAANG", "MAANG", "STARTUP", "CUSTOM", "REGULAR"],
        "Interview style must be one of: MANGOS, FAANG, MAANG, STARTUP, CUSTOM, REGULAR",
      )
      .default("FAANG"),
    interviewType: z
      .enum(
        ["BEHAVIORAL", "TECHNICAL", "MIXED"],
        "Interview type must be one of: BEHAVIORAL, TECHNICAL, MIXED",
      )
      .default("MIXED"),
    duration: z.number().int().positive(),
    // not user-configurable — fixed default; product decision, not incidental
    maxFollowUps: z.number().int().min(0).max(5).default(3),
    isScheduled: z.boolean().default(false),
    scheduledDate: z.coerce.date().optional(),
    targetedCompany: z.enum(TARGET_COMPANIES).optional(),
    targetedCompanyOther: z.string().max(100).optional(),
    endingCriteria: z.enum(["QUESTION_COUNT", "DURATION"]).default("DURATION"),
    // Keep aligned with the generated-question limit used by interview outcomes.
    questionCount: z.number().int().positive().max(25).optional(),
    // TODO(codebox): Add isCodingInterview z.boolean().default(false) and
    // codingConfig z.object({ language: z.string(), ... }).optional() here
    // once src/integrations/codebox is ready. Must be added in the same PR as
    // the schema migration that adds the DB columns.
  })
  .superRefine((data, ctx) => {
    // scheduledDate required and must be in the future when isScheduled is true
    if (data.isScheduled) {
      if (!data.scheduledDate) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["scheduledDate"],
          message: "scheduledDate is required when isScheduled is true",
        });
      } else if (data.scheduledDate <= new Date()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["scheduledDate"],
          message: "scheduledDate must be in the future",
        });
      }
    }

    if (data.endingCriteria === "QUESTION_COUNT" && !data.questionCount) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["questionCount"],
        message: "questionCount is required when endingCriteria is QUESTION_COUNT",
      });
    }

  });
