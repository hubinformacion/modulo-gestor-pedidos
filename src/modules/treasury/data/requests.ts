import type { Database } from "@/db";
import { cajaNotifications, cajaRequests, orders } from "@/db/schema";
import { CajaError } from "@/modules/treasury/domain/errors";
import { eq } from "drizzle-orm";
import "server-only";

type Transaction = Parameters<Parameters<Database["transaction"]>[0]>[0];
export async function createCajaRequest(tx: Transaction, orderId: string, imprint: "universidad" | "instituto") {
  const [request] = await tx.insert(cajaRequests).values({ orderId, publisherImprint: imprint }).onConflictDoNothing().returning();
  if (!request) return null;
  const [event] = await tx.insert(cajaNotifications).values({ requestId: request.id, cycle: 1, eventType: "SOLICITUD" }).returning({ id: cajaNotifications.id });
  return { requestId: request.id, notificationId: event.id };
}
export async function lockRequest(tx: Transaction, id: string) {
  const [reference] = await tx.select({ orderId: cajaRequests.orderId }).from(cajaRequests).where(eq(cajaRequests.id, id));
  if (!reference) throw new CajaError("La solicitud no existe.");
  // All revisions of a mixed order serialize on its order, independently of
  // distribution state; this makes the all-PDF readiness check atomic.
  const [order] = await tx.select().from(orders).where(eq(orders.id, reference.orderId)).for("update");
  const [request] = await tx.select().from(cajaRequests).where(eq(cajaRequests.id, id)).for("update");
  return { order, request };
}