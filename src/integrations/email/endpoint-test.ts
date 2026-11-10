import "server-only";
import type { MailEndpointTestInput, MailEndpointTestResult } from "@/modules/settings/domain/mail-endpoint-test";
import { MailDeliveryError, sendEndpointMail } from "./endpoint";
import type { PdfAttachment } from "./types";

export async function sendMailEndpointTest(input: MailEndpointTestInput, attachment?: PdfAttachment): Promise<MailEndpointTestResult> {
  try {
    const sent = await sendEndpointMail({ to: [input.to], cc: input.cc, bcc: input.bcc, subject: input.subject, html: input.html, attachments: attachment ? [attachment] : [] });
    return { success: true, httpStatus: sent.httpStatus, providerMessageId: sent.providerMessageId ?? undefined, message: "El servicio aceptó el correo. Revisa el buzón de destino para confirmar la recepción." };
  } catch (error) {
    return error instanceof MailDeliveryError ? error.result : { success: false, message: "No se pudo confirmar el resultado. Comprueba el buzón antes de repetir la prueba." };
  }
}
