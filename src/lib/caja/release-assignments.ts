import "server-only";
import { and, asc, inArray, notInArray } from "drizzle-orm";
import type { Database } from "@/db";
import { cajaRequests, treasuryActivity, orderActivity, orders } from "@/db/schema";
import type { AuthorizedActor } from "@/lib/access-policy";
type Transaction = Parameters<Parameters<Database["transaction"]>[0]>[0];
export async function releaseCajaAssignments(tx: Transaction, userIds: string[], actor: AuthorizedActor) {
  if (!userIds.length) return;
  const open = await tx.select({ orderId: cajaRequests.orderId }).from(cajaRequests).where(and(inArray(cajaRequests.assignedTo, userIds), notInArray(cajaRequests.status, ["FINALIZADA", "ANULADA"])));
  if (!open.length) return;
  // Match business lock order: authorization -> orders -> requests.
  await tx.select({ id: orders.id }).from(orders).where(inArray(orders.id, [...new Set(open.map((row) => row.orderId))])).orderBy(asc(orders.id)).for("update");
  const released = await tx.update(cajaRequests).set({ assignedTo: null, assignedName: null, assignedAt: null, assignmentToken: null }).where(and(inArray(cajaRequests.assignedTo, userIds), notInArray(cajaRequests.status, ["FINALIZADA", "ANULADA"]))).returning({ orderId: cajaRequests.orderId, id: cajaRequests.id });
  for (const row of released) await tx.insert(treasuryActivity).values({ requestId: row.id, actorId: actor.userId, actorName: actor.name, event: "LIBERADA", detail: "El acceso del responsable se revocó; la solicitud quedó disponible." });
  for (const row of released) await tx.insert(orderActivity).values({ orderId: row.orderId, actorUserId: actor.userId, actorName: actor.name, eventType: "CAJA_LIBERADA", detail: "La emisión se liberó al revocar el acceso de su responsable." });
}
