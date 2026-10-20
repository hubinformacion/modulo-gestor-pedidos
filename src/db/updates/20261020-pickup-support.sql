-- Aplicar una vez, con respaldo previo, antes de desplegar la versión de recojo.
-- No borra pedidos, no cambia importes y no envía mensajes.
BEGIN;
SET LOCAL lock_timeout = '10s';
SET LOCAL statement_timeout = '30s';

CREATE TABLE "pickup_contacts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"status" "book_status" DEFAULT 'ACTIVO' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "pickup_contacts_nonempty" CHECK (btrim("pickup_contacts"."name") <> '' AND "pickup_contacts"."email" = lower(btrim("pickup_contacts"."email")))
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

ALTER TABLE "campuses" ADD COLUMN "pickup_hours" text DEFAULT '' NOT NULL;
ALTER TABLE "orders" ADD COLUMN "delivery_pickup_hours" text,
 ADD COLUMN "pickup_contact_id" uuid, ADD COLUMN "pickup_contact_name" text, ADD COLUMN "pickup_contact_email" text;
ALTER TABLE "coupons" ADD COLUMN "scope" text DEFAULT 'all' NOT NULL,
 ADD COLUMN "book_ids" jsonb DEFAULT '[]'::jsonb NOT NULL;

ALTER TABLE "orders" ADD CONSTRAINT "orders_pickup_contact_id_pickup_contacts_id_fk" FOREIGN KEY ("pickup_contact_id") REFERENCES "public"."pickup_contacts"("id") ON DELETE restrict ON UPDATE no action;

ALTER TABLE "pickup_notifications" ADD CONSTRAINT "pickup_notifications_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE restrict ON UPDATE no action;

ALTER TABLE "pickup_notifications" ADD CONSTRAINT "pickup_notifications_contact_id_pickup_contacts_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."pickup_contacts"("id") ON DELETE restrict ON UPDATE no action;

CREATE UNIQUE INDEX "pickup_contacts_email_unique" ON "pickup_contacts" USING btree (lower(btrim("email")));

ALTER TABLE "coupons" ADD CONSTRAINT "coupons_scope" CHECK ("coupons"."scope" IN ('all','selected') AND jsonb_typeof("coupons"."book_ids") = 'array' AND ("coupons"."scope" = 'all' OR jsonb_array_length("coupons"."book_ids") > 0));

UPDATE "campuses" SET "pickup_hours" = CASE
 WHEN "name" = 'Lima - Miraflores' THEN 'Martes, jueves y viernes, de 9:00 a. m. a 5:00 p. m.'
 ELSE 'Lunes a viernes, de 9:00 a. m. a 7:00 p. m.' END,
 "updated_at" = now()
 WHERE "pickup_hours" = '' AND "name" IN ('Arequipa','Ayacucho','Cusco','Huancayo - Instituto','Huancayo - Universidad','Ica','Lima - Los Olivos','Lima - Miraflores');
COMMIT;
