CREATE TABLE "order_notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" uuid NOT NULL,
	"event_type" text NOT NULL,
	"publisher_imprint" "publisher_imprint",
	"receipt_id" uuid,
	"status" text DEFAULT 'PENDIENTE' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"last_attempt_at" timestamp with time zone,
	"gmail_message_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "order_notifications_valid_event" CHECK ("order_notifications"."event_type" IN ('COMPROBANTE_RECIBIDO', 'PAGO_VERIFICADO', 'PAGO_RECHAZADO')),
	CONSTRAINT "order_notifications_valid_status" CHECK ("order_notifications"."status" IN ('PENDIENTE', 'ENVIANDO', 'ENVIADO', 'ERROR')),
	CONSTRAINT "order_notifications_event_fields" CHECK (("order_notifications"."event_type" = 'COMPROBANTE_RECIBIDO' AND "order_notifications"."publisher_imprint" IS NOT NULL AND "order_notifications"."receipt_id" IS NOT NULL) OR ("order_notifications"."event_type" IN ('PAGO_VERIFICADO', 'PAGO_RECHAZADO') AND "order_notifications"."publisher_imprint" IS NOT NULL))
);
--> statement-breakpoint
ALTER TABLE "order_emails" ADD COLUMN "gmail_thread_id" text;--> statement-breakpoint
ALTER TABLE "order_emails" ADD COLUMN "rfc_message_id" text;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "submitted_receipt_universidad" uuid;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "submitted_receipt_instituto" uuid;--> statement-breakpoint
ALTER TABLE "order_notifications" ADD CONSTRAINT "order_notifications_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_notifications" ADD CONSTRAINT "order_notifications_receipt_id_payment_receipts_id_fk" FOREIGN KEY ("receipt_id") REFERENCES "public"."payment_receipts"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "order_notifications_order_idx" ON "order_notifications" USING btree ("order_id","created_at");--> statement-breakpoint
CREATE INDEX "order_notifications_retry_idx" ON "order_notifications" USING btree ("status","last_attempt_at");--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_submitted_receipt_universidad_payment_receipts_id_fk" FOREIGN KEY ("submitted_receipt_universidad") REFERENCES "public"."payment_receipts"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_submitted_receipt_instituto_payment_receipts_id_fk" FOREIGN KEY ("submitted_receipt_instituto") REFERENCES "public"."payment_receipts"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
-- Existing reviewed receipts remain the submitted baseline after the new flow.
UPDATE "orders" SET
  "submitted_receipt_universidad" = CASE WHEN "payment_status_universidad" IN ('EN_REVISION', 'VERIFICADO', 'RECHAZADO') THEN (
    SELECT "id" FROM "payment_receipts" WHERE "order_id" = "orders"."id" AND "publisher_imprint" = 'universidad' ORDER BY "uploaded_at" DESC, "id" DESC LIMIT 1
  ) ELSE NULL END,
  "submitted_receipt_instituto" = CASE WHEN "payment_status_instituto" IN ('EN_REVISION', 'VERIFICADO', 'RECHAZADO') THEN (
    SELECT "id" FROM "payment_receipts" WHERE "order_id" = "orders"."id" AND "publisher_imprint" = 'instituto' ORDER BY "uploaded_at" DESC, "id" DESC LIMIT 1
  ) ELSE NULL END;
