import { z } from "zod";

export const supportSchema = z.object({
  id: z.uuid().optional(), version: z.iso.datetime().optional(),
  name: z.string().trim().min(3, "Ingresa los nombres completos.").max(200),
  email: z.string().trim().toLowerCase().max(254).pipe(z.email()),
  status: z.enum(["ACTIVO", "INACTIVO"]),
}).refine((value) => Boolean(value.id) === Boolean(value.version), "Actualiza el listado antes de editar.");
export const deleteSupportSchema = z.object({ id: z.uuid(), version: z.iso.datetime() });
export type SupportRow = { id: string; name: string; email: string; status: "ACTIVO" | "INACTIVO"; version: string };
