import "server-only";
import { Readable } from "node:stream";
import { randomUUID } from "node:crypto";
import { OAuth2Client } from "google-auth-library";
import { drive } from "googleapis/build/src/apis/drive/index.js";
import { gmail } from "googleapis/build/src/apis/gmail/index.js";
import { z } from "zod";
import { safeErrorDetails } from "@/lib/server-diagnostics";
import { googleConfigured, getPublicOrigin, readOrderPaymentGuide } from "@/lib/payments/config";
import { formatMoney, toCents } from "@/lib/orders/money";
import { MASTER_EMAIL } from "@/lib/access-policy";
import { customerTrackingUrl } from "@/lib/orders/customer-links";
import { courierEstimate } from "@/lib/orders/courier";
import { readMailArt, type MailArt } from "@/lib/orders/mail-art";
import { emailSubject, renderOrderEmail, renderOrderUpdate } from "@/lib/orders/email-template";
import { imprintNames } from "@/lib/orders/types";
import type { getTrackedOrder } from "@/lib/orders/tracking";

export function ownerAuth() {
  if (!googleConfigured()) throw new Error("GOOGLE_NOT_CONFIGURED");
  const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID, process.env.GOOGLE_CLIENT_SECRET);
  client.setCredentials({ refresh_token: process.env.GOOGLE_REFRESH_TOKEN });
  return client;
}

