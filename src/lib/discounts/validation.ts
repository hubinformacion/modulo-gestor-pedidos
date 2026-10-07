import { z } from "zod";
export const promotionSchema = z.object({
  id: z.uuid().optional(), version: z.iso.datetime().optional(),
  name: z.string().trim().min(3, "Escribe un nombre (mínimo 3 caracteres).").max(120),
  communityPercent: z.coerce.number().int().min(0).max(99), publicPercent: z.coerce.number().int().min(0).max(99),
  startsAt: z.iso.datetime({ offset: true }), endsAt: z.iso.datetime({ offset: true }),
  scope: z.enum(["all", "selected"]), bookIds: z.array(z.uuid()).max(2000), status: z.enum(["ACTIVO", "INACTIVO"]),
}).refine((data) => Boolean(data.id) === Boolean(data.version), "Actualiza la promoción antes de editarla.")
  .refine((data) => data.communityPercent > 0 || data.publicPercent > 0, "Indica un descuento para al menos un público.")
  .refine((data) => Date.parse(data.startsAt) < Date.parse(data.endsAt), "La fecha de fin debe ser posterior al inicio.")
  .refine((data) => data.scope === "all" || data.bookIds.length > 0, "Selecciona al menos una publicación.");
export const deletePromotionSchema = z.object({ id: z.uuid(), version: z.iso.datetime() });
export function peruInputDate(iso: string) { return new Date(Date.parse(iso) - 5 * 3600_000).toISOString().slice(0, 16); }
export function peruIsoDate(local: string) { return /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(local) ? `${local}:00-05:00` : ""; }
export type PromotionRow = { id: string; name: string; communityPercent: number; publicPercent: number; scope: "all" | "selected"; bookIds: string[]; startsAt: string; endsAt: string; status: "ACTIVO" | "INACTIVO"; version: string };
