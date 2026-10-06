export type ProgressOrder = { orderStatus: string; deliveryType: string; paymentStatusUniversidad: string; paymentStatusInstituto: string };
export function orderProgress(order: ProgressOrder) {
  if (order.orderStatus === "CANCELADO") return { index: -1, title: "Pedido cancelado", description: "Este pedido está cerrado. Contacta al equipo si necesitas ayuda." };
  if (order.orderStatus === "ENTREGADO") return { index: 4, title: "Publicaciones entregadas", description: "Tu pedido fue entregado. Gracias por tu compra." };
  if (order.orderStatus === "DESPACHADO") return order.deliveryType === "recojo_campus" ? { index: 3, title: "Listo para recoger", description: "Tus publicaciones te esperan en la biblioteca. Lleva tu documento para recogerlas." } : { index: 3, title: "Tu pedido está en camino", description: "Consulta el courier y la guía de envío para seguir su recorrido." };
  if (order.orderStatus === "EN_PREPARACION") return { index: 2, title: "Estamos preparando tu pedido", description: "Los pagos ya están verificados. Te avisaremos cuando salga o esté listo para recoger." };
  if ([order.paymentStatusUniversidad, order.paymentStatusInstituto].includes("RECHAZADO")) return { index: 1, title: "Necesitamos revisar un comprobante", description: "Revisa el motivo indicado y adjunta otro archivo únicamente para ese sello." };
  if ([order.paymentStatusUniversidad, order.paymentStatusInstituto].includes("EN_REVISION")) return { index: 1, title: "Estamos revisando tus comprobantes", description: "Ya están adjuntos al pedido. Un gestor verificará el pago y te avisará por correo." };
  return { index: 1, title: "Completa el pago de tu pedido", description: "Realiza el depósito en la cuenta del sello correspondiente y adjunta tu comprobante." };
}
