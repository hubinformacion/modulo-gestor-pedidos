CREATE TABLE "payment_guides" (
	"hash" text PRIMARY KEY NOT NULL,
	"content_base64" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "payment_guide_hash" text;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_payment_guide_hash_payment_guides_hash_fk" FOREIGN KEY ("payment_guide_hash") REFERENCES "public"."payment_guides"("hash") ON DELETE restrict ON UPDATE no action;