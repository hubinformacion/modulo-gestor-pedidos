import { emailHeading, emailShell, escapeHtml } from "@/integrations/email/template";
import { formatMoney, toCents } from "@/modules/orders/domain/money";
import { formatOrderNumber } from "@/modules/orders/domain/number";
import { imprintNames, type Imprint } from "@/modules/orders/domain/types";

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
  const fiscal = input.billingRuc
    ? [["RUC", input.billingRuc], ["Razón social", input.billingBusinessName ?? ""], ["Dirección fiscal", input.billingAddress ?? ""]]
    : [["Nombre", input.customerName], ["Documento", input.customerDocument]];
  const items = input.items.map(({ title, quantity, unitPrice, subtotal }) => `${quantity} × ${title} · ${money(unitPrice)} por unidad · ${money(subtotal)}`);
  const amounts = [["Subtotal neto", money(input.subtotal)]];
  if (toCents(input.shipping) > 0) amounts.push(["Flete", money(input.shipping)]);
  amounts.push(["Total del sello", money(input.total)]);
  const details = (rows: string[][]) => `<table width="100%" cellspacing="0" cellpadding="0" style="background:#faf8fd;border-radius:8px">${rows.map(([label, value]) => `<tr><th scope="row" align="left" style="padding:8px 12px;font-size:12px;font-weight:400">${escapeHtml(label)}</th><td style="padding:8px 12px;font-size:12px;font-weight:600">${escapeHtml(value)}</td></tr>`).join("")}</table>`;
  const html = emailShell(`${emailHeading(`Pedido ${number} · ${imprint}`, title, input.logoCid)}
<p style="font-size:13px;line-height:1.7">${escapeHtml(intro)}</p>
${details(fiscal)}
<h2 style="margin:18px 0 8px;font-size:13px">Publicaciones</h2>
<ul style="padding-left:18px;font-size:12px;line-height:1.7">${items.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>
${details(amounts)}
<p style="font-size:13px;line-height:1.7">${escapeHtml(reply)}</p>`);
  const text = [subject, intro, ...fiscal.map(([label, value]) => `${label}: ${value}`), "Publicaciones", ...items, ...amounts.map(([label, value]) => `${label}: ${value}`), reply].join("\n");
  return { subject, html, text };
}
