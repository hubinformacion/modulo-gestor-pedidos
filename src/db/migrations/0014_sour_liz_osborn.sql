CREATE TABLE "promotion_books" (
	"promotion_id" uuid NOT NULL,
	"book_id" uuid NOT NULL,
	CONSTRAINT "promotion_books_promotion_id_book_id_pk" PRIMARY KEY("promotion_id","book_id")
);
--> statement-breakpoint
CREATE TABLE "promotions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"community_percent" integer DEFAULT 0 NOT NULL,
	"public_percent" integer DEFAULT 0 NOT NULL,
	"scope" text NOT NULL,
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone NOT NULL,
	"status" "book_status" DEFAULT 'INACTIVO' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "promotions_rates" CHECK ("promotions"."community_percent" BETWEEN 0 AND 99 AND "promotions"."public_percent" BETWEEN 0 AND 99 AND ("promotions"."community_percent" > 0 OR "promotions"."public_percent" > 0)),
	CONSTRAINT "promotions_scope" CHECK ("promotions"."scope" IN ('all','selected')),
	CONSTRAINT "promotions_period" CHECK ("promotions"."starts_at" < "promotions"."ends_at" AND btrim("promotions"."name") <> '')
);
--> statement-breakpoint
ALTER TABLE "order_items" ADD COLUMN "base_unit_price" numeric(12, 2);--> statement-breakpoint
ALTER TABLE "order_items" ADD COLUMN "discount_percent" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "order_items" ADD COLUMN "promotion_id" uuid;--> statement-breakpoint
ALTER TABLE "order_items" ADD COLUMN "promotion_name" text;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "discount_total" numeric(12, 2) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE "promotion_books" ADD CONSTRAINT "promotion_books_promotion_id_promotions_id_fk" FOREIGN KEY ("promotion_id") REFERENCES "public"."promotions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "promotion_books" ADD CONSTRAINT "promotion_books_book_id_books_id_fk" FOREIGN KEY ("book_id") REFERENCES "public"."books"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "promotion_books_book_idx" ON "promotion_books" USING btree ("book_id");--> statement-breakpoint
CREATE INDEX "promotions_dates_idx" ON "promotions" USING btree ("status","starts_at","ends_at");--> statement-breakpoint
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_promotion_id_promotions_id_fk" FOREIGN KEY ("promotion_id") REFERENCES "public"."promotions"("id") ON DELETE restrict ON UPDATE no action;