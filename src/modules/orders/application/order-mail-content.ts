import { pickupEntryInstructions } from "@/modules/orders/domain/pickup";
import { courierEstimate } from "@/modules/orders/domain/courier";
import { formatOrderNumber } from "@/modules/orders/domain/number";
import { imprintNames } from "@/modules/orders/domain/types";
import { formatMoney, toCents } from "@/modules/orders/domain/money";
import { emailAction, emailDetails, emailNote, emailShell, escapeHtml, type EmailDetail } from "@/integrations/email/template";
import { emailSubject, formatEmailDate, orderCodeDetail, renderOrderEmail, type EmailOrder } from "./email-template";

export function buildOrderConfirmationContent(tracking: EmailOrder, link: string, logoCid: string) {
  const intro = tracking.order.orderType === "mixto" ? "Hemos recibido tu pedido con publicaciones de ambos sellos. Realiza los dos depósitos según la guía adjunta." : `Hemos recibido tu pedido. Realiza el depósito de ${tracking.order.orderType === "solo_instituto" ? "Instituto" : "Universidad"} Continental según la guía adjunta.`;
  const amounts = (["universidad", "instituto"] as const)
    .filter((imprint) => (imprint === "universidad" ? tracking.order.paymentStatusUniversidad : tracking.order.paymentStatusInstituto) !== "NO_APLICA")
    .map((imprint) => `${imprintNames[imprint]}: ${formatMoney(toCents(imprint === "universidad" ? tracking.order.totalUniversidad : tracking.order.totalInstituto))}`).join("\n");
  return { subject: emailSubject(tracking.order.orderNumber), html: renderOrderEmail(tracking, { intro, link, logoCid }), text: `Pedido ${formatOrderNumber(tracking.order.orderNumber)}\n${intro}\n${amounts}\n${tracking.order.orderType === "mixto" ? "Realiza dos depósitos independientes.\n" : ""}Seguimiento y pago: ${link}\nGuía de pago adjunta en PDF.` };
}

export type OrderNotice = { id: string; eventType: string; publisherImprint: "universidad" | "instituto" | null; payload: Record<string, string>; createdAt: Date };

type NoticeContent = {
  title: string;
  body: string;
  status: string;
  action?: string;
  note?: string;
  details?: EmailDetail[];
};

