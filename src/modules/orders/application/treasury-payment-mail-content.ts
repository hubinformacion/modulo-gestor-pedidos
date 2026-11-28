import { emailDetails, emailNote, emailShell, escapeHtml, type EmailDetail } from "@/integrations/email/template";
import { formatMoney, toCents } from "@/modules/orders/domain/money";
import { formatOrderNumber } from "@/modules/orders/domain/number";
import { imprintNames, type Imprint } from "@/modules/orders/domain/types";
import { orderCodeDetail } from "./email-template";

type TreasuryPaymentMail = {
  orderNumber: string;
  imprint: Imprint;
  customerName: string;
  customerDocument: string;
  billingRuc: string | null;
  billingBusinessName: string | null;
  billingAddress: string | null;
  items: { title: string; quantity: number; unitPrice: string; subtotal: string }[];
  subtotal: string;
  shipping: string;
  total: string;
  logoCid: string;
};

export function buildTreasuryPaymentMail(input: TreasuryPaymentMail) {
  const number = formatOrderNumber(input.orderNumber);
  const imprint = imprintNames[input.imprint];
  const type = input.billingRuc ? "factura" : "boleta";
  const title = `Emisión de ${type}`;
  const subject = `Pedido #${number} · ${imprint} · ${title}`;
  const intro = `Fondo Editorial verificó el pago de ${imprint}. Adjuntamos el voucher revisado para la emisión de la ${type}.`;
  const reply = "Responde a este correo con el PDF y el XML originales o con las observaciones de la emisión.";
  const money = (amount: string) => formatMoney(toCents(amount));
  const fiscal: EmailDetail[] = input.billingRuc
    ? [["RUC", input.billingRuc], ["Razón social", input.billingBusinessName ?? ""], ["Dirección fiscal", input.billingAddress ?? ""]]
    : [["Nombre", input.customerName], ["Documento", input.customerDocument]];
  const items = input.items.map(({ title, quantity, unitPrice, subtotal }) => `${quantity} × ${title} · ${money(unitPrice)} por unidad · ${money(subtotal)}`);
  const amounts: EmailDetail[] = [["Subtotal neto", money(input.subtotal)]];
  if (toCents(input.shipping) > 0) amounts.push(["Flete", money(input.shipping)]);
  amounts.push(["Total del sello", money(input.total), "strong"]);
  const html = emailShell({
    title,
    logoCid: input.logoCid,
    content: `<p style="margin:0 0 24px;color:#3f3f46">${escapeHtml(intro)}</p>
    ${emailDetails([
      orderCodeDetail(input.orderNumber), ["Sello editorial", imprint], ["Estado actual", "Pendiente de emisión", "status"], ...fiscal,
    ])}
    <h2 style="margin:0 0 8px;font-size:14px;font-weight:600">Publicaciones</h2>
    <ul style="margin:0 0 24px;padding-left:18px;font-size:13px">${items.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>
    ${emailDetails(amounts)}
    ${emailNote(reply)}`,
  });
  const text = [subject, intro, ...fiscal.map(([label, value]) => `${label}: ${value}`), "Publicaciones", ...items, ...amounts.map(([label, value]) => `${label}: ${value}`), reply].join("\n");
  return { subject, html, text };
}
