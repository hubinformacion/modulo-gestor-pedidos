-- Reconcile unsent legacy per-imprint notices; never resend accepted Gmail mail.
DELETE FROM "order_notifications" n USING "orders" o
WHERE n.order_id = o.id AND o.order_type = 'mixto'
  AND n.status <> 'ENVIADO'
  AND ((n.event_type = 'COMPROBANTE_RECIBIDO' AND NOT (
    o.payment_status_universidad IN ('EN_REVISION','VERIFICADO')
    AND o.payment_status_instituto IN ('EN_REVISION','VERIFICADO')))
    OR (n.event_type = 'PAGO_VERIFICADO' AND NOT (
      o.payment_status_universidad = 'VERIFICADO'
      AND o.payment_status_instituto = 'VERIFICADO')));
--> statement-breakpoint
WITH ranked AS (
  SELECT n.id, row_number() OVER (
    PARTITION BY n.order_id, n.event_type ORDER BY n.created_at DESC, n.id DESC
  ) AS position
  FROM "order_notifications" n JOIN "orders" o ON o.id = n.order_id
  WHERE o.order_type = 'mixto' AND n.status <> 'ENVIADO'
    AND n.event_type IN ('COMPROBANTE_RECIBIDO','PAGO_VERIFICADO')
)
DELETE FROM "order_notifications" n USING ranked r
WHERE n.id = r.id AND r.position > 1;
--> statement-breakpoint
UPDATE "order_notifications" n SET payload = n.payload || '{"scope":"pedido"}'::jsonb
FROM "orders" o WHERE o.id = n.order_id AND o.order_type = 'mixto'
  AND n.status <> 'ENVIADO' AND n.event_type IN ('COMPROBANTE_RECIBIDO','PAGO_VERIFICADO');
