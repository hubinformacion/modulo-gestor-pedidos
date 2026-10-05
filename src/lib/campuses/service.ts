import "server-only";
import { eq, or } from "drizzle-orm";
import type { Database } from "@/db";
import { campuses, orders } from "@/db/schema";
import { type AuthorizedActor } from "@/lib/access-policy";
import { assertAuthorized } from "@/lib/transaction-access";
import type { CampusActionResult, CampusForm } from "./validation";


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
