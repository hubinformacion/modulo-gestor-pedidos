-- Esquema inicial de producción. Fuente: schema.ts y auth-schema.ts.
-- Instalación controlada: pnpm db:setup. No aplicar manualmente sobre una BD con datos.

CREATE TYPE "public"."book_status" AS ENUM('ACTIVO', 'INACTIVO');
CREATE TYPE "public"."customer_type" AS ENUM('comunidad_continental', 'publico_general');
CREATE TYPE "public"."delivery_type" AS ENUM('recojo_campus', 'delivery');
CREATE TYPE "public"."delivery_zone" AS ENUM('lima_callao', 'provincia');
CREATE TYPE "public"."order_status" AS ENUM('PENDIENTE_PAGO', 'EN_PREPARACION', 'DESPACHADO', 'ENTREGADO', 'CANCELADO');
CREATE TYPE "public"."order_type" AS ENUM('solo_universidad', 'solo_instituto', 'mixto');
CREATE TYPE "public"."payment_status" AS ENUM('NO_APLICA', 'PENDIENTE', 'EN_REVISION', 'VERIFICADO', 'RECHAZADO');
CREATE TYPE "public"."publisher_imprint" AS ENUM('universidad', 'instituto');
CREATE TYPE "public"."recipient_type" AS ENUM('comprador', 'otra_persona');
CREATE TABLE "authorized_emails" (
	"email" text PRIMARY KEY NOT NULL,
	"role" text DEFAULT 'gestor' NOT NULL,
	"publisher_imprints" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"treasury_service" boolean DEFAULT false NOT NULL,
	"publisher_imprint" "publisher_imprint",
	"added_by" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "authorized_emails_role" CHECK (("authorized_emails"."role" = 'gestor' AND "authorized_emails"."publisher_imprint" IS NULL) OR ("authorized_emails"."role" = 'caja' AND "authorized_emails"."publisher_imprint" IS NOT NULL)),
	CONSTRAINT "authorized_emails_scope" CHECK (jsonb_typeof("authorized_emails"."publisher_imprints") = 'array' AND "authorized_emails"."publisher_imprints" <@ '["universidad","instituto"]'::jsonb AND ("authorized_emails"."role" = 'caja' OR ("authorized_emails"."publisher_imprints" = '[]'::jsonb AND "authorized_emails"."treasury_service" = false))),
	CONSTRAINT "authorized_emails_master_role" CHECK ("authorized_emails"."email" <> 'distribucionfe@continental.edu.pe' OR "authorized_emails"."role" = 'gestor'),
	CONSTRAINT "authorized_emails_normalized" CHECK ("authorized_emails"."email" = lower(btrim("authorized_emails"."email")))
);

CREATE TABLE "bank_accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"publisher_imprint" "publisher_imprint" NOT NULL,
	"bank" text NOT NULL,
	"holder" text NOT NULL,
	"currency" text DEFAULT 'PEN' NOT NULL,
	"account" text NOT NULL,
	"cci" text NOT NULL,
	"status" "book_status" DEFAULT 'INACTIVO' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "bank_accounts_currency" CHECK ("bank_accounts"."currency" = 'PEN'),
	CONSTRAINT "bank_accounts_active_fields" CHECK ("bank_accounts"."status" <> 'ACTIVO' OR (btrim("bank_accounts"."bank") <> '' AND btrim("bank_accounts"."holder") <> '' AND "bank_accounts"."account" ~ '^[0-9 -]{5,40}$' AND "bank_accounts"."cci" ~ '^[0-9]{20}$'))
);

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

CREATE TABLE "caja_notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"request_id" uuid NOT NULL,
	"cycle" integer NOT NULL,
	"event_type" text NOT NULL,
	"assignment_key" uuid,
	"reason" text,
	"status" text DEFAULT 'NO_ENVIADO' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"last_attempt_at" timestamp with time zone,
	"gmail_message_id" text,
	"rfc_message_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "caja_notifications_assignment_key" CHECK (("caja_notifications"."event_type" = 'ASIGNACION' AND "caja_notifications"."assignment_key" IS NOT NULL) OR ("caja_notifications"."event_type" <> 'ASIGNACION' AND "caja_notifications"."assignment_key" IS NULL)),
	CONSTRAINT "caja_notifications_event" CHECK ("caja_notifications"."event_type" IN ('SOLICITUD','FINALIZADA','DEVUELTA','ANULADA','ASIGNACION')),
	CONSTRAINT "caja_notifications_state" CHECK ("caja_notifications"."status" IN ('NO_ENVIADO','ENVIANDO','ENVIADO','ERROR','OMITIDO'))
);

