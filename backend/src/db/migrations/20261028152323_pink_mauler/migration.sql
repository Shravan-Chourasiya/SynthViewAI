CREATE TYPE "answer_format" AS ENUM('TEXT', 'CODE');--> statement-breakpoint
ALTER TABLE "interview_questions" ADD COLUMN "answer_format" "answer_format" DEFAULT 'TEXT'::"answer_format" NOT NULL;--> statement-breakpoint
ALTER TABLE "interview_questions" ADD COLUMN "code_language" varchar(32);