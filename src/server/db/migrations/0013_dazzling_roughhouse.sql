CREATE TYPE "public"."watchlist_category" AS ENUM('electronics', 'appliances', 'furniture', 'apparel', 'beauty', 'sports_outdoors', 'toys_games', 'home_kitchen', 'books_media', 'automotive', 'other');--> statement-breakpoint
CREATE TYPE "public"."watchlist_resolution_status" AS ENUM('resolved', 'needs_reresolution');--> statement-breakpoint
ALTER TABLE "watchlist_items" ADD COLUMN "category" "watchlist_category" NOT NULL;--> statement-breakpoint
ALTER TABLE "watchlist_items" ADD COLUMN "brand" text;--> statement-breakpoint
ALTER TABLE "watchlist_items" ADD COLUMN "variant" text;--> statement-breakpoint
ALTER TABLE "watchlist_items" ADD COLUMN "notes" text;--> statement-breakpoint
ALTER TABLE "watchlist_items" ADD COLUMN "expected_price_min_minor" integer;--> statement-breakpoint
ALTER TABLE "watchlist_items" ADD COLUMN "expected_price_max_minor" integer;--> statement-breakpoint
ALTER TABLE "watchlist_items" ADD COLUMN "expected_price_currency" char(3);--> statement-breakpoint
ALTER TABLE "watchlist_items" ADD COLUMN "tracked_sellers" text[] NOT NULL;--> statement-breakpoint
ALTER TABLE "watchlist_items" ADD COLUMN "resolved_product_id" text NOT NULL;--> statement-breakpoint
ALTER TABLE "watchlist_items" ADD COLUMN "resolved_title" text NOT NULL;--> statement-breakpoint
ALTER TABLE "watchlist_items" ADD COLUMN "resolved_source_url" text;--> statement-breakpoint
ALTER TABLE "watchlist_items" ADD COLUMN "resolution_status" "watchlist_resolution_status" DEFAULT 'resolved' NOT NULL;