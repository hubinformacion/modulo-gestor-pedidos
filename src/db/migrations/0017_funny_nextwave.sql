CREATE TABLE "treasury_activity" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"request_id" uuid NOT NULL,
	"actor_id" text,
	"actor_name" text NOT NULL,
	"event" text NOT NULL,
	"detail" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "treasury_mailboxes" (
	"publisher_imprint" "publisher_imprint" PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "treasury_mailboxes_email" CHECK ("treasury_mailboxes"."email" = lower(btrim("treasury_mailboxes"."email")))
);
--> statement-breakpoint
CREATE TABLE "treasury_notes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"request_id" uuid NOT NULL,
	"actor_id" text,
	"actor_name" text NOT NULL,
	"content" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "treasury_observations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"request_id" uuid NOT NULL,
	"category" text NOT NULL,
	"content" text NOT NULL,
	"actor_name" text NOT NULL,
	"correction" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"resolved_at" timestamp with time zone,
	"resolved_by" text,
	"response" text
);
--> statement-breakpoint
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
--> statement-breakpoint
ALTER TABLE "authorized_emails" ADD COLUMN "publisher_imprints" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "authorized_emails" ADD COLUMN "treasury_service" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "billing_address" text;--> statement-breakpoint
ALTER TABLE "treasury_activity" ADD CONSTRAINT "treasury_activity_request_id_caja_requests_id_fk" FOREIGN KEY ("request_id") REFERENCES "public"."caja_requests"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "treasury_activity" ADD CONSTRAINT "treasury_activity_actor_id_user_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "treasury_notes" ADD CONSTRAINT "treasury_notes_request_id_caja_requests_id_fk" FOREIGN KEY ("request_id") REFERENCES "public"."caja_requests"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "treasury_notes" ADD CONSTRAINT "treasury_notes_actor_id_user_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "treasury_observations" ADD CONSTRAINT "treasury_observations_request_id_caja_requests_id_fk" FOREIGN KEY ("request_id") REFERENCES "public"."caja_requests"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "treasury_supporting_files" ADD CONSTRAINT "treasury_supporting_files_request_id_caja_requests_id_fk" FOREIGN KEY ("request_id") REFERENCES "public"."caja_requests"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "treasury_supporting_files" ADD CONSTRAINT "treasury_supporting_files_actor_id_user_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "treasury_activity_request_idx" ON "treasury_activity" USING btree ("request_id","created_at");--> statement-breakpoint
CREATE INDEX "treasury_notes_request_idx" ON "treasury_notes" USING btree ("request_id","created_at");--> statement-breakpoint
CREATE INDEX "treasury_observations_request_idx" ON "treasury_observations" USING btree ("request_id","resolved_at");--> statement-breakpoint
CREATE INDEX "treasury_supporting_request_idx" ON "treasury_supporting_files" USING btree ("request_id");--> statement-breakpoint
ALTER TABLE "authorized_emails" ADD CONSTRAINT "authorized_emails_scope" CHECK (jsonb_typeof("authorized_emails"."publisher_imprints") = 'array' AND "authorized_emails"."publisher_imprints" <@ '["universidad","instituto"]'::jsonb AND ("authorized_emails"."role" = 'caja' OR ("authorized_emails"."publisher_imprints" = '[]'::jsonb AND "authorized_emails"."treasury_service" = false)));