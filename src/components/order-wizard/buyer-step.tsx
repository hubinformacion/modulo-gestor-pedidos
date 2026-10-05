import { Field, RadioCard, SelectField, type FieldErrors } from "./fields";
import type { BuyerDraft, Campus } from "@/lib/orders/types";

export function BuyerStep({ buyer, campuses, errors, onChange }: {
  buyer: BuyerDraft; campuses: Campus[]; errors: FieldErrors;
  onChange: (value: BuyerDraft) => void;
}) {
  function set<K extends keyof BuyerDraft>(key: K, value: BuyerDraft[K]) { onChange({ ...buyer, [key]: value }); }
  return (
    <div className="space-y-7">
      <fieldset>
        <legend className="mb-3 text-xs font-medium">Tipo de comprador</legend>
        <div className="grid gap-3 sm:grid-cols-2">
          <RadioCard name="buyer-type" value="publico_general" checked={buyer.type === "publico_general"} onChange={() => set("type", "publico_general")} title="Público general" description="Precios de venta estándar." />
          <RadioCard name="buyer-type" value="comunidad_continental" checked={buyer.type === "comunidad_continental"} onChange={() => set("type", "comunidad_continental")} disabled={campuses.length === 0} title="Comunidad Continental" description="Con sede y correo institucional." />
        </div>
        {campuses.length === 0 ? <p className="mt-3 text-xs leading-5 text-muted-foreground">La opción de comunidad estará disponible cuando se habiliten sus sedes.</p> : null}
      </fieldset>
      {buyer.type === "comunidad_continental" ? (
        <SelectField id="buyer-campus" label="Sede" value={buyer.campus} onChange={(event) => set("campus", event.target.value)} error={errors.campus} required>
          <option value="">Selecciona tu sede</option>
          {campuses.map((campus) => <option key={campus.id} value={campus.id}>{campus.name}</option>)}
        </SelectField>
      ) : null}
      <div className="grid gap-5 sm:grid-cols-2">
        <div className="sm:col-span-2"><Field id="buyer-name" label="Nombre completo" autoComplete="name" value={buyer.name} onChange={(event) => set("name", event.target.value)} error={errors.name} maxLength={160} required /></div>
        <Field id="buyer-email" label="Correo electrónico" type="email" autoComplete="email" value={buyer.email} onChange={(event) => set("email", event.target.value)} error={errors.email} hint={buyer.type === "comunidad_continental" ? "Usa tu correo @continental.edu.pe." : "Aquí recibirás la confirmación y el seguimiento."} maxLength={254} required />
        <Field id="buyer-phone" label="Teléfono" type="tel" autoComplete="tel" value={buyer.phone} onChange={(event) => set("phone", event.target.value)} error={errors.phone} maxLength={24} required />
        <Field id="buyer-document" label="DNI, CE o pasaporte" value={buyer.document} onChange={(event) => set("document", event.target.value)} error={errors.document} maxLength={20} required />
      </div>
      <fieldset className="border-t border-border pt-6">
        <legend className="sr-only">Facturación</legend>
        <label className="flex min-h-10 cursor-pointer items-center gap-3 text-sm font-medium">
          <input type="checkbox" className="size-4 accent-primary" checked={buyer.wantsInvoice} onChange={(event) => set("wantsInvoice", event.target.checked)} />
          Necesito factura
        </label>
        <p className="ml-7 text-xs leading-5 text-muted-foreground">Añade los datos fiscales de la empresa.</p>
        {buyer.wantsInvoice ? (
          <div className="mt-5 grid gap-5 sm:grid-cols-2">
            <Field id="buyer-ruc" label="RUC" inputMode="numeric" value={buyer.billingRuc} onChange={(event) => set("billingRuc", event.target.value)} error={errors.billingRuc} maxLength={11} required />
            <Field id="buyer-business-name" label="Razón social" value={buyer.billingBusinessName} onChange={(event) => set("billingBusinessName", event.target.value)} error={errors.billingBusinessName} maxLength={200} required />
          </div>
        ) : null}
      </fieldset>
    </div>
  );
}
