import { buildEmailMessage } from "@/integrations/email/message";
import type { MailAudience, PdfAttachment } from "@/integrations/email/types";
import { formatMailSubject, sendStandaloneMail, type SentMail } from "@/integrations/email/send";
import { sendRawMail } from "@/integrations/google/gmail";
import { customerTrackingUrl } from "@/integrations/wordpress/customer-links";
import { managerMailCopies } from "@/modules/orders/data/mail-recipients";
import type { getTrackedOrder } from "@/modules/orders/data/tracking";
import { readOrderPaymentGuide } from "@/modules/settings/application/payment-config";
import { getPublicOrigin } from "@/shared/config/application";
import { getMailProvider } from "@/shared/config/mail";
import { buildOrderConfirmationContent, buildOrderUpdateContent, buildReceiptReviewContent, type OrderNotice } from "./order-mail-content";
import "server-only";
import { z } from "zod";
type Tracking = NonNullable<Awaited<ReturnType<typeof getTrackedOrder>>>;
function originalMessageId(tracking: Tracking) { return tracking.emailRfcMessageId ?? `<pedido-${tracking.order.id}@${new URL(getPublicOrigin()).hostname}>`; }

export async function sendOrderMessage({ tracking, html, text, subject, attachment, attachments = [], audience, notificationId, logoCid, eventCreatedAt }: { subject?: string; eventCreatedAt?: Date; attachments?: PdfAttachment[]; audience?: MailAudience; logoCid: string; tracking: Tracking; html: string; text: string; attachment?: PdfAttachment; notificationId?: string }): Promise<SentMail> {
  const provider = getMailProvider();
  const recipients = [...new Set(z.array(z.email()).min(1).parse(audience?.to ?? [tracking.order.customerEmail]).map((email) => email.toLowerCase()))];
  const cc = (await managerMailCopies(eventCreatedAt ?? tracking.order.createdAt, recipients)).filter((email) => !audience || email !== tracking.order.customerEmail.toLowerCase());
  const currentSubject = audience?.subject ?? subject ?? buildOrderConfirmationContent(tracking, "", logoCid).subject;
  const pdfs = attachment ? [attachment, ...attachments] : attachments;
  if (provider === "endpoint") return sendStandaloneMail({ to: recipients, cc, subject: currentSubject, html, text, attachments: pdfs, logoCid }, provider);
  const from = z.email().parse(process.env.GOOGLE_OWNER_EMAIL);
  const messageId = notificationId ? `<pedido-aviso-${notificationId}@${new URL(getPublicOrigin()).hostname}>` : originalMessageId(tracking);
  // Existing Gmail conversations keep their subject. Endpoint messages never use it.
  const gmailSubject = audience?.subject ?? (notificationId && tracking.emailSubjectHeader ? tracking.emailSubjectHeader : currentSubject);
  const headers = [`From: Fondo Editorial <${from}>`, `To: ${recipients.join(", ")}`, ...(cc.length ? [`Cc: ${cc.join(", ")}`] : []),
    `Subject: ${formatMailSubject(gmailSubject.replace(/\r?\n[ \t]+/g, " "))}`, `Date: ${new Date().toUTCString()}`, `Message-ID: ${messageId}`, "MIME-Version: 1.0",
    ...(audience ? (audience.lastRfcMessageId ? [`In-Reply-To: ${audience.lastRfcMessageId}`, `References: ${[...new Set([...(audience.references ?? []), audience.lastRfcMessageId])].slice(-10).join("\r\n ")}`] : []) : notificationId ? [`In-Reply-To: ${tracking.emailLastRfcMessageId ?? originalMessageId(tracking)}`, `References: ${[...new Set([originalMessageId(tracking), ...tracking.emailReferences.slice(-8), tracking.emailLastRfcMessageId ?? originalMessageId(tracking)])].join("\r\n ")}`] : []),
  ];
  const raw = await buildEmailMessage({ headers, html, text, attachments: pdfs, logoCid });
  const sent = await sendRawMail(raw, audience?.threadId ?? (!audience && notificationId ? tracking.emailThreadId : null));
  return { ...sent, provider, providerMessageId: sent.id };
}

export async function sendOrderConfirmationEmail(tracking: Tracking) {
  const logoCid = `brand-${tracking.order.id}@${new URL(getPublicOrigin()).hostname}`;
  if (tracking.order.orderStatus === "CANCELADO") {
    const content = buildOrderUpdateContent(tracking, {
      id: tracking.order.id, eventType: "CANCELADO", publisherImprint: null,
      payload: { reason: tracking.order.cancellationReason ?? "" },
      createdAt: tracking.order.cancelledAt ?? tracking.order.updatedAt,
    }, customerTrackingUrl(tracking.order.trackingToken), logoCid);
    return sendOrderMessage({ tracking, logoCid, ...content });
  }
  const content = buildOrderConfirmationContent(tracking, customerTrackingUrl(tracking.order.trackingToken), logoCid);
  return sendOrderMessage({ tracking, logoCid, ...content, attachment: await readOrderPaymentGuide(tracking.order) });
}
export async function sendOrderUpdateEmail(tracking: Tracking, notification: OrderNotice, attachments?: PdfAttachment[]) {
  const logoCid = `brand-${notification.id}@${new URL(getPublicOrigin()).hostname}`;
  if (notification.eventType === "COMPROBANTE_RECIBIDO") {
    const managers = (await managerMailCopies(notification.createdAt, [tracking.order.customerEmail]));
    if (!managers.length) throw new NoMailRecipients();
    const link = new URL(`/admin/pedidos/${tracking.order.id}`, getPublicOrigin()).toString();
    const content = buildReceiptReviewContent(tracking.order.orderNumber, notification.payload.scope === "pedido", link, logoCid);
    // One message: first manager in To, remaining managers in Cc. Never the buyer.
    return sendStandaloneMail({ to: [managers[0]], cc: managers.slice(1), ...content, logoCid });
  }
  if (getMailProvider() === "gmail" && (!tracking.emailHeadersVerified || !tracking.emailThreadId || !tracking.emailRfcMessageId || !tracking.emailSubjectHeader)) throw new Error("GMAIL_THREAD_NOT_VERIFIED");
  const content = buildOrderUpdateContent(tracking, notification, customerTrackingUrl(tracking.order.trackingToken), logoCid);
  return sendOrderMessage({ tracking, logoCid, attachments, ...content, eventCreatedAt: notification.createdAt, notificationId: notification.id });
}
export class NoMailRecipients extends Error { constructor() { super("NO_MAIL_RECIPIENTS"); } }
export async function sendPickupSupportEmail(tracking: Tracking, contactEmail: string, noticeId: string, createdAt: Date, html: string, text: string, subject: string) {
  const logoCid = `brand-pickup-support-${noticeId}@${new URL(getPublicOrigin()).hostname}`;
  return sendOrderMessage({ tracking, audience: { to: [contactEmail], subject }, notificationId: noticeId, logoCid, eventCreatedAt: createdAt, html, text });
}
