"use client";
import { useState, useTransition } from "react";
import { sileo } from "sileo";
import { Button } from "@/components/ui/button";
import { ImprintBadge } from "@/components/order-wizard/imprint-badge";
import { saveCajaResponsibleAction } from "@/app/admin/caja-settings";
import { cajaSettingsSchema } from "@/lib/caja/validation";
import { Dialog } from "@base-ui/react/dialog";
type Imprint = "universidad" | "instituto";
export function CajaSettings({ rows, canManage }: { rows: { email: string; imprint: Imprint }[]; canManage: boolean }) {
  return <div className="mt-5 grid items-start gap-4 md:grid-cols-2">{(["universidad", "instituto"] as const).map((imprint) => <Responsibles key={imprint} imprint={imprint} emails={rows.filter((row) => row.imprint === imprint).map((row) => row.email)} canManage={canManage} />)}</div>;
}
function Responsibles({ imprint, emails, canManage }: { imprint: Imprint; emails: string[]; canManage: boolean }) {
  const [email, setEmail] = useState(""); const [error, setError] = useState(""); const [remove, setRemove] = useState<string | null>(null); const [pending, startTransition] = useTransition();
  function save(value: string, operation: "add" | "remove") {
    const parsed = cajaSettingsSchema.safeParse({ imprint, email: value, operation });
    if (!parsed.success) { setError(parsed.error.issues[0].message); return; }
    setError("");
    startTransition(async () => {
      try {
        const result = await saveCajaResponsibleAction(parsed.data);
        if (result.success) { setEmail(""); setRemove(null); sileo.success({ title: result.message }); }
        else setError(result.message);
      } catch { setError("No se pudo actualizar. Reintenta."); }
    });
  }
  return <section className="rounded-xl border border-border p-5"><div className="flex items-center justify-between gap-3"><ImprintBadge imprint={imprint} /><span className="text-xs text-muted-foreground">{emails.length} {emails.length === 1 ? "responsable" : "responsables"}</span></div><ul className="mt-4 divide-y divide-border">{emails.map((value) => <li key={value} className="flex items-center justify-between gap-2 py-3"><span className="min-w-0 break-all text-xs font-medium">{value}</span>{canManage ? <Button type="button" variant="outline" size="sm" className="shrink-0 cursor-pointer" disabled={pending} onClick={() => { setError(""); setRemove(value); }} aria-label={`Revocar acceso de ${value}`}>Revocar</Button> : null}</li>)}</ul>{!emails.length ? <p className="mt-4 text-xs leading-6 text-muted-foreground">Sin responsables configurados. Las solicitudes permanecen disponibles en la plataforma.</p> : null}{canManage ? <form noValidate className="mt-4 border-t border-border pt-4" onSubmit={(event) => { event.preventDefault(); save(email, "add"); }}><label htmlFor={`caja-email-${imprint}`} className="mb-2 block text-xs font-medium">Añadir responsable</label><input id={`caja-email-${imprint}`} type="email" value={email} onChange={(event) => { setEmail(event.target.value); setError(""); }} placeholder="responsable@continental.edu.pe" maxLength={254} disabled={pending} className="h-11 w-full rounded-lg border border-input px-3 text-sm" /><Button type="submit" disabled={pending || !email.trim()} size="sm" className="mt-3 cursor-pointer">{pending ? "Guardando…" : "Añadir correo"}</Button></form> : <p className="mt-4 text-xs text-muted-foreground">Solo el correo maestro modifica estos accesos.</p>}{error && !remove ? <p role="alert" className="mt-3 text-xs text-destructive">{error}</p> : null}<Dialog.Root open={Boolean(remove)} onOpenChange={(open) => { if (!pending && !open) setRemove(null); }}><Dialog.Portal><Dialog.Backdrop className="fixed inset-0 z-40 bg-black/30" /><Dialog.Popup className="fixed left-1/2 top-1/2 z-50 w-[calc(100%_-_2rem)] max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-xl bg-white p-6 shadow-xl"><Dialog.Title className="text-base font-semibold">Revocar acceso de caja</Dialog.Title><Dialog.Description className="mt-3 break-words text-sm leading-6">{remove} dejará de acceder. Sus solicitudes abiertas quedarán disponibles para el equipo.</Dialog.Description>{error ? <p role="alert" className="mt-3 text-xs text-destructive">{error}</p> : null}<div className="mt-5 flex justify-end gap-2"><Button variant="outline" disabled={pending} onClick={() => setRemove(null)}>Cancelar</Button><Button variant="destructive" disabled={pending} onClick={() => { if (remove) save(remove, "remove"); }}>Revocar</Button></div></Dialog.Popup></Dialog.Portal></Dialog.Root></section>;
}
