import * as z from "zod";
export const interviewSchema = z.object({
  // Interview Base fields
  id: z.string().uuid({ message: "Invalid UUID format" }),
  userId: z.string().uuid({ message: "Invalid UUID format" }),

  // Interview MetaData fields
  interviewTitle: z.string().max(255, { message: "Interview title is too long" }),
  interviewDescription: z
    .string()
    .max(550, { message: "Interview description is too long" })
    .optional(),
  interviewMetaData: z.object({
    jobRole: z.string().max(255, { message: "Job role is too long" }).optional(),
    jobSkills: z
      .array(z.string())
      .max(10, { message: "Maximum of 10 technical job skills allowed" })
      .optional(),
    interviewCompanyStyle: z
      .enum(["MANGOS", "FAANG", "MAANG", "STARTUP", "CUSTOM", "REGULAR"], {
        message: "Invalid interview style",
      })
      .optional(),
    interviewType: z
      .enum(["BEHAVIORAL", "TECHNICAL", "MIXED"], { message: "Invalid interview style" })
      .optional(),
  }),

  interviewDuration: z
    .number()
    .int()
    .max(180, { message: "Maximum interview duration is 180 minutes" }),

  // Interview Status fields
  interviewStatus: z.enum(["SCHEDULED", "COMPLETED", "CANCELLED", "INPROGRESS", "DRAFT"], {
    message: "Invalid interview status",
  }),
  isInterviewScheduled: z.boolean().default(false),
  interviewScheduledDate: z.date().optional(),

  // Interview Outcome fields
  interviewQuestionsGeneratedCount: z
    .number()
    .int()
    .max(25, { message: "Maximum of 25 questions allowed" }),
  interviewQuestionsAnsweredCount: z
    .number()
    .int()
    .max(25, { message: "Maximum of 25 questions allowed" })
    .optional(),
  interviewOutcome: z
    .object({
      finalScore: z.number().int().max(100, { message: "Maximum score is 100" }),
      finalVerdict: z.enum(["PASS", "FAIL", "INCONCLUSIVE"], {
        message: "Invalid interview outcome",
      }),

      questionWiseScore: z.array(
        z.object({
          questionId: z.string().uuid({ message: "Invalid UUID format" }),
          score: z.number().int().max(100, { message: "Maximum score is 100" }),
          answerId: z.string().uuid({ message: "Invalid UUID format" }).optional(),
        }),
      ),

      finalFeedBack: z.string().max(3000, { message: "Feedback is too long" }),
      suggestedImprovements: z
        .string()
        .max(3000, { message: "Suggested improvements are too long" })
        .optional(),
      helpfulResources: z
        .string()
        .max(3000, { message: "Helpful resources are too long" })
        .optional(),
    })
    .optional(),

  // Timestamps
  createdAt: z.date(),
  updatedAt: z.date(),
});
