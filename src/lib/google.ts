import "server-only";
import { Readable } from "node:stream";
import { randomUUID } from "node:crypto";
import { OAuth2Client } from "google-auth-library";
import { drive } from "googleapis/build/src/apis/drive/index.js";
import { gmail } from "googleapis/build/src/apis/gmail/index.js";
import { z } from "zod";
import { googleConfigured, getOrderBankAccounts, getPublicOrigin, readOrderPaymentGuide } from "@/lib/payments/config";
import { formatMoney, toCents } from "@/lib/orders/money";
import { MASTER_EMAIL } from "@/lib/access-policy";
import { emailSubject, renderOrderEmail } from "@/lib/orders/email-template";
import { imprintNames } from "@/lib/orders/types";
import type { getTrackedOrder } from "@/lib/orders/tracking";

function ownerAuth() {
  if (!googleConfigured()) throw new Error("GOOGLE_NOT_CONFIGURED");
  const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID, process.env.GOOGLE_CLIENT_SECRET);
  client.setCredentials({ refresh_token: process.env.GOOGLE_REFRESH_TOKEN });
  return client;
}

async function retryOnce<T>(operation: () => Promise<T>): Promise<T> {
  try { return await operation(); }
  catch {
    try { return await operation(); }
    catch { throw new Error("GOOGLE_OPERATION_FAILED"); }
  }
}

export async function reserveDriveFileId() {
  return retryOnce(async () => {
    const response = await drive({ version: "v3", auth: ownerAuth() }).files.generateIds({ count: 1, space: "drive", type: "files" }, { timeout: 15_000, retry: false });
    if (!response.data.ids?.[0]) throw new Error("NO_DRIVE_ID");
    return response.data.ids[0];
  });
}

export async function uploadFileToDrive({ id, name, mimeType, bytes }: { id: string; name: string; mimeType: string; bytes: Buffer }) {
  const api = drive({ version: "v3", auth: ownerAuth() });
  return retryOnce(async () => {
    // Checking the reserved ID makes retries safe after an ambiguous create response.
    let exists = false;
    try {
      await api.files.get({ fileId: id, fields: "id" }, { timeout: 15_000, retry: false });
      exists = true;
    } catch (error) {
      const code = error && typeof error === "object" && "code" in error ? Number(error.code) : 0;
      if (code !== 404) throw error;
    }
    if (!exists) await api.files.create({
      requestBody: { id, name, parents: [process.env.GOOGLE_DRIVE_FOLDER_ID!] },
      media: { mimeType, body: Readable.from(bytes) }, fields: "id",
    }, { timeout: 20_000, retry: false });
    await api.permissions.create({ fileId: id, requestBody: { type: "anyone", role: "reader" } }, { timeout: 15_000, retry: false });
    const response = await api.files.get({ fileId: id, fields: "webViewLink" }, { timeout: 15_000, retry: false });
    return { driveFileId: id, driveViewUrl: response.data.webViewLink ?? `https://drive.google.com/file/d/${id}/view` };
  });
}

function base64Lines(value: Buffer) { return value.toString("base64").match(/.{1,76}/g)?.join("\r\n") ?? ""; }

type Tracking = NonNullable<Awaited<ReturnType<typeof getTrackedOrder>>>;
const emailTemplates = {
  solo_universidad: "Hemos recibido tu pedido. Realiza el depósito de Universidad Continental según la guía adjunta.",
  solo_instituto: "Hemos recibido tu pedido. Realiza el depósito de Instituto Continental según la guía adjunta.",
  mixto: "Hemos recibido tu pedido con publicaciones de ambos sellos. Realiza los dos depósitos según la guía adjunta.",
} as const;

