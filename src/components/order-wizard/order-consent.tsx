import { Button } from "@/components/ui/button";

export function OrderConsent({ accepted, onAccepted, disabled, preview }: {
  accepted: boolean;
  onAccepted: (value: boolean) => void;
  disabled: boolean; preview: boolean;
}) {
  return <section className="rounded-xl border border-border bg-white p-5" aria-labelledby="consent-title">
    <h2 id="consent-title" className="mb-4 text-sm font-semibold">Enviar pedido</h2>
      <label htmlFor="privacy-consent" className="flex cursor-pointer items-start gap-3 text-xs leading-6">
        <input id="privacy-consent" type="checkbox" form="order-wizard-form" required className="mt-1 size-4 shrink-0 accent-primary" checked={accepted} onChange={(event) => onAccepted(event.target.checked)} />
        <span>He leído y acepto la <a href="https://ucontinental.edu.pe/politica-de-privacidad/" target="_blank" rel="noopener noreferrer" className="font-bold text-primary underline underline-offset-4">Política de confidencialidad y protección de datos personales</a> y autorizo a la Universidad Continental a tratar mis datos personales conforme a dicha política.</span>
      </label>
    <Button type="submit" form="order-wizard-form" className="mt-5 h-11 w-full" disabled={disabled}>Enviar pedido</Button>
    {!preview ? <p className="mt-3 text-xs leading-5 text-muted-foreground">El registro de pedidos aún no está habilitado; todavía no se ha reservado stock.</p> : null}
  </section>;
}