CREATE TABLE "caja_requests" (
	"request_number" integer GENERATED ALWAYS AS IDENTITY (sequence name "caja_requests_request_number_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" uuid NOT NULL,
	"publisher_imprint" "publisher_imprint" NOT NULL,
	"status" text DEFAULT 'PENDIENTE' NOT NULL,
	"cycle" integer DEFAULT 1 NOT NULL,
	"draft_document_id" uuid,
	"finalized_document_id" uuid,
	"return_reason" text,
	"assigned_to" text,
	"assigned_name" text,
	"assigned_at" timestamp with time zone,
	"assignment_token" uuid,
	"finalized_by" text,
	"finalized_at" timestamp with time zone,
	"gmail_thread_id" text,
	"subject_header" text,
	"last_rfc_message_id" text,
	"rfc_references" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"lease_id" uuid,
	"lease_until" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "caja_requests_request_number_unique" UNIQUE("request_number"),
	CONSTRAINT "caja_requests_assignment" CHECK (("caja_requests"."assigned_to" IS NULL AND "caja_requests"."assigned_name" IS NULL AND "caja_requests"."assigned_at" IS NULL AND "caja_requests"."assignment_token" IS NULL) OR ("caja_requests"."assigned_to" IS NOT NULL AND "caja_requests"."assigned_name" IS NOT NULL AND "caja_requests"."assigned_at" IS NOT NULL AND "caja_requests"."assignment_token" IS NOT NULL)),
	CONSTRAINT "caja_requests_state" CHECK ("caja_requests"."status" IN ('PENDIENTE','FINALIZADA','DEVUELTA','ANULADA') AND "caja_requests"."cycle" > 0),
	CONSTRAINT "caja_requests_finalized" CHECK ("caja_requests"."status" <> 'FINALIZADA' OR ("caja_requests"."finalized_document_id" IS NOT NULL AND "caja_requests"."finalized_at" IS NOT NULL AND "caja_requests"."finalized_by" IS NOT NULL))
);

CREATE TABLE "campuses" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid()::text NOT NULL,
	"name" text NOT NULL,
	"library_address" text NOT NULL,
	"library_location" text DEFAULT '' NOT NULL,
	"pickup_hours" text DEFAULT '' NOT NULL,
	"latitude" numeric(10, 7),
	"longitude" numeric(10, 7),
	"google_maps_embed_url" text,
	"status" "book_status" DEFAULT 'ACTIVO' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "campuses_nonempty_fields" CHECK (btrim("campuses"."name") <> '' AND btrim("campuses"."library_address") <> ''),
	CONSTRAINT "campuses_valid_coordinates" CHECK (("campuses"."latitude" IS NULL AND "campuses"."longitude" IS NULL) OR ("campuses"."latitude" IS NOT NULL AND "campuses"."longitude" IS NOT NULL AND "campuses"."latitude" BETWEEN -90 AND 90 AND "campuses"."longitude" BETWEEN -180 AND 180)),
	CONSTRAINT "campuses_valid_map_url" CHECK ("campuses"."google_maps_embed_url" IS NULL OR "campuses"."google_maps_embed_url" ~ '^https://(www[.]google[.]com|maps[.]google[.]com)/maps/embed([?]|/)')
);

CREATE TABLE "coupon_redemptions" (
	"order_id" uuid PRIMARY KEY NOT NULL,
	"coupon_id" uuid NOT NULL,
	"released_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "coupons" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" text NOT NULL,
	"percent" integer NOT NULL,
	"scope" text DEFAULT 'all' NOT NULL,
	"book_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"audience" text DEFAULT 'all' NOT NULL,
	"max_uses" integer,
	"used_count" integer DEFAULT 0 NOT NULL,
	"starts_at" timestamp with time zone,
	"ends_at" timestamp with time zone,
	"status" "book_status" DEFAULT 'INACTIVO' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "coupons_code_unique" UNIQUE("code"),
	CONSTRAINT "coupons_scope" CHECK ("coupons"."scope" IN ('all','selected') AND jsonb_typeof("coupons"."book_ids") = 'array' AND ("coupons"."scope" = 'all' OR jsonb_array_length("coupons"."book_ids") > 0)),
	CONSTRAINT "coupons_code" CHECK ("coupons"."code" ~ '^[A-Z0-9_-]{3,32}$'),
	CONSTRAINT "coupons_percent" CHECK ("coupons"."percent" BETWEEN 1 AND 99),
	CONSTRAINT "coupons_audience" CHECK ("coupons"."audience" IN ('all','comunidad_continental','publico_general')),
	CONSTRAINT "coupons_usage" CHECK ("coupons"."used_count" >= 0 AND ("coupons"."max_uses" IS NULL OR ("coupons"."max_uses" > 0 AND "coupons"."used_count" <= "coupons"."max_uses"))),
	CONSTRAINT "coupons_dates" CHECK ("coupons"."starts_at" IS NULL OR "coupons"."ends_at" IS NULL OR "coupons"."starts_at" < "coupons"."ends_at")
);

CREATE TABLE "delivery_rates" (
	"zone" "delivery_zone" PRIMARY KEY NOT NULL,
	"price" numeric(12, 2) NOT NULL,
	"status" "book_status" DEFAULT 'ACTIVO' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "delivery_rates_price" CHECK ("delivery_rates"."price" >= 0 AND "delivery_rates"."price" <= 999999.99)
);

CREATE TABLE "drive_file_reader_grants" (
	"drive_file_id" text NOT NULL,
	"email" text NOT NULL,
	"request_id" uuid NOT NULL,
	"permission_id" text,
	"managed" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "drive_file_reader_grants_drive_file_id_email_pk" PRIMARY KEY("drive_file_id","email")
);

