"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { withDatabase } from "@/db";
import { getAuthorizedSession } from "@/lib/access";
import { AccessError } from "@/lib/access-policy";
import { deleteBank, saveBank } from "@/lib/payments/banks-service";
import { bankIdSchema, bankFormSchema, bankUpdateSchema, type BankResult } from "@/lib/payments/banks-validation";

function databaseError(error: unknown): string | undefined {
  if (!error || typeof error !== "object") return undefined;
  if ("code" in error && typeof error.code === "string") return error.code;
  return "cause" in error ? databaseError(error.cause) : undefined;
}

async function changeBank(input: unknown, operation: "create" | "update" | "delete"): Promise<BankResult> {
  try {
    const requestHeaders = await headers();
    const result = await withDatabase(async (db) => {
      const actor = await getAuthorizedSession(db, requestHeaders);
      if (operation === "delete") {
        const id = bankIdSchema.safeParse(input);
        if (!id.success) return { success: false, message: "Selecciona una cuenta válida." };
        return deleteBank(db, actor, id.data);
      }
      const parsed = (operation === "update" ? bankUpdateSchema : bankFormSchema).safeParse(input);
      if (!parsed.success) {
        const fieldErrors: Record<string, string> = {};
        for (const issue of parsed.error.issues) fieldErrors[String(issue.path[0])] ??= issue.message;
        return { success: false, message: "Revisa los datos de la cuenta.", fieldErrors };
      }
      const id = "id" in parsed.data ? String(parsed.data.id) : undefined;
      return saveBank(db, actor, parsed.data, id);
    });
    if (result.success) {
      revalidatePath("/admin/configuracion", "page");
      revalidatePath("/pedido");
    }
    return result;
  } catch (error) {
    const code = databaseError(error);
    return { success: false, message: error instanceof AccessError ? error.message : code === "23505" ? "Ya existe esa cuenta en este banco y sello." : "No se pudo guardar el cambio. Intenta nuevamente." };
  }
}

export async function createBankAction(input: unknown): Promise<BankResult> { return changeBank(input, "create"); }
export async function updateBankAction(input: unknown): Promise<BankResult> { return changeBank(input, "update"); }
export async function deleteBankAction(input: unknown): Promise<BankResult> { return changeBank(input, "delete"); }
