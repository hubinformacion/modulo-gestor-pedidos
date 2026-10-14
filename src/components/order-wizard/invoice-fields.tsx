import { ReceiptText } from "lucide-react";
import type { BuyerDraft, DeliveryDraft } from "@/lib/orders/types";
import { resolveLocation } from "@/lib/orders/geography";
import { Field, RadioCard, type FieldErrors } from "./fields";

export function InvoiceFields({ buyer, delivery, errors, onChange }: { buyer: BuyerDraft; delivery: DeliveryDraft; errors: FieldErrors; onChange: (buyer: BuyerDraft) => void }) {
  const location = resolveLocation(delivery.district);
  const shippingAddress = [delivery.address, location?.district.name, location?.province.name, location?.department.name].filter(Boolean).join(", ");
  function set<K extends keyof BuyerDraft>(key: K, value: BuyerDraft[K]) { onChange({ ...buyer, [key]: value }); }
  return <section className="rounded-xl border border-border bg-white p-5" aria-labelledby="invoice-title">
    <h3 id="invoice-title" className="flex items-center gap-2 text-sm font-semibold"><ReceiptText className="size-4 text-primary" aria-hidden="true" />Comprobante de compra</h3>
    <p className="mt-2 text-xs leading-6 text-muted-foreground">Elige el documento que necesitas recibir.</p>
    <fieldset className="mt-4"><legend className="sr-only">Tipo de comprobante</legend><div className="grid gap-3 sm:grid-cols-2">
      <RadioCard name="invoice-type" value="boleta" checked={!buyer.wantsInvoice} onChange={() => set("wantsInvoice", false)} title="Boleta" description="Con tus datos de comprador." />
      <RadioCard name="invoice-type" value="factura" checked={buyer.wantsInvoice} onChange={() => onChange({ ...buyer, wantsInvoice: true, billingAddressMode: delivery.type === "delivery" ? buyer.billingAddressMode : "custom" })} title="Factura" description="Con RUC, razón social y dirección fiscal." />
    </div></fieldset>
    {buyer.wantsInvoice ? <div className="mt-5 space-y-5 border-t border-border pt-5">
      <div className="grid gap-4 sm:grid-cols-2"><Field id="billing-ruc" label="RUC" placeholder="Ej. 20123456789" inputMode="numeric" value={buyer.billingRuc} onChange={(event) => set("billingRuc", event.target.value)} error={errors.billingRuc} maxLength={11} required /><Field id="billing-business" label="Razón social" placeholder="Nombre legal de la empresa" value={buyer.billingBusinessName} onChange={(event) => set("billingBusinessName", event.target.value)} error={errors.billingBusinessName} maxLength={200} required /></div>
      {delivery.type === "delivery" ? <fieldset><legend className="mb-3 text-xs font-medium">Dirección fiscal</legend><div className="grid gap-3 sm:grid-cols-2"><RadioCard name="billing-address-mode" value="shipping" checked={buyer.billingAddressMode === "shipping"} onChange={() => set("billingAddressMode", "shipping")} title="Usar dirección de envío" description={shippingAddress} /><RadioCard name="billing-address-mode" value="custom" checked={buyer.billingAddressMode === "custom"} onChange={() => set("billingAddressMode", "custom")} title="Otra dirección" description="Indica la dirección para facturar." /></div></fieldset> : null}
      {delivery.type === "recojo_campus" || buyer.billingAddressMode === "custom" ? <Field id="billing-address" label="Dirección fiscal completa" placeholder="Calle, número, distrito, provincia y departamento" value={buyer.billingAddress} onChange={(event) => onChange({ ...buyer, billingAddressMode: "custom", billingAddress: event.target.value })} error={errors.billingAddress} maxLength={500} hint={delivery.type === "recojo_campus" ? "El recojo en biblioteca también requiere una dirección fiscal para emitir factura." : undefined} required /> : null}
    </div> : null}
  </section>;
}
