CREATE TABLE "order_activity" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" uuid NOT NULL,
	"actor_user_id" text,
	"actor_name" text,
	"event_type" text NOT NULL,
	"detail" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "order_notifications" DROP CONSTRAINT "order_notifications_valid_event";--> statement-breakpoint
ALTER TABLE "order_notifications" DROP CONSTRAINT "order_notifications_event_fields";--> statement-breakpoint
ALTER TABLE "order_emails" ADD COLUMN "subject_header" text;--> statement-breakpoint
ALTER TABLE "order_emails" ADD COLUMN "headers_verified" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "order_emails" ADD COLUMN "thread_issue" text;--> statement-breakpoint
ALTER TABLE "order_emails" ADD COLUMN "last_rfc_message_id" text;--> statement-breakpoint
ALTER TABLE "order_emails" ADD COLUMN "rfc_references" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "order_emails" ADD COLUMN "lease_id" uuid;--> statement-breakpoint
ALTER TABLE "order_emails" ADD COLUMN "lease_until" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "order_notifications" ADD COLUMN "payload" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "order_notifications" ADD COLUMN "rfc_message_id" text;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "assigned_to" text;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "assigned_name" text;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "assigned_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "rejection_universidad" text;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "rejection_instituto" text;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "shipping_tracking_code" text;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "shipping_tracking_url" text;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "dispatched_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "delivered_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "order_activity" ADD CONSTRAINT "order_activity_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_activity" ADD CONSTRAINT "order_activity_actor_user_id_user_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "order_activity_order_idx" ON "order_activity" USING btree ("order_id","created_at");--> statement-breakpoint
CREATE INDEX "order_activity_actor_idx" ON "order_activity" USING btree ("actor_user_id","created_at");--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_assigned_to_user_id_fk" FOREIGN KEY ("assigned_to") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "orders_assigned_status_idx" ON "orders" USING btree ("assigned_to","order_status");--> statement-breakpoint
ALTER TABLE "order_notifications" ADD CONSTRAINT "order_notifications_valid_event" CHECK ("order_notifications"."event_type" IN ('COMPROBANTE_RECIBIDO', 'PAGO_VERIFICADO', 'PAGO_RECHAZADO', 'ASIGNADO', 'DESPACHADO', 'ENTREGADO'));--> statement-breakpoint
ALTER TABLE "order_notifications" ADD CONSTRAINT "order_notifications_event_fields" CHECK (("order_notifications"."event_type" = 'COMPROBANTE_RECIBIDO' AND "order_notifications"."publisher_imprint" IS NOT NULL AND "order_notifications"."receipt_id" IS NOT NULL) OR ("order_notifications"."event_type" IN ('PAGO_VERIFICADO', 'PAGO_RECHAZADO') AND "order_notifications"."publisher_imprint" IS NOT NULL) OR "order_notifications"."event_type" IN ('ASIGNADO', 'DESPACHADO', 'ENTREGADO'));
--> statement-breakpoint
INSERT INTO "order_activity" ("order_id", "event_type", "detail", "created_at") SELECT "id", 'PEDIDO_RECIBIDO', 'Registramos tu pedido.', "created_at" FROM "orders";
--> statement-breakpoint
-- Existing files waiting for the former confirmation button now enter review.
WITH latest AS (
  SELECT DISTINCT ON ("order_id", "publisher_imprint") "id", "order_id", "publisher_imprint" FROM "payment_receipts" ORDER BY "order_id", "publisher_imprint", "uploaded_at" DESC, "id" DESC
), pending AS (
  SELECT l.* FROM latest l JOIN "orders" o ON o."id" = l."order_id" WHERE o."order_status" = 'PENDIENTE_PAGO' AND ((l."publisher_imprint" = 'universidad' AND o."payment_status_universidad" IN ('PENDIENTE','RECHAZADO') AND o."submitted_receipt_universidad" IS DISTINCT FROM l."id") OR (l."publisher_imprint" = 'instituto' AND o."payment_status_instituto" IN ('PENDIENTE','RECHAZADO') AND o."submitted_receipt_instituto" IS DISTINCT FROM l."id"))
), notifications AS (
  INSERT INTO "order_notifications" ("order_id", "event_type", "publisher_imprint", "receipt_id") SELECT "order_id", 'COMPROBANTE_RECIBIDO', "publisher_imprint", "id" FROM pending RETURNING "order_id", "publisher_imprint", "receipt_id"
), history AS (
  INSERT INTO "order_activity" ("order_id", "event_type", "detail") SELECT "order_id", 'COMPROBANTE_RECIBIDO', 'Recibimos un comprobante. Está en revisión.' FROM notifications RETURNING "order_id"
)
UPDATE "orders" o SET
  "payment_status_universidad" = CASE WHEN EXISTS (SELECT 1 FROM notifications n WHERE n."order_id" = o."id" AND n."publisher_imprint" = 'universidad') THEN 'EN_REVISION'::"payment_status" ELSE o."payment_status_universidad" END,
  "payment_status_instituto" = CASE WHEN EXISTS (SELECT 1 FROM notifications n WHERE n."order_id" = o."id" AND n."publisher_imprint" = 'instituto') THEN 'EN_REVISION'::"payment_status" ELSE o."payment_status_instituto" END,
  "submitted_receipt_universidad" = coalesce((SELECT "receipt_id" FROM notifications n WHERE n."order_id" = o."id" AND n."publisher_imprint" = 'universidad'), o."submitted_receipt_universidad"),
  "submitted_receipt_instituto" = coalesce((SELECT "receipt_id" FROM notifications n WHERE n."order_id" = o."id" AND n."publisher_imprint" = 'instituto'), o."submitted_receipt_instituto"),
  "updated_at" = now()
WHERE o."id" IN (SELECT "order_id" FROM notifications);