CREATE TABLE "drive_reader_grants" (
	"folder_id" text NOT NULL,
	"email" text NOT NULL,
	"permission_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "drive_reader_grants_folder_id_email_pk" PRIMARY KEY("folder_id","email")
);

CREATE TABLE "management_audit" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"actor_user_id" text NOT NULL,
	"actor_email" text NOT NULL,
	"actor_name" text NOT NULL,
	"actor_role" text NOT NULL,
	"event" text NOT NULL,
	"resource" text NOT NULL,
	"target" text NOT NULL,
	"details" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "order_activity" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" uuid NOT NULL,
	"actor_user_id" text,
	"actor_name" text,
	"event_type" text NOT NULL,
	"detail" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "order_admission_changes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"actor_email" text NOT NULL,
	"previous" jsonb NOT NULL,
	"next" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "order_admission_counters" (
	"key" text PRIMARY KEY NOT NULL,
	"window_start" timestamp with time zone NOT NULL,
	"count" integer NOT NULL,
	CONSTRAINT "order_admission_counter_positive" CHECK ("order_admission_counters"."count" > 0)
);

CREATE TABLE "order_admission_policy" (
	"id" text PRIMARY KEY DEFAULT 'orders' NOT NULL,
	"email_quarter_hour" integer DEFAULT 3 NOT NULL,
	"email_day" integer DEFAULT 10 NOT NULL,
	"ip_quarter_hour" integer DEFAULT 20 NOT NULL,
	"global_day" integer DEFAULT 200 NOT NULL,
	"pending_email" integer DEFAULT 3 NOT NULL,
	"updated_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "order_admission_singleton" CHECK ("order_admission_policy"."id" = 'orders'),
	CONSTRAINT "order_admission_positive_limits" CHECK ("order_admission_policy"."email_quarter_hour" BETWEEN 1 AND 100000 AND "order_admission_policy"."email_day" BETWEEN 1 AND 100000 AND "order_admission_policy"."ip_quarter_hour" BETWEEN 1 AND 100000 AND "order_admission_policy"."global_day" BETWEEN 1 AND 100000 AND "order_admission_policy"."pending_email" BETWEEN 1 AND 100000)
);

CREATE TABLE "order_counters" (
	"year" integer PRIMARY KEY NOT NULL,
	"last_number" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "order_counters_valid_year" CHECK ("order_counters"."year" BETWEEN 2000 AND 9999),
	CONSTRAINT "order_counters_nonnegative_number" CHECK ("order_counters"."last_number" >= 0)
);

CREATE TABLE "order_emails" (
	"order_id" uuid PRIMARY KEY NOT NULL,
	"status" text DEFAULT 'NO_ENVIADO' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"last_attempt_at" timestamp with time zone,
	"gmail_message_id" text,
	"gmail_thread_id" text,
	"rfc_message_id" text,
	"subject_header" text,
	"headers_verified" boolean DEFAULT false NOT NULL,
	"thread_issue" text,
	"last_rfc_message_id" text,
	"rfc_references" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"lease_id" uuid,
	"lease_until" timestamp with time zone,
	"sent_at" timestamp with time zone,
	CONSTRAINT "order_emails_valid_status" CHECK ("order_emails"."status" IN ('NO_ENVIADO', 'ENVIANDO', 'ENVIADO', 'ERROR'))
);

CREATE TABLE "order_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" uuid NOT NULL,
	"book_id" uuid NOT NULL,
	"publisher_imprint" "publisher_imprint" NOT NULL,
	"book_title" text,
	"book_code" text,
	"base_unit_price" numeric(12, 2),
	"discount_percent" integer DEFAULT 0 NOT NULL,
	"promotion_id" uuid,
	"promotion_name" text,
	"unit_price" numeric(12, 2) NOT NULL,
	"quantity" integer NOT NULL,
	"subtotal" numeric(12, 2) NOT NULL,
	CONSTRAINT "order_items_positive_quantity" CHECK ("order_items"."quantity" > 0),
	CONSTRAINT "order_items_price_consistent" CHECK ("order_items"."unit_price" >= 0 AND "order_items"."subtotal" = "order_items"."unit_price" * "order_items"."quantity")
);

CREATE TABLE "order_notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" uuid NOT NULL,
	"event_type" text NOT NULL,
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"publisher_imprint" "publisher_imprint",
	"receipt_id" uuid,
	"status" text DEFAULT 'NO_ENVIADO' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"last_attempt_at" timestamp with time zone,
	"gmail_message_id" text,
	"rfc_message_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "order_notifications_valid_event" CHECK ("order_notifications"."event_type" IN ('COMPROBANTE_RECIBIDO', 'PAGO_VERIFICADO', 'PAGO_RECHAZADO', 'ASIGNADO', 'DESPACHADO', 'ENTREGADO', 'DOCUMENTOS_VENTA', 'CANCELADO')),
	CONSTRAINT "order_notifications_valid_status" CHECK ("order_notifications"."status" IN ('NO_ENVIADO', 'ENVIANDO', 'ENVIADO', 'ERROR', 'OMITIDO')),
	CONSTRAINT "order_notifications_event_fields" CHECK (("order_notifications"."event_type" = 'COMPROBANTE_RECIBIDO' AND "order_notifications"."publisher_imprint" IS NOT NULL AND "order_notifications"."receipt_id" IS NOT NULL) OR ("order_notifications"."event_type" IN ('PAGO_VERIFICADO', 'PAGO_RECHAZADO') AND "order_notifications"."publisher_imprint" IS NOT NULL) OR "order_notifications"."event_type" IN ('ASIGNADO', 'DESPACHADO', 'ENTREGADO', 'DOCUMENTOS_VENTA', 'CANCELADO'))
);

