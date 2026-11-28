import { emailDetails, emailNote, emailShell, escapeHtml, type EmailDetail } from "@/integrations/email/template";
import { formatOrderNumber } from "@/modules/orders/domain/number";
import type { getTrackedOrder } from "@/modules/orders/data/tracking";
import { orderCodeDetail } from "./email-template";

type Tracked = NonNullable<Awaited<ReturnType<typeof getTrackedOrder>>>;
export type PickupMailOrder = Pick<Tracked["order"], "orderNumber" | "deliveryRecipient" | "deliveryRecipientDocument" | "customerDocument" | "deliveryRecipientPhone" | "customerPhone" | "deliveryAddress" | "deliveryLibraryLocation" | "deliveryPickupHours">;

export function buildPickupSupportContent(order: PickupMailOrder, items: {quantity: number; title: string}[], contactName: string, logoCid: string) {
  const details: EmailDetail[] = [
    ["Persona que recoge", order.deliveryRecipient],
    ["DNI / documento", order.deliveryRecipientDocument ?? order.customerDocument],
    ["Celular", order.deliveryRecipientPhone ?? order.customerPhone],
    ["Biblioteca", order.deliveryAddress],
    ["Ubicación", order.deliveryLibraryLocation ?? ""],
    ["Horario", order.deliveryPickupHours ?? ""],
    ["Estado actual", "Listo para recoger", "status"],
  ];
  const title = "Apoyo para entrega en biblioteca";
  const body = `Hola, ${contactName}. Las publicaciones de este pedido están listas para recoger. Agradecemos su apoyo para entregarlas a la persona indicada.`;
  const note = "Verifique el documento de identidad antes de entregar. Agradecemos que nos avise respondiendo a este correo una vez realizada la entrega.";
  const publications = items.map((item) => `<li style="margin:4px 0">${item.quantity} × ${escapeHtml(item.title)}</li>`).join("");
  const html = emailShell({
    title,
    logoCid,
    content: `<p style="margin:0 0 24px;color:#3f3f46">${escapeHtml(body)}</p>
    ${emailDetails([orderCodeDetail(order.orderNumber), ...details])}
    <h2 style="margin:0 0 8px;font-size:14px;font-weight:600">Publicaciones para entregar</h2>
    <ul style="margin:0 0 24px;padding-left:18px;font-size:13px">${publications}</ul>
    ${emailNote(note)}`,
  });
  const text = [title, `Pedido ${formatOrderNumber(order.orderNumber)}`, body,
    ...details.filter(([, value]) => value).map(([label, value]) => `${label}: ${value}`),
    ...items.map((item) => `${item.quantity} × ${item.title}`), note].join("\n");
  return { subject: `Pedido #${formatOrderNumber(order.orderNumber)} · Apoyo para recojo`, html, text };
}