export function buildOrderUpdateContent({ order }: EmailOrder, notification: OrderNotice, link: string, logoCid: string) {
  const { publisherImprint, payload, eventType } = notification;
  const date = formatEmailDate(notification.createdAt);
  const imprint = publisherImprint ? imprintNames[publisherImprint] : "";
  const grouped = payload.scope === "pedido";
  const pickup = (payload.deliveryType || order.deliveryType) === "recojo_campus";
  const courier = payload.courier || order.courier || "";
  const complete = payload.orderStatus === "EN_PREPARACION";
  const correction = payload.correction === "true";
  const validatedAmount = eventType === "PAGO_VERIFICADO" ? formatMoney(grouped || !publisherImprint
    ? toCents(order.totalUniversidad) + toCents(order.totalInstituto)
    : toCents(publisherImprint === "universidad" ? order.totalUniversidad : order.totalInstituto)) : "";
  const notices: Record<string, NoticeContent> = {
    PAGO_VERIFICADO: {
      title: grouped ? "Pagos confirmados" : "Pago confirmado",
      body: complete ? "Hemos confirmado el pago de tu pedido. Tus publicaciones pasan a distribución." : "Este pago está confirmado. Continuaremos con la distribución cuando se verifique el otro sello.",
      details: [["Monto validado", validatedAmount, "strong"], ["Fecha de validación", date]],
      status: complete ? "En distribución" : "Pendiente de pago del otro sello",
      note: complete ? "Te avisaremos por correo cuando tus publicaciones se despachen o estén listas para recoger." : undefined,
    },
    PAGO_RECHAZADO: {
      title: "Necesitamos otro comprobante",
      body: imprint ? `Revisa el comprobante de ${imprint} y adjunta un archivo nuevo desde el seguimiento.` : "Revisa el comprobante y adjunta un archivo nuevo desde el seguimiento.",
      details: [["Motivo", payload.reason ?? ""], ["Fecha de revisión", date]],
      status: "Comprobante observado",
      action: "Adjuntar otro comprobante",
    },
    DESPACHADO: {
      title: pickup ? "Tu pedido está listo para recoger" : "Tu pedido está en camino",
      body: pickup ? "Tus publicaciones están listas para recoger en la biblioteca. Lleva tu documento de identidad." : "Hemos entregado tus publicaciones al operador logístico.",
      details: [
        ["Modalidad", pickup ? "Recojo en biblioteca" : "Envío a domicilio"],
        [pickup ? "Biblioteca" : "Dirección de entrega", payload.address || order.deliveryAddress],
        ...(pickup ? [
          ["Ubicación", payload.libraryLocation ?? order.deliveryLibraryLocation ?? ""],
          ["Horario", payload.pickupHours ?? order.deliveryPickupHours ?? ""],
          ["Pregunta por", payload.pickupContactName ?? order.pickupContactName ?? ""],
        ] satisfies EmailDetail[] : [
          ["Operador", courier],
          ["Código de rastreo", payload.trackingCode ?? "", "code"],
        ] satisfies EmailDetail[]),
      ],
      status: pickup ? "Listo para recoger" : "Despachado",
      action: pickup ? "Ver detalles del recojo" : "Ver seguimiento del envío",
      note: pickup ? pickupEntryInstructions : courierEstimate(payload.deliveryZone || order.deliveryZone),
    },
    DOCUMENTOS_VENTA: {
      title: correction ? "Documentos de venta actualizados" : "Tus documentos de venta",
      body: `${correction ? "Adjuntamos las versiones corregidas" : "Adjuntamos la boleta o factura"}${order.orderType === "mixto" ? " de ambos sellos editoriales" : " de tu pedido"}.`,
      details: [["Fecha del aviso", date]],
      status: correction ? "Documentos actualizados" : "Documentos emitidos",
      note: "Conserva los documentos adjuntos para tu registro.",
    },
    CANCELADO: {
      title: payload.source === "gestor" ? "Pedido anulado por Fondo Editorial" : "Pedido cancelado",
      body: "El pedido está cerrado. No realices nuevos depósitos.",
      details: [["Fecha de cierre", date], ["Motivo", payload.reason ?? ""]],
      status: payload.source === "gestor" ? "Anulado" : "Cancelado",
      note: "Si realizaste un depósito, contacta al Fondo Editorial para coordinar su devolución.",
    },
    ENTREGADO: {
      title: "Pedido entregado",
      body: "Registramos la entrega de tus publicaciones. Gracias por tu pedido.",
      details: [["Fecha de entrega", date]],
      status: "Entregado",
      action: "Ver resumen del pedido",
      note: "En el seguimiento puedes consultar el historial y descargar tus documentos de venta cuando estén disponibles.",
    },
  };
  const notice = notices[eventType];
  if (!notice) throw new Error("INVALID_NOTIFICATION_EVENT");
  const details: EmailDetail[] = [orderCodeDetail(order.orderNumber), ...(notice.details ?? []), ["Estado actual", notice.status, "status"]];
  const mapUrl = eventType === "DESPACHADO" ? payload.mapUrl || order.deliveryMapUrl : "";
  const references = [[payload.trackingUrl, "Consultar con el courier"], [mapUrl, "Ver ubicación en Google Maps"]]
    .filter(([url]) => /^https:\/\//.test(url ?? ""));
  const body = `<p style="margin:0 0 24px;color:#3f3f46">Hola, <strong>${escapeHtml(order.customerName)}</strong>. ${escapeHtml(notice.body)}</p>`;
  const referenceLinks = references.map(([url, label]) => `<p style="margin:0 0 12px"><a href="${escapeHtml(url)}" style="color:#6802c1;font-size:13px;font-weight:600">${escapeHtml(label)} ↗</a></p>`).join("");
  const action = notice.action ?? "Ver seguimiento";
  const html = emailShell({
    title: notice.title,
    logoCid,
    content: `${body}${emailDetails(details)}${emailAction(link, action)}${referenceLinks}${notice.note ? emailNote(notice.note) : ""}`,
  });
  const text = [`Pedido ${formatOrderNumber(order.orderNumber)}`, notice.title, notice.body,
    ...details.slice(1).filter(([, value]) => value).map(([label, value]) => `${label}: ${value}`),
    ...references.map(([url, label]) => `${label}: ${url}`), notice.note, `${action}: ${link}`].filter(Boolean).join("\n");
  return { subject: `Pedido #${formatOrderNumber(order.orderNumber)} · ${notice.title}`, html, text };
}

export function buildReceiptReviewContent(orderNumber: string, grouped: boolean, link: string, logoCid: string, registeredAt: Date) {
  const title = "Comprobantes pendientes de validación";
  const body = grouped ? "Se recibieron los comprobantes de ambos sellos. Revisa los archivos y valida los pagos desde el pedido." : "Se recibió un comprobante de pago. Revisa el archivo y valida el pago desde el pedido.";
  const date = formatEmailDate(registeredAt);
  const note = "El comprador conserva el acuse en su seguimiento.";
  const html = emailShell({
    title,
    logoCid,
    content: `<p style="margin:0 0 24px;color:#3f3f46">${escapeHtml(body)}</p>
    ${emailDetails([orderCodeDetail(orderNumber), ["Fecha de registro", date], ["Estado actual", "Pendiente de revisión", "status"]])}
    ${emailAction(link, "Revisar pedido")}
    ${emailNote(note)}`,
  });
  return { subject: `Pedido #${formatOrderNumber(orderNumber)} · Comprobantes por validar`, html, text: `${title}\nPedido ${formatOrderNumber(orderNumber)}\n${body}\nFecha de registro: ${date}\nRevisar pedido: ${link}\n${note}` };
}
