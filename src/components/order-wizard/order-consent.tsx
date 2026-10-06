import { Button } from "@/components/ui/button";

export function OrderConsent({ accepted, onAccepted, disabled, pending, enabled }: {
  accepted: boolean;
  onAccepted: (value: boolean) => void;
  disabled: boolean; pending: boolean; enabled: boolean;
}) {
  return <section className="rounded-xl border border-border bg-white p-5" aria-labelledby="consent-title">
    <h2 id="consent-title" className="mb-4 text-sm font-semibold">Enviar pedido</h2>
      <label htmlFor="privacy-consent" className="flex cursor-pointer items-start gap-3 text-xs leading-6">
        <input id="privacy-consent" type="checkbox" form="order-wizard-form" required className="mt-1 size-4 shrink-0 accent-primary" disabled={pending} checked={accepted} onChange={(event) => onAccepted(event.target.checked)} />
        <span>He leído y acepto la <a href="https://ucontinental.edu.pe/politica-de-privacidad/" target="_blank" rel="noopener noreferrer" className="font-bold text-primary underline underline-offset-4">Política de Confidencialidad y Protección de Datos Personales</a>, y autorizo a la Universidad Continental al tratamiento de mis datos.</span>
      </label>
    <Button type="submit" form="order-wizard-form" className="mt-5 h-11 w-full" disabled={disabled}>{pending ? "Enviando…" : "Enviar pedido"}</Button>
    {!enabled ? <p className="mt-3 text-xs leading-5 text-muted-foreground">El registro de pedidos aún no está habilitado; todavía no se ha reservado stock.</p> : null}
  </section>;
}
