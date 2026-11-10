"use server";

import { headers } from "next/headers";
import { withDatabase } from "@/db";
import { getAuthorizedSession } from "@/modules/access/application/session";
import { assertAuthorized } from "@/modules/access/data/transaction-access";
import { isMasterEmail } from "@/modules/access/domain/policy";
import { buildMailSample, mailSamplePreviewHtml } from "@/modules/settings/application/mail-samples";
import { mailSampleSelectionSchema, mailSampleSendSchema, type MailSamplePreviewResult } from "@/modules/settings/domain/mail-samples";
import type { MailEndpointTestResult } from "@/modules/settings/domain/mail-endpoint-test";
import { MailDeliveryError } from "@/integrations/email/endpoint";
import { sendStandaloneMail } from "@/integrations/email/send";
import { isMailEndpointConfigured } from "@/shared/config/mail-endpoint";

async function authorizeMaster() {
  const requestHeaders = await headers();
  return withDatabase(async (db) => {
    const actor = await getAuthorizedSession(db, requestHeaders);
    if (!isMasterEmail(actor.email)) return false;
    await db.transaction((tx) => assertAuthorized(tx, actor));
    return true;
  });
}

export async function previewMailSampleAction(input: unknown): Promise<MailSamplePreviewResult> {
  try {
    if (!await authorizeMaster()) return { success: false, message: "Solo el correo maestro puede consultar estas plantillas." };
    const parsed = mailSampleSelectionSchema.safeParse(input);
    if (!parsed.success) return { success: false, message: "Revisa la plantilla, el sello y la modalidad de entrega." };
    const sample = await buildMailSample(parsed.data);
    return { success: true, preview: { subject: sample.subject, html: mailSamplePreviewHtml(sample.html), attachmentNames: sample.attachments.map((attachment) => attachment.filename) } };
  } catch {
    return { success: false, message: "No se pudo generar la vista previa. Revisa tu sesión y vuelve a intentarlo." };
  }
}

export async function sendMailSampleAction(input: unknown): Promise<MailEndpointTestResult> {
  try {
    if (!await authorizeMaster()) return { success: false, message: "Solo el correo maestro puede enviar esta prueba." };
    const parsed = mailSampleSendSchema.safeParse(input);
    if (!parsed.success) return { success: false, message: parsed.error.issues[0].message };
    const { destination, provider, ...selection } = parsed.data;
    if (provider === "endpoint" && !isMailEndpointConfigured()) return { success: false, message: "Completa la configuración del servicio de correo antes de probarlo." };
    const sample = await buildMailSample(selection);
    const result = await sendStandaloneMail({
      to: [destination],
      subject: `[PRUEBA] ${sample.subject}`,
      html: sample.html,
      text: sample.text,
      attachments: sample.attachments,
      logoCid: "mail-sample@preview.invalid",
    }, provider);
    return { success: true, message: "Correo de prueba aceptado. Comprueba su recepción en el destinatario indicado.", ...(result.providerMessageId ? { providerMessageId: result.providerMessageId } : {}) };
  } catch (error) {
    if (error instanceof MailDeliveryError) return error.result;
    return { success: false, message: "No se pudo confirmar el envío. Comprueba el buzón antes de repetir la prueba." };
  }
}
