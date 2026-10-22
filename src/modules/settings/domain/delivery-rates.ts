import type { ShippingZone } from "@/modules/orders/domain/types";
import { z } from "zod";

export type DeliveryRates = Partial<Record<ShippingZone, number>>;
export const deliveryZoneLabels: Record<ShippingZone, string> = { lima_callao: "Lima / Callao", provincia: "Provincia" };
export const initialDeliveryRates = [
  { zone: "lima_callao" as const, price: "15.00", status: "ACTIVO" as const },
  { zone: "provincia" as const, price: "25.00", status: "ACTIVO" as const },
];
export const deliveryRateSchema = z.object({
  zone: z.enum(["lima_callao", "provincia"]),
  price: z.string().trim().regex(/^\d{1,6}(\.\d{1,2})?$/, "Ingresa un monto en soles con punto decimal y hasta dos decimales."),
  status: z.enum(["ACTIVO", "INACTIVO"]), version: z.iso.datetime().optional(),
});
export const deleteDeliveryRateSchema = z.object({ zone: z.enum(["lima_callao", "provincia"]), version: z.iso.datetime() });
export type DeliveryRateRow = z.infer<typeof deliveryRateSchema> & { version: string };
