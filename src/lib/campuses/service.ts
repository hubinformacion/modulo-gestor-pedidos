import "server-only";
import { and, eq, gt, or } from "drizzle-orm";
import type { Database } from "@/db";
import { authorizedEmails, campuses, orders, session, user } from "@/db/schema";
import { AccessError, type AuthorizedActor } from "@/lib/access-policy";
import type { CampusActionResult, CampusForm } from "./validation";

type Transaction = Parameters<Parameters<Database["transaction"]>[0]>[0];

async function assertAuthorized(tx: Transaction, actor: AuthorizedActor) {
  // Share lock coordinates with revocation: permissions remain valid through commit.
  const [allowed] = await tx.select({ email: authorizedEmails.email }).from(authorizedEmails).where(eq(authorizedEmails.email, actor.email)).for("share");
  if (!allowed) throw new AccessError("FORBIDDEN");
  const [current] = await tx.select({ id: session.id }).from(session).innerJoin(user, eq(user.id, session.userId)).where(and(
    eq(session.id, actor.sessionId), eq(session.userId, actor.userId), gt(session.expiresAt, new Date()), eq(user.email, actor.email), eq(user.emailVerified, true),
  ));
  if (!current) throw new AccessError("UNAUTHENTICATED");
}

export async function saveCampus(db: Database, actor: AuthorizedActor, data: CampusForm, id?: string): Promise<CampusActionResult> {
  return db.transaction(async (tx) => {
    await assertAuthorized(tx, actor);
    const values = {
      name: data.name, libraryAddress: data.libraryAddress, latitude: data.latitude || null,
      longitude: data.longitude || null, googleMapsEmbedUrl: data.googleMapsEmbedUrl || null, status: data.status,
    };
    if (id) {
      const changed = await tx.update(campuses).set(values).where(eq(campuses.id, id)).returning({ id: campuses.id });
      if (!changed.length) return { success: false, message: "El campus ya no existe. Actualiza la página." };
    } else await tx.insert(campuses).values(values);
    return { success: true, message: id ? "Campus actualizado." : "Campus creado." };
  });
}

export async function deleteCampus(db: Database, actor: AuthorizedActor, id: string): Promise<CampusActionResult> {
  return db.transaction(async (tx) => {
    await assertAuthorized(tx, actor);
    const [campus] = await tx.select({ id: campuses.id }).from(campuses).where(eq(campuses.id, id)).for("update");
    if (!campus) return { success: false, message: "El campus ya no existe." };
    const [used] = await tx.select({ id: orders.id }).from(orders).where(or(eq(orders.customerCampus, id), eq(orders.deliveryCampus, id))).limit(1);
    if (used) return { success: false, message: "Este campus tiene pedidos asociados. Desactívalo para conservar su historial." };
    await tx.delete(campuses).where(eq(campuses.id, id));
    return { success: true, message: "Campus eliminado." };
  });
}
