CREATE TYPE "user_role" AS ENUM('user', 'admin', 'moderator', 'owner');--> statement-breakpoint
ALTER TABLE "sessions" ADD COLUMN "csrf_token" varchar(512) NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "user_role" "user_role" DEFAULT 'user'::"user_role" NOT NULL;