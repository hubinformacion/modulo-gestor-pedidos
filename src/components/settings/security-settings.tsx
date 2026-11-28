"use client";
import { useState, useTransition, type FormEvent } from "react";
import { ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { admissionFields, admissionPolicySchema, type AdmissionPolicy } from "@/modules/orders/domain/admission-policy";
import { saveAdmissionPolicyAction } from "@/app/admin/security-actions";
import { notifyAction } from "@/components/feedback/notify-action";
export function SecuritySettings({ policy, version, canManage, updatedBy }: { policy: AdmissionPolicy; version: string; canManage: boolean; updatedBy: string | null }) {
  const [values, setValues] = useState(policy);
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState("");
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsed = admissionPolicySchema.safeParse(values);
    if (!parsed.success) { setMessage("Introduce límites enteros entre 1 y 100 000."); return; }
    startTransition(async () => {
      try {
        const result = await notifyAction(() => saveAdmissionPolicyAction({ policy: parsed.data, version }), {
          loading: { title: "Guardando límites", description: "Comprobamos los permisos y registramos el cambio." },
          success: { title: "Límites actualizados", description: "Los pedidos nuevos utilizarán esta configuración. Los pedidos existentes se conservan." },
          error: { title: "No se pudieron guardar los límites", description: "Actualiza la página para comprobar la configuración antes de reintentar." },
        });
        setMessage(result.message ?? "");
      } catch { setMessage("No se pudo confirmar el guardado. Actualiza la página antes de reintentar."); }
    });
  }
  return <section aria-labelledby="security-title" className="min-w-0 overflow-hidden rounded-xl border border-border bg-white">
    <header className="border-b border-border bg-muted/60 px-4 py-4 sm:px-5">
      <h2 id="security-title" className="flex items-center gap-2 text-base font-semibold"><ShieldCheck className="size-4 shrink-0 text-primary" aria-hidden="true" />Límites de registro de pedidos</h2>
      <p className="mt-1.5 max-w-[65ch] text-xs leading-5 text-muted-foreground">Los reintentos de un pedido ya creado no consumen otra cuota.</p>
    </header>
    <form onSubmit={submit}>
      <fieldset disabled={!canManage || pending} className="divide-y divide-border">{admissionFields.map(({ key, label, detail }) => <div key={key} className="grid grid-cols-[minmax(0,1fr)_4.75rem] items-start gap-3 px-4 py-3.5 sm:grid-cols-[minmax(0,1fr)_6rem] sm:px-5"><div><label htmlFor={`limit-${key}`} className="text-sm font-medium">{label}</label><p id={`hint-${key}`} className="mt-1 text-xs leading-5 text-muted-foreground">{detail}</p></div><input id={`limit-${key}`} aria-describedby={`hint-${key}`} type="number" inputMode="numeric" min={1} max={100000} step={1} required value={Number.isNaN(values[key]) ? "" : values[key]} onChange={(event) => { setValues({ ...values, [key]: event.target.valueAsNumber }); setMessage(""); }} className="h-10 w-full rounded-lg border border-border bg-white px-3 text-right text-sm tabular-nums focus-visible:outline-2 focus-visible:outline-primary disabled:bg-muted/30" /></div>)}</fieldset>
      <div className="flex flex-wrap items-center justify-between gap-4 border-y border-border bg-muted/30 px-4 py-3.5 sm:px-5"><p className="max-w-lg text-xs leading-5 text-muted-foreground">{canManage ? "Los cambios quedan registrados y no requieren un nuevo despliegue." : "Solo el correo maestro puede modificar estos valores."}{updatedBy ? ` Último cambio: ${updatedBy}.` : " Configuración inicial."}</p>{canManage && <Button type="submit" disabled={pending}>{pending ? "Guardando…" : "Guardar límites"}</Button>}</div>
    </form>
    {message ? <p role="status" className="px-4 pt-3 text-sm sm:px-5">{message}</p> : null}
    <p className="px-4 py-3.5 text-xs leading-5 text-muted-foreground sm:px-5">La protección del tráfico HTTP se configura en el firewall de Vercel. No se almacenan direcciones IP en texto claro.</p>
  </section>;
}
