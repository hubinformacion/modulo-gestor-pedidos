CREATE TABLE "drive_file_reader_grants" (
	"drive_file_id" text NOT NULL,
	"email" text NOT NULL,
	"request_id" uuid NOT NULL,
	"permission_id" text,
	"managed" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "drive_file_reader_grants_drive_file_id_email_pk" PRIMARY KEY("drive_file_id","email")
);
--> statement-breakpoint
ALTER TABLE "caja_notifications" DROP CONSTRAINT "caja_notifications_event";--> statement-breakpoint
ALTER TABLE "caja_notifications" DROP CONSTRAINT "caja_notifications_state";--> statement-breakpoint
ALTER TABLE "caja_requests" DROP CONSTRAINT "caja_requests_state";--> statement-breakpoint
ALTER TABLE "order_notifications" DROP CONSTRAINT "order_notifications_valid_event";--> statement-breakpoint
ALTER TABLE "order_notifications" DROP CONSTRAINT "order_notifications_event_fields";--> statement-breakpoint
ALTER TABLE "order_items" ADD COLUMN "book_code" text;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "cancelled_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "cancellation_source" text;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "cancellation_reason" text;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "stock_restored_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "drive_file_reader_grants" ADD CONSTRAINT "drive_file_reader_grants_request_id_caja_requests_id_fk" FOREIGN KEY ("request_id") REFERENCES "public"."caja_requests"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "caja_notifications" ADD CONSTRAINT "caja_notifications_event" CHECK ("caja_notifications"."event_type" IN ('SOLICITUD','FINALIZADA','DEVUELTA','ANULADA'));--> statement-breakpoint
ALTER TABLE "caja_notifications" ADD CONSTRAINT "caja_notifications_state" CHECK ("caja_notifications"."status" IN ('PENDIENTE','ENVIANDO','ENVIADO','ERROR','OMITIDO'));--> statement-breakpoint
ALTER TABLE "caja_requests" ADD CONSTRAINT "caja_requests_state" CHECK ("caja_requests"."status" IN ('PENDIENTE','FINALIZADA','DEVUELTA','ANULADA') AND "caja_requests"."cycle" > 0);--> statement-breakpoint
ALTER TABLE "order_notifications" ADD CONSTRAINT "order_notifications_valid_event" CHECK ("order_notifications"."event_type" IN ('COMPROBANTE_RECIBIDO', 'PAGO_VERIFICADO', 'PAGO_RECHAZADO', 'ASIGNADO', 'DESPACHADO', 'ENTREGADO', 'DOCUMENTOS_VENTA', 'CANCELADO'));--> statement-breakpoint
ALTER TABLE "order_notifications" ADD CONSTRAINT "order_notifications_event_fields" CHECK (("order_notifications"."event_type" = 'COMPROBANTE_RECIBIDO' AND "order_notifications"."publisher_imprint" IS NOT NULL AND "order_notifications"."receipt_id" IS NOT NULL) OR ("order_notifications"."event_type" IN ('PAGO_VERIFICADO', 'PAGO_RECHAZADO') AND "order_notifications"."publisher_imprint" IS NOT NULL) OR "order_notifications"."event_type" IN ('ASIGNADO', 'DESPACHADO', 'ENTREGADO', 'DOCUMENTOS_VENTA', 'CANCELADO'));