ALTER TABLE "detected_signals" ADD COLUMN "review_brief" text;--> statement-breakpoint
ALTER TABLE "detected_signals" ADD COLUMN "action_required" boolean;--> statement-breakpoint
ALTER TABLE "detected_signals" ADD COLUMN "resolved_at" timestamp with time zone;