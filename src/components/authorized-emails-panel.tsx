"use client";

import { useState, useTransition, type FormEvent } from "react";
import { Mail, Plus, ShieldCheck, Trash2 } from "lucide-react";
import { sileo } from "sileo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { addEmailAction, removeEmailAction } from "@/app/admin/correos/actions";
import { authorizedEmailSchema, MASTER_EMAIL, type AccessActionResult } from "@/lib/access-policy";

export type AuthorizedEmailRow = { email: string; addedBy: string; createdAt: string };

export function AuthorizedEmailsPanel({ rows, canManage }: { rows: AuthorizedEmailRow[]; canManage: boolean }) {
  const [email, setEmail] = useState("");
  const [emailError, setEmailError] = useState<string | null>(null);
  const [message, setMessage] = useState<AccessActionResult | null>(null);
  const [confirmEmail, setConfirmEmail] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function report(result: AccessActionResult) {
    setMessage(result);
    if (result.success) sileo.success({ title: result.message });
    else sileo.error({ title: "No se pudo actualizar el acceso", description: result.message });
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsed = authorizedEmailSchema.safeParse(email);
    if (!parsed.success) {
      setEmailError(parsed.error.issues[0]?.message ?? "Ingresa un correo válido.");
      return;
    }
    setEmailError(null);
    setMessage(null);
    startTransition(async () => {
      try {
        const result = await addEmailAction(parsed.data);
        report(result);
        if (result.success) setEmail("");
      } catch {
        report({ success: false, message: "No se pudo guardar el cambio. Recarga la página e intenta nuevamente." });
      }
    });
  }

  function remove(target: string) {
    const parsed = authorizedEmailSchema.safeParse(target);
    if (!parsed.success) return;
    setMessage(null);
    startTransition(async () => {
      try {
        const result = await removeEmailAction(parsed.data);
        report(result);
        setConfirmEmail(null);
      } catch {
        report({ success: false, message: "No se pudo revocar el acceso. Recarga la página e intenta nuevamente." });
      }
    });
  }

  return (
    <div className="mt-7 grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_19rem]">
      <section className="min-w-0 overflow-hidden rounded-xl border border-border" aria-labelledby="lista-correos">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-4">
          <h2 id="lista-correos" className="text-sm font-semibold">Personas autorizadas</h2>
          <span className="rounded-md bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground">{rows.length} {rows.length === 1 ? "correo" : "correos"}</span>
        </div>
        <ul className="divide-y divide-border">
          {rows.map((row) => (
            <li key={row.email} className="px-5 py-5">
              <div className="flex items-start gap-3">
                <span className="hidden size-9 shrink-0 items-center justify-center rounded-lg border border-border text-muted-foreground sm:flex" aria-hidden="true"><Mail className="size-4" /></span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                    <p className="break-all text-sm font-medium">{row.email}</p>
                    {row.email === MASTER_EMAIL ? <span className="inline-flex items-center gap-1 rounded-md bg-secondary px-2 py-1 text-[11px] font-medium text-primary"><ShieldCheck className="size-3" aria-hidden="true" />Maestro</span> : null}
                  </div>
                  <p className="mt-2 break-all text-xs leading-5 text-muted-foreground">Añadido el {row.createdAt} · Por {row.addedBy}</p>
                </div>
                {canManage && row.email !== MASTER_EMAIL ? (
                  <Button variant="ghost" size="icon" className="size-9 shrink-0 text-muted-foreground hover:bg-destructive/5 hover:text-destructive" disabled={pending} onClick={() => { setConfirmEmail(row.email); setMessage(null); }} aria-label={`Revocar acceso de ${row.email}`}>
                    <Trash2 className="size-4" aria-hidden="true" />
                  </Button>
                ) : null}
              </div>
              {confirmEmail === row.email ? (
                <div className="mt-4 rounded-lg border border-destructive/20 bg-destructive/5 p-4" role="group" aria-label={`Confirmar revocación de ${row.email}`}>
                  <p className="text-sm leading-6">Este correo perderá acceso y se cerrarán sus sesiones.</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button variant="destructive" className="h-9 px-3" disabled={pending} onClick={() => remove(row.email)}>{pending ? "Revocando…" : "Revocar acceso"}</Button>
                    <Button variant="outline" className="h-9 px-3" disabled={pending} onClick={() => setConfirmEmail(null)}>Cancelar</Button>
                  </div>
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      </section>
      <aside>
        {canManage ? (
          <form onSubmit={submit} noValidate className="rounded-xl border border-border p-5">
            <h2 className="text-sm font-semibold">Añadir un correo</h2>
            <p className="mb-5 mt-2 text-xs leading-5 text-muted-foreground">Autoriza a otra persona para ingresar con su cuenta de Google.</p>
            <label htmlFor="authorized-email" className="mb-2 block text-xs font-medium">Correo electrónico</label>
            <Input id="authorized-email" type="email" name="email" autoComplete="email" placeholder="correo@ejemplo.com" value={email} onChange={(event) => { setEmail(event.target.value); setEmailError(null); setMessage(null); }} disabled={pending} maxLength={254} className="h-10 rounded-lg" aria-invalid={emailError !== null} aria-describedby={emailError ? "email-error" : undefined} required />
            {emailError ? <p id="email-error" role="alert" className="mt-2 text-xs text-destructive">{emailError}</p> : null}
            <Button type="submit" className="mt-4 h-10 w-full gap-2 rounded-lg" disabled={pending}><Plus className="size-4" aria-hidden="true" />{pending ? "Guardando…" : "Autorizar correo"}</Button>
          </form>
        ) : (
          <div className="rounded-xl border border-border p-5">
            <span className="inline-flex rounded-md bg-muted px-2 py-1 text-xs font-medium text-muted-foreground">Solo lectura</span>
            <h2 className="mt-4 text-sm font-semibold">Gestión de acceso</h2>
            <p className="mt-2 text-xs leading-6 text-muted-foreground">Solo el correo maestro puede añadir o quitar correos. Contacta al administrador para solicitar un cambio.</p>
          </div>
        )}
        {message ? <p role={message.success ? "status" : "alert"} className={`mt-4 text-sm leading-6 ${message.success ? "text-primary" : "text-destructive"}`}>{message.message}</p> : null}
        <p className="mt-4 px-1 text-xs leading-5 text-muted-foreground">El correo maestro conserva siempre su acceso.</p>
      </aside>
    </div>
  );
}
