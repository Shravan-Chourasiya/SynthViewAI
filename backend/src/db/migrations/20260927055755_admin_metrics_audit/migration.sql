CREATE TYPE "admin_audit_action" AS ENUM('interview_metrics_viewed');--> statement-breakpoint
CREATE TABLE "admin_audit_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"admin_id" uuid NOT NULL,
	"admin_role" varchar(32) NOT NULL,
	"action" "admin_audit_action" NOT NULL,
	"interview_id" uuid NOT NULL,
	"candidate_ref" varchar(32),
	"ip" varchar(64),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "interview_questions" ADD COLUMN "question_difficulty" "interview_difficulty";--> statement-breakpoint
CREATE INDEX "admin_audit_log_admin_created_at_idx" ON "admin_audit_log" ("admin_id","created_at");--> statement-breakpoint
CREATE INDEX "admin_audit_log_interview_idx" ON "admin_audit_log" ("interview_id");