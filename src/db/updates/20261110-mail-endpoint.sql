-- Additive update for operational data; no reset, backfill, or changes to applied SQL.
-- Historical Gmail metadata and provider NULL values remain unchanged.
BEGIN;

ALTER TABLE order_emails
  ADD COLUMN IF NOT EXISTS provider text,
  ADD COLUMN IF NOT EXISTS provider_message_id text;

ALTER TABLE order_notifications
  ADD COLUMN IF NOT EXISTS provider text,
  ADD COLUMN IF NOT EXISTS provider_message_id text;

ALTER TABLE caja_notifications
  ADD COLUMN IF NOT EXISTS provider text,
  ADD COLUMN IF NOT EXISTS provider_message_id text;

ALTER TABLE pickup_notifications
  ADD COLUMN IF NOT EXISTS provider text,
  ADD COLUMN IF NOT EXISTS provider_message_id text;

COMMIT;
