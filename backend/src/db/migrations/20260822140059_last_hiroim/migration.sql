CREATE TYPE "interview_company_style" AS ENUM('MANGOS', 'FAANG', 'MAANG', 'STARTUP', 'CUSTOM');--> statement-breakpoint
CREATE TYPE "interview_status" AS ENUM('SCHEDULED', 'COMPLETED', 'CANCELLED', 'INPROGRESS', 'DRAFT');--> statement-breakpoint
CREATE TYPE "interview_type" AS ENUM('BEHAVIORAL', 'TECHNICAL', 'MIXED');--> statement-breakpoint
CREATE TYPE "interview_verdict" AS ENUM('PASS', 'FAIL', 'INCONCLUSIVE');--> statement-breakpoint
CREATE TYPE "device_type" AS ENUM('desktop', 'mobile', 'tablet');--> statement-breakpoint
CREATE TYPE "account_status" AS ENUM('active', 'suspended', 'disabled', 'deleted');--> statement-breakpoint
CREATE TYPE "oauth_provider" AS ENUM('google', 'facebook', 'github', 'none');--> statement-breakpoint
CREATE TYPE "subscription_plan" AS ENUM('free', 'premium', 'enterprise');--> statement-breakpoint
CREATE TYPE "two_fa_status" AS ENUM('enabled', 'disabled');--> statement-breakpoint
CREATE TYPE "two_fa_type" AS ENUM('none', 'sms', 'authenticator');--> statement-breakpoint
CREATE TABLE "interviews" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"user_id" uuid NOT NULL,
	"interview_title" varchar(255) NOT NULL,
	"interview_description" varchar(550),
	"interview_meta_data" jsonb NOT NULL,
	"interview_duration" integer NOT NULL,
	"interview_status" "interview_status" DEFAULT 'DRAFT'::"interview_status" NOT NULL,
	"is_interview_scheduled" boolean DEFAULT false NOT NULL,
	"interview_scheduled_date" timestamp with time zone,
	"interview_questions_generated_count" integer,
	"interview_questions_answered_count" integer,
	"interview_outcome" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"user_id" uuid NOT NULL,
	"active_session_count" integer DEFAULT 1 NOT NULL,
	"total_session_count" integer DEFAULT 1 NOT NULL,
	"token_family" uuid NOT NULL,
	"refresh_token" varchar(512) NOT NULL,
	"access_token" varchar(512) NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"is_revoked" boolean DEFAULT false NOT NULL,
	"login_count" integer DEFAULT 1 NOT NULL,
	"failed_login_attempts" integer DEFAULT 0 NOT NULL,
	"is_expired" boolean DEFAULT false NOT NULL,
	"expiry_date" timestamp with time zone NOT NULL,
	"device_type" "device_type" DEFAULT 'desktop'::"device_type" NOT NULL,
	"device_id" uuid NOT NULL,
	"ip_address" varchar(45) NOT NULL,
	"user_agent" varchar(512) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"email" varchar(255) NOT NULL UNIQUE,
	"password" varchar(255) NOT NULL,
	"username" varchar(30) NOT NULL UNIQUE,
	"is_verified" boolean DEFAULT false NOT NULL,
	"account_status" "account_status" DEFAULT 'active'::"account_status" NOT NULL,
	"oauth_provider" "oauth_provider" DEFAULT 'none'::"oauth_provider" NOT NULL,
	"is_oauth_enabled" boolean DEFAULT false NOT NULL,
	"first_name" varchar(100),
	"last_name" varchar(100),
	"bio" varchar(500),
	"organisation" varchar(255),
	"country" varchar(100),
	"two_fa_type" "two_fa_type" DEFAULT 'none'::"two_fa_type" NOT NULL,
	"two_fa_status" "two_fa_status" DEFAULT 'disabled'::"two_fa_status" NOT NULL,
	"two_fa_secret" varchar(255),
	"two_fa_recovery_codes" jsonb,
	"two_fa_enabled_options" jsonb,
	"interview_count" integer DEFAULT 0 NOT NULL,
	"subscription_plan" "subscription_plan" DEFAULT 'free'::"subscription_plan" NOT NULL,
	"session_count" integer DEFAULT 0 NOT NULL,
	"disabled_at" timestamp with time zone,
	"scheduled_deletion_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "interviews" ADD CONSTRAINT "interviews_user_id_users_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE;