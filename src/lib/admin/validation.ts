import { z } from "zod";

export const orderLabels = { PENDIENTE_PAGO: "Pendiente de pago", EN_PREPARACION: "En preparación", DESPACHADO: "Despachado", ENTREGADO: "Entregado", CANCELADO: "Cancelado" } as const;
export const paymentLabels = { NO_APLICA: "No aplica", PENDIENTE: "Sin comprobante", EN_REVISION: "En revisión", VERIFICADO: "Verificado", RECHAZADO: "Rechazado" } as const;
export const assignmentSchema = z.object({ id: z.uuid(), version: z.iso.datetime(), operation: z.enum(["claim", "release"]) });
export const retryOrderMailSchema = z.object({ id: z.uuid() });
export type ActionResult = { success: boolean; message: string };
const version = z.iso.datetime();
export const reviewSchema = z.object({ id: z.uuid(), imprint: z.enum(["universidad", "instituto"]), receiptId: z.uuid(), version, decision: z.enum(["VERIFICADO", "RECHAZADO"]), reason: z.string().trim().max(500).default("") }).refine((value) => value.decision !== "RECHAZADO" || value.reason.length >= 5, "Explica el motivo del rechazo (al menos 5 caracteres).");
export const dispatchSchema = z.object({ id: z.uuid(), version, status: z.enum(["DESPACHADO", "ENTREGADO"]), courier: z.string().trim().max(150), trackingCode: z.string().trim().max(120).default(""), trackingUrl: z.union([z.literal(""), z.url().max(2000).refine((value) => { const url = new URL(value); return url.protocol === "https:" && !url.username && !url.password; }, "Usa un enlace HTTPS válido.")]).transform((value) => value ? new URL(value).toString() : "").default("") });
const price = z.string().trim().regex(/^\d{1,10}(\.\d{1,2})?$/, "Usa un importe en soles con hasta dos decimales.");
export const bookSchema = z.object({
  inventoryCode: z.string().trim().min(1, "Ingresa el código.").max(80),
  title: z.string().trim().min(1, "Ingresa el título.").max(300),
  author: z.string().trim().min(1, "Ingresa el autor.").max(200),
  publisherImprint: z.enum(["universidad", "instituto"]),
  standardPrice: price, communityPrice: price,
  stock: z.number().int().min(0).max(2147483647), status: z.enum(["ACTIVO", "INACTIVO"]),
});
export const saveBookSchema = z.object({ book: bookSchema, id: z.uuid().optional(), version: version.optional() }).refine((value) => Boolean(value.id) === Boolean(value.version), "Actualiza la publicación antes de editarla.");
export const deleteBookSchema = z.object({ id: z.uuid(), version });
export type BookForm = z.infer<typeof bookSchema>;
export type BookRow = BookForm & { id: string; version: string };
export const emptyBook: BookForm = { inventoryCode: "", title: "", author: "", publisherImprint: "universidad", standardPrice: "", communityPrice: "", stock: 0, status: "INACTIVO" };
export const filterSchema = z.object({
  q: z.string().trim().max(120).catch(""),
  status: z.enum(["", "PENDIENTE_PAGO", "EN_PREPARACION", "DESPACHADO", "ENTREGADO", "CANCELADO"]).catch(""),
  owner: z.enum(["all", "mine", "unassigned", "participated"]).catch("all"),
  page: z.coerce.number().int().min(1).max(100000).catch(1),
});
