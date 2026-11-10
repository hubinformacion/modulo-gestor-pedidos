import { emailAction, emailHeading, emailShell, escapeHtml } from "@/integrations/email/template";
import { imprintNames } from "@/modules/orders/domain/types";

export type CajaNotice = {
  orderNumber: string;
  requestNumber: string;
  imprint: "universidad" | "instituto";
  invoice: boolean;
  assignedName: string | null;
  customerName: string;
  customerDocument: string;
  customerPhone: string;
  billingRuc: string | null;
  billingBusinessName: string | null;
  billingAddress: string | null;
  amount: string;
  eventType: "SOLICITUD" | "FINALIZADA" | "DEVUELTA" | "ANULADA";
  reason?: string | null;
  link: string;
  logoCid: string;
};

export function renderCajaNotice(notice: CajaNotice) {
  const title = notice.eventType === "ANULADA" ? "Solicitud anulada" : notice.eventType === "SOLICITUD" ? `Emisión de ${notice.invoice ? "factura" : "boleta"}` : notice.eventType === "DEVUELTA" ? "Corrección solicitada" : "Documento de venta finalizado";
  const body = notice.eventType === "ANULADA" ? `El pedido fue anulado. No continúes la emisión. Motivo: ${notice.reason ?? "Pedido cancelado."} Los documentos ya emitidos se revisan por separado con Fondo Editorial.` : notice.eventType === "SOLICITUD" ? "Fondo Editorial verificó el pago. Revisa los datos y comprobantes de la solicitud, adjunta el PDF y finaliza la emisión." : notice.eventType === "DEVUELTA" ? `Fondo Editorial solicita corregir el documento: ${notice.reason ?? "Revisa los datos."}` : "El PDF está disponible en el detalle. El comprador lo recibirá cuando estén finalizados todos los documentos requeridos.";
  const details = [["Unidad de negocio", imprintNames[notice.imprint]], ["Responsable de Tesorería Recaudación", notice.assignedName ?? "Por asignar"], ["Comprador", notice.customerName], ["Celular", notice.customerPhone], ...(notice.invoice ? [["Dirección fiscal", notice.billingAddress ?? ""]] : []), [notice.invoice ? "RUC" : "Documento", notice.billingRuc ?? notice.customerDocument], ...(notice.billingBusinessName ? [["Razón social", notice.billingBusinessName]] : []), ["Importe", notice.amount]];
  const subject = `Pedido #${notice.orderNumber} · ${title} · ${imprintNames[notice.imprint]}`;
  const html = emailShell(`${emailHeading(`Tesorería Recaudación · Solicitud ${notice.requestNumber}`, title, notice.logoCid)}<p style="font-size:13px;line-height:1.7">${escapeHtml(body)}</p><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#faf8fd;border-radius:8px">${details.map(([label, value]) => `<tr><td style="padding:8px 12px;font-size:12px;color:#666674">${escapeHtml(label)}</td><td style="padding:8px 12px;font-size:12px;font-weight:600;text-align:right">${escapeHtml(value)}</td></tr>`).join("")}</table>${emailAction(notice.link, notice.eventType === "FINALIZADA" ? "Revisar documento" : "Abrir solicitud")}<p style="font-size:11px;color:#666674;line-height:1.8">Comunicación interna de Tesorería Recaudación y atención editorial. Este aviso no se envía al comprador.</p>`);
  const text = `${title}\n${body}\n${details.map(([label, value]) => `${label}: ${value}`).join("\n")}\nTesorería Recaudación: ${notice.link}`;
  return { subject, title, html, text };
}
