import { canAttendOrders, type AuthorizedActor } from "@/modules/access/domain/policy";
import { OperationError } from "@/modules/orders/domain/operation-error";
import { z } from "zod";

const saleFormatSchema = z.enum(["pdf", "xml"]);
export type SaleFormat = z.infer<typeof saleFormatSchema>;
export const saleMimeTypes = { pdf: "application/pdf", xml: "application/xml" } as const;
export const maxSaleFileBytes = 3 * 1024 * 1024;

export const saleFileSchema = z.instanceof(File)
  .refine((file) => file.name.length > 0 && file.name.length <= 255 && !/[\x00-\x1f\x7f/\\]/.test(file.name), "Usa un nombre de archivo válido (hasta 255 caracteres).")
  .refine((file) => file.size > 0 && file.size <= maxSaleFileBytes, "El archivo debe pesar hasta 3 MB.");

export const uploadSaleSchema = z.object({ id: z.uuid(), uploadId: z.uuid(), cycle: z.coerce.number().int().positive(), format: saleFormatSchema });
export const finalizeSaleSchema = z.object({ id: z.uuid(), version: z.iso.datetime(), documentId: z.uuid(), xmlDocumentId: z.uuid() });
export const reviseSaleSchema = z.object({ id: z.uuid(), version: z.iso.datetime(), reason: z.string().trim().min(5, "Indica el motivo (mínimo 5 caracteres).").max(500) });
export const removeDraftSchema = z.object({ id: z.uuid(), documentId: z.uuid(), cycle: z.number().int().positive(), format: saleFormatSchema });

export const saleIssuanceLabels = { PENDIENTE: "Pendiente", FINALIZADA: "Confirmados", DEVUELTA: "En corrección", ANULADA: "Pedido cancelado" } as const;
export class StaleDocumentBatch extends OperationError {}

export function canManageSaleDocuments(actor: AuthorizedActor, order: { assignedTo: string | null; orderStatus: string }, assigneeActive: boolean) {
  return canAttendOrders(actor) && order.orderStatus !== "CANCELADO"
    && (order.assignedTo === actor.userId || (order.orderStatus === "ENTREGADO" && !assigneeActive));
}
