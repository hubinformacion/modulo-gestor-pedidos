CREATE TYPE "public"."recipient_type" AS ENUM('comprador', 'otra_persona');--> statement-breakpoint
CREATE TABLE "campuses" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid()::text NOT NULL,
	"name" text NOT NULL,
	"library_address" text NOT NULL,
	"latitude" numeric(10, 7),
	"longitude" numeric(10, 7),
	"google_maps_embed_url" text,
	"status" "book_status" DEFAULT 'ACTIVO' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "campuses_nonempty_fields" CHECK (btrim("campuses"."name") <> '' AND btrim("campuses"."library_address") <> ''),
	CONSTRAINT "campuses_valid_coordinates" CHECK (("campuses"."latitude" IS NULL AND "campuses"."longitude" IS NULL) OR ("campuses"."latitude" IS NOT NULL AND "campuses"."longitude" IS NOT NULL AND "campuses"."latitude" BETWEEN -90 AND 90 AND "campuses"."longitude" BETWEEN -180 AND 180)),
	CONSTRAINT "campuses_valid_map_url" CHECK ("campuses"."google_maps_embed_url" IS NULL OR "campuses"."google_maps_embed_url" ~ '^https://(www[.]google[.]com|maps[.]google[.]com)/maps/embed([?]|/)')
);
--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "delivery_province" text;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "delivery_district" text;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "delivery_ubigeo" text;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "delivery_recipient_type" "recipient_type" DEFAULT 'comprador' NOT NULL;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "delivery_recipient_document" text;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "delivery_recipient_phone" text;--> statement-breakpoint
CREATE UNIQUE INDEX "campuses_name_unique" ON "campuses" USING btree (lower(btrim("name")));--> statement-breakpoint
-- Initial campus addresses supplied by the owner; applied once, never restored by db:seed.
INSERT INTO "campuses" ("id", "name", "library_address") VALUES
('arequipa', 'Arequipa', 'La Canseco II / Sector: Valle Chili, José Luis Bustamante y Rivero - Arequipa'),
('ayacucho', 'Ayacucho', 'Av. Javier Pérez de Cuéllar 725, Ayacucho'),
('cusco', 'Cusco', 'Sector Angostura Km. 10, carretera Cusco - Saylla, San Jerónimo, Cusco'),
('huancayo-instituto', 'Huancayo - Instituto', 'Calle Real 125, Huancayo - Junín'),
('huancayo-universidad', 'Huancayo - Universidad', 'Av. San Carlos 1980, Huancayo'),
('ica', 'Ica', 'Calle C N° 201 - Parque Industrial, Ica'),
('lima-los-olivos', 'Lima - Los Olivos', 'Av. Alfredo Mendiola 5210 - Los Olivos'),
('lima-miraflores', 'Lima - Miraflores', 'Calle Junín 355, Miraflores - Lima')
ON CONFLICT DO NOTHING;
--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_customer_campus_campuses_id_fk" FOREIGN KEY ("customer_campus") REFERENCES "public"."campuses"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_delivery_campus_campuses_id_fk" FOREIGN KEY ("delivery_campus") REFERENCES "public"."campuses"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "orders_customer_campus_idx" ON "orders" USING btree ("customer_campus");--> statement-breakpoint
CREATE INDEX "orders_delivery_campus_idx" ON "orders" USING btree ("delivery_campus");--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_other_recipient_fields" CHECK ("orders"."delivery_recipient_type" <> 'otra_persona' OR (coalesce("orders"."delivery_recipient_document", '') ~ '^[0-9]{8}$' AND coalesce("orders"."delivery_recipient_phone", '') ~ '^[+]?[0-9 ()-]{7,24}$'));--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_ubigeo_zone" CHECK ("orders"."delivery_ubigeo" IS NULL OR ("orders"."delivery_type" = 'delivery' AND "orders"."delivery_ubigeo" ~ '^[0-9]{6}$' AND (("orders"."delivery_zone" = 'lima_callao' AND left("orders"."delivery_ubigeo", 4) IN ('1501', '0701')) OR ("orders"."delivery_zone" = 'provincia' AND left("orders"."delivery_ubigeo", 4) NOT IN ('1501', '0701')))));