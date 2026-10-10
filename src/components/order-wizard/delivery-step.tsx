import { CampusLocation } from "./campus-location";
import { Field, RadioCard, SelectField, type FieldErrors } from "./fields";
import { departments, districtsFor, provincesFor } from "@/lib/orders/geography";
import { courierEstimate } from "@/lib/orders/courier";
import { resolveRecipient } from "@/lib/orders/recipient";
import type { BuyerDraft, Campus, DeliveryDraft } from "@/lib/orders/types";

export function DeliveryStep({ delivery, campuses, errors, onChange, buyer, onBuyerChange }: {
  delivery: DeliveryDraft; campuses: Campus[]; errors: FieldErrors;
  onChange: (value: DeliveryDraft) => void; buyer: BuyerDraft; onBuyerChange: (value: BuyerDraft) => void;
}) {
  const pickupCampuses = campuses.filter((campus) => campus.libraryAddress.trim());
  const campus = pickupCampuses.find((option) => option.id === delivery.campus);
  const recipient = resolveRecipient(delivery, buyer);
  function set<K extends keyof DeliveryDraft>(key: K, value: DeliveryDraft[K]) { onChange({ ...delivery, [key]: value }); }
  function changeType(type: DeliveryDraft["type"]) {
    if (type === "recojo_campus" && buyer.wantsInvoice) onBuyerChange({ ...buyer, billingAddressMode: "custom" });
    onChange({ ...delivery, type, campus: "", department: "", province: "", district: "", address: "", reference: "" });
  }
  return (
    <div className="space-y-7">
      <fieldset>
        <legend className="mb-3 text-xs font-medium">Modalidad de entrega</legend>
        <div className="grid gap-3 sm:grid-cols-2">
          <RadioCard name="delivery-type" value="delivery" checked={delivery.type === "delivery"} onChange={() => changeType("delivery")} title="Envío a domicilio" description="Recibe tu pedido en la dirección indicada." />
          <RadioCard name="delivery-type" value="recojo_campus" checked={delivery.type === "recojo_campus"} onChange={() => changeType("recojo_campus")} disabled={pickupCampuses.length === 0} title="Recojo en campus" description="Recoge en la biblioteca del campus elegido." />
        </div>
        {pickupCampuses.length === 0 ? <p className="mt-3 text-xs leading-5 text-muted-foreground">El recojo estará disponible cuando se habiliten las bibliotecas.</p> : null}
      </fieldset>
      {delivery.type === "recojo_campus" ? (
        <div>
          <SelectField id="delivery-campus" label="Campus de recojo" value={delivery.campus} onChange={(event) => set("campus", event.target.value)} error={errors.campus} required>
            <option value="">Selecciona un campus</option>
            {pickupCampuses.map((option) => <option key={option.id} value={option.id}>{option.name}</option>)}
          </SelectField>
          {campus ? <div className="mt-4"><CampusLocation campus={campus} /></div> : null}
        </div>
      ) : (
        <>
          <div className="grid gap-5 sm:grid-cols-2">
            <SelectField id="delivery-department" label="Departamento" value={delivery.department} onChange={(event) => onChange({ ...delivery, department: event.target.value, province: "", district: "" })} error={errors.department} required>
              <option value="">Selecciona el departamento</option>
              {departments.map((option) => <option key={option.id} value={option.id}>{option.name}</option>)}
            </SelectField>
            <SelectField id="delivery-province" label="Provincia" value={delivery.province} onChange={(event) => onChange({ ...delivery, province: event.target.value, district: "" })} disabled={!delivery.department} error={errors.province} required>
              <option value="">Selecciona la provincia</option>
              {provincesFor(delivery.department).map((option) => <option key={option.id} value={option.id}>{option.name}</option>)}
            </SelectField>
            <SelectField id="delivery-district" label="Distrito" value={delivery.district} onChange={(event) => set("district", event.target.value)} disabled={!delivery.province} error={errors.district} required>
              <option value="">Selecciona el distrito</option>
              {districtsFor(delivery.province).map((option) => <option key={option.id} value={option.id}>{option.name}</option>)}
            </SelectField>
          </div>
          <Field id="delivery-address" placeholder="Ej. Av. Los Cedros 123, departamento 402" label="Dirección completa" autoComplete="street-address" value={delivery.address} onChange={(event) => set("address", event.target.value)} error={errors.address} maxLength={300} hint="Calle, número y departamento, si corresponde." required />
          <Field id="delivery-reference" placeholder="Ej. Frente al parque, puerta azul" label="Referencia (opcional)" value={delivery.reference} onChange={(event) => set("reference", event.target.value)} error={errors.reference} maxLength={300} />
        </>
      )}
      {buyer.wantsInvoice ? <section className="rounded-xl border border-primary/15 bg-secondary/20 p-5"><h3 className="text-sm font-semibold">Dirección fiscal para la factura</h3>{delivery.type === "delivery" ? <div className="mt-3 grid gap-3 sm:grid-cols-2"><RadioCard name="billing-address-mode" value="shipping" checked={buyer.billingAddressMode === "shipping"} onChange={() => onBuyerChange({ ...buyer, billingAddressMode: "shipping" })} title="Usar dirección de envío" description={delivery.address || "La dirección que indiques para la entrega."} /><RadioCard name="billing-address-mode" value="custom" checked={buyer.billingAddressMode === "custom"} onChange={() => onBuyerChange({ ...buyer, billingAddressMode: "custom" })} title="Otra dirección fiscal" description="Indica la dirección para facturar." /></div> : null}{delivery.type === "recojo_campus" || buyer.billingAddressMode === "custom" ? <div className="mt-4"><Field id="billing-address" label="Dirección fiscal completa" placeholder="Ej. Av. San Carlos 123, Huancayo, Junín" value={buyer.billingAddress} onChange={(event) => onBuyerChange({ ...buyer, billingAddressMode: "custom", billingAddress: event.target.value })} error={errors.billingAddress} maxLength={500} required /></div> : null}</section> : null}
      {delivery.type === "delivery" ? <p className="rounded-lg bg-secondary/30 p-4 text-xs leading-6 text-muted-foreground">{courierEstimate(null)}</p> : null}
      <fieldset className="border-t border-border pt-6">
        <legend className="sr-only">Persona que {delivery.type === "recojo_campus" ? "recoge" : "recibe"}</legend>
        <p className="mb-3 text-xs font-medium">¿Quién {delivery.type === "recojo_campus" ? "recoge" : "recibe"} el pedido?</p>
        <div className="grid gap-3 sm:grid-cols-2">
          <RadioCard name="recipient-type" value="comprador" checked={delivery.recipientType === "comprador"} onChange={() => set("recipientType", "comprador")} title="Yo" description={buyer.name || "Usar mis datos de comprador."} />
          <RadioCard name="recipient-type" value="otra_persona" checked={delivery.recipientType === "otra_persona"} onChange={() => set("recipientType", "otra_persona")} title="Otra persona" description="Indica sus datos para la entrega." />
        </div>
        {delivery.recipientType === "otra_persona" ? <div className="mt-5 grid gap-5 sm:grid-cols-2">
          <div className="sm:col-span-2"><Field id="delivery-recipient" placeholder="Ej. Ana Torres López" label="Nombres y apellidos" autoComplete="section-recipient name" value={delivery.recipient} onChange={(event) => set("recipient", event.target.value)} error={errors.recipient} maxLength={160} required /></div>
          <Field id="delivery-recipient-document" placeholder="Ej. 12345678" label="DNI" inputMode="numeric" value={delivery.recipientDocument} onChange={(event) => set("recipientDocument", event.target.value)} error={errors.recipientDocument} maxLength={8} required />
          <Field id="delivery-recipient-phone" placeholder="Ej. 987654321" label="Teléfono" type="tel" autoComplete="section-recipient tel" value={delivery.recipientPhone} onChange={(event) => set("recipientPhone", event.target.value)} error={errors.recipientPhone} maxLength={24} required />
        </div> : <p className="mt-4 text-xs leading-6 text-muted-foreground">Documento: {recipient.document} · Teléfono: {recipient.phone}</p>}
      </fieldset>
    </div>
  );
}
