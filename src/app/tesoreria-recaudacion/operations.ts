"use server";











import { withDatabase } from "@/db";
import { reportServerError } from "@/shared/logging/server-diagnostics";
import { getAuthorizedSession, getCajaSession } from "@/modules/access/application/session";
import { AccessError } from "@/modules/access/domain/policy";
import { addObservation, addTreasuryNote, resolveObservation } from "@/modules/treasury/data/notes";
import { CajaError } from "@/modules/treasury/domain/errors";
import { noteSchema, observationSchema, resolveSchema } from "@/modules/treasury/domain/notes";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { z } from "zod";

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
