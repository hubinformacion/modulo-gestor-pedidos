import "server-only";
import { and, eq, gt, inArray, notInArray } from "drizzle-orm";
import type { Database } from "@/db";
import { authorizedEmails, orderActivity, orders, session, user } from "@/db/schema";
import {
  AccessError, authorizedEmailSchema, isMasterEmail, MASTER_EMAIL,
  type AuthorizedActor, type AccessActionResult,
} from "./access-policy";

type Transaction = Parameters<Parameters<Database["transaction"]>[0]>[0];

async function assertCurrentMaster(tx: Transaction, actor: AuthorizedActor) {
  if (!isMasterEmail(actor.email)) throw new AccessError("FORBIDDEN");
  const [allowed] = await tx.select().from(authorizedEmails)
    .where(eq(authorizedEmails.email, MASTER_EMAIL)).for("share");
  if (!allowed || allowed.role !== "gestor") throw new AccessError("FORBIDDEN");
  const [validSession] = await tx.select({ id: session.id }).from(session)
    .innerJoin(user, eq(user.id, session.userId))
    .where(and(
      eq(session.id, actor.sessionId),
      eq(session.userId, actor.userId),
      gt(session.expiresAt, new Date()),
      eq(user.email, MASTER_EMAIL),
      eq(user.emailVerified, true),
    ));
  if (!validSession) throw new AccessError("UNAUTHENTICATED");
}

export async function addAuthorizedEmail(db: Database, actor: AuthorizedActor, input: unknown): Promise<AccessActionResult> {
  if (!isMasterEmail(actor.email)) throw new AccessError("FORBIDDEN");
  const email = authorizedEmailSchema.safeParse(input);
  if (!email.success) return { success: false, message: "Ingresa un correo válido." };
  return db.transaction(async (tx) => {
    await assertCurrentMaster(tx, actor);
    const inserted = await tx.insert(authorizedEmails).values({ email: email.data, addedBy: actor.email })
      .onConflictDoNothing().returning({ email: authorizedEmails.email });
    return inserted.length
      ? { success: true, message: "Correo autorizado correctamente." }
      : { success: false, message: "Este correo ya está autorizado." };
  });
}

export async function removeAuthorizedEmail(db: Database, actor: AuthorizedActor, input: unknown): Promise<AccessActionResult> {
  if (!isMasterEmail(actor.email)) throw new AccessError("FORBIDDEN");
  const email = authorizedEmailSchema.safeParse(input);
  if (!email.success) return { success: false, message: "Ingresa un correo válido." };
  if (email.data === MASTER_EMAIL) {
    return { success: false, message: "El correo maestro no se puede eliminar." };
  }
  return db.transaction(async (tx) => {
    await assertCurrentMaster(tx, actor);
    const deleted = await tx.delete(authorizedEmails).where(eq(authorizedEmails.email, email.data))
      .returning({ email: authorizedEmails.email });
    if (!deleted.length) return { success: false, message: "El correo ya no está autorizado." };
    const owners = await tx.select({ id: user.id }).from(user).where(eq(user.email, email.data));
    if (owners.length) {
      const released = await tx.update(orders).set({ assignedTo: null, assignedName: null, assignedAt: null }).where(and(inArray(orders.assignedTo, owners.map((owner) => owner.id)), notInArray(orders.orderStatus, ["ENTREGADO", "CANCELADO"]))).returning({ id: orders.id });
      if (released.length) await tx.insert(orderActivity).values(released.map((order) => ({ orderId: order.id, actorUserId: actor.userId, actorName: actor.name, eventType: "LIBERADO", detail: "El pedido está disponible para un gestor del equipo." })));
      await tx.delete(session).where(inArray(session.userId, owners.map((owner) => owner.id)));
    }
    return { success: true, message: "Acceso revocado y sesiones cerradas." };
  });
}
