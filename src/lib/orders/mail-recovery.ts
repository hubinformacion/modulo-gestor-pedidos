import "server-only";
import { sql } from "drizzle-orm";
import { withReadDatabase } from "@/db";
import { orderEmails, orderNotifications } from "@/db/schema";

// A page request can recover an interrupted background send. No periodic
// polling, no new event, and nothing to send once the outbox is drained.
export async function needsOrderMailRecovery(orderId: string): Promise<boolean> {
  return withReadDatabase(async (db) => {
    const [row] = await db.select({ eligible: sql<boolean>`
      (${orderEmails.leaseUntil} IS NULL OR ${orderEmails.leaseUntil} < now())
      AND (${orderEmails.lastAttemptAt} IS NULL OR ${orderEmails.lastAttemptAt} < now() - interval '1 minute')
      AND (
        (${orderEmails.status} <> 'ENVIADO' AND ${orderEmails.attempts} < 5)
        OR (${orderEmails.status} = 'ENVIADO' AND EXISTS (
          SELECT 1 FROM ${orderNotifications} n
          WHERE n.order_id = ${orderEmails.orderId} AND n.status <> 'ENVIADO' AND n.event_type <> 'ASIGNADO'
            AND n.attempts < 5 AND (n.last_attempt_at IS NULL OR n.last_attempt_at < now() - interval '3 minutes')
        ))
      )` }).from(orderEmails).where(sql`${orderEmails.orderId} = ${orderId}`);
    return Boolean(row?.eligible);
  });
}