function originalMessageId(tracking: Tracking) { return tracking.emailRfcMessageId ?? `<pedido-${tracking.order.id}@${new URL(getPublicOrigin()).hostname}>`; }
async function sendMime({ tracking, html, text, attachment, notificationId }: { tracking: Tracking; html: string; text: string; attachment?: { filename: string; content: Buffer }; notificationId?: string }) {
  const from = z.email().parse(process.env.GOOGLE_OWNER_EMAIL);
  const to = z.email().parse(tracking.order.customerEmail);
  const boundary = `mixed_${randomUUID()}`;
  const alternative = `alternative_${randomUUID()}`;
  const messageId = notificationId ? `<pedido-aviso-${notificationId}@${new URL(getPublicOrigin()).hostname}>` : originalMessageId(tracking);
  const headers = [
    `From: Fondo Editorial <${from}>`, `To: ${to}`,
    ...(to.toLowerCase() === MASTER_EMAIL ? [] : [`Cc: ${MASTER_EMAIL}`]),
    `Subject: =?UTF-8?B?${Buffer.from(emailSubject(tracking.order.orderNumber)).toString("base64")}?=`,
    `Message-ID: ${messageId}`, "MIME-Version: 1.0",
    ...(notificationId ? [`In-Reply-To: ${originalMessageId(tracking)}`, `References: ${originalMessageId(tracking)}`] : []),
  ];
  const body = [`--${alternative}`, "Content-Type: text/plain; charset=UTF-8", "Content-Transfer-Encoding: base64", "", base64Lines(Buffer.from(text)),
    `--${alternative}`, "Content-Type: text/html; charset=UTF-8", "Content-Transfer-Encoding: base64", "", base64Lines(Buffer.from(html)), `--${alternative}--`];
  const raw = attachment ? [...headers, `Content-Type: multipart/mixed; boundary="${boundary}"`, "", `--${boundary}`, `Content-Type: multipart/alternative; boundary="${alternative}"`, "", ...body,
    `--${boundary}`, `Content-Type: application/pdf; name="${attachment.filename}"`, "Content-Transfer-Encoding: base64", `Content-Disposition: attachment; filename="${attachment.filename}"`, "", base64Lines(attachment.content), `--${boundary}--`, ""].join("\r\n")
    : [...headers, `Content-Type: multipart/alternative; boundary="${alternative}"`, "", ...body, ""].join("\r\n");
  return retryOnce(async () => {
    const response = await gmail({ version: "v1", auth: ownerAuth() }).users.messages.send({ userId: "me", requestBody: { raw: Buffer.from(raw).toString("base64url"), ...(notificationId && tracking.emailThreadId ? { threadId: tracking.emailThreadId } : {}) } }, { timeout: 20_000, retry: false });
    if (!response.data.id || !response.data.threadId) throw new Error("NO_GMAIL_ID");
    return { id: response.data.id, threadId: response.data.threadId, messageId, rootMessageId: originalMessageId(tracking) };
  });
}

export async function sendOrderConfirmationEmail(tracking: Tracking) {
  const banks = await getOrderBankAccounts(tracking.order.paymentAccounts);
  if (!banks) throw new Error("BANKS_NOT_CONFIGURED");
  const link = `${getPublicOrigin()}/seguimiento/${tracking.order.trackingToken}`;
  const intro = emailTemplates[tracking.order.orderType];
  return sendMime({ tracking, html: renderOrderEmail(tracking, { intro, link, banks }),
    text: `Pedido ${tracking.order.orderNumber}\n${intro}\nCosto por envío: ${formatMoney(toCents(tracking.order.shippingCost))}\nTotal: ${formatMoney(toCents(tracking.order.total))}\nSeguimiento: ${link}`,
    attachment: await readOrderPaymentGuide(tracking.order),
  });
}

export async function sendOrderUpdateEmail(tracking: Tracking, notification: { id: string; eventType: string; publisherImprint: "universidad" | "instituto" | null }) {
  const imprint = notification.publisherImprint ? imprintNames[notification.publisherImprint] : "el pedido";
  const title = notification.eventType === "COMPROBANTE_RECIBIDO" ? `Comprobantes enviados para revisión · ${imprint}` : notification.eventType === "PAGO_VERIFICADO" ? `Pago verificado · ${imprint}` : `Comprobante rechazado · ${imprint}`;
  const body = notification.eventType === "COMPROBANTE_RECIBIDO" ? "Tus archivos se guardaron y el equipo ya puede revisar este pago. La preparación comienza cuando todos los pagos requeridos estén verificados." : notification.eventType === "PAGO_VERIFICADO" ? "El equipo verificó el pago de este sello. Consulta el seguimiento para conocer el estado del pedido." : "Adjunta un nuevo comprobante de este sello y confirma su envío. El estado del otro sello se conserva.";
  const link = `${getPublicOrigin()}/seguimiento/${tracking.order.trackingToken}`;
  return sendMime({ tracking, notificationId: notification.id, html: renderOrderEmail(tracking, { intro: "Hay una actualización sobre tu pedido.", link, notice: { title, body } }), text: `Pedido ${tracking.order.orderNumber}\n${title}\n${body}\nSeguimiento: ${link}` });
}
