"use server";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { withDatabase } from "@/db";
import { pickupContacts, orders } from "@/db/schema";
import { getAuthorizedSession } from "@/lib/access";
import { assertAuthorized } from "@/lib/transaction-access";
import { AccessError } from "@/lib/access-policy";
import { writeManagementAudit } from "@/lib/audit/management";
import { supportSchema, deleteSupportSchema } from "@/lib/delivery/support-validation";
import { reportServerError, safeErrorDetails } from "@/lib/server-diagnostics";
class SupportError extends Error {}
function failure(error: unknown) {
  if (!(error instanceof SupportError || error instanceof AccessError)) reportServerError("pickup.support.change", error);
  return { success: false, message: error instanceof SupportError || error instanceof AccessError ? error.message : safeErrorDetails(error).code === "23505" ? "Ese correo ya está registrado en el personal de apoyo." : "No se pudo guardar. Actualiza el listado y reintenta." };
}
export async function saveSupportAction(input: unknown) {
  const parsed = supportSchema.safeParse(input);
  if (!parsed.success) return { success: false, message: parsed.error.issues[0].message };
  try {
    const requestHeaders = await headers();
    await withDatabase(async (db) => {
      const actor = await getAuthorizedSession(db, requestHeaders);
      await db.transaction(async (tx) => {
        await assertAuthorized(tx, actor);
        const { id, version, ...values } = parsed.data;
        const [previous] = id ? await tx.select().from(pickupContacts).where(eq(pickupContacts.id, id)).for("update") : [];
        if (id && (!previous || previous.updatedAt.toISOString() !== version)) throw new SupportError("El registro cambió. Actualiza el listado.");
        const [saved] = id ? await tx.update(pickupContacts).set(values).where(eq(pickupContacts.id, id)).returning({ id: pickupContacts.id }) : await tx.insert(pickupContacts).values(values).returning({ id: pickupContacts.id });
        await writeManagementAudit(tx, actor, "PICKUP_SUPPORT_SAVED", "pickup_contact", saved.id, { previous: previous ? { name: previous.name, email: previous.email, status: previous.status } : null, next: values });
      });
    });
    revalidatePath("/admin/configuracion"); revalidatePath("/admin/pedidos", "layout");
    return { success: true, message: "Personal de apoyo guardado." };
  } catch (error) { return failure(error); }
}
export async function deleteSupportAction(input: unknown) {
  const parsed = deleteSupportSchema.safeParse(input);
  if (!parsed.success) return { success: false, message: "Actualiza el listado." };
  try {
    const requestHeaders = await headers();
    await withDatabase(async (db) => {
      const actor = await getAuthorizedSession(db, requestHeaders);
      await db.transaction(async (tx) => {
        await assertAuthorized(tx, actor);
        const [row] = await tx.select().from(pickupContacts).where(eq(pickupContacts.id, parsed.data.id)).for("update");
        if (!row || row.updatedAt.toISOString() !== parsed.data.version) throw new SupportError("El registro cambió. Actualiza el listado.");
        const [used] = await tx.select({ id: orders.id }).from(orders).where(eq(orders.pickupContactId, row.id)).limit(1);
        if (used) throw new SupportError("Esta persona tiene pedidos asociados. Desactívala para conservar el historial.");
        await tx.delete(pickupContacts).where(eq(pickupContacts.id, row.id));
        await writeManagementAudit(tx, actor, "PICKUP_SUPPORT_DELETED", "pickup_contact", row.id);
      });
    });
    revalidatePath("/admin/configuracion"); revalidatePath("/admin/pedidos", "layout");
    return { success: true, message: "Personal de apoyo eliminado." };
  } catch (error) { return failure(error); }
}
