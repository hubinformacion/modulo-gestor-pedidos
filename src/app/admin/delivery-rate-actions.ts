"use server";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { withDatabase } from "@/db";
import { deliveryRates } from "@/db/schema";
import { getAuthorizedSession } from "@/lib/access";
import { assertAuthorized } from "@/lib/transaction-access";
import { AccessError } from "@/lib/access-policy";
import { writeManagementAudit } from "@/lib/audit/management";
import { deliveryRateSchema, deleteDeliveryRateSchema } from "@/lib/delivery/rates-validation";
import { reportServerError } from "@/lib/server-diagnostics";
class RateError extends Error {}
async function changeRate(input: unknown, remove: boolean) {
  const parsed = (remove ? deleteDeliveryRateSchema : deliveryRateSchema).safeParse(input);
  if (!parsed.success) return { success: false, message: parsed.error.issues[0].message };
  try {
    const requestHeaders = await headers();
    await withDatabase(async (db) => {
      const actor = await getAuthorizedSession(db, requestHeaders);
      await db.transaction(async (tx) => {
        await assertAuthorized(tx, actor);
        const { zone, version } = parsed.data;
        const [current] = await tx.select().from(deliveryRates).where(eq(deliveryRates.zone, zone)).for("update");
        if (current ? current.updatedAt.toISOString() !== version : Boolean(version)) throw new RateError("La tarifa cambió. Actualiza la configuración.");
        if (remove) {
          if (!current) throw new RateError("La tarifa ya no existe.");
          await tx.delete(deliveryRates).where(eq(deliveryRates.zone, zone));
        } else {
          const data = deliveryRateSchema.parse(input);
          const values = { zone, price: data.price, status: data.status };
          if (current) await tx.update(deliveryRates).set(values).where(eq(deliveryRates.zone, zone));
          else await tx.insert(deliveryRates).values(values);
        }
        await writeManagementAudit(tx, actor, remove ? "DELIVERY_RATE_DELETED" : "DELIVERY_RATE_SAVED", "delivery_rate", zone, { previous: current ? { price: current.price, status: current.status } : null, next: remove ? null : deliveryRateSchema.parse(input) });
      });
    });
    revalidatePath("/admin/configuracion"); revalidatePath("/pedido");
    return { success: true, message: remove ? "Tarifa eliminada. Los pedidos anteriores conservan su costo." : "Tarifa guardada. Se aplicará a nuevas compras." };
  } catch (error) {
    if (!(error instanceof RateError || error instanceof AccessError)) reportServerError("delivery.rate.change", error);
    return { success: false, message: error instanceof RateError || error instanceof AccessError ? error.message : "No se pudo guardar la tarifa. Actualiza y reintenta." };
  }
}
export async function saveDeliveryRateAction(input: unknown) { return changeRate(input, false); }
export async function deleteDeliveryRateAction(input: unknown) { return changeRate(input, true); }
