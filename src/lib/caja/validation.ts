import { z } from "zod";
import { authorizedEmailSchema } from "@/lib/access-policy";
export const imprintSchema = z.enum(["universidad", "instituto"]);
export const cajaSettingsSchema = z.object({ imprint: imprintSchema, email: z.union([z.literal(""), authorizedEmailSchema]), previousEmail: z.union([z.literal(""), authorizedEmailSchema]) });
export const cajaFiltersSchema = z.object({ state: z.enum(["pending", "finished", "cancelled", "all"]).catch("all"), q: z.string().trim().max(100).catch(""), page: z.coerce.number().int().min(1).max(10000).catch(1) });
export const pdfSchema = z.instanceof(File).refine((file) => file.name.length > 0 && file.name.length <= 255 && !/[\x00-\x1f\x7f/\\]/.test(file.name), "Usa un nombre de archivo válido (hasta 255 caracteres).").refine((file) => file.type === "application/pdf", "Adjunta un PDF.").refine((file) => file.size > 0 && file.size <= 3 * 1024 * 1024, "El PDF debe pesar hasta 3 MB.");
export const uploadSaleSchema = z.object({ id: z.uuid(), uploadId: z.uuid(), cycle: z.coerce.number().int().positive() });
export const finalizeSaleSchema = z.object({ id: z.uuid(), version: z.iso.datetime(), documentId: z.uuid() });
export const returnSaleSchema = z.object({ id: z.uuid(), version: z.iso.datetime(), reason: z.string().trim().min(5, "Indica el motivo (mínimo 5 caracteres).").max(500) });
export const cajaLabels = { PENDIENTE: "Pendiente", FINALIZADA: "Finalizada", DEVUELTA: "Por corregir", ANULADA: "Anulada" } as const;

export const removeDraftSchema = z.object({ id: z.uuid(), documentId: z.uuid(), cycle: z.number().int().positive() });
