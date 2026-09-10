CREATE TYPE "public"."item_price_history_source" AS ENUM('manual', 'walmart');--> statement-breakpoint
CREATE TABLE "item_price_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"item_id" uuid NOT NULL,
	"unit_price_minor" integer NOT NULL,
	"currency" char(3) NOT NULL,
	"source" "item_price_history_source" NOT NULL,
	"checked_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "item_price_history" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "preferred_stores" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "preferred_stores" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "shopping_list_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"list_id" uuid NOT NULL,
	"name" text NOT NULL,
	"quantity" integer DEFAULT 1 NOT NULL,
	"notes" text,
	"store" text,
	"unit_price_minor" integer,
	"currency" char(3),
	"last_price_checked_at" timestamp with time zone,
	"checked" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "shopping_list_items" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "shopping_lists" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "shopping_lists" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "item_price_history" ADD CONSTRAINT "item_price_history_item_id_shopping_list_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."shopping_list_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shopping_list_items" ADD CONSTRAINT "shopping_list_items_list_id_shopping_lists_id_fk" FOREIGN KEY ("list_id") REFERENCES "public"."shopping_lists"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "item_price_history_item_id_idx" ON "item_price_history" USING btree ("item_id");--> statement-breakpoint
CREATE UNIQUE INDEX "preferred_stores_name_idx" ON "preferred_stores" USING btree ("name");--> statement-breakpoint
CREATE INDEX "shopping_list_items_list_id_idx" ON "shopping_list_items" USING btree ("list_id");