import { emailAction, emailDetails, emailNote, emailShell, escapeHtml, type EmailDetail } from "@/integrations/email/template";
import type { getTrackedOrder } from "@/modules/orders/data/tracking";
import { formatMoney, toCents } from "@/modules/orders/domain/money";
import { formatOrderNumber } from "@/modules/orders/domain/number";
import { imprintNames } from "@/modules/orders/domain/types";

type Tracked = NonNullable<Awaited<ReturnType<typeof getTrackedOrder>>>;
export type EmailOrder = { order: Pick<Tracked["order"], "orderNumber" | "createdAt" | "customerName" | "orderType" | "paymentStatusUniversidad" | "paymentStatusInstituto" | "totalUniversidad" | "totalInstituto" | "shippingCost" | "deliveryType" | "courier" | "deliveryZone" | "deliveryAddress" | "deliveryLibraryLocation" | "deliveryPickupHours" | "pickupContactName" | "deliveryMapUrl"> };
export const emailSubject = (number: string) => `Pedido #${formatOrderNumber(number)} · Pedido registrado`;
const dateFormat = new Intl.DateTimeFormat("es-PE", { dateStyle: "long", timeZone: "America/Lima" });

export function formatEmailDate(date: Date) {
  return dateFormat.format(date);
}

export function orderCodeDetail(orderNumber: string): EmailDetail {
  return ["Código de pedido", formatOrderNumber(orderNumber), "code"];
}

export function renderOrderEmail(tracking: EmailOrder, { intro, link, logoCid }: { intro: string; link: string; logoCid: string }) {
  const { order } = tracking;
  const applicable = (["universidad", "instituto"] as const).filter((imprint) => (imprint === "universidad" ? order.paymentStatusUniversidad : order.paymentStatusInstituto) !== "NO_APLICA");
  const amount = (imprint: (typeof applicable)[number]) => toCents(imprint === "universidad" ? order.totalUniversidad : order.totalInstituto);
  const mixed = order.orderType === "mixto";
  const amounts = applicable.map((imprint): EmailDetail => [imprintNames[imprint], formatMoney(amount(imprint)), "strong"]);
  const totals: EmailDetail[] = [
    ["Monto total", formatMoney(applicable.reduce((sum, imprint) => sum + amount(imprint), 0)), "strong"],
    ...(mixed ? amounts : []),
  ];
  const shipping = toCents(order.shippingCost);
  const depositNote = mixed ? ` Realiza dos depósitos independientes, uno por cada sello.${shipping > 0 ? ` El flete de ${formatMoney(shipping)} está incluido en Universidad Continental.` : ""}` : "";
  return emailShell({
    title: "Tu pedido ha sido registrado",
    logoCid,
    content: `<p style="margin:0 0 24px;color:#3f3f46">Hola, <strong>${escapeHtml(order.customerName)}</strong>. ${escapeHtml(intro)}</p>
    ${emailDetails([orderCodeDetail(order.orderNumber), ["Fecha de emisión", formatEmailDate(order.createdAt)], ...totals, ["Estado actual", "Pendiente de pago", "status"]])}
    ${emailAction(link, "Ver pedido y adjuntar comprobante")}
    ${emailNote(`La guía de pago está adjunta en PDF.${depositNote} En el seguimiento puedes consultar las cuentas y adjuntar tus comprobantes.`)}`,
  });
}
