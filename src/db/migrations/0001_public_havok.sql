CREATE TYPE "public"."book_status" AS ENUM('ACTIVO', 'INACTIVO');--> statement-breakpoint
CREATE TYPE "public"."customer_type" AS ENUM('comunidad_continental', 'publico_general');--> statement-breakpoint
CREATE TYPE "public"."delivery_type" AS ENUM('recojo_campus', 'delivery');--> statement-breakpoint
CREATE TYPE "public"."delivery_zone" AS ENUM('lima_callao', 'provincia');--> statement-breakpoint
CREATE TYPE "public"."order_status" AS ENUM('PENDIENTE_PAGO', 'EN_PREPARACION', 'DESPACHADO', 'ENTREGADO', 'CANCELADO');--> statement-breakpoint
CREATE TYPE "public"."order_type" AS ENUM('solo_universidad', 'solo_instituto', 'mixto');--> statement-breakpoint
CREATE TYPE "public"."payment_status" AS ENUM('NO_APLICA', 'PENDIENTE', 'EN_REVISION', 'VERIFICADO', 'RECHAZADO');--> statement-breakpoint
CREATE TYPE "public"."publisher_imprint" AS ENUM('universidad', 'instituto');--> statement-breakpoint
CREATE TABLE "books" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"inventory_code" text NOT NULL,
	"title" text NOT NULL,
	"author" text NOT NULL,
	"publisher_imprint" "publisher_imprint" NOT NULL,
	"standard_price" numeric(12, 2) NOT NULL,
	"community_price" numeric(12, 2) NOT NULL,
	"stock" integer DEFAULT 0 NOT NULL,
	"status" "book_status" DEFAULT 'ACTIVO' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "books_inventory_code_unique" UNIQUE("inventory_code"),
	CONSTRAINT "books_nonempty_fields" CHECK (btrim("books"."inventory_code") <> '' AND btrim("books"."title") <> '' AND btrim("books"."author") <> ''),
	CONSTRAINT "books_nonnegative_prices" CHECK ("books"."standard_price" >= 0 AND "books"."community_price" >= 0),
	CONSTRAINT "books_nonnegative_stock" CHECK ("books"."stock" >= 0)
);
--> statement-breakpoint
CREATE TABLE "order_counters" (
	"year" integer PRIMARY KEY NOT NULL,
	"last_number" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "order_counters_valid_year" CHECK ("order_counters"."year" BETWEEN 2000 AND 9999),
	CONSTRAINT "order_counters_nonnegative_number" CHECK ("order_counters"."last_number" >= 0)
);
--> statement-breakpoint
CREATE TABLE "order_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" uuid NOT NULL,
	"book_id" uuid NOT NULL,
	"publisher_imprint" "publisher_imprint" NOT NULL,
	"unit_price" numeric(12, 2) NOT NULL,
	"quantity" integer NOT NULL,
	"subtotal" numeric(12, 2) NOT NULL,
	CONSTRAINT "order_items_positive_quantity" CHECK ("order_items"."quantity" > 0),
	CONSTRAINT "order_items_price_consistent" CHECK ("order_items"."unit_price" >= 0 AND "order_items"."subtotal" = "order_items"."unit_price" * "order_items"."quantity")
);
--> statement-breakpoint
CREATE TABLE "orders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_number" text NOT NULL,
	"tracking_token" text NOT NULL,
	"order_type" "order_type" NOT NULL,
	"customer_type" "customer_type" NOT NULL,
	"customer_campus" text,
	"customer_name" text NOT NULL,
	"customer_email" text NOT NULL,
	"customer_phone" text NOT NULL,
	"customer_document" text NOT NULL,
	"delivery_type" "delivery_type" NOT NULL,
	"delivery_campus" text,
	"delivery_zone" "delivery_zone",
	"delivery_department" text,
	"delivery_city" text,
	"delivery_address" text NOT NULL,
	"delivery_reference" text,
	"delivery_recipient" text NOT NULL,
	"subtotal_universidad" numeric(12, 2) NOT NULL,
	"subtotal_instituto" numeric(12, 2) NOT NULL,
	"shipping_cost" numeric(12, 2) NOT NULL,
	"shipping_universidad" numeric(12, 2) NOT NULL,
	"shipping_instituto" numeric(12, 2) NOT NULL,
	"total_universidad" numeric(12, 2) NOT NULL,
	"total_instituto" numeric(12, 2) NOT NULL,
	"total" numeric(12, 2) NOT NULL,
	"billing_ruc" text,
	"billing_business_name" text,
	"order_status" "order_status" DEFAULT 'PENDIENTE_PAGO' NOT NULL,
	"payment_status_universidad" "payment_status" NOT NULL,
	"payment_status_instituto" "payment_status" NOT NULL,
	"courier" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "orders_order_number_unique" UNIQUE("order_number"),
	CONSTRAINT "orders_tracking_token_unique" UNIQUE("tracking_token"),
	CONSTRAINT "orders_number_format" CHECK ("orders"."order_number" ~ '^[1-9][0-9]*-[0-9]{4}$'),
	CONSTRAINT "orders_tracking_token_format" CHECK ("orders"."tracking_token" ~ '^[A-Za-z0-9_-]{24,}$'),
	CONSTRAINT "orders_customer_fields" CHECK (btrim("orders"."customer_name") <> '' AND btrim("orders"."customer_phone") <> '' AND btrim("orders"."customer_document") <> '' AND "orders"."customer_email" = lower(btrim("orders"."customer_email")) AND "orders"."customer_email" ~ '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$'),
	CONSTRAINT "orders_community_requirements" CHECK ("orders"."customer_type" <> 'comunidad_continental' OR (coalesce(btrim("orders"."customer_campus"), '') <> '' AND "orders"."customer_email" ~ '^[^[:space:]@]+@continental[.]edu[.]pe$')),
	CONSTRAINT "orders_delivery_fields" CHECK (btrim("orders"."delivery_address") <> '' AND btrim("orders"."delivery_recipient") <> '' AND (
    ("orders"."delivery_type" = 'recojo_campus' AND coalesce(btrim("orders"."delivery_campus"), '') <> '' AND "orders"."delivery_zone" IS NULL AND "orders"."shipping_cost" = 0)
    OR ("orders"."delivery_type" = 'delivery' AND "orders"."delivery_campus" IS NULL AND "orders"."delivery_zone" IS NOT NULL AND (
      ("orders"."delivery_zone" = 'lima_callao' AND "orders"."shipping_cost" = 15)
      OR ("orders"."delivery_zone" = 'provincia' AND "orders"."shipping_cost" = 25 AND coalesce(btrim("orders"."delivery_department"), '') <> '' AND coalesce(btrim("orders"."delivery_city"), '') <> '')
    ))
  )),
	CONSTRAINT "orders_nonnegative_amounts" CHECK ("orders"."subtotal_universidad" >= 0 AND "orders"."subtotal_instituto" >= 0 AND "orders"."shipping_cost" >= 0 AND "orders"."shipping_universidad" >= 0 AND "orders"."shipping_instituto" >= 0 AND "orders"."total_universidad" >= 0 AND "orders"."total_instituto" >= 0 AND "orders"."total" >= 0),
	CONSTRAINT "orders_totals_consistent" CHECK ("orders"."shipping_cost" = "orders"."shipping_universidad" + "orders"."shipping_instituto" AND "orders"."total_universidad" = "orders"."subtotal_universidad" + "orders"."shipping_universidad" AND "orders"."total_instituto" = "orders"."subtotal_instituto" + "orders"."shipping_instituto" AND "orders"."total" = "orders"."total_universidad" + "orders"."total_instituto"),
	CONSTRAINT "orders_imprint_amounts" CHECK ((
    ("orders"."order_type" = 'solo_universidad' AND "orders"."subtotal_instituto" = 0 AND "orders"."shipping_instituto" = 0)
    OR ("orders"."order_type" = 'solo_instituto' AND "orders"."subtotal_universidad" = 0 AND "orders"."shipping_universidad" = 0)
    OR ("orders"."order_type" = 'mixto' AND "orders"."shipping_instituto" = 0)
  )),
	CONSTRAINT "orders_payment_applicability" CHECK ((
    ("orders"."order_type" = 'solo_universidad' AND "orders"."payment_status_universidad" <> 'NO_APLICA' AND "orders"."payment_status_instituto" = 'NO_APLICA')
    OR ("orders"."order_type" = 'solo_instituto' AND "orders"."payment_status_universidad" = 'NO_APLICA' AND "orders"."payment_status_instituto" <> 'NO_APLICA')
    OR ("orders"."order_type" = 'mixto' AND "orders"."payment_status_universidad" <> 'NO_APLICA' AND "orders"."payment_status_instituto" <> 'NO_APLICA')
  )),
	CONSTRAINT "orders_verified_before_preparation" CHECK ("orders"."order_status" NOT IN ('EN_PREPARACION', 'DESPACHADO', 'ENTREGADO') OR (
    ("orders"."order_type" = 'solo_universidad' AND "orders"."payment_status_universidad" = 'VERIFICADO')
    OR ("orders"."order_type" = 'solo_instituto' AND "orders"."payment_status_instituto" = 'VERIFICADO')
    OR ("orders"."order_type" = 'mixto' AND "orders"."payment_status_universidad" = 'VERIFICADO' AND "orders"."payment_status_instituto" = 'VERIFICADO')
  )),
	CONSTRAINT "orders_billing_pair" CHECK (("orders"."billing_ruc" IS NULL AND "orders"."billing_business_name" IS NULL) OR ("orders"."billing_ruc" IS NOT NULL AND "orders"."billing_business_name" IS NOT NULL AND "orders"."billing_ruc" ~ '^[0-9]{11}$' AND btrim("orders"."billing_business_name") <> ''))
);
--> statement-breakpoint
CREATE TABLE "payment_receipts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" uuid NOT NULL,
	"publisher_imprint" "publisher_imprint" NOT NULL,
	"drive_file_id" text NOT NULL,
	"drive_view_url" text NOT NULL,
	"file_name" text NOT NULL,
	"uploaded_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "payment_receipts_drive_file_id_unique" UNIQUE("drive_file_id"),
	CONSTRAINT "payment_receipts_nonempty_fields" CHECK (btrim("payment_receipts"."drive_file_id") <> '' AND btrim("payment_receipts"."file_name") <> ''),
	CONSTRAINT "payment_receipts_https_url" CHECK ("payment_receipts"."drive_view_url" ~ '^https://')
);
--> statement-breakpoint
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_book_id_books_id_fk" FOREIGN KEY ("book_id") REFERENCES "public"."books"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_receipts" ADD CONSTRAINT "payment_receipts_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "books_status_imprint_idx" ON "books" USING btree ("status","publisher_imprint");--> statement-breakpoint
CREATE INDEX "order_items_order_id_idx" ON "order_items" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "order_items_book_id_idx" ON "order_items" USING btree ("book_id");--> statement-breakpoint
CREATE INDEX "orders_created_at_idx" ON "orders" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "orders_status_created_at_idx" ON "orders" USING btree ("order_status","created_at");--> statement-breakpoint
CREATE INDEX "orders_payment_status_idx" ON "orders" USING btree ("payment_status_universidad","payment_status_instituto");--> statement-breakpoint
CREATE INDEX "payment_receipts_order_imprint_idx" ON "payment_receipts" USING btree ("order_id","publisher_imprint");