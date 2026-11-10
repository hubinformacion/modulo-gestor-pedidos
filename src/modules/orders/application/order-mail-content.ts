import { pickupEntryInstructions } from "@/modules/orders/domain/pickup";
import { courierEstimate } from "@/modules/orders/domain/courier";
import { formatOrderNumber } from "@/modules/orders/domain/number";
import { imprintNames } from "@/modules/orders/domain/types";
import { formatMoney, toCents } from "@/modules/orders/domain/money";
import { emailAction, emailHeading, emailShell, escapeHtml } from "@/integrations/email/template";
import { emailSubject, renderOrderEmail, renderOrderUpdate, type EmailOrder } from "./email-template";

export function buildOrderConfirmationContent(tracking: EmailOrder, link: string, logoCid: string) {
  const intro = tracking.order.orderType === "mixto" ? "Hemos recibido tu pedido con publicaciones de ambos sellos. Realiza los dos depósitos según la guía adjunta." : `Hemos recibido tu pedido. Realiza el depósito de ${tracking.order.orderType === "solo_instituto" ? "Instituto" : "Universidad"} Continental según la guía adjunta.`;
  const amounts = (["universidad", "instituto"] as const)
    .filter((imprint) => (imprint === "universidad" ? tracking.order.paymentStatusUniversidad : tracking.order.paymentStatusInstituto) !== "NO_APLICA")
    .map((imprint) => `${imprintNames[imprint]}: ${formatMoney(toCents(imprint === "universidad" ? tracking.order.totalUniversidad : tracking.order.totalInstituto))}`).join("\n");
  return { subject: emailSubject(tracking.order.orderNumber), html: renderOrderEmail(tracking, { intro, link, logoCid }), text: `Pedido ${formatOrderNumber(tracking.order.orderNumber)}\n${intro}\n${amounts}\n${tracking.order.orderType === "mixto" ? "Realiza dos depósitos independientes.\n" : ""}Seguimiento y pago: ${link}\nGuía de pago adjunta en PDF.` };
}

export type OrderNotice = { id: string; eventType: string; publisherImprint: "universidad" | "instituto" | null; payload: Record<string, string>; createdAt: Date };
export function buildOrderUpdateContent(tracking: EmailOrder, notification: OrderNotice, link: string, logoCid: string) {
  const imprint = notification.publisherImprint ? imprintNames[notification.publisherImprint] : "";
  const payload = notification.payload;
  const grouped = payload.scope === "pedido";
  const notices: Record<string, { title: string; body: string }> = {
    PAGO_VERIFICADO: { title: grouped ? "Pagos confirmados" : "Pago confirmado", body: payload.orderStatus === "EN_PREPARACION" ? "Todos los pagos están verificados. Tus publicaciones pasan a distribución." : "Este pago está verificado. Continuaremos con la distribución cuando se verifique el otro sello." },
    PAGO_RECHAZADO: { title: "Necesitamos otro comprobante", body: `${imprint ? `Revisa el comprobante de ${imprint}. ` : ""}${payload.reason || "Adjunta un archivo nuevo desde tu seguimiento."}` },
    DESPACHADO: { title: payload.deliveryType === "recojo_campus" ? "Tu pedido está listo para recoger" : "Tu pedido está en camino", body: payload.deliveryType === "recojo_campus" ? "Tus publicaciones están listas para recoger en la biblioteca. Lleva tu documento de identidad." : `Enviamos tus publicaciones por ${payload.courier || tracking.order.courier || "el transporte indicado"}.${payload.trackingCode ? ` Número de guía: ${payload.trackingCode}.` : ""} ${courierEstimate(payload.deliveryZone || tracking.order.deliveryZone)}` },
    DOCUMENTOS_VENTA: { title: payload.correction === "true" ? "Documentos de venta actualizados" : "Tus documentos de venta", body: `${payload.correction === "true" ? "Adjuntamos las versiones corregidas" : "Adjuntamos la boleta o factura"}${tracking.order.orderType === "mixto" ? " de ambos sellos editoriales" : " de tu pedido"}. Conserva los PDF adjuntos para tu registro.` },
    CANCELADO: { title: payload.source === "gestor" ? "Pedido anulado por Fondo Editorial" : "Pedido cancelado", body: `El pedido está cerrado. No realices nuevos depósitos.${payload.reason ? ` Motivo: ${payload.reason}` : ""} Si realizaste un depósito, contacta al Fondo Editorial para coordinar su devolución.` },
    ENTREGADO: { title: "Pedido entregado", body: "Registramos la entrega de tus publicaciones. Gracias por tu pedido." },
  };
  const notice = notices[notification.eventType];
  if (!notice) throw new Error("INVALID_NOTIFICATION_EVENT");
  const deliveryLocation = notification.eventType === "DESPACHADO" ? { address: payload.address || tracking.order.deliveryAddress, libraryLocation: payload.libraryLocation ?? tracking.order.deliveryLibraryLocation ?? "", pickupHours: payload.pickupHours ?? tracking.order.deliveryPickupHours ?? "", pickupContactName: payload.pickupContactName ?? tracking.order.pickupContactName ?? "", pickup: tracking.order.deliveryType === "recojo_campus", mapUrl: payload.mapUrl || tracking.order.deliveryMapUrl } : undefined;
  return { subject: `Pedido #${formatOrderNumber(tracking.order.orderNumber)} · ${notice.title}`, html: renderOrderUpdate(tracking, { ...notice, link, trackingUrl: payload.trackingUrl, createdAt: notification.createdAt, logoCid, deliveryLocation }), text: `Pedido ${formatOrderNumber(tracking.order.orderNumber)}\n${notice.title}\n${notice.body}\n${payload.trackingUrl || ""}\n${deliveryLocation ? [deliveryLocation.address, deliveryLocation.libraryLocation, deliveryLocation.pickupHours, deliveryLocation.pickupContactName ? `Pregunta por ${deliveryLocation.pickupContactName}.` : "", deliveryLocation.pickup ? pickupEntryInstructions : "", deliveryLocation.mapUrl].filter(Boolean).join("\n") : ""}\nSeguimiento: ${link}` };
}

export function buildReceiptReviewContent(orderNumber: string, grouped: boolean, link: string, logoCid: string) {
  const title = "Comprobantes pendientes de validación";
  const body = grouped ? "Se recibieron los comprobantes de ambos sellos. Revisa los archivos y valida los pagos desde el pedido." : "Se recibió un comprobante de pago. Revisa el archivo y valida el pago desde el pedido.";
  return { subject: `Pedido #${formatOrderNumber(orderNumber)} · Comprobantes por validar`, html: emailShell(`${emailHeading(`Pedido ${formatOrderNumber(orderNumber)}`, title, logoCid)}<p style="font-size:13px;line-height:1.7">${escapeHtml(body)}</p>${emailAction(link, "Revisar pedido")}<p style="font-size:11px;color:#666674">Aviso interno para el equipo del Fondo Editorial. El comprador conserva el acuse en su seguimiento.</p>`), text: `${title}\n${body}\nRevisar pedido: ${link}` };
}
