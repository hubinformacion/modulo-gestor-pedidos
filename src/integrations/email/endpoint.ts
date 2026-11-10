import "server-only";
import { z } from "zod";
import { getMailEndpointEnvironment } from "@/shared/config/mail-endpoint";
import type { MailEndpointTestResult } from "@/modules/settings/domain/mail-endpoint-test";
import type { PdfAttachment } from "./types";

export class MailDeliveryError extends Error {
  constructor(public readonly result: MailEndpointTestResult) {
    super("MAIL_DELIVERY_FAILED");
    this.name = "MailDeliveryError";
  }
}

const responseSchema = z.object({ isSuccess: z.boolean(), message: z.unknown().optional() });

export async function sendEndpointMail(input: { to: string[]; cc?: string[]; bcc?: string[]; subject: string; html: string; attachments?: PdfAttachment[] }): Promise<{ providerMessageId: string | null; httpStatus: number }> {
  const environment = getMailEndpointEnvironment();
  if (!environment.success) throw new MailDeliveryError({ success: false, message: "Completa la configuración del servicio de correo en el servidor." });
  const config = environment.data;
  const recipients = z.array(z.email()).min(1).parse(input.to);
  const cc = z.array(z.email()).parse(input.cc ?? []).filter((email) => !recipients.includes(email));
  const bcc = z.array(z.email()).parse(input.bcc ?? []).filter((email) => !recipients.includes(email) && !cc.includes(email));
  // The contract documents multiple addresses only for cc/cco, not emailDestino.
  if (recipients.length !== 1) throw new MailDeliveryError({ success: false, message: "El servicio requiere un destinatario principal." });
  const attachments = input.attachments ?? [];
  for (const file of attachments) {
    if (!file.content.length || file.content.length > 3 * 1024 * 1024 || file.content.subarray(0, 5).toString("ascii") !== "%PDF-" || !file.filename.length || file.filename.length > 255 || /[\x00-\x1f\x7f/\\]/.test(file.filename)) {
      throw new MailDeliveryError({ success: false, message: "El adjunto debe ser un PDF válido de hasta 3 MiB con un nombre seguro." });
    }
  }
  let httpStatus: number | undefined;
  try {
    const response = await fetch(config.MAIL_ENDPOINT_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Ocp-Apim-Subscription-Key": config.MAIL_ENDPOINT_TOKEN },
      body: JSON.stringify({ from: config.MAIL_ENDPOINT_FROM, fromName: config.MAIL_ENDPOINT_FROM_NAME, asunto: input.subject, mensaje: input.html,
        emailDestino: recipients[0], cc: [...new Set(cc)].join(";"), cco: [...new Set(bcc)].join(";"), sistema: config.MAIL_ENDPOINT_SYSTEM,
        unidadNegocio: config.MAIL_ENDPOINT_BUSINESS_UNIT, retry: 1,
        adjuntos: attachments.map((file) => ({ base64Encode: file.content.toString("base64"), nombreArchivoConExtension: file.filename, mimeType: "application/pdf" })),
      }),
      signal: AbortSignal.timeout(20_000), redirect: "error", cache: "no-store",
    });
    httpStatus = response.status;
    if (!response.ok) throw new MailDeliveryError({ success: false, httpStatus, message: "El servicio rechazó la solicitud. Revisa las credenciales y los parámetros con TI antes de volver a enviar." });
    const parsed = responseSchema.safeParse(await response.json());
    if (!parsed.success) throw new MailDeliveryError({ success: false, httpStatus, message: "El servicio devolvió una respuesta inesperada. El correo podría haberse aceptado; comprueba el buzón antes de repetir la prueba." });
    if (!parsed.data.isSuccess) throw new MailDeliveryError({ success: false, httpStatus, message: "El servicio informó un error de envío. Consulta con TI antes de repetir la prueba." });
    const providerMessageId = typeof parsed.data.message === "string" ? parsed.data.message.match(/^MessageID:\s*([A-Za-z0-9._@<>-]{1,254})(?:\s|$)/i)?.[1] ?? null : null;
    return { providerMessageId, httpStatus };
  } catch (error) {
    if (error instanceof MailDeliveryError) throw error;
    throw new MailDeliveryError({ success: false, httpStatus, message: "No se pudo confirmar el resultado del envío. Comprueba el buzón y consulta con TI antes de repetirlo." });
  }
}
