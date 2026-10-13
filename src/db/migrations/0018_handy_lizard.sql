-- Apply with the old cron disabled and request traffic paused during rollout.
-- Never send anything from a migration. Preserve accepted delivery history.
SELECT 1 / CASE WHEN EXISTS (SELECT 1 FROM order_emails WHERE lease_until > now()) OR EXISTS (SELECT 1 FROM caja_requests WHERE lease_until > now()) THEN 0 ELSE 1 END;
--> statement-breakpoint
ALTER TABLE "caja_notifications" DROP CONSTRAINT "caja_notifications_state";--> statement-breakpoint
ALTER TABLE "order_emails" DROP CONSTRAINT "order_emails_valid_status";--> statement-breakpoint
ALTER TABLE "order_notifications" DROP CONSTRAINT "order_notifications_valid_status";--> statement-breakpoint
ALTER TABLE "caja_notifications" ALTER COLUMN "status" SET DEFAULT 'NO_ENVIADO';--> statement-breakpoint
ALTER TABLE "order_emails" ALTER COLUMN "status" SET DEFAULT 'NO_ENVIADO';--> statement-breakpoint
ALTER TABLE "order_notifications" ALTER COLUMN "status" SET DEFAULT 'NO_ENVIADO';--> statement-breakpoint
ALTER TABLE "caja_notifications" ADD CONSTRAINT "caja_notifications_state" CHECK ("caja_notifications"."status" IN ('NO_ENVIADO','PENDIENTE','ENVIANDO','ENVIADO','ERROR','OMITIDO'));--> statement-breakpoint
ALTER TABLE "order_emails" ADD CONSTRAINT "order_emails_valid_status" CHECK ("order_emails"."status" IN ('NO_ENVIADO', 'PENDIENTE', 'ENVIANDO', 'ENVIADO', 'ERROR'));--> statement-breakpoint
ALTER TABLE "order_notifications" ADD CONSTRAINT "order_notifications_valid_status" CHECK ("order_notifications"."status" IN ('NO_ENVIADO', 'PENDIENTE', 'ENVIANDO', 'ENVIADO', 'ERROR', 'OMITIDO'));
--> statement-breakpoint
UPDATE order_emails SET status = 'NO_ENVIADO', attempts = greatest(attempts, 5), lease_id = NULL, lease_until = NULL WHERE status IN ('PENDIENTE', 'ENVIANDO', 'ERROR');
--> statement-breakpoint
UPDATE order_notifications SET status = 'OMITIDO', attempts = greatest(attempts, 1) WHERE status IN ('PENDIENTE', 'ENVIANDO', 'ERROR');
--> statement-breakpoint
UPDATE caja_notifications SET status = 'OMITIDO', attempts = greatest(attempts, 1) WHERE status IN ('PENDIENTE', 'ENVIANDO', 'ERROR');
