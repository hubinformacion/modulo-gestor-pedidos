"use server";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { eq, sql } from "drizzle-orm";
import { withDatabase } from "@/db";
import { orderAdmissionPolicy, orderAdmissionChanges } from "@/db/schema";
import { getAuthorizedSession } from "@/modules/access/application/session";
import { isMasterEmail } from "@/modules/access/domain/policy";
import { assertAuthorized } from "@/modules/access/data/transaction-access";
import { admissionPolicySchema, admissionUpdateSchema } from "@/modules/orders/domain/admission-policy";
import { reportServerError } from "@/shared/logging/server-diagnostics";
class PolicyError extends Error {}
export async function saveAdmissionPolicyAction(input: unknown) {
  const parsed = admissionUpdateSchema.safeParse(input);
  if (!parsed.success) return { success: false, message: "Introduce límites enteros entre 1 y 100 000." };
  try {
    const h = await headers();
    await withDatabase(async (db) => {
      const actor = await getAuthorizedSession(db, h);
      if (!isMasterEmail(actor.email)) throw new PolicyError("Solo el correo maestro puede modificar estos límites.");
      await db.transaction(async (tx) => {
        await tx.execute(sql`SET LOCAL lock_timeout = '10s'`);
        await tx.execute(sql`SET LOCAL statement_timeout = '20s'`);
        await assertAuthorized(tx, actor);
        const [current] = await tx.select().from(orderAdmissionPolicy).where(eq(orderAdmissionPolicy.id, "orders")).for("update");
        if (!current || current.updatedAt.toISOString() !== parsed.data.version) throw new PolicyError("La configuración cambió. Actualiza la página antes de guardar.");
        const previous = admissionPolicySchema.parse(Object.fromEntries(Object.keys(parsed.data.policy).map((key) => [key, current[key as keyof typeof current]])));
        if (JSON.stringify(previous) === JSON.stringify(parsed.data.policy)) return;
        await tx.update(orderAdmissionPolicy).set({ ...parsed.data.policy, updatedBy: actor.email }).where(eq(orderAdmissionPolicy.id, "orders"));
        await tx.insert(orderAdmissionChanges).values({ actorEmail: actor.email, previous, next: parsed.data.policy });
      });
    });
    revalidatePath("/admin/configuracion");
    return { success: true, message: "Límites guardados. Se aplicarán a los pedidos nuevos." };
  } catch (error) {
    if (error instanceof PolicyError) return { success: false, message: error.message };
    reportServerError("admission.settings", error);
    return { success: false, message: "No se pudo guardar la configuración. Actualiza la página para comprobar su estado." };
  }
}
