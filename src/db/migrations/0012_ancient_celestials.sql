CREATE TABLE "caja_notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"request_id" uuid NOT NULL,
	"cycle" integer NOT NULL,
	"event_type" text NOT NULL,
	"reason" text,
	"status" text DEFAULT 'PENDIENTE' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"last_attempt_at" timestamp with time zone,
	"gmail_message_id" text,
	"rfc_message_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "caja_notifications_event" CHECK ("caja_notifications"."event_type" IN ('SOLICITUD','FINALIZADA','DEVUELTA')),
	CONSTRAINT "caja_notifications_state" CHECK ("caja_notifications"."status" IN ('PENDIENTE','ENVIANDO','ENVIADO','ERROR'))
);
--> statement-breakpoint
CREATE TABLE "caja_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" uuid NOT NULL,
	"publisher_imprint" "publisher_imprint" NOT NULL,
	"status" text DEFAULT 'PENDIENTE' NOT NULL,
	"cycle" integer DEFAULT 1 NOT NULL,
	"draft_document_id" uuid,
	"finalized_document_id" uuid,
	"return_reason" text,
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
	CONSTRAINT "caja_requests_state" CHECK ("caja_requests"."status" IN ('PENDIENTE','FINALIZADA','DEVUELTA') AND "caja_requests"."cycle" > 0),
	CONSTRAINT "caja_requests_finalized" CHECK ("caja_requests"."status" <> 'FINALIZADA' OR ("caja_requests"."finalized_document_id" IS NOT NULL AND "caja_requests"."finalized_at" IS NOT NULL AND "caja_requests"."finalized_by" IS NOT NULL))
);
--> statement-breakpoint
CREATE TABLE "sale_document_batches" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" uuid NOT NULL,
	"batch_key" text NOT NULL,
	"document_ids" jsonb NOT NULL,
	"correction" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sale_document_batches_batch_key_unique" UNIQUE("batch_key")
);
--> statement-breakpoint
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
--> statement-breakpoint
ALTER TABLE "order_notifications" DROP CONSTRAINT "order_notifications_valid_event";--> statement-breakpoint
ALTER TABLE "order_notifications" DROP CONSTRAINT "order_notifications_valid_status";--> statement-breakpoint
ALTER TABLE "order_notifications" DROP CONSTRAINT "order_notifications_event_fields";--> statement-breakpoint
ALTER TABLE "authorized_emails" ADD COLUMN "role" text DEFAULT 'gestor' NOT NULL;--> statement-breakpoint
ALTER TABLE "authorized_emails" ADD COLUMN "publisher_imprint" "publisher_imprint";--> statement-breakpoint
ALTER TABLE "caja_notifications" ADD CONSTRAINT "caja_notifications_request_id_caja_requests_id_fk" FOREIGN KEY ("request_id") REFERENCES "public"."caja_requests"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "caja_requests" ADD CONSTRAINT "caja_requests_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "caja_requests" ADD CONSTRAINT "caja_requests_draft_document_id_sale_documents_id_fk" FOREIGN KEY ("draft_document_id") REFERENCES "public"."sale_documents"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "caja_requests" ADD CONSTRAINT "caja_requests_finalized_document_id_sale_documents_id_fk" FOREIGN KEY ("finalized_document_id") REFERENCES "public"."sale_documents"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sale_document_batches" ADD CONSTRAINT "sale_document_batches_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sale_documents" ADD CONSTRAINT "sale_documents_request_id_caja_requests_id_fk" FOREIGN KEY ("request_id") REFERENCES "public"."caja_requests"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "caja_notifications_event_unique" ON "caja_notifications" USING btree ("request_id","cycle","event_type");--> statement-breakpoint
CREATE INDEX "caja_notifications_retry_idx" ON "caja_notifications" USING btree ("status","last_attempt_at");--> statement-breakpoint
CREATE UNIQUE INDEX "caja_requests_order_imprint_unique" ON "caja_requests" USING btree ("order_id","publisher_imprint");--> statement-breakpoint
CREATE INDEX "caja_requests_inbox_idx" ON "caja_requests" USING btree ("publisher_imprint","status","created_at");--> statement-breakpoint
CREATE INDEX "sale_documents_request_idx" ON "sale_documents" USING btree ("request_id");--> statement-breakpoint
CREATE UNIQUE INDEX "authorized_emails_caja_imprint_unique" ON "authorized_emails" USING btree ("publisher_imprint") WHERE "authorized_emails"."role" = 'caja';--> statement-breakpoint
ALTER TABLE "authorized_emails" ADD CONSTRAINT "authorized_emails_role" CHECK (("authorized_emails"."role" = 'gestor' AND "authorized_emails"."publisher_imprint" IS NULL) OR ("authorized_emails"."role" = 'caja' AND "authorized_emails"."publisher_imprint" IS NOT NULL));--> statement-breakpoint
ALTER TABLE "authorized_emails" ADD CONSTRAINT "authorized_emails_master_role" CHECK ("authorized_emails"."email" <> 'distribucionfe@continental.edu.pe' OR "authorized_emails"."role" = 'gestor');--> statement-breakpoint
ALTER TABLE "order_notifications" ADD CONSTRAINT "order_notifications_valid_event" CHECK ("order_notifications"."event_type" IN ('COMPROBANTE_RECIBIDO', 'PAGO_VERIFICADO', 'PAGO_RECHAZADO', 'ASIGNADO', 'DESPACHADO', 'ENTREGADO', 'DOCUMENTOS_VENTA'));--> statement-breakpoint
ALTER TABLE "order_notifications" ADD CONSTRAINT "order_notifications_valid_status" CHECK ("order_notifications"."status" IN ('PENDIENTE', 'ENVIANDO', 'ENVIADO', 'ERROR', 'OMITIDO'));--> statement-breakpoint
ALTER TABLE "order_notifications" ADD CONSTRAINT "order_notifications_event_fields" CHECK (("order_notifications"."event_type" = 'COMPROBANTE_RECIBIDO' AND "order_notifications"."publisher_imprint" IS NOT NULL AND "order_notifications"."receipt_id" IS NOT NULL) OR ("order_notifications"."event_type" IN ('PAGO_VERIFICADO', 'PAGO_RECHAZADO') AND "order_notifications"."publisher_imprint" IS NOT NULL) OR "order_notifications"."event_type" IN ('ASIGNADO', 'DESPACHADO', 'ENTREGADO', 'DOCUMENTOS_VENTA'));