ALTER TABLE "caja_notifications" DROP CONSTRAINT "caja_notifications_event";--> statement-breakpoint
DROP INDEX "caja_notifications_event_unique";--> statement-breakpoint
ALTER TABLE "caja_notifications" ADD COLUMN "assignment_key" uuid;--> statement-breakpoint
CREATE UNIQUE INDEX "caja_notifications_assignment_unique" ON "caja_notifications" USING btree ("request_id","assignment_key") WHERE "caja_notifications"."event_type" = 'ASIGNACION';--> statement-breakpoint
CREATE UNIQUE INDEX "caja_notifications_event_unique" ON "caja_notifications" USING btree ("request_id","cycle","event_type") WHERE "caja_notifications"."event_type" <> 'ASIGNACION';--> statement-breakpoint
ALTER TABLE "caja_notifications" ADD CONSTRAINT "caja_notifications_assignment_key" CHECK (("caja_notifications"."event_type" = 'ASIGNACION' AND "caja_notifications"."assignment_key" IS NOT NULL) OR ("caja_notifications"."event_type" <> 'ASIGNACION' AND "caja_notifications"."assignment_key" IS NULL));--> statement-breakpoint
ALTER TABLE "caja_notifications" ADD CONSTRAINT "caja_notifications_event" CHECK ("caja_notifications"."event_type" IN ('SOLICITUD','FINALIZADA','DEVUELTA','ANULADA','ASIGNACION'));