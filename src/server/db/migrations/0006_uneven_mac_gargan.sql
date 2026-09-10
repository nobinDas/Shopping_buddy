CREATE TABLE "user_settings" (
	"id" text PRIMARY KEY NOT NULL,
	"home_address" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "user_settings" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "preferred_stores" ADD COLUMN "address" text NOT NULL;--> statement-breakpoint
ALTER TABLE "preferred_stores" ADD COLUMN "place_id" text;--> statement-breakpoint
ALTER TABLE "preferred_stores" ADD COLUMN "opening_hours_text" text[];--> statement-breakpoint
ALTER TABLE "preferred_stores" ADD COLUMN "opening_hours_periods" jsonb;--> statement-breakpoint
ALTER TABLE "shopping_list_items" ADD COLUMN "checked_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "shopping_list_items" ADD COLUMN "due_at" date;