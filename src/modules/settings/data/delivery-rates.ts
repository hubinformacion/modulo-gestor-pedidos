import { withReadDatabase } from "@/db";
import { deliveryRates } from "@/db/schema";
import { toCents } from "@/modules/orders/domain/money";
import type { DeliveryRates } from "@/modules/settings/domain/delivery-rates";
import { eq } from "drizzle-orm";
import "server-only";

export function ratesFromRows(rows: (typeof deliveryRates.$inferSelect)[]): DeliveryRates {
  return Object.fromEntries(rows.filter((row) => row.status === "ACTIVO").map((row) => [row.zone, toCents(row.price)]));
}
export async function getDeliveryRates() {
  return withReadDatabase(async (db) => ratesFromRows(await db.select().from(deliveryRates).where(eq(deliveryRates.status, "ACTIVO"))));
}
