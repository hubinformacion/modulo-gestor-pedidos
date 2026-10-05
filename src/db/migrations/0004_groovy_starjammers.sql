CREATE TABLE "bank_accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"publisher_imprint" "publisher_imprint" NOT NULL,
	"bank" text NOT NULL,
	"holder" text NOT NULL,
	"currency" text DEFAULT 'PEN' NOT NULL,
	"account" text NOT NULL,
	"cci" text NOT NULL,
	"status" "book_status" DEFAULT 'INACTIVO' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "bank_accounts_currency" CHECK ("bank_accounts"."currency" = 'PEN'),
	CONSTRAINT "bank_accounts_active_fields" CHECK ("bank_accounts"."status" <> 'ACTIVO' OR (btrim("bank_accounts"."bank") <> '' AND btrim("bank_accounts"."holder") <> '' AND "bank_accounts"."account" ~ '^[0-9 -]{5,40}$' AND "bank_accounts"."cci" ~ '^[0-9]{20}$'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX "bank_accounts_unique" ON "bank_accounts" USING btree ("publisher_imprint",lower(btrim("bank")),regexp_replace("account", '[ -]', '', 'g'));--> statement-breakpoint
-- Accounts supplied by the owner. University remains inactive until corrected.
INSERT INTO "bank_accounts" ("publisher_imprint", "bank", "holder", "currency", "account", "cci", "status") VALUES
('instituto', 'BCP', 'Corporación APEC SAC', 'PEN', '355-1737857-0-67', '00235500173785706769', 'ACTIVO'),
('instituto', 'BBVA', 'Corporación APEC SAC', 'PEN', '011-0235-0100038682', '01123500010003868299', 'ACTIVO'),
('universidad', 'BCP', '', 'PEN', '355-1144183-0-61', '0023550011441830666', 'INACTIVO'),
('universidad', 'BBVA', '', 'PEN', '0011-0235-0100038518', '01123500010003851895', 'INACTIVO')
ON CONFLICT DO NOTHING;
