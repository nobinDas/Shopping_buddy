CREATE TYPE "public"."category" AS ENUM('software', 'media', 'insurance', 'utility', 'other');--> statement-breakpoint
CREATE TYPE "public"."cycle" AS ENUM('monthly', 'quarterly', 'semiannual', 'annual', 'custom');--> statement-breakpoint
CREATE TYPE "public"."price_history_source" AS ENUM('manual', 'detected');--> statement-breakpoint
CREATE TYPE "public"."status" AS ENUM('active', 'paused', 'cancelled', 'archived');--> statement-breakpoint
CREATE TYPE "public"."subscription_source" AS ENUM('manual', 'detected', 'manual_confirmed');--> statement-breakpoint
CREATE TABLE "price_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"subscription_id" uuid NOT NULL,
	"amount_minor" integer NOT NULL,
	"currency" char(3) NOT NULL,
	"effective_from" date NOT NULL,
	"source" "price_history_source" NOT NULL,
	"signal_id" uuid
);
--> statement-breakpoint
CREATE TABLE "subscriptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"vendor_key" text NOT NULL,
	"amount_minor" integer NOT NULL,
	"currency" char(3) NOT NULL,
	"cycle" "cycle" NOT NULL,
	"cycle_days" integer,
	"anchor_date" date NOT NULL,
	"next_billing_date" date NOT NULL,
	"category" "category" NOT NULL,
	"source" "subscription_source" DEFAULT 'manual' NOT NULL,
	"status" "status" DEFAULT 'active' NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "price_history" ADD CONSTRAINT "price_history_subscription_id_subscriptions_id_fk" FOREIGN KEY ("subscription_id") REFERENCES "public"."subscriptions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "price_history_subscription_id_idx" ON "price_history" USING btree ("subscription_id");--> statement-breakpoint
CREATE INDEX "price_history_effective_from_idx" ON "price_history" USING btree ("effective_from");--> statement-breakpoint
CREATE INDEX "subscriptions_vendor_key_idx" ON "subscriptions" USING btree ("vendor_key");--> statement-breakpoint
CREATE INDEX "subscriptions_status_idx" ON "subscriptions" USING btree ("status");--> statement-breakpoint
CREATE INDEX "subscriptions_next_billing_date_idx" ON "subscriptions" USING btree ("next_billing_date");