"use client";
import { useState, useTransition } from "react";
import { sileo } from "sileo";
import { Button } from "@/components/ui/button";
import { ImprintBadge } from "@/components/order-wizard/imprint-badge";
import { saveCajaResponsibleAction } from "@/app/admin/caja-settings";
import { cajaSettingsSchema } from "@/lib/caja/validation";
export function CajaSettings({ rows, canManage }: { rows: { email: string; imprint: "universidad" | "instituto" }[]; canManage: boolean }) {
  return <div className="mt-5 grid gap-4 md:grid-cols-2">{(["universidad", "instituto"] as const).map((imprint) => <Responsible key={`${imprint}:${rows.find((row) => row.imprint === imprint)?.email ?? ""}`} imprint={imprint} previousEmail={rows.find((row) => row.imprint === imprint)?.email ?? ""} canManage={canManage} />)}</div>;
}
function Responsible({ imprint, previousEmail, canManage }: { imprint: "universidad" | "instituto"; previousEmail: string; canManage: boolean }) {
  const [email, setEmail] = useState(previousEmail); const [error, setError] = useState(""); const [confirmRemove, setConfirmRemove] = useState(false); const [pending, startTransition] = useTransition();
  function save(value: string) {
    const parsed = cajaSettingsSchema.safeParse({ imprint, previousEmail, email: value }); if (!parsed.success) { setError(parsed.error.issues[0].message); return; }
    startTransition(async () => { try { const result = await saveCajaResponsibleAction(parsed.data); if (result.success) sileo.success({ title: result.message }); else setError(result.message); } catch { setError("No se pudo actualizar. Reintenta."); } });
  }
  return <form noValidate className="rounded-xl border border-border p-5" onSubmit={(event) => { event.preventDefault(); save(email); }}><ImprintBadge imprint={imprint} /><label htmlFor={`caja-email-${imprint}`} className="mb-2 mt-5 block text-xs font-medium">Correo del responsable de caja</label><input id={`caja-email-${imprint}`} type="email" value={email} onChange={(event) => { setEmail(event.target.value); setError(""); }} placeholder="responsable@continental.edu.pe" maxLength={254} disabled={!canManage || pending} className="h-11 w-full rounded-lg border border-input px-3 text-sm disabled:bg-muted/20" />{!previousEmail ? <p className="mt-3 text-xs leading-6 text-muted-foreground">Las solicitudes se conservarán pendientes hasta configurar el responsable.</p> : null}{canManage ? <div className="mt-4 flex flex-wrap gap-2"><Button type="submit" disabled={pending || !email.trim()} size="sm">{pending ? "Guardando…" : "Guardar responsable"}</Button>{previousEmail ? <Button type="button" size="sm" variant="outline" disabled={pending} onClick={() => setConfirmRemove(true)}>Revocar acceso</Button> : null}</div> : <p className="mt-3 text-xs text-muted-foreground">Solo el correo maestro modifica estos accesos.</p>}{confirmRemove ? <div role="alert" className="mt-4 rounded-lg bg-muted/20 p-3 text-xs"><p>¿Revocar el acceso de caja de este sello?</p><div className="mt-2 flex gap-2"><Button type="button" variant="destructive" size="sm" disabled={pending} onClick={() => save("")}>Revocar</Button><Button type="button" size="sm" variant="ghost" disabled={pending} onClick={() => setConfirmRemove(false)}>Cancelar</Button></div></div> : null}{error ? <p role="alert" className="mt-3 text-xs text-destructive">{error}</p> : null}</form>;
}
