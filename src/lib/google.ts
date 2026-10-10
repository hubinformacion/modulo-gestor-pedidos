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
import { managerMailCopies } from "@/lib/orders/mail-recipients";
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

function attachmentName(filename: string) {
  const fallback = filename.replace(/[^\x20-\x7e]/g, "_").replace(/["\\]/g, "_");
  return `filename="${fallback}"; filename*=UTF-8''${encodeURIComponent(filename).replace(/[!'()*]/g, (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`)}`;
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

export type PdfAttachment = { filename: string; content: Buffer };
export type MailAudience = { to: string[]; subject: string; threadId?: string | null; lastRfcMessageId?: string | null; references?: string[] };
async function sendMime({ tracking, html, text, attachment, attachments = [], audience, notificationId, art, artCid, eventCreatedAt }: { eventCreatedAt?: Date; attachments?: PdfAttachment[]; audience?: MailAudience; art: MailArt; artCid: string; tracking: Tracking; html: string; text: string; attachment?: { filename: string; content: Buffer }; notificationId?: string }) {
  const from = z.email().parse(process.env.GOOGLE_OWNER_EMAIL);
  const recipients = [...new Set(z.array(z.email()).min(1).parse(audience?.to ?? [tracking.order.customerEmail]).map((email) => email.toLowerCase()))];
  const to = recipients.join(", ");
  const cc = audience ? [] : await managerMailCopies(eventCreatedAt ?? tracking.order.createdAt, recipients);
  const boundary = `mixed_${randomUUID()}`;
  const alternative = `alternative_${randomUUID()}`;
  const messageId = notificationId ? `<pedido-aviso-${notificationId}@${new URL(getPublicOrigin()).hostname}>` : originalMessageId(tracking);
  const headers = [
    `From: Fondo Editorial <${from}>`, `To: ${to}`,
    ...(cc.length ? [`Cc: ${cc.join(", ")}`] : []),
    `Subject: ${audience ? formatSubject(audience.subject) : notificationId && tracking.emailSubjectHeader ? formatSubject(tracking.emailSubjectHeader) : formatSubject(emailSubject(tracking.order.orderNumber))}`,
    `Date: ${new Date().toUTCString()}`,
    `Message-ID: ${messageId}`, "MIME-Version: 1.0",
    ...(audience ? (audience.lastRfcMessageId ? [`In-Reply-To: ${audience.lastRfcMessageId}`, `References: ${[...new Set([...(audience.references ?? []), audience.lastRfcMessageId])].slice(-10).join("\r\n ")}`] : []) : notificationId ? [`In-Reply-To: ${tracking.emailLastRfcMessageId ?? originalMessageId(tracking)}`, `References: ${[...new Set([originalMessageId(tracking), ...tracking.emailReferences.slice(-8), tracking.emailLastRfcMessageId ?? originalMessageId(tracking)])].join("\r\n ")}`] : []),
  ];
  const body = [`--${alternative}`, "Content-Type: text/plain; charset=UTF-8", "Content-Transfer-Encoding: base64", "", base64Lines(Buffer.from(text)),
    `--${alternative}`, "Content-Type: text/html; charset=UTF-8", "Content-Transfer-Encoding: base64", "", base64Lines(Buffer.from(html)), `--${alternative}--`];
  const related = `related_${randomUUID()}`;
  const illustration = await readMailArt(art);
  const relatedBody = [`--${related}`, `Content-Type: multipart/alternative; boundary="${alternative}"`, "", ...body,
    `--${related}`, "Content-Type: image/png", "Content-Transfer-Encoding: base64", `Content-ID: <${artCid}>`, `Content-Disposition: inline; filename="${art}.png"`, "", base64Lines(illustration), `--${related}--`, ""];
  const pdfs = attachment ? [attachment, ...attachments] : attachments;
  const raw = pdfs.length ? [...headers, `Content-Type: multipart/mixed; boundary="${boundary}"`, "", `--${boundary}`, `Content-Type: multipart/related; boundary="${related}"`, "", ...relatedBody,
    ...pdfs.flatMap((pdf) => [`--${boundary}`, "Content-Type: application/pdf", "Content-Transfer-Encoding: base64", `Content-Disposition: attachment; ${attachmentName(pdf.filename)}`, "", base64Lines(pdf.content)]), `--${boundary}--`, ""].join("\r\n")
    : [...headers, `Content-Type: multipart/related; boundary="${related}"`, "", ...relatedBody].join("\r\n");
  return retryOnce(async () => {
    const response = await gmail({ version: "v1", auth: ownerAuth() }).users.messages.send({ userId: "me", requestBody: { raw: Buffer.from(raw).toString("base64url"), ...((audience?.threadId ?? (!audience && notificationId ? tracking.emailThreadId : null)) ? { threadId: audience?.threadId ?? tracking.emailThreadId! } : {}) } }, { timeout: 20_000, retry: false });
    if (!response.data.id || !response.data.threadId) throw new Error("NO_GMAIL_ID");
    return { id: response.data.id, threadId: response.data.threadId, messageId, rootMessageId: originalMessageId(tracking) };
  });
}

export async function sendOrderConfirmationEmail(tracking: Tracking) {
  const link = customerTrackingUrl(tracking.order.trackingToken);
  const artCid = `state-${tracking.order.id}@${new URL(getPublicOrigin()).hostname}`;
  if (tracking.order.orderStatus === "CANCELADO") {
    const title = "Pedido cancelado";
    const body = `El pedido está cerrado. No realices nuevos depósitos.${tracking.order.cancellationReason ? ` Motivo: ${tracking.order.cancellationReason}` : ""} Si realizaste un depósito, contacta al Fondo Editorial para coordinar su devolución.`;
    return sendMime({ tracking, art: "rejected", artCid, html: renderOrderUpdate(tracking, { title, body, link, artCid, createdAt: tracking.order.cancelledAt ?? tracking.order.updatedAt }), text: `${title}\n${body}\nSeguimiento: ${link}` });
  }
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

export async function sendOrderUpdateEmail(tracking: Tracking, notification: { id: string; eventType: string; publisherImprint: "universidad" | "instituto" | null; payload: Record<string, string>; createdAt: Date }, attachments?: PdfAttachment[]) {
  if (!tracking.emailHeadersVerified || !tracking.emailThreadId || !tracking.emailRfcMessageId || !tracking.emailSubjectHeader) throw new Error("GMAIL_THREAD_NOT_VERIFIED");
  const imprint = notification.publisherImprint ? imprintNames[notification.publisherImprint] : "";
  const payload = notification.payload;
  const grouped = payload.scope === "pedido";
  const notices: Record<string, { title: string; body: string }> = {
    COMPROBANTE_RECIBIDO: { title: grouped ? "Comprobantes recibidos" : "Comprobante recibido", body: grouped ? "Ya recibimos los comprobantes de ambos sellos. Te avisaremos cuando termine la revisión de los pagos." : "Tu comprobante ya está adjunto al pedido. Te avisaremos al terminar la revisión." },
    PAGO_VERIFICADO: { title: grouped ? "Pagos confirmados" : "Pago confirmado", body: payload.orderStatus === "EN_PREPARACION" ? "Todos los pagos están verificados. Tus publicaciones pasan a distribución." : "Este pago está verificado. Continuaremos con la distribución cuando se verifique el otro sello." },
    PAGO_RECHAZADO: { title: "Necesitamos otro comprobante", body: `${imprint ? `Revisa el comprobante de ${imprint}. ` : ""}${payload.reason || "Adjunta un archivo nuevo desde tu seguimiento."}` },
    DESPACHADO: { title: payload.deliveryType === "recojo_campus" ? "Tu pedido está listo para recoger" : "Tu pedido está en camino", body: payload.deliveryType === "recojo_campus" ? "Tus publicaciones están listas para recoger en la biblioteca. Lleva tu documento de identidad." : `Enviamos tus publicaciones por ${payload.courier || tracking.order.courier || "el transporte indicado"}.${payload.trackingCode ? ` Número de guía: ${payload.trackingCode}.` : ""} ${courierEstimate(payload.deliveryZone || tracking.order.deliveryZone)}` },
    DOCUMENTOS_VENTA: { title: payload.correction === "true" ? "Documentos de venta actualizados" : "Tus documentos de venta", body: `${payload.correction === "true" ? "Adjuntamos las versiones corregidas" : "Adjuntamos la boleta o factura"}${tracking.order.orderType === "mixto" ? " de ambos sellos editoriales" : " de tu pedido"}. Conserva los PDF adjuntos para tu registro.` },
    CANCELADO: { title: payload.source === "gestor" ? "Pedido anulado por Fondo Editorial" : "Pedido cancelado", body: `El pedido está cerrado. No realices nuevos depósitos.${payload.reason ? ` Motivo: ${payload.reason}` : ""} Si realizaste un depósito, contacta al Fondo Editorial para coordinar su devolución.` },
    ENTREGADO: { title: "Pedido entregado", body: "Registramos la entrega de tus publicaciones. Gracias por tu pedido." },
  };
  const notice = notices[notification.eventType];
  if (!notice) throw new Error("INVALID_NOTIFICATION_EVENT");
  const link = customerTrackingUrl(tracking.order.trackingToken);
  const art: MailArt = notification.eventType === "CANCELADO" ? "rejected" : notification.eventType === "DOCUMENTOS_VENTA" ? "verified" : notification.eventType === "COMPROBANTE_RECIBIDO" ? "review" : notification.eventType === "PAGO_RECHAZADO" ? "rejected" : notification.eventType === "PAGO_VERIFICADO" ? payload.orderStatus === "EN_PREPARACION" ? "preparing" : "verified" : notification.eventType === "DESPACHADO" ? payload.deliveryType === "recojo_campus" ? "pickup" : "shipped" : "delivered";
  const artCid = `state-${notification.id}@${new URL(getPublicOrigin()).hostname}`;
  const deliveryLocation = notification.eventType === "DESPACHADO" ? { address: payload.address || tracking.order.deliveryAddress, libraryLocation: payload.libraryLocation ?? tracking.order.deliveryLibraryLocation ?? "", mapUrl: payload.mapUrl || tracking.order.deliveryMapUrl } : undefined;
  return sendMime({ tracking, art, artCid, attachments, eventCreatedAt: notification.createdAt, notificationId: notification.id, html: renderOrderUpdate(tracking, { ...notice, link, trackingUrl: payload.trackingUrl, createdAt: notification.createdAt, artCid, deliveryLocation }), text: `Pedido ${tracking.order.orderNumber}\n${notice.title}\n${notice.body}\n${payload.trackingUrl || ""}\n${deliveryLocation ? [deliveryLocation.address, deliveryLocation.libraryLocation, deliveryLocation.mapUrl].filter(Boolean).join("\n") : ""}\nSeguimiento: ${link}` });
}

export async function sendCajaEmail(tracking: Tracking, audience: MailAudience, notificationId: string, html: string, text: string, art: MailArt, eventCreatedAt: Date) {
  const artCid = `caja-${notificationId}@${new URL(getPublicOrigin()).hostname}`;
  return sendMime({ tracking, audience, notificationId, html, text, art, artCid, eventCreatedAt });
}
