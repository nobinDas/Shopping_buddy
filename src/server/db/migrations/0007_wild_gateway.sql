CREATE TABLE "watchlist_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"has_price_drop" boolean DEFAULT false NOT NULL,
	"latest_price_minor" integer,
	"latest_currency" char(3),
	"latest_seller_name" text,
	"last_checked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "watchlist_items" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "watchlist_price_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"item_id" uuid NOT NULL,
	"unit_price_minor" integer NOT NULL,
	"currency" char(3) NOT NULL,
	"seller_name" text,
	"product_link" text,
	"checked_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "watchlist_price_history" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "watchlist_price_history" ADD CONSTRAINT "watchlist_price_history_item_id_watchlist_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."watchlist_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "watchlist_price_history_item_id_idx" ON "watchlist_price_history" USING btree ("item_id");