CREATE TABLE "orders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_number" text NOT NULL,
	"request_id" uuid,
	"draft_hash" text,
	"consent_accepted_at" timestamp with time zone,
	"consent_version" text,
	"payment_accounts" jsonb,
	"payment_guide_hash" text,
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
	"delivery_province" text,
	"delivery_district" text,
	"delivery_ubigeo" text,
	"delivery_address" text NOT NULL,
	"delivery_library_location" text,
	"delivery_pickup_hours" text,
	"pickup_contact_id" uuid,
	"pickup_contact_name" text,
	"pickup_contact_email" text,
	"delivery_map_url" text,
	"delivery_reference" text,
	"delivery_recipient" text NOT NULL,
	"delivery_recipient_type" "recipient_type" DEFAULT 'comprador' NOT NULL,
	"delivery_recipient_document" text,
	"delivery_recipient_phone" text,
	"subtotal_universidad" numeric(12, 2) NOT NULL,
	"subtotal_instituto" numeric(12, 2) NOT NULL,
	"shipping_cost" numeric(12, 2) NOT NULL,
	"shipping_universidad" numeric(12, 2) NOT NULL,
	"shipping_instituto" numeric(12, 2) NOT NULL,
	"total_universidad" numeric(12, 2) NOT NULL,
	"total_instituto" numeric(12, 2) NOT NULL,
	"total" numeric(12, 2) NOT NULL,
	"discount_total" numeric(12, 2) DEFAULT '0' NOT NULL,
	"coupon_id" uuid,
	"coupon_code" text,
	"coupon_percent" integer,
	"billing_ruc" text,
	"billing_business_name" text,
	"billing_address" text,
	"cancelled_at" timestamp with time zone,
	"cancellation_source" text,
	"cancellation_reason" text,
	"stock_restored_at" timestamp with time zone,
	"order_status" "order_status" DEFAULT 'PENDIENTE_PAGO' NOT NULL,
	"payment_status_universidad" "payment_status" NOT NULL,
	"payment_status_instituto" "payment_status" NOT NULL,
	"submitted_receipt_universidad" uuid,
	"submitted_receipt_instituto" uuid,
	"assigned_to" text,
	"assigned_name" text,
	"assigned_at" timestamp with time zone,
	"rejection_universidad" text,
	"rejection_instituto" text,
	"courier" text,
	"shipping_tracking_code" text,
	"shipping_tracking_url" text,
	"dispatched_at" timestamp with time zone,
	"delivered_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "orders_order_number_unique" UNIQUE("order_number"),
	CONSTRAINT "orders_request_id_unique" UNIQUE("request_id"),
	CONSTRAINT "orders_tracking_token_unique" UNIQUE("tracking_token"),
	CONSTRAINT "orders_other_recipient_fields" CHECK ("orders"."delivery_recipient_type" <> 'otra_persona' OR (coalesce("orders"."delivery_recipient_document", '') ~ '^[0-9]{8}$' AND coalesce("orders"."delivery_recipient_phone", '') ~ '^[+]?[0-9 ()-]{7,24}$')),
	CONSTRAINT "orders_ubigeo_zone" CHECK ("orders"."delivery_ubigeo" IS NULL OR ("orders"."delivery_type" = 'delivery' AND "orders"."delivery_ubigeo" ~ '^[0-9]{6}$' AND (("orders"."delivery_zone" = 'lima_callao' AND left("orders"."delivery_ubigeo", 4) IN ('1501', '0701')) OR ("orders"."delivery_zone" = 'provincia' AND left("orders"."delivery_ubigeo", 4) NOT IN ('1501', '0701'))))),
	CONSTRAINT "orders_number_format" CHECK ("orders"."order_number" ~ '^[1-9][0-9]*-[0-9]{4}$'),
	CONSTRAINT "orders_tracking_token_format" CHECK ("orders"."tracking_token" ~ '^[A-Za-z0-9_-]{24,}$'),
	CONSTRAINT "orders_customer_fields" CHECK (btrim("orders"."customer_name") <> '' AND btrim("orders"."customer_phone") <> '' AND btrim("orders"."customer_document") <> '' AND "orders"."customer_email" = lower(btrim("orders"."customer_email")) AND "orders"."customer_email" ~ '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$'),
	CONSTRAINT "orders_community_requirements" CHECK ("orders"."customer_type" <> 'comunidad_continental' OR (coalesce(btrim("orders"."customer_campus"), '') <> '' AND "orders"."customer_email" ~ '^[^[:space:]@]+@continental[.]edu[.]pe$')),
	CONSTRAINT "orders_delivery_fields" CHECK (btrim("orders"."delivery_address") <> '' AND btrim("orders"."delivery_recipient") <> '' AND (
    ("orders"."delivery_type" = 'recojo_campus' AND coalesce(btrim("orders"."delivery_campus"), '') <> '' AND "orders"."delivery_zone" IS NULL AND "orders"."shipping_cost" = 0)
    OR ("orders"."delivery_type" = 'delivery' AND "orders"."delivery_campus" IS NULL AND "orders"."delivery_zone" IS NOT NULL AND (
      ("orders"."delivery_zone" = 'lima_callao')
      OR ("orders"."delivery_zone" = 'provincia' AND coalesce(btrim("orders"."delivery_department"), '') <> '' AND coalesce(btrim("orders"."delivery_city"), '') <> '')
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

CREATE TABLE "payment_guides" (
	"hash" text PRIMARY KEY NOT NULL,
	"content_base64" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "payment_receipts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" uuid NOT NULL,
	"publisher_imprint" "publisher_imprint" NOT NULL,
	"upload_id" uuid,
	"drive_file_id" text NOT NULL,
	"drive_view_url" text NOT NULL,
	"file_name" text NOT NULL,
	"uploaded_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "payment_receipts_upload_id_unique" UNIQUE("upload_id"),
	CONSTRAINT "payment_receipts_drive_file_id_unique" UNIQUE("drive_file_id"),
	CONSTRAINT "payment_receipts_nonempty_fields" CHECK (btrim("payment_receipts"."drive_file_id") <> '' AND btrim("payment_receipts"."file_name") <> ''),
	CONSTRAINT "payment_receipts_https_url" CHECK ("payment_receipts"."drive_view_url" ~ '^https://')
);

CREATE TABLE "payment_uploads" (
	"id" uuid PRIMARY KEY NOT NULL,
	"order_id" uuid NOT NULL,
	"publisher_imprint" "publisher_imprint" NOT NULL,
	"content_hash" text NOT NULL,
	"drive_file_id" text NOT NULL,
	"file_name" text NOT NULL,
	"mime_type" text NOT NULL,
	"size" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "payment_uploads_drive_file_id_unique" UNIQUE("drive_file_id")
);

CREATE TABLE "pickup_contacts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"status" "book_status" DEFAULT 'ACTIVO' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "pickup_contacts_nonempty" CHECK (btrim("pickup_contacts"."name") <> '' AND "pickup_contacts"."email" = lower(btrim("pickup_contacts"."email")))
);

CREATE TABLE "pickup_evidence" (
	"id" uuid PRIMARY KEY NOT NULL,
	"order_id" uuid NOT NULL,
	"actor_user_id" text,
	"actor_name" text NOT NULL,
	"drive_file_id" text NOT NULL,
	"drive_view_url" text,
	"file_name" text NOT NULL,
	"mime_type" text NOT NULL,
	"content_hash" text NOT NULL,
	"size" integer NOT NULL,
	"uploaded_at" timestamp with time zone,
	"confirmed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "pickup_evidence_drive_file_id_unique" UNIQUE("drive_file_id"),
	CONSTRAINT "pickup_evidence_size" CHECK ("pickup_evidence"."size" > 0 AND "pickup_evidence"."size" <= 3145728),
	CONSTRAINT "pickup_evidence_image_type" CHECK ("pickup_evidence"."mime_type" IN ('image/jpeg','image/png'))
);

CREATE TABLE "pickup_notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" uuid NOT NULL,
	"contact_id" uuid NOT NULL,
	"contact_name" text NOT NULL,
	"contact_email" text NOT NULL,
	"status" text DEFAULT 'NO_ENVIADO' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"gmail_message_id" text,
	"gmail_thread_id" text,
	"last_attempt_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "pickup_notifications_order_id_unique" UNIQUE("order_id"),
	CONSTRAINT "pickup_notifications_status" CHECK ("pickup_notifications"."status" IN ('NO_ENVIADO','ENVIANDO','ENVIADO','ERROR','OMITIDO')),
	CONSTRAINT "pickup_notifications_attempts" CHECK ("pickup_notifications"."attempts" BETWEEN 0 AND 1)
);

CREATE TABLE "promotion_books" (
	"promotion_id" uuid NOT NULL,
	"book_id" uuid NOT NULL,
	CONSTRAINT "promotion_books_promotion_id_book_id_pk" PRIMARY KEY("promotion_id","book_id")
);

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

CREATE TABLE "sale_document_batches" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" uuid NOT NULL,
	"batch_key" text NOT NULL,
	"document_ids" jsonb NOT NULL,
	"correction" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sale_document_batches_batch_key_unique" UNIQUE("batch_key")
);

CREATE TABLE "sale_documents" (
	"id" uuid PRIMARY KEY NOT NULL,
	"request_id" uuid NOT NULL,
	"cycle" integer NOT NULL,
	"actor_email" text NOT NULL,
	"drive_file_id" text NOT NULL,
	"drive_view_url" text,
	"content_hash" text NOT NULL,
	"file_name" text NOT NULL,
	"size" integer NOT NULL,
	"uploaded_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sale_documents_drive_file_id_unique" UNIQUE("drive_file_id"),
	CONSTRAINT "sale_documents_size" CHECK ("sale_documents"."size" BETWEEN 1 AND 3145728 AND "sale_documents"."cycle" > 0)
);

CREATE TABLE "treasury_activity" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"request_id" uuid NOT NULL,
	"actor_id" text,
	"actor_name" text NOT NULL,
	"event" text NOT NULL,
	"detail" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "treasury_mailboxes" (
	"publisher_imprint" "publisher_imprint" PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "treasury_mailboxes_email" CHECK ("treasury_mailboxes"."email" = lower(btrim("treasury_mailboxes"."email")))
);

CREATE TABLE "treasury_notes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"request_id" uuid NOT NULL,
	"actor_id" text,
	"actor_name" text NOT NULL,
	"content" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "treasury_observations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"request_id" uuid NOT NULL,
	"content" text NOT NULL,
	"actor_name" text NOT NULL,
	"correction" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"resolved_at" timestamp with time zone,
	"resolved_by" text,
	"response" text
);

