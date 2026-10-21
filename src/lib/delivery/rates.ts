import "server-only";
import { eq } from "drizzle-orm";
import { withReadDatabase } from "@/db";
import { deliveryRates } from "@/db/schema";
import { toCents } from "@/lib/orders/money";
import type { DeliveryRates } from "./rates-validation";
export function ratesFromRows(rows: (typeof deliveryRates.$inferSelect)[]): DeliveryRates {
  return Object.fromEntries(rows.filter((row) => row.status === "ACTIVO").map((row) => [row.zone, toCents(row.price)]));
}
export async function getDeliveryRates() {
  return withReadDatabase(async (db) => ratesFromRows(await db.select().from(deliveryRates).where(eq(deliveryRates.status, "ACTIVO"))));
}
