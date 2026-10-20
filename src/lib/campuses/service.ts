import "server-only";
import { writeManagementAudit } from "@/lib/audit/management";
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
      name: data.name, libraryAddress: data.libraryAddress, libraryLocation: data.libraryLocation, pickupHours: data.pickupHours, latitude: data.latitude || null,
      longitude: data.longitude || null, googleMapsEmbedUrl: data.googleMapsEmbedUrl || null, status: data.status,
    };
    const [previous] = id ? await tx.select().from(campuses).where(eq(campuses.id, id)).for("update") : [];
    let targetId = id;
    if (id) {
      const changed = await tx.update(campuses).set(values).where(eq(campuses.id, id)).returning({ id: campuses.id });
      if (!changed.length) return { success: false, message: "El campus ya no existe. Actualiza la página." };
    } else { const [created] = await tx.insert(campuses).values(values).returning({ id: campuses.id }); targetId = created.id; }
    await writeManagementAudit(tx, actor, id ? "CAMPUS_CHANGED" : "CAMPUS_CREATED", "campus", targetId!, { previous: previous ? Object.fromEntries(Object.keys(values).map((field) => [field, previous[field as keyof typeof previous]])) : null, next: values });
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
    await writeManagementAudit(tx, actor, "CAMPUS_DELETED", "campus", id);
    return { success: true, message: "Campus eliminado." };
  });
}
