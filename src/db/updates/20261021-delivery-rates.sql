-- Aplicar una vez antes del despliegue; conserva importes de pedidos anteriores.
BEGIN;
SET LOCAL lock_timeout = '10s';
SET LOCAL statement_timeout = '30s';

CREATE TABLE "delivery_rates" (
	"zone" "delivery_zone" PRIMARY KEY NOT NULL,
	"price" numeric(12, 2) NOT NULL,
	"status" "book_status" DEFAULT 'ACTIVO' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "delivery_rates_price" CHECK ("delivery_rates"."price" >= 0 AND "delivery_rates"."price" <= 999999.99)
);

ALTER TABLE orders DROP CONSTRAINT orders_delivery_fields;
ALTER TABLE orders ADD CONSTRAINT orders_delivery_fields CHECK (btrim("orders"."delivery_address") <> '' AND btrim("orders"."delivery_recipient") <> '' AND (
    ("orders"."delivery_type" = 'recojo_campus' AND coalesce(btrim("orders"."delivery_campus"), '') <> '' AND "orders"."delivery_zone" IS NULL AND "orders"."shipping_cost" = 0)
    OR ("orders"."delivery_type" = 'delivery' AND "orders"."delivery_campus" IS NULL AND "orders"."delivery_zone" IS NOT NULL AND (
      ("orders"."delivery_zone" = 'lima_callao')
      OR ("orders"."delivery_zone" = 'provincia' AND coalesce(btrim("orders"."delivery_department"), '') <> '' AND coalesce(btrim("orders"."delivery_city"), '') <> '')
    ))
  ));

INSERT INTO delivery_rates (zone, price, status) VALUES ('lima_callao',15.00,'ACTIVO'),('provincia',25.00,'ACTIVO');
COMMIT;