CREATE TABLE "treasury_supporting_files" (
	"id" uuid PRIMARY KEY NOT NULL,
	"request_id" uuid NOT NULL,
	"drive_file_id" text NOT NULL,
	"drive_view_url" text,
	"file_name" text NOT NULL,
	"mime_type" text NOT NULL,
	"content_hash" text NOT NULL,
	"size" integer NOT NULL,
	"actor_id" text NOT NULL,
	"uploaded_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "treasury_supporting_files_drive_file_id_unique" UNIQUE("drive_file_id"),
	CONSTRAINT "treasury_supporting_size" CHECK ("treasury_supporting_files"."size" BETWEEN 1 AND 3145728)
);

CREATE TABLE "account" (
	"id" text PRIMARY KEY NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"user_id" text NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" timestamp,
	"refresh_token_expires_at" timestamp,
	"scope" text,
	"password" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp NOT NULL
);

CREATE TABLE "session" (
	"id" text PRIMARY KEY NOT NULL,
	"expires_at" timestamp NOT NULL,
	"token" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"user_id" text NOT NULL,
	CONSTRAINT "session_token_unique" UNIQUE("token")
);

CREATE TABLE "user" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"image" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "user_email_unique" UNIQUE("email")
);

CREATE TABLE "verification" (
	"id" text PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);

ALTER TABLE "caja_notifications" ADD CONSTRAINT "caja_notifications_request_id_caja_requests_id_fk" FOREIGN KEY ("request_id") REFERENCES "public"."caja_requests"("id") ON DELETE restrict ON UPDATE no action;
ALTER TABLE "caja_requests" ADD CONSTRAINT "caja_requests_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE restrict ON UPDATE no action;
ALTER TABLE "caja_requests" ADD CONSTRAINT "caja_requests_draft_document_id_sale_documents_id_fk" FOREIGN KEY ("draft_document_id") REFERENCES "public"."sale_documents"("id") ON DELETE restrict ON UPDATE no action;
ALTER TABLE "caja_requests" ADD CONSTRAINT "caja_requests_finalized_document_id_sale_documents_id_fk" FOREIGN KEY ("finalized_document_id") REFERENCES "public"."sale_documents"("id") ON DELETE restrict ON UPDATE no action;
ALTER TABLE "caja_requests" ADD CONSTRAINT "caja_requests_assigned_to_user_id_fk" FOREIGN KEY ("assigned_to") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;
ALTER TABLE "coupon_redemptions" ADD CONSTRAINT "coupon_redemptions_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE restrict ON UPDATE no action;
ALTER TABLE "coupon_redemptions" ADD CONSTRAINT "coupon_redemptions_coupon_id_coupons_id_fk" FOREIGN KEY ("coupon_id") REFERENCES "public"."coupons"("id") ON DELETE restrict ON UPDATE no action;
ALTER TABLE "drive_file_reader_grants" ADD CONSTRAINT "drive_file_reader_grants_request_id_caja_requests_id_fk" FOREIGN KEY ("request_id") REFERENCES "public"."caja_requests"("id") ON DELETE restrict ON UPDATE no action;
ALTER TABLE "order_activity" ADD CONSTRAINT "order_activity_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE restrict ON UPDATE no action;
ALTER TABLE "order_activity" ADD CONSTRAINT "order_activity_actor_user_id_user_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;
ALTER TABLE "order_emails" ADD CONSTRAINT "order_emails_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE restrict ON UPDATE no action;
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE restrict ON UPDATE no action;
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_book_id_books_id_fk" FOREIGN KEY ("book_id") REFERENCES "public"."books"("id") ON DELETE restrict ON UPDATE no action;
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_promotion_id_promotions_id_fk" FOREIGN KEY ("promotion_id") REFERENCES "public"."promotions"("id") ON DELETE restrict ON UPDATE no action;
ALTER TABLE "order_notifications" ADD CONSTRAINT "order_notifications_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE restrict ON UPDATE no action;
ALTER TABLE "order_notifications" ADD CONSTRAINT "order_notifications_receipt_id_payment_receipts_id_fk" FOREIGN KEY ("receipt_id") REFERENCES "public"."payment_receipts"("id") ON DELETE restrict ON UPDATE no action;
ALTER TABLE "orders" ADD CONSTRAINT "orders_payment_guide_hash_payment_guides_hash_fk" FOREIGN KEY ("payment_guide_hash") REFERENCES "public"."payment_guides"("hash") ON DELETE restrict ON UPDATE no action;
ALTER TABLE "orders" ADD CONSTRAINT "orders_customer_campus_campuses_id_fk" FOREIGN KEY ("customer_campus") REFERENCES "public"."campuses"("id") ON DELETE restrict ON UPDATE no action;
ALTER TABLE "orders" ADD CONSTRAINT "orders_delivery_campus_campuses_id_fk" FOREIGN KEY ("delivery_campus") REFERENCES "public"."campuses"("id") ON DELETE restrict ON UPDATE no action;
ALTER TABLE "orders" ADD CONSTRAINT "orders_pickup_contact_id_pickup_contacts_id_fk" FOREIGN KEY ("pickup_contact_id") REFERENCES "public"."pickup_contacts"("id") ON DELETE restrict ON UPDATE no action;
ALTER TABLE "orders" ADD CONSTRAINT "orders_coupon_id_coupons_id_fk" FOREIGN KEY ("coupon_id") REFERENCES "public"."coupons"("id") ON DELETE restrict ON UPDATE no action;
ALTER TABLE "orders" ADD CONSTRAINT "orders_submitted_receipt_universidad_payment_receipts_id_fk" FOREIGN KEY ("submitted_receipt_universidad") REFERENCES "public"."payment_receipts"("id") ON DELETE restrict ON UPDATE no action;
ALTER TABLE "orders" ADD CONSTRAINT "orders_submitted_receipt_instituto_payment_receipts_id_fk" FOREIGN KEY ("submitted_receipt_instituto") REFERENCES "public"."payment_receipts"("id") ON DELETE restrict ON UPDATE no action;
ALTER TABLE "orders" ADD CONSTRAINT "orders_assigned_to_user_id_fk" FOREIGN KEY ("assigned_to") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;
ALTER TABLE "payment_receipts" ADD CONSTRAINT "payment_receipts_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE restrict ON UPDATE no action;
ALTER TABLE "payment_receipts" ADD CONSTRAINT "payment_receipts_upload_id_payment_uploads_id_fk" FOREIGN KEY ("upload_id") REFERENCES "public"."payment_uploads"("id") ON DELETE restrict ON UPDATE no action;
ALTER TABLE "payment_uploads" ADD CONSTRAINT "payment_uploads_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE restrict ON UPDATE no action;
ALTER TABLE "pickup_evidence" ADD CONSTRAINT "pickup_evidence_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE restrict ON UPDATE no action;
ALTER TABLE "pickup_evidence" ADD CONSTRAINT "pickup_evidence_actor_user_id_user_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;
ALTER TABLE "pickup_notifications" ADD CONSTRAINT "pickup_notifications_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE restrict ON UPDATE no action;
ALTER TABLE "pickup_notifications" ADD CONSTRAINT "pickup_notifications_contact_id_pickup_contacts_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."pickup_contacts"("id") ON DELETE restrict ON UPDATE no action;
ALTER TABLE "promotion_books" ADD CONSTRAINT "promotion_books_promotion_id_promotions_id_fk" FOREIGN KEY ("promotion_id") REFERENCES "public"."promotions"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "promotion_books" ADD CONSTRAINT "promotion_books_book_id_books_id_fk" FOREIGN KEY ("book_id") REFERENCES "public"."books"("id") ON DELETE restrict ON UPDATE no action;
ALTER TABLE "sale_document_batches" ADD CONSTRAINT "sale_document_batches_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE restrict ON UPDATE no action;
ALTER TABLE "sale_documents" ADD CONSTRAINT "sale_documents_request_id_caja_requests_id_fk" FOREIGN KEY ("request_id") REFERENCES "public"."caja_requests"("id") ON DELETE restrict ON UPDATE no action;
ALTER TABLE "treasury_activity" ADD CONSTRAINT "treasury_activity_request_id_caja_requests_id_fk" FOREIGN KEY ("request_id") REFERENCES "public"."caja_requests"("id") ON DELETE restrict ON UPDATE no action;
ALTER TABLE "treasury_activity" ADD CONSTRAINT "treasury_activity_actor_id_user_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;
ALTER TABLE "treasury_notes" ADD CONSTRAINT "treasury_notes_request_id_caja_requests_id_fk" FOREIGN KEY ("request_id") REFERENCES "public"."caja_requests"("id") ON DELETE restrict ON UPDATE no action;
ALTER TABLE "treasury_notes" ADD CONSTRAINT "treasury_notes_actor_id_user_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;
ALTER TABLE "treasury_observations" ADD CONSTRAINT "treasury_observations_request_id_caja_requests_id_fk" FOREIGN KEY ("request_id") REFERENCES "public"."caja_requests"("id") ON DELETE restrict ON UPDATE no action;
ALTER TABLE "treasury_supporting_files" ADD CONSTRAINT "treasury_supporting_files_request_id_caja_requests_id_fk" FOREIGN KEY ("request_id") REFERENCES "public"."caja_requests"("id") ON DELETE restrict ON UPDATE no action;
ALTER TABLE "treasury_supporting_files" ADD CONSTRAINT "treasury_supporting_files_actor_id_user_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;
ALTER TABLE "account" ADD CONSTRAINT "account_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "session" ADD CONSTRAINT "session_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
CREATE INDEX "authorized_emails_caja_imprint_idx" ON "authorized_emails" USING btree ("publisher_imprint") WHERE "authorized_emails"."role" = 'caja';
CREATE UNIQUE INDEX "bank_accounts_unique" ON "bank_accounts" USING btree ("publisher_imprint",lower(btrim("bank")),regexp_replace("account", '[ -]', '', 'g'));
CREATE INDEX "books_status_imprint_idx" ON "books" USING btree ("status","publisher_imprint");
CREATE UNIQUE INDEX "caja_notifications_event_unique" ON "caja_notifications" USING btree ("request_id","cycle","event_type") WHERE "caja_notifications"."event_type" <> 'ASIGNACION';
CREATE UNIQUE INDEX "caja_notifications_assignment_unique" ON "caja_notifications" USING btree ("request_id","assignment_key") WHERE "caja_notifications"."event_type" = 'ASIGNACION';
CREATE UNIQUE INDEX "caja_requests_order_imprint_unique" ON "caja_requests" USING btree ("order_id","publisher_imprint");
CREATE INDEX "caja_requests_assigned_idx" ON "caja_requests" USING btree ("assigned_to","status");
CREATE INDEX "caja_requests_inbox_idx" ON "caja_requests" USING btree ("publisher_imprint","status","created_at");
CREATE UNIQUE INDEX "campuses_name_unique" ON "campuses" USING btree (lower(btrim("name")));
CREATE INDEX "coupon_redemptions_coupon_idx" ON "coupon_redemptions" USING btree ("coupon_id");
CREATE UNIQUE INDEX "drive_reader_grants_permission_unique" ON "drive_reader_grants" USING btree ("folder_id","permission_id");
CREATE INDEX "management_audit_created_at_idx" ON "management_audit" USING btree ("created_at");
CREATE INDEX "management_audit_target_idx" ON "management_audit" USING btree ("resource","target");
CREATE INDEX "order_activity_order_idx" ON "order_activity" USING btree ("order_id","created_at");
CREATE INDEX "order_activity_actor_idx" ON "order_activity" USING btree ("actor_user_id","created_at");
CREATE INDEX "order_items_order_id_idx" ON "order_items" USING btree ("order_id");
CREATE INDEX "order_items_book_id_idx" ON "order_items" USING btree ("book_id");
CREATE INDEX "order_notifications_order_idx" ON "order_notifications" USING btree ("order_id","created_at");
CREATE INDEX "orders_assigned_status_idx" ON "orders" USING btree ("assigned_to","order_status");
CREATE INDEX "orders_created_at_idx" ON "orders" USING btree ("created_at");
CREATE INDEX "orders_email_status_idx" ON "orders" USING btree ("customer_email","order_status");
CREATE INDEX "orders_status_created_at_idx" ON "orders" USING btree ("order_status","created_at");
CREATE INDEX "orders_payment_status_idx" ON "orders" USING btree ("payment_status_universidad","payment_status_instituto");
CREATE INDEX "orders_customer_campus_idx" ON "orders" USING btree ("customer_campus");
CREATE INDEX "orders_delivery_campus_idx" ON "orders" USING btree ("delivery_campus");
CREATE INDEX "payment_receipts_order_imprint_idx" ON "payment_receipts" USING btree ("order_id","publisher_imprint");
CREATE INDEX "payment_uploads_order_idx" ON "payment_uploads" USING btree ("order_id");
CREATE UNIQUE INDEX "pickup_contacts_email_unique" ON "pickup_contacts" USING btree (lower(btrim("email")));
CREATE INDEX "pickup_evidence_order_idx" ON "pickup_evidence" USING btree ("order_id");
CREATE INDEX "promotion_books_book_idx" ON "promotion_books" USING btree ("book_id");
CREATE INDEX "promotions_dates_idx" ON "promotions" USING btree ("status","starts_at","ends_at");
CREATE INDEX "sale_documents_request_idx" ON "sale_documents" USING btree ("request_id");
CREATE INDEX "treasury_activity_request_idx" ON "treasury_activity" USING btree ("request_id","created_at");
CREATE INDEX "treasury_notes_request_idx" ON "treasury_notes" USING btree ("request_id","created_at");
CREATE INDEX "treasury_observations_request_idx" ON "treasury_observations" USING btree ("request_id","resolved_at");
CREATE INDEX "treasury_supporting_request_idx" ON "treasury_supporting_files" USING btree ("request_id");
CREATE INDEX "account_userId_idx" ON "account" USING btree ("user_id");
CREATE INDEX "session_userId_idx" ON "session" USING btree ("user_id");
CREATE INDEX "verification_identifier_idx" ON "verification" USING btree ("identifier");
