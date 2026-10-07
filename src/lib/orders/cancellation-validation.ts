import { z } from "zod";
import { trackingTokenSchema } from "./submission";
export const cancelPurchaseSchema = z.object({ token: trackingTokenSchema, version: z.iso.datetime(), reason: z.string().trim().max(500).default("") });
export const annulPurchaseSchema = z.object({ id: z.uuid(), version: z.iso.datetime(), reason: z.string().trim().min(5, "Indica el motivo de la anulación (mínimo 5 caracteres).").max(500) });
export function canBuyerCancel(order: { orderStatus: string; paymentStatusUniversidad: string; paymentStatusInstituto: string }) { return order.orderStatus === "PENDIENTE_PAGO" && ![order.paymentStatusUniversidad, order.paymentStatusInstituto].includes("VERIFICADO"); }
