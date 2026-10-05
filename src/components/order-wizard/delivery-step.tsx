import { CampusLocation } from "./campus-location";
import { Field, RadioCard, SelectField, type FieldErrors } from "./fields";
import type { Campus, DeliveryDraft } from "@/lib/orders/types";

export function DeliveryStep({ delivery, campuses, errors, onChange, buyerName }: {
  delivery: DeliveryDraft; campuses: Campus[]; errors: FieldErrors;
  onChange: (value: DeliveryDraft) => void; buyerName: string;
}) {
  const pickupCampuses = campuses.filter((campus) => campus.libraryAddress.trim());
  const campus = pickupCampuses.find((option) => option.id === delivery.campus);
  function set<K extends keyof DeliveryDraft>(key: K, value: DeliveryDraft[K]) { onChange({ ...delivery, [key]: value }); }
  return (
    <div className="space-y-7">
      <fieldset>
        <legend className="mb-3 text-xs font-medium">Modalidad de entrega</legend>
        <div className="grid gap-3 sm:grid-cols-2">
          <RadioCard name="delivery-type" value="delivery" checked={delivery.type === "delivery"} onChange={() => set("type", "delivery")} title="Envío a domicilio" description="Lima/Callao S/15 · Provincia S/25" />
          <RadioCard name="delivery-type" value="recojo_campus" checked={delivery.type === "recojo_campus"} onChange={() => set("type", "recojo_campus")} disabled={pickupCampuses.length === 0} title="Recojo en campus" description="Recoge en biblioteca. Sin costo." />
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
          <SelectField id="delivery-zone" label="Zona de entrega" value={delivery.zone} onChange={(event) => set("zone", event.target.value as DeliveryDraft["zone"])} error={errors.zone} required>
            <option value="">Selecciona la zona</option>
            <option value="lima_callao">Lima / Callao — S/15</option>
            <option value="provincia">Provincia — S/25</option>
          </SelectField>
          {delivery.zone === "provincia" ? <div className="grid gap-5 sm:grid-cols-2">
            <Field id="delivery-department" label="Departamento" autoComplete="address-level1" value={delivery.department} onChange={(event) => set("department", event.target.value)} error={errors.department} maxLength={100} required />
            <Field id="delivery-city" label="Ciudad" autoComplete="address-level2" value={delivery.city} onChange={(event) => set("city", event.target.value)} error={errors.city} maxLength={100} required />
          </div> : null}
          <Field id="delivery-address" label="Dirección completa" autoComplete="street-address" value={delivery.address} onChange={(event) => set("address", event.target.value)} error={errors.address} maxLength={300} hint="Calle, número y departamento, si corresponde." required />
          <Field id="delivery-reference" label="Referencia (opcional)" value={delivery.reference} onChange={(event) => set("reference", event.target.value)} error={errors.reference} maxLength={300} />
        </>
      )}
      <div className="border-t border-border pt-6">
        <Field id="delivery-recipient" label={delivery.type === "recojo_campus" ? "Persona que recoge" : "Persona que recibe"} autoComplete="section-recipient name" value={delivery.recipient} onChange={(event) => set("recipient", event.target.value)} error={errors.recipient} maxLength={160} required />
        {buyerName && delivery.recipient !== buyerName ? <button className="mt-2 min-h-10 text-xs font-medium text-primary underline underline-offset-4" type="button" onClick={() => set("recipient", buyerName)}>Usar mis datos</button> : null}
      </div>
    </div>
  );
}
