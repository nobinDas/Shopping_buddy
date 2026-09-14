CREATE TYPE "public"."proposal_status" AS ENUM('pending', 'accepted', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."proposal_type" AS ENUM('confirm', 'price_update', 'date_update', 'discovery', 'cancellation');--> statement-breakpoint
CREATE TABLE "reconciliation_proposals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"signal_id" uuid NOT NULL,
	"subscription_id" uuid,
	"proposal_type" "proposal_type" NOT NULL,
	"proposed_changes" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"reasoning" text NOT NULL,
	"status" "proposal_status" DEFAULT 'pending' NOT NULL,
	"resolved_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "reconciliation_proposals" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD COLUMN "last_verified_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "reconciliation_proposals" ADD CONSTRAINT "reconciliation_proposals_signal_id_detected_signals_id_fk" FOREIGN KEY ("signal_id") REFERENCES "public"."detected_signals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reconciliation_proposals" ADD CONSTRAINT "reconciliation_proposals_subscription_id_subscriptions_id_fk" FOREIGN KEY ("subscription_id") REFERENCES "public"."subscriptions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "reconciliation_proposals_signal_id_idx" ON "reconciliation_proposals" USING btree ("signal_id");--> statement-breakpoint
CREATE INDEX "reconciliation_proposals_status_idx" ON "reconciliation_proposals" USING btree ("status");