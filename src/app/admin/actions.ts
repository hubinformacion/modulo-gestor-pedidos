"use server";

import { after } from "next/server";
import { synchronizeDriveReaders } from "@/lib/payments/drive-access";
import { reportServerError } from "@/lib/server-diagnostics";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { withDatabase } from "@/db";
import { getAuthorizedSession } from "@/lib/access";
import { AccessError, authorizedEmailSchema, type AccessActionResult } from "@/lib/access-policy";
import { addAuthorizedEmail, removeAuthorizedEmail } from "@/lib/authorized-emails";

async function changeAccess(input: unknown, operation: "add" | "remove"): Promise<AccessActionResult> {
  try {
    const requestHeaders = await headers();
    const result = await withDatabase(async (db) => {
      const actor = await getAuthorizedSession(db, requestHeaders);
      const email = authorizedEmailSchema.safeParse(input);
      if (!email.success) return { success: false, message: "Ingresa un correo válido." };
      return operation === "add"
        ? addAuthorizedEmail(db, actor, email.data)
        : removeAuthorizedEmail(db, actor, email.data);
    });
    if (result.success) { revalidatePath("/admin/configuracion", "page"); after(async () => { try { await synchronizeDriveReaders(); } catch (error) { reportServerError("drive.readers.pending", error); } }); }
    return result;
  } catch (error) {
    return {
      success: false,
      message: error instanceof AccessError ? error.message : "No se pudo guardar el cambio. Intenta nuevamente.",
    };
  }
}

export async function addEmailAction(input: unknown): Promise<AccessActionResult> {
  return changeAccess(input, "add");
}

export async function removeEmailAction(input: unknown): Promise<AccessActionResult> {
  return changeAccess(input, "remove");
}
