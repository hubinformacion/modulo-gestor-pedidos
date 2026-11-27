BEGIN;
SET LOCAL lock_timeout = '10s';
LOCK TABLE authorized_emails IN SHARE ROW EXCLUSIVE MODE;

-- The previous deployment's permissions cron still needs the old tables.
-- Remove authorizations, never convert them to Fondo Editorial accounts.
WITH revoked AS (
  DELETE FROM authorized_emails
  WHERE role = 'caja'
  RETURNING email
)
DELETE FROM "session" AS s
USING "user" AS u, revoked AS r
WHERE s.user_id = u.id AND u.email = r.email;

ALTER TABLE authorized_emails
  ADD CONSTRAINT authorized_emails_treasury_closed CHECK (role = 'gestor');

COMMIT;
