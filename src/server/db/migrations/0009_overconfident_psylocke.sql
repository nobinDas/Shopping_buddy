CREATE TYPE "public"."signal_status" AS ENUM('pending', 'matched', 'merged_duplicate', 'dismissed');--> statement-breakpoint
CREATE TYPE "public"."signal_type" AS ENUM('new', 'renewal', 'price_change', 'trial_conversion', 'cancellation');--> statement-breakpoint
CREATE TABLE "detected_signals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"account_id" uuid NOT NULL,
	"message_id" text NOT NULL,
	"content_hash" text NOT NULL,
	"signal_type" "signal_type" NOT NULL,
	"vendor_key" text NOT NULL,
	"amount_minor" integer,
	"currency" char(3),
	"billing_date" date,
	"confidence" numeric(3, 2) NOT NULL,
	"status" "signal_status" DEFAULT 'pending' NOT NULL,
	"superseded_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "detected_signals" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "detected_signals" ADD CONSTRAINT "detected_signals_account_id_email_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."email_accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "detected_signals_account_message_idx" ON "detected_signals" USING btree ("account_id","message_id");--> statement-breakpoint
CREATE INDEX "detected_signals_status_idx" ON "detected_signals" USING btree ("status");--> statement-breakpoint
CREATE INDEX "detected_signals_content_hash_idx" ON "detected_signals" USING btree ("content_hash");