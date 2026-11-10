import { emailHeading, emailShell, escapeHtml } from "@/integrations/email/template";
import { formatOrderNumber } from "@/modules/orders/domain/number";
import type { getTrackedOrder } from "@/modules/orders/data/tracking";
type Tracked = NonNullable<Awaited<ReturnType<typeof getTrackedOrder>>>;
export type PickupMailOrder = Pick<Tracked["order"], "orderNumber" | "deliveryRecipient" | "deliveryRecipientDocument" | "customerDocument" | "deliveryRecipientPhone" | "customerPhone" | "deliveryAddress" | "deliveryLibraryLocation" | "deliveryPickupHours">;
export function buildPickupSupportContent(order: PickupMailOrder, items: {quantity: number; title: string}[], contactName: string, logoCid: string) {
    const details = [["Persona que recoge", order.deliveryRecipient], ["DNI / documento", order.deliveryRecipientDocument ?? order.customerDocument], ["Celular", order.deliveryRecipientPhone ?? order.customerPhone], ["Biblioteca", order.deliveryAddress], ["Ubicación", order.deliveryLibraryLocation ?? ""], ["Horario", order.deliveryPickupHours ?? ""]].filter(([, value]) => Boolean(value));
    const title = "Apoyo para entrega en biblioteca";
    const body = `Hola, ${contactName}. Las publicaciones de esta orden están listas para recoger. Agradecemos su apoyo para entregarlas a la persona indicada.`;
    const closing = "Muchas gracias por su apoyo con la entrega de nuestras publicaciones. Por favor, agradeceremos que nos avisen respondiendo a este correo una vez realizada la entrega de las publicaciones.";
    const rows = details.map(([label, value]) => `<tr><td style="padding:8px 12px;font-size:12px;color:#666674">${escapeHtml(label)}</td><td style="padding:8px 12px;font-size:12px;font-weight:600">${escapeHtml(value)}</td></tr>`).join("");
    const publications = items.map((item) => `<li style="margin:6px 0">${item.quantity} × ${escapeHtml(item.title)}</li>`).join("");
    const html = emailShell(`${emailHeading(`Orden ${formatOrderNumber(order.orderNumber)}`, title, logoCid)}<p style="font-size:13px;line-height:1.7">${escapeHtml(body)}</p><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f5effc;border-radius:8px">${rows}</table><h2 style="font-size:13px;margin:18px 0 8px">Publicaciones para entregar</h2><ul style="padding-left:18px;font-size:12px;line-height:1.6">${publications}</ul><p style="font-size:12px;line-height:1.7;color:#666674">Verifique el documento de identidad antes de entregar.</p><p style="font-size:13px;line-height:1.7">${escapeHtml(closing)}</p>`);
    const text = `${title}\nOrden ${formatOrderNumber(order.orderNumber)}\n${body}\n${details.map(([label, value]) => `${label}: ${value}`).join("\n")}\n${items.map((item) => `${item.quantity} × ${item.title}`).join("\n")}\nVerifique el documento de identidad antes de entregar.\n\n${closing}`;
    return { subject: `Pedido #${formatOrderNumber(order.orderNumber)} · Apoyo para recojo`, html, text };
}
