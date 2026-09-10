CREATE TYPE "public"."policy_type" AS ENUM('medical', 'auto');--> statement-breakpoint
CREATE TABLE "insurance_policies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"type" "policy_type" NOT NULL,
	"insurer" text NOT NULL,
	"policy_number" text NOT NULL,
	"premium_minor" integer NOT NULL,
	"currency" char(3) NOT NULL,
	"cycle" "cycle" NOT NULL,
	"cycle_days" integer,
	"anchor_date" date NOT NULL,
	"next_billing_date" date NOT NULL,
	"reminder_lead_days" integer DEFAULT 30 NOT NULL,
	"status" "status" DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "insurance_policies" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE INDEX "insurance_policies_status_idx" ON "insurance_policies" USING btree ("status");--> statement-breakpoint
CREATE INDEX "insurance_policies_next_billing_date_idx" ON "insurance_policies" USING btree ("next_billing_date");