DROP INDEX "authorized_emails_caja_imprint_unique";--> statement-breakpoint
ALTER TABLE "caja_requests" ADD COLUMN "assigned_to" text;--> statement-breakpoint
ALTER TABLE "caja_requests" ADD COLUMN "assigned_name" text;--> statement-breakpoint
ALTER TABLE "caja_requests" ADD COLUMN "assigned_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "caja_requests" ADD COLUMN "assignment_token" uuid;--> statement-breakpoint
ALTER TABLE "caja_requests" ADD CONSTRAINT "caja_requests_assigned_to_user_id_fk" FOREIGN KEY ("assigned_to") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "authorized_emails_caja_imprint_idx" ON "authorized_emails" USING btree ("publisher_imprint") WHERE "authorized_emails"."role" = 'caja';--> statement-breakpoint
CREATE INDEX "caja_requests_assigned_idx" ON "caja_requests" USING btree ("assigned_to","status");--> statement-breakpoint
ALTER TABLE "caja_requests" ADD CONSTRAINT "caja_requests_assignment" CHECK (("caja_requests"."assigned_to" IS NULL AND "caja_requests"."assigned_name" IS NULL AND "caja_requests"."assigned_at" IS NULL AND "caja_requests"."assignment_token" IS NULL) OR ("caja_requests"."assigned_to" IS NOT NULL AND "caja_requests"."assigned_name" IS NOT NULL AND "caja_requests"."assigned_at" IS NOT NULL AND "caja_requests"."assignment_token" IS NOT NULL));