-- Assignment remains audited internally; do not send obsolete assignment notices.
-- Preserve notifications Gmail has already accepted.
DELETE FROM "order_notifications"
WHERE "event_type" = 'ASIGNADO' AND "status" <> 'ENVIADO';
