CREATE TYPE "answer_state" AS ENUM('RECEIVED', 'PERSISTED', 'EVALUATED');--> statement-breakpoint
CREATE TYPE "answer_type" AS ENUM('TEXT', 'AUDIO', 'VIDEO');--> statement-breakpoint
CREATE TYPE "interview_difficulty" AS ENUM('EASY', 'MEDIUM', 'HARD');--> statement-breakpoint
CREATE TYPE "question_state" AS ENUM('PENDING', 'ANSWERED', 'SKIPPED', 'TIMED_OUT', 'EVALUATED');--> statement-breakpoint
CREATE TYPE "question_type" AS ENUM('BEHAVIORAL', 'TECHNICAL', 'MIXED');--> statement-breakpoint
CREATE TYPE "timeout_behavior" AS ENUM('AUTO_SKIP', 'EMPTY_SUBMIT', 'PENALISE');--> statement-breakpoint
CREATE TABLE "interview_answers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"interview_id" uuid NOT NULL,
	"question_id" uuid NOT NULL,
	"answer_data" varchar(5000) NOT NULL,
	"answer_type" "answer_type" NOT NULL,
	"answer_state" "answer_state" DEFAULT 'PERSISTED'::"answer_state" NOT NULL,
	"evaluation_data" jsonb,
	"answered_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "answer_evaluations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"interview_id" uuid NOT NULL,
	"question_id" uuid NOT NULL,
	"answer_id" uuid NOT NULL,
	"score" numeric(5,2) NOT NULL,
	"correctness_score" numeric(5,2) NOT NULL,
	"relevance_score" numeric(5,2) NOT NULL,
	"clarity_score" numeric(5,2) NOT NULL,
	"depth_score" numeric(5,2) NOT NULL,
	"feedback" text NOT NULL,
	"strengths" text[] NOT NULL,
	"weaknesses" text[] NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "interview_questions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"interview_id" uuid NOT NULL,
	"sequence_number" integer NOT NULL,
	"question_title" varchar(255) NOT NULL,
	"question_description" varchar(550),
	"question_type" "question_type" NOT NULL,
	"question_state" "question_state" DEFAULT 'PENDING'::"question_state" NOT NULL,
	"timed_out_at" timestamp with time zone,
	"timeout_behavior" "timeout_behavior",
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "interview_results" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"interview_id" uuid NOT NULL,
	"overall_score" numeric(5,2) NOT NULL,
	"technical_score" numeric(5,2) NOT NULL,
	"communication_score" numeric(5,2) NOT NULL,
	"problem_solving_score" numeric(5,2) NOT NULL,
	"confidence_score" numeric(5,2) NOT NULL,
	"questions_answered" integer DEFAULT 0 NOT NULL,
	"questions_skipped" integer DEFAULT 0 NOT NULL,
	"questions_evaluated" integer DEFAULT 0 NOT NULL,
	"total_duration" integer NOT NULL,
	"feedback" text NOT NULL,
	"strengths" text[] NOT NULL,
	"weaknesses" text[] NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "interviews" ADD COLUMN "interview_type" "interview_type" NOT NULL;--> statement-breakpoint
ALTER TABLE "interviews" ADD COLUMN "interview_company_style" "interview_company_style" NOT NULL;--> statement-breakpoint
ALTER TABLE "interviews" ADD COLUMN "interview_difficulty" "interview_difficulty" DEFAULT 'MEDIUM'::"interview_difficulty" NOT NULL;--> statement-breakpoint
ALTER TABLE "interviews" ADD COLUMN "last_activity_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "interviews" ADD COLUMN "interview_started_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "interviews" ALTER COLUMN "interview_status" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "interviews" ALTER COLUMN "interview_status" DROP DEFAULT;--> statement-breakpoint
DROP TYPE "interview_status";--> statement-breakpoint
CREATE TYPE "interview_status" AS ENUM('DRAFT', 'READY', 'SCHEDULED', 'INPROGRESS', 'COMPLETED', 'CANCELLED', 'ABANDONED', 'EXPIRED', 'TIMED_OUT');--> statement-breakpoint
ALTER TABLE "interviews" ALTER COLUMN "interview_status" SET DATA TYPE "interview_status" USING "interview_status"::"interview_status";--> statement-breakpoint
ALTER TABLE "interviews" ALTER COLUMN "interview_status" SET DEFAULT 'READY'::"interview_status";--> statement-breakpoint
ALTER TABLE "interview_answers" ADD CONSTRAINT "interview_answers_interview_id_interviews_id_fkey" FOREIGN KEY ("interview_id") REFERENCES "interviews"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "interview_answers" ADD CONSTRAINT "interview_answers_question_id_interview_questions_id_fkey" FOREIGN KEY ("question_id") REFERENCES "interview_questions"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "answer_evaluations" ADD CONSTRAINT "answer_evaluations_interview_id_interviews_id_fkey" FOREIGN KEY ("interview_id") REFERENCES "interviews"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "answer_evaluations" ADD CONSTRAINT "answer_evaluations_question_id_interview_questions_id_fkey" FOREIGN KEY ("question_id") REFERENCES "interview_questions"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "answer_evaluations" ADD CONSTRAINT "answer_evaluations_answer_id_interview_answers_id_fkey" FOREIGN KEY ("answer_id") REFERENCES "interview_answers"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "interview_questions" ADD CONSTRAINT "interview_questions_interview_id_interviews_id_fkey" FOREIGN KEY ("interview_id") REFERENCES "interviews"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "interview_results" ADD CONSTRAINT "interview_results_interview_id_interviews_id_fkey" FOREIGN KEY ("interview_id") REFERENCES "interviews"("id") ON DELETE CASCADE;