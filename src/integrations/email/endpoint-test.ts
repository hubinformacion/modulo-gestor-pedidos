import "server-only";
import { z } from "zod";
import { getMailEndpointEnvironment } from "@/shared/config/mail-endpoint";
import type { MailEndpointTestInput, MailEndpointTestResult } from "@/modules/settings/domain/mail-endpoint-test";

const responseSchema = z.object({ isSuccess: z.boolean(), message: z.unknown().optional() });

// This probe is deliberately separate from the operational Gmail senders.
export async function sendMailEndpointTest(input: MailEndpointTestInput, attachment?: { filename: string; content: Buffer }): Promise<MailEndpointTestResult> {
  const environment = getMailEndpointEnvironment();
  if (!environment.success) return { success: false, message: "Completa la configuración del servicio de correo en el servidor." };
  const config = environment.data;
  const cc = input.cc.filter((email) => email !== input.to);
  const bcc = input.bcc.filter((email) => email !== input.to && !cc.includes(email));
  let httpStatus: number | undefined;
  try {
    const response = await fetch(config.MAIL_ENDPOINT_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Ocp-Apim-Subscription-Key": config.MAIL_ENDPOINT_TOKEN },
      body: JSON.stringify({
        from: config.MAIL_ENDPOINT_FROM,
        fromName: config.MAIL_ENDPOINT_FROM_NAME,
        asunto: input.subject,
        mensaje: input.html,
        emailDestino: input.to,
        cc: cc.join(";"),
        cco: bcc.join(";"),
        sistema: config.MAIL_ENDPOINT_SYSTEM,
        unidadNegocio: config.MAIL_ENDPOINT_BUSINESS_UNIT,
        retry: 1,
        adjuntos: attachment ? [{ base64Encode: attachment.content.toString("base64"), nombreArchivoConExtension: attachment.filename, mimeType: "application/pdf" }] : [],
      }),
      signal: AbortSignal.timeout(20_000),
      redirect: "error",
      cache: "no-store",
    });
    httpStatus = response.status;
    if (!response.ok) return { success: false, httpStatus, message: "El servicio rechazó la solicitud. Revisa las credenciales y los parámetros con TI antes de volver a enviar." };
    const parsed = responseSchema.safeParse(await response.json());
    if (!parsed.success) return { success: false, httpStatus, message: "El servicio devolvió una respuesta inesperada. El correo podría haberse aceptado; comprueba el buzón antes de repetir la prueba." };
    if (!parsed.data.isSuccess) return { success: false, httpStatus, message: "El servicio informó un error de envío. Consulta con TI antes de repetir la prueba." };
    const providerMessageId = typeof parsed.data.message === "string" ? parsed.data.message.match(/^MessageID:\s*([A-Za-z0-9._@<>-]{1,254})(?:\s|$)/i)?.[1] : undefined;
    return { success: true, httpStatus, providerMessageId, message: "El servicio aceptó el correo. Revisa el buzón de destino para confirmar la recepción." };
  } catch {
    // Never retry an ambiguous send or expose provider bodies, credentials or payloads.
    return { success: false, httpStatus, message: "No se pudo confirmar el resultado del envío. Comprueba el buzón y consulta con TI antes de repetir la prueba." };
  }
}
