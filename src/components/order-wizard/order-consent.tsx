import { Button } from "@/components/ui/button";

export function OrderConsent({ privacyAccepted, treatmentAuthorized, onConsent, disabled, preview }: {
  privacyAccepted: boolean; treatmentAuthorized: boolean;
  onConsent: (key: "privacyAccepted" | "treatmentAuthorized", value: boolean) => void;
  disabled: boolean; preview: boolean;
}) {
  return <section className="rounded-xl border border-border bg-white p-5" aria-labelledby="consent-title">
    <h2 id="consent-title" className="mb-4 text-sm font-semibold">Enviar pedido</h2>
      <fieldset className="space-y-4">
        <legend className="sr-only">Consentimiento para el tratamiento de datos personales</legend>
        <div className="flex items-start gap-3 text-xs leading-6">
          <input id="privacy-accepted" type="checkbox" form="order-wizard-form" required className="mt-1 size-4 shrink-0 accent-primary" checked={privacyAccepted} onChange={(event) => onConsent("privacyAccepted", event.target.checked)} />
          <div><label htmlFor="privacy-accepted" className="cursor-pointer">Acepto haber leído la </label><a href="https://ucontinental.edu.pe/politica-de-privacidad/" target="_blank" rel="noopener noreferrer" className="font-bold text-primary underline underline-offset-4">Política de confidencialidad y protección de datos personales</a></div>
        </div>
        <label className="flex cursor-pointer items-start gap-3 text-xs leading-6">
          <input type="checkbox" form="order-wizard-form" required className="mt-1 size-4 shrink-0 accent-primary" checked={treatmentAuthorized} onChange={(event) => onConsent("treatmentAuthorized", event.target.checked)} />
          <span>Al presionar <strong className="font-bold text-primary">Enviar pedido</strong>, autorizo a la Universidad Continental al tratamiento de mis datos personales, según la <strong className="font-bold">Política de confidencialidad y protección de datos personales</strong>.</span>
        </label>
      </fieldset>
    <Button type="submit" form="order-wizard-form" className="mt-5 h-11 w-full" disabled={disabled}>Enviar pedido</Button>
    {!preview ? <p className="mt-3 text-xs leading-5 text-muted-foreground">El registro de pedidos aún no está habilitado; todavía no se ha reservado stock.</p> : null}
  </section>;
}
