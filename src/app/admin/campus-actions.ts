"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { withDatabase } from "@/db";
import { getAuthorizedSession } from "@/lib/access";
import { AccessError } from "@/lib/access-policy";
import { deleteCampus, saveCampus } from "@/lib/campuses/service";
import { campusIdSchema, campusSchema, campusUpdateSchema, type CampusActionResult } from "@/lib/campuses/validation";

function databaseError(error: unknown): string | undefined {
  if (!error || typeof error !== "object") return undefined;
  if ("code" in error && typeof error.code === "string") return error.code;
  return "cause" in error ? databaseError(error.cause) : undefined;
}

async function changeCampus(input: unknown, operation: "create" | "update" | "delete"): Promise<CampusActionResult> {
  try {
    const requestHeaders = await headers();
    const result = await withDatabase(async (db) => {
      const actor = await getAuthorizedSession(db, requestHeaders);
      if (operation === "delete") {
        const id = campusIdSchema.safeParse(input);
        if (!id.success) return { success: false, message: "Selecciona un campus válido." };
        return deleteCampus(db, actor, id.data);
      }
      const parsed = (operation === "update" ? campusUpdateSchema : campusSchema).safeParse(input);
      if (!parsed.success) {
        const fieldErrors: Record<string, string> = {};
        for (const issue of parsed.error.issues) fieldErrors[String(issue.path[0])] ??= issue.message;
        return { success: false, message: "Revisa los datos del campus.", fieldErrors };
      }
      const id = "id" in parsed.data ? String(parsed.data.id) : undefined;
      return saveCampus(db, actor, parsed.data, id);
    });
    if (result.success) {
      revalidatePath("/admin", "layout");
      revalidatePath("/pedido");
    }
    return result;
  } catch (error) {
    const code = databaseError(error);
    return { success: false, message: error instanceof AccessError ? error.message : code === "23505" ? "Ya existe un campus con ese nombre." : code === "23503" ? "El campus tiene pedidos asociados. Desactívalo para conservar el historial." : "No se pudo guardar el cambio. Intenta nuevamente." };
  }
}

export async function createCampusAction(input: unknown): Promise<CampusActionResult> { return changeCampus(input, "create"); }
export async function updateCampusAction(input: unknown): Promise<CampusActionResult> { return changeCampus(input, "update"); }
export async function deleteCampusAction(input: unknown): Promise<CampusActionResult> { return changeCampus(input, "delete"); }
