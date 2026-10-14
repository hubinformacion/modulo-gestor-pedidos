"use server";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { withDatabase } from "@/db";
import { getAuthorizedSession, getCajaSession } from "@/lib/access";
import { AccessError } from "@/lib/access-policy";
import { CajaError } from "@/lib/caja/service";
import { reportServerError } from "@/lib/server-diagnostics";
import { noteSchema, observationSchema, resolveSchema } from "@/lib/treasury/validation";
import { addTreasuryNote, addObservation, resolveObservation } from "@/lib/treasury/operations";
async function change<T>(schema: z.ZodType<T>, input: unknown, gestor: boolean, work: (actor: Awaited<ReturnType<typeof getCajaSession>>, data: T) => Promise<void>) {
  const parsed = schema.safeParse(input); if (!parsed.success) return { success: false, message: parsed.error.issues[0]?.message ?? "Revisa los datos." };
  try {
    const h = await headers(); const actor = await withDatabase((db) => gestor ? getAuthorizedSession(db, h) : getCajaSession(db, h));
    await work(actor, parsed.data); revalidatePath("/tesoreria-recaudacion", "layout"); revalidatePath("/admin/pedidos", "layout");
    return { success: true, message: "Información registrada." };
  } catch (error) {
    if (!(error instanceof CajaError || error instanceof AccessError)) reportServerError("treasury.operation", error);
    return { success: false, message: error instanceof CajaError || error instanceof AccessError ? error.message : "No se pudo registrar el cambio." };
  }
}
export async function addTreasuryNoteAction(input: unknown) { return change(noteSchema, input, false, addTreasuryNote); }
export async function addObservationAction(input: unknown) { return change(observationSchema, input, false, addObservation); }
export async function resolveObservationAction(input: unknown) { return change(resolveSchema, input, true, resolveObservation); }
