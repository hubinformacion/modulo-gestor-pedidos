"use server";

import { headers } from "next/headers";
import { withDatabase } from "@/db";
import { getAuthorizedSession } from "@/modules/access/application/session";
import { assertAuthorized } from "@/modules/access/data/transaction-access";
import { isMasterEmail } from "@/modules/access/domain/policy";
import { mailEndpointTestSchema, maxMailTestPdfBytes, type MailEndpointTestResult } from "@/modules/settings/domain/mail-endpoint-test";
import { sendMailEndpointTest } from "@/integrations/email/endpoint-test";

export async function sendMailEndpointTestAction(formData: FormData): Promise<MailEndpointTestResult> {
  try {
    const requestHeaders = await headers();
    const allowed = await withDatabase(async (db) => {
      const actor = await getAuthorizedSession(db, requestHeaders);
      if (!isMasterEmail(actor.email)) return false;
      await db.transaction((tx) => assertAuthorized(tx, actor));
      return true;
    });
    if (!allowed) return { success: false, message: "Solo el correo maestro puede enviar esta prueba." };
    const parsed = mailEndpointTestSchema.safeParse({ to: formData.get("to"), cc: formData.get("cc"), bcc: formData.get("bcc"), subject: formData.get("subject"), html: formData.get("html") });
    if (!parsed.success) return { success: false, message: parsed.error.issues[0].message };
    const file = formData.get("attachment");
    let attachment: { filename: string; content: Buffer } | undefined;
    if (file instanceof File && (file.size > 0 || file.name)) {
      if (!file.size || file.size > maxMailTestPdfBytes || file.type !== "application/pdf" || !/\.pdf$/i.test(file.name) || file.name.length > 180 || /[\x00-\x1f\x7f/\\]/.test(file.name)) {
        return { success: false, message: "Adjunta un PDF de hasta 3 MiB con un nombre válido de hasta 180 caracteres." };
      }
      const content = Buffer.from(await file.arrayBuffer());
      if (content.subarray(0, 5).toString("ascii") !== "%PDF-") return { success: false, message: "El archivo no tiene una firma PDF válida." };
      attachment = { filename: file.name, content };
    } else if (file !== null && !(file instanceof File)) {
      return { success: false, message: "El adjunto no es válido." };
    }
    return await sendMailEndpointTest(parsed.data, attachment);
  } catch {
    return { success: false, message: "No se pudo completar la prueba. Revisa tu sesión; si ya iniciaste un envío, comprueba el buzón antes de repetirlo." };
  }
}
