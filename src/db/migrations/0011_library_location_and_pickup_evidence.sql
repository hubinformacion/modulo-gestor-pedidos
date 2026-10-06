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
--> statement-breakpoint
ALTER TABLE "campuses" ADD COLUMN "library_location" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "delivery_library_location" text;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "delivery_map_url" text;--> statement-breakpoint
ALTER TABLE "pickup_evidence" ADD CONSTRAINT "pickup_evidence_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pickup_evidence" ADD CONSTRAINT "pickup_evidence_actor_user_id_user_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "pickup_evidence_order_idx" ON "pickup_evidence" USING btree ("order_id");