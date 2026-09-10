CREATE TYPE "public"."email_account_status" AS ENUM('active', 'needs_reauth', 'disconnected');--> statement-breakpoint
CREATE TYPE "public"."email_provider" AS ENUM('google', 'microsoft');--> statement-breakpoint
CREATE TABLE "email_accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"provider" "email_provider" NOT NULL,
	"email_address" text NOT NULL,
	"access_token_enc" "bytea" NOT NULL,
	"refresh_token_enc" "bytea" NOT NULL,
	"token_expires_at" timestamp with time zone NOT NULL,
	"sync_cursor" text,
	"last_synced_at" timestamp with time zone,
	"status" "email_account_status" DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "email_accounts" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE INDEX "email_accounts_status_idx" ON "email_accounts" USING btree ("status");