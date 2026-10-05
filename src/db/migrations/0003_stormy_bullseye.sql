CREATE TABLE "order_emails" (
	"order_id" uuid PRIMARY KEY NOT NULL,
	"status" text DEFAULT 'PENDIENTE' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"last_attempt_at" timestamp with time zone,
	"gmail_message_id" text,
	"sent_at" timestamp with time zone,
	CONSTRAINT "order_emails_valid_status" CHECK ("order_emails"."status" IN ('PENDIENTE', 'ENVIANDO', 'ENVIADO', 'ERROR'))
);
--> statement-breakpoint
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
--> statement-breakpoint
ALTER TABLE "order_items" ADD COLUMN "book_title" text;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "request_id" uuid;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "draft_hash" text;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "consent_accepted_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "consent_version" text;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "payment_accounts" jsonb;--> statement-breakpoint
ALTER TABLE "payment_receipts" ADD COLUMN "upload_id" uuid;--> statement-breakpoint
ALTER TABLE "order_emails" ADD CONSTRAINT "order_emails_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_uploads" ADD CONSTRAINT "payment_uploads_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "payment_uploads_order_idx" ON "payment_uploads" USING btree ("order_id");--> statement-breakpoint
ALTER TABLE "payment_receipts" ADD CONSTRAINT "payment_receipts_upload_id_payment_uploads_id_fk" FOREIGN KEY ("upload_id") REFERENCES "public"."payment_uploads"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_request_id_unique" UNIQUE("request_id");--> statement-breakpoint
ALTER TABLE "payment_receipts" ADD CONSTRAINT "payment_receipts_upload_id_unique" UNIQUE("upload_id");