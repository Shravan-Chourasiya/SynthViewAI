CREATE TYPE "notification_type" AS ENUM('REMINDER_24H', 'REMINDER_1H', 'INTERVIEW_PAUSED');--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"user_id" uuid NOT NULL,
	"type" "notification_type" NOT NULL,
	"title" varchar(255) NOT NULL,
	"body" varchar(550) NOT NULL,
	"related_interview_id" uuid,
	"read_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "notifications_user_created_at_idx" ON "notifications" ("user_id","created_at");--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_users_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_related_interview_id_interviews_id_fkey" FOREIGN KEY ("related_interview_id") REFERENCES "interviews"("id") ON DELETE CASCADE;