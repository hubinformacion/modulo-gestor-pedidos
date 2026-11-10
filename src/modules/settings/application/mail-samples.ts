import "server-only";
import type { MailSampleSelection } from "@/modules/settings/domain/mail-samples";
import type { EmailOrder } from "@/modules/orders/application/email-template";
import { buildOrderConfirmationContent, buildOrderUpdateContent, buildReceiptReviewContent } from "@/modules/orders/application/order-mail-content";
import { buildPickupSupportContent } from "@/modules/orders/application/pickup-mail-content";
import { renderCajaNotice } from "@/modules/treasury/application/email-template";
import { getMailLogoUrl } from "@/shared/config/mail";
import type { PdfAttachment } from "@/integrations/email/types";

// Explicitly requested examples: no order, inventory, identity or Drive records.
const sampleDate = new Date("2026-11-10T15:00:00-05:00");
const logoCid = "mail-sample@preview.invalid";

function samplePdf(filename: string): PdfAttachment {
  const stream = "BT /F1 16 Tf 50 780 Td (PRUEBA - DOCUMENTO FICTICIO SIN VALOR) Tj ET";
  const objects = ["<< /Type /Catalog /Pages 2 0 R >>", "<< /Type /Pages /Kids [3 0 R] /Count 1 >>", "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>", "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>", `<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}\nendstream`];
  let pdf = "%PDF-1.4\n";
  const offsets = [0];
  for (const [index, object] of objects.entries()) { offsets.push(Buffer.byteLength(pdf)); pdf += `${index + 1} 0 obj\n${object}\nendobj\n`; }
  const xref = Buffer.byteLength(pdf);
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets.slice(1).map((offset) => `${String(offset).padStart(10, "0")} 00000 n \n`).join("")}trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return { filename, content: Buffer.from(pdf) };
}

export async function buildMailSample(input: MailSampleSelection) {
  const mixed = input.variant === "mixto";
  const instituto = input.variant === "instituto";
  const invoice = input.billing === "factura";
  const tracking: EmailOrder = { order: {
    orderNumber: "EJEMPLO-2026", createdAt: sampleDate, customerName: "Persona de ejemplo (ficticia)",
    orderType: mixed ? "mixto" : instituto ? "solo_instituto" : "solo_universidad",
    paymentStatusUniversidad: instituto ? "NO_APLICA" : "VERIFICADO", paymentStatusInstituto: !instituto && !mixed ? "NO_APLICA" : "VERIFICADO",
    totalUniversidad: instituto ? "0.00" : "50.00", totalInstituto: !instituto && !mixed ? "0.00" : "30.00", shippingCost: "0.00",
    deliveryType: input.delivery, courier: "Courier de ejemplo (ficticio)", deliveryZone: "lima_callao", deliveryAddress: "Dirección de ejemplo · sin ubicación real",
    deliveryLibraryLocation: "Biblioteca de ejemplo (ficticia)", deliveryPickupHours: "Horario de ejemplo", pickupContactName: "Personal de ejemplo (ficticio)", deliveryMapUrl: "",
  } };
  let content: { subject: string; html: string; text: string };
  let attachments: PdfAttachment[] = [];
  if (input.template === "PEDIDO_RECIBIDO") {
    content = buildOrderConfirmationContent(tracking, "#", logoCid);
    attachments = [samplePdf(`guia_pago_${input.variant}_EJEMPLO.pdf`)];
  } else if (input.template === "COMPROBANTE_RECIBIDO") {
    content = buildReceiptReviewContent(tracking.order.orderNumber, mixed, "#", logoCid);
  } else if (input.template === "APOYO_RECOJO") {
    content = buildPickupSupportContent({ orderNumber: tracking.order.orderNumber, deliveryRecipient: "Persona de ejemplo (ficticia)", deliveryRecipientDocument: "DOCUMENTO FICTICIO", customerDocument: "DOCUMENTO FICTICIO", deliveryRecipientPhone: "TELÉFONO FICTICIO", customerPhone: "TELÉFONO FICTICIO", deliveryAddress: tracking.order.deliveryAddress, deliveryLibraryLocation: tracking.order.deliveryLibraryLocation, deliveryPickupHours: tracking.order.deliveryPickupHours }, [{ title: "Publicación de ejemplo (ficticia)", quantity: 2 }], "Personal de ejemplo (ficticio)", logoCid);
  } else if (input.template.startsWith("CAJA_")) {
    const eventType = input.template === "CAJA_SOLICITUD" ? "SOLICITUD" : input.template === "CAJA_FINALIZADA" ? "FINALIZADA" : input.template === "CAJA_DEVUELTA" ? "DEVUELTA" : "ANULADA";
    content = renderCajaNotice({ orderNumber: tracking.order.orderNumber, requestNumber: "EJEMPLO", imprint: instituto ? "instituto" : "universidad", invoice,
      assignedName: eventType === "SOLICITUD" ? null : "Responsable de ejemplo (ficticio)", customerName: tracking.order.customerName,
      customerDocument: "DOCUMENTO FICTICIO", customerPhone: "TELÉFONO FICTICIO", billingRuc: invoice ? "RUC FICTICIO" : null,
      billingBusinessName: invoice ? "Razón social de ejemplo (ficticia)" : null, billingAddress: invoice ? "Dirección fiscal de ejemplo (ficticia)" : null,
      amount: instituto ? "S/ 30.00" : "S/ 50.00", eventType, reason: "Motivo de ejemplo para revisar la comunicación.", link: "#", logoCid });
  } else {
    const eventType = input.template === "ANULADO" ? "CANCELADO" : input.template === "DOCUMENTOS_CORREGIDOS" ? "DOCUMENTOS_VENTA" : input.template;
    content = buildOrderUpdateContent(tracking, { id: "ejemplo", eventType, publisherImprint: instituto ? "instituto" : "universidad", createdAt: sampleDate,
      payload: { scope: mixed ? "pedido" : "", orderStatus: "EN_PREPARACION", deliveryType: input.delivery, deliveryZone: "lima_callao", courier: "Courier de ejemplo (ficticio)", trackingCode: "GUÍA FICTICIA", reason: "Motivo de ejemplo para revisar la comunicación.", source: input.template === "ANULADO" ? "gestor" : "comprador", correction: String(input.template === "DOCUMENTOS_CORREGIDOS") } }, "#", logoCid);
    if (eventType === "DOCUMENTOS_VENTA") attachments = (mixed ? ["universidad", "instituto"] : [input.variant]).map((imprint) => samplePdf(`${input.billing}_${imprint}_EJEMPLO.pdf`));
  }
  const banner = '<p style="padding:12px;background:#fff4cc;color:#332900;font-family:Arial,sans-serif">PRUEBA · Información ficticia. Sin pedido real. Enlaces desactivados.</p>';
  // Keep CID for Gmail test sends; the preview action swaps only this known logo.
  const html = content.html.replace(/<body([^>]*)>/i, `<body$1>${banner}`).replace(/<a\b[^>]*>([\s\S]*?)<\/a>/gi, '<span style="display:inline-block;padding:8px;color:inherit">$1</span>');
  return { ...content, html, text: `PRUEBA · Información ficticia. Sin pedido real.\n${content.text}`, attachments };
}

export function mailSamplePreviewHtml(html: string) {
  return html.replaceAll(`cid:${logoCid}`, getMailLogoUrl());
}