export class GoogleOperationError extends Error {
  constructor(public readonly stage: string, cause: unknown) { super("GOOGLE_OPERATION_FAILED", { cause }); }
}
async function retryOnce<T>(operation: () => Promise<T>, stage: string | (() => string) = "google.request"): Promise<T> {
  try { return await operation(); }
  catch {
    try { return await operation(); }
    catch (cause) { throw new GoogleOperationError(typeof stage === "function" ? stage() : stage, cause); }
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
  let stage = "drive.lookup";
  return retryOnce(async () => {
    // Reserved IDs reconcile ambiguous uploads without creating another file.
    stage = "drive.lookup";
    let exists = false;
    try {
      await api.files.get({ fileId: id, fields: "id" }, { timeout: 15_000, retry: false });
      exists = true;
    } catch (error) {
      if (safeErrorDetails(error).status !== 404) throw error;
    }
    if (!exists) {
      stage = "drive.upload";
      await api.files.create({ requestBody: { id, name, parents: [process.env.GOOGLE_DRIVE_FOLDER_ID!] }, media: { mimeType, body: Readable.from(bytes) }, fields: "id" }, { timeout: 20_000, retry: false });
    }
    stage = "drive.read_link";
    const response = await api.files.get({ fileId: id, fields: "webViewLink" }, { timeout: 15_000, retry: false });
    return { driveFileId: id, driveViewUrl: response.data.webViewLink ?? `https://drive.google.com/file/d/${id}/view` };
  }, () => stage);
}

export async function readFileFromDrive(fileId: string): Promise<Readable> {
  return retryOnce(async () => {
    const response = await drive({ version: "v3", auth: ownerAuth() }).files.get({ fileId, alt: "media" }, { responseType: "stream", timeout: 20_000, retry: false });
    return response.data as unknown as Readable;
  }, "drive.download");
}

function base64Lines(value: Buffer) { return value.toString("base64").match(/.{1,76}/g)?.join("\r\n") ?? ""; }

type Tracking = NonNullable<Awaited<ReturnType<typeof getTrackedOrder>>>;
const emailTemplates = {
  solo_universidad: "Hemos recibido tu pedido. Realiza el depósito de Universidad Continental según la guía adjunta.",
  solo_instituto: "Hemos recibido tu pedido. Realiza el depósito de Instituto Continental según la guía adjunta.",
  mixto: "Hemos recibido tu pedido con publicaciones de ambos sellos. Realiza los dos depósitos según la guía adjunta.",
} as const;

function originalMessageId(tracking: Tracking) { return tracking.emailRfcMessageId ?? `<pedido-${tracking.order.id}@${new URL(getPublicOrigin()).hostname}>`; }
function formatSubject(subject: string) {
  const clean = subject.replace(/\r?\n[ \t]+/g, " ");
  if (/[\r\n\0]/.test(clean)) throw new Error("INVALID_SUBJECT_HEADER");
  return clean.startsWith("=?") ? clean : `=?UTF-8?B?${Buffer.from(clean).toString("base64")}?=`;
}

export async function readSentMailHeaders(messageId: string) {
  return retryOnce(async () => {
    const response = await gmail({ version: "v1", auth: ownerAuth() }).users.messages.get({ userId: "me", id: messageId, format: "metadata", metadataHeaders: ["Message-ID", "Subject"], fields: "threadId,payload(headers)" }, { timeout: 15_000, retry: false });
    const headers = response.data.payload?.headers ?? [];
    const rfc = headers.find((item) => item.name?.toLowerCase() === "message-id")?.value?.trim();
    const subject = headers.find((item) => item.name?.toLowerCase() === "subject")?.value;
    if (!rfc || !/^<[^<>\s]+@[^<>\s]+>$/.test(rfc) || !subject || !response.data.threadId) throw new Error("INVALID_GMAIL_HEADERS");
    return { rfcMessageId: rfc, subjectHeader: subject, threadId: response.data.threadId };
  }, "gmail.metadata");
}

async function sendMime({ tracking, html, text, attachment, notificationId, art, artCid }: { art: MailArt; artCid: string; tracking: Tracking; html: string; text: string; attachment?: { filename: string; content: Buffer }; notificationId?: string }) {
  const from = z.email().parse(process.env.GOOGLE_OWNER_EMAIL);
  const to = z.email().parse(tracking.order.customerEmail);
  const boundary = `mixed_${randomUUID()}`;
  const alternative = `alternative_${randomUUID()}`;
  const messageId = notificationId ? `<pedido-aviso-${notificationId}@${new URL(getPublicOrigin()).hostname}>` : originalMessageId(tracking);
  const headers = [
    `From: Fondo Editorial <${from}>`, `To: ${to}`,
    ...(to.toLowerCase() === MASTER_EMAIL ? [] : [`Cc: ${MASTER_EMAIL}`]),
    `Subject: ${notificationId && tracking.emailSubjectHeader ? formatSubject(tracking.emailSubjectHeader) : formatSubject(emailSubject(tracking.order.orderNumber))}`,
    `Date: ${new Date().toUTCString()}`,
    ...(tracking.handlerEmail && ![to.toLowerCase(), MASTER_EMAIL, from.toLowerCase()].includes(tracking.handlerEmail.toLowerCase()) ? [`Bcc: ${z.email().parse(tracking.handlerEmail)}`] : []),
    `Message-ID: ${messageId}`, "MIME-Version: 1.0",
    ...(notificationId ? [`In-Reply-To: ${tracking.emailLastRfcMessageId ?? originalMessageId(tracking)}`, `References: ${[...new Set([originalMessageId(tracking), ...tracking.emailReferences.slice(-8), tracking.emailLastRfcMessageId ?? originalMessageId(tracking)])].join("\r\n ")}`] : []),
  ];
  const body = [`--${alternative}`, "Content-Type: text/plain; charset=UTF-8", "Content-Transfer-Encoding: base64", "", base64Lines(Buffer.from(text)),
    `--${alternative}`, "Content-Type: text/html; charset=UTF-8", "Content-Transfer-Encoding: base64", "", base64Lines(Buffer.from(html)), `--${alternative}--`];
  const related = `related_${randomUUID()}`;
  const illustration = await readMailArt(art);
  const relatedBody = [`--${related}`, `Content-Type: multipart/alternative; boundary="${alternative}"`, "", ...body,
    `--${related}`, "Content-Type: image/png", "Content-Transfer-Encoding: base64", `Content-ID: <${artCid}>`, `Content-Disposition: inline; filename="${art}.png"`, "", base64Lines(illustration), `--${related}--`, ""];
  const raw = attachment ? [...headers, `Content-Type: multipart/mixed; boundary="${boundary}"`, "", `--${boundary}`, `Content-Type: multipart/related; boundary="${related}"`, "", ...relatedBody,
    `--${boundary}`, `Content-Type: application/pdf; name="${attachment.filename}"`, "Content-Transfer-Encoding: base64", `Content-Disposition: attachment; filename="${attachment.filename}"`, "", base64Lines(attachment.content), `--${boundary}--`, ""].join("\r\n")
    : [...headers, `Content-Type: multipart/related; boundary="${related}"`, "", ...relatedBody].join("\r\n");
  return retryOnce(async () => {
    const response = await gmail({ version: "v1", auth: ownerAuth() }).users.messages.send({ userId: "me", requestBody: { raw: Buffer.from(raw).toString("base64url"), ...(notificationId && tracking.emailThreadId ? { threadId: tracking.emailThreadId } : {}) } }, { timeout: 20_000, retry: false });
    if (!response.data.id || !response.data.threadId) throw new Error("NO_GMAIL_ID");
    return { id: response.data.id, threadId: response.data.threadId, messageId, rootMessageId: originalMessageId(tracking) };
  });
}

export async function sendOrderConfirmationEmail(tracking: Tracking) {
  const link = customerTrackingUrl(tracking.order.trackingToken);
  const artCid = `state-${tracking.order.id}@${new URL(getPublicOrigin()).hostname}`;
  const intro = emailTemplates[tracking.order.orderType];
  const amounts = (["universidad", "instituto"] as const)
    .filter((imprint) => (imprint === "universidad" ? tracking.order.paymentStatusUniversidad : tracking.order.paymentStatusInstituto) !== "NO_APLICA")
    .map((imprint) => `${imprintNames[imprint]}: ${formatMoney(toCents(imprint === "universidad" ? tracking.order.totalUniversidad : tracking.order.totalInstituto))}`)
    .join("\n");
  return sendMime({ tracking, art: "received", artCid, html: renderOrderEmail(tracking, { intro, link, artCid }),
    text: `Pedido ${tracking.order.orderNumber}\n${intro}\n${amounts}\n${tracking.order.orderType === "mixto" ? "Realiza dos depósitos independientes.\n" : ""}Seguimiento y pago: ${link}\nGuía de pago adjunta en PDF.`,
    attachment: await readOrderPaymentGuide(tracking.order),
  });
}

export async function sendOrderUpdateEmail(tracking: Tracking, notification: { id: string; eventType: string; publisherImprint: "universidad" | "instituto" | null; payload: Record<string, string>; createdAt: Date }) {
  if (!tracking.emailHeadersVerified || !tracking.emailThreadId || !tracking.emailRfcMessageId || !tracking.emailSubjectHeader) throw new Error("GMAIL_THREAD_NOT_VERIFIED");
  const imprint = notification.publisherImprint ? imprintNames[notification.publisherImprint] : "";
  const payload = notification.payload;
  const grouped = payload.scope === "pedido";
  const notices: Record<string, { title: string; body: string }> = {
    COMPROBANTE_RECIBIDO: { title: grouped ? "Comprobantes recibidos" : `Comprobante recibido · ${imprint}`, body: grouped ? "Ya recibimos los comprobantes de ambos sellos. Te avisaremos cuando termine la revisión de los pagos." : "Tu comprobante ya está adjunto al pedido. Te avisaremos al terminar la revisión." },
    PAGO_VERIFICADO: { title: grouped ? "Pagos confirmados" : `Pago verificado · ${imprint}`, body: payload.orderStatus === "EN_PREPARACION" ? "Todos los pagos están verificados. Tus publicaciones pasan a distribución." : "Este pago está verificado. Continuaremos con la distribución cuando se verifique el otro sello." },
    PAGO_RECHAZADO: { title: `Necesitamos otro comprobante · ${imprint}`, body: payload.reason || "Revisa el comprobante y adjunta uno nuevo desde tu seguimiento." },
    DESPACHADO: { title: payload.deliveryType === "recojo_campus" ? "Tu pedido está listo para recoger" : "Tu pedido está en camino", body: payload.deliveryType === "recojo_campus" ? "Tus publicaciones están listas para recoger en la biblioteca. Lleva tu documento de identidad." : `Enviamos tus publicaciones por ${payload.courier || tracking.order.courier || "el transporte indicado"}.${payload.trackingCode ? ` Número de guía: ${payload.trackingCode}.` : ""} ${courierEstimate(payload.deliveryZone || tracking.order.deliveryZone)}` },
    ENTREGADO: { title: "Pedido entregado", body: "Registramos la entrega de tus publicaciones. Gracias por tu pedido." },
  };
  const notice = notices[notification.eventType];
  if (!notice) throw new Error("INVALID_NOTIFICATION_EVENT");
  const link = customerTrackingUrl(tracking.order.trackingToken);
  const art: MailArt = notification.eventType === "COMPROBANTE_RECIBIDO" ? "review" : notification.eventType === "PAGO_RECHAZADO" ? "rejected" : notification.eventType === "PAGO_VERIFICADO" ? payload.orderStatus === "EN_PREPARACION" ? "preparing" : "verified" : notification.eventType === "DESPACHADO" ? payload.deliveryType === "recojo_campus" ? "pickup" : "shipped" : "delivered";
  const artCid = `state-${notification.id}@${new URL(getPublicOrigin()).hostname}`;
  const deliveryLocation = notification.eventType === "DESPACHADO" ? { address: payload.address || tracking.order.deliveryAddress, libraryLocation: payload.libraryLocation ?? tracking.order.deliveryLibraryLocation ?? "", mapUrl: payload.mapUrl || tracking.order.deliveryMapUrl } : undefined;
  return sendMime({ tracking, art, artCid, notificationId: notification.id, html: renderOrderUpdate(tracking, { ...notice, link, trackingUrl: payload.trackingUrl, createdAt: notification.createdAt, artCid, deliveryLocation }), text: `Pedido ${tracking.order.orderNumber}\n${notice.title}\n${notice.body}\n${payload.trackingUrl || ""}\n${deliveryLocation ? [deliveryLocation.address, deliveryLocation.libraryLocation, deliveryLocation.mapUrl].filter(Boolean).join("\n") : ""}\nSeguimiento: ${link}` });
}
