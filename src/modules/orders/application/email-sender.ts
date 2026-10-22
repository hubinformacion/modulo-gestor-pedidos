import { buildEmailMessage } from "@/integrations/email/message";
import type { MailAudience, PdfAttachment } from "@/integrations/email/types";
import { sendRawMail } from "@/integrations/google/gmail";
import { customerTrackingUrl } from "@/integrations/wordpress/customer-links";
import { emailSubject, renderOrderEmail, renderOrderUpdate } from "@/modules/orders/application/email-template";
import { managerMailCopies } from "@/modules/orders/data/mail-recipients";
import type { getTrackedOrder } from "@/modules/orders/data/tracking";
import { courierEstimate } from "@/modules/orders/domain/courier";
import { formatMoney, toCents } from "@/modules/orders/domain/money";
import { formatOrderNumber } from "@/modules/orders/domain/number";
import { imprintNames } from "@/modules/orders/domain/types";
import { readOrderPaymentGuide } from "@/modules/settings/application/payment-config";
import { getPublicOrigin } from "@/shared/config/application";
import "server-only";
import { z } from "zod";
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
export async function sendOrderMessage({ tracking, html, text, attachment, attachments = [], audience, notificationId, logoCid, eventCreatedAt }: { eventCreatedAt?: Date; attachments?: PdfAttachment[]; audience?: MailAudience; logoCid: string; tracking: Tracking; html: string; text: string; attachment?: { filename: string; content: Buffer }; notificationId?: string }) {
  const from = z.email().parse(process.env.GOOGLE_OWNER_EMAIL);
  const recipients = [...new Set(z.array(z.email()).min(1).parse(audience?.to ?? [tracking.order.customerEmail]).map((email) => email.toLowerCase()))];
  const to = recipients.join(", ");
  const cc = (await managerMailCopies(eventCreatedAt ?? tracking.order.createdAt, recipients))
    .filter((email) => !audience || email !== tracking.order.customerEmail.toLowerCase());
  const messageId = notificationId ? `<pedido-aviso-${notificationId}@${new URL(getPublicOrigin()).hostname}>` : originalMessageId(tracking);
  const headers = [
    `From: Fondo Editorial <${from}>`, `To: ${to}`,
    ...(cc.length ? [`Cc: ${cc.join(", ")}`] : []),
    `Subject: ${audience ? formatSubject(audience.subject) : notificationId && tracking.emailSubjectHeader ? formatSubject(tracking.emailSubjectHeader) : formatSubject(emailSubject(tracking.order.orderNumber))}`,
    `Date: ${new Date().toUTCString()}`,
    `Message-ID: ${messageId}`, "MIME-Version: 1.0",
    ...(audience ? (audience.lastRfcMessageId ? [`In-Reply-To: ${audience.lastRfcMessageId}`, `References: ${[...new Set([...(audience.references ?? []), audience.lastRfcMessageId])].slice(-10).join("\r\n ")}`] : []) : notificationId ? [`In-Reply-To: ${tracking.emailLastRfcMessageId ?? originalMessageId(tracking)}`, `References: ${[...new Set([originalMessageId(tracking), ...tracking.emailReferences.slice(-8), tracking.emailLastRfcMessageId ?? originalMessageId(tracking)])].join("\r\n ")}`] : []),
  ];
  const raw = await buildEmailMessage({ headers, html, text, attachment, attachments, logoCid });
  const threadId = audience?.threadId ?? (!audience && notificationId ? tracking.emailThreadId : null);
  const sent = await sendRawMail(raw, threadId);
  return { ...sent, messageId, rootMessageId: originalMessageId(tracking) };
}

export async function sendOrderConfirmationEmail(tracking: Tracking) {
  const link = customerTrackingUrl(tracking.order.trackingToken);
  const logoCid = `brand-${tracking.order.id}@${new URL(getPublicOrigin()).hostname}`;
  if (tracking.order.orderStatus === "CANCELADO") {
    const title = "Pedido cancelado";
    const body = `El pedido está cerrado. No realices nuevos depósitos.${tracking.order.cancellationReason ? ` Motivo: ${tracking.order.cancellationReason}` : ""} Si realizaste un depósito, contacta al Fondo Editorial para coordinar su devolución.`;
    return sendOrderMessage({ tracking, logoCid, html: renderOrderUpdate(tracking, { title, body, link, logoCid, createdAt: tracking.order.cancelledAt ?? tracking.order.updatedAt }), text: `${title}\n${body}\nSeguimiento: ${link}` });
  }
  const intro = emailTemplates[tracking.order.orderType];
  const amounts = (["universidad", "instituto"] as const)
    .filter((imprint) => (imprint === "universidad" ? tracking.order.paymentStatusUniversidad : tracking.order.paymentStatusInstituto) !== "NO_APLICA")
    .map((imprint) => `${imprintNames[imprint]}: ${formatMoney(toCents(imprint === "universidad" ? tracking.order.totalUniversidad : tracking.order.totalInstituto))}`)
    .join("\n");
  return sendOrderMessage({
    tracking, logoCid, html: renderOrderEmail(tracking, { intro, link, logoCid }),
    text: `Pedido ${formatOrderNumber(tracking.order.orderNumber)}\n${intro}\n${amounts}\n${tracking.order.orderType === "mixto" ? "Realiza dos depósitos independientes.\n" : ""}Seguimiento y pago: ${link}\nGuía de pago adjunta en PDF.`,
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
  const logoCid = `brand-${notification.id}@${new URL(getPublicOrigin()).hostname}`;
  const deliveryLocation = notification.eventType === "DESPACHADO" ? { address: payload.address || tracking.order.deliveryAddress, libraryLocation: payload.libraryLocation ?? tracking.order.deliveryLibraryLocation ?? "", pickupHours: payload.pickupHours ?? tracking.order.deliveryPickupHours ?? "", pickupContactName: payload.pickupContactName ?? tracking.order.pickupContactName ?? "", pickup: tracking.order.deliveryType === "recojo_campus", mapUrl: payload.mapUrl || tracking.order.deliveryMapUrl } : undefined;
  return sendOrderMessage({ tracking, logoCid, attachments, eventCreatedAt: notification.createdAt, notificationId: notification.id, html: renderOrderUpdate(tracking, { ...notice, link, trackingUrl: payload.trackingUrl, createdAt: notification.createdAt, logoCid, deliveryLocation }), text: `Pedido ${formatOrderNumber(tracking.order.orderNumber)}\n${notice.title}\n${notice.body}\n${payload.trackingUrl || ""}\n${deliveryLocation ? [deliveryLocation.address, deliveryLocation.libraryLocation, deliveryLocation.pickupHours, deliveryLocation.pickupContactName ? `Pregunta por ${deliveryLocation.pickupContactName}.` : "", deliveryLocation.pickup ? "Presenta en vigilancia tu DNI, correo de la orden y comprobante del depósito." : "", deliveryLocation.mapUrl].filter(Boolean).join("\n") : ""}\nSeguimiento: ${link}` });
}
export async function sendPickupSupportEmail(tracking: Tracking, contactEmail: string, noticeId: string, createdAt: Date, html: string, text: string) {
  const logoCid = `brand-pickup-support-${noticeId}@${new URL(getPublicOrigin()).hostname}`;
  return sendOrderMessage({ tracking, audience: { to: [contactEmail], subject: `Apoyo para recojo · Orden #${formatOrderNumber(tracking.order.orderNumber)} - Fondo Editorial` }, notificationId: noticeId, logoCid, eventCreatedAt: createdAt, html, text });
}
