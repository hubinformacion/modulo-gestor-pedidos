"use client";

import { useState, useTransition, type FormEvent } from "react";
import { MailPlus, ShieldCheck, Trash2 } from "lucide-react";
import { sileo } from "sileo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { addEmailAction, removeEmailAction } from "@/app/admin/correos/actions";
import { authorizedEmailSchema, MASTER_EMAIL, type AccessActionResult } from "@/lib/access-policy";

export type AuthorizedEmailRow = { email: string; addedBy: string; createdAt: string };

export function AuthorizedEmailsPanel({ rows, canManage }: { rows: AuthorizedEmailRow[]; canManage: boolean }) {
  const [email, setEmail] = useState("");
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
      report({ success: false, message: parsed.error.issues[0]?.message ?? "Ingresa un correo válido." });
      return;
    }
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
    <div className="mt-10 grid items-start gap-8 lg:grid-cols-[1fr_20rem]">
      <section className="min-w-0 border border-border bg-white/50" aria-labelledby="lista-correos">
        <div className="flex items-center justify-between border-b border-border px-6 py-5">
          <h2 id="lista-correos" className="text-sm font-semibold">Equipo autorizado</h2>
          <span className="rounded-full bg-secondary px-3 py-1 text-xs">{rows.length} {rows.length === 1 ? "correo" : "correos"}</span>
        </div>
        <ul className="divide-y divide-border">
          {rows.map((row) => (
            <li key={row.email} className="p-6">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <p className="break-all text-sm font-medium">{row.email}</p>
                  {row.email === MASTER_EMAIL ? <span className="mt-2 inline-flex items-center gap-1.5 text-xs text-primary"><ShieldCheck className="size-3.5" aria-hidden="true" />Correo maestro</span> : null}
                  <p className="mt-2 text-xs leading-5 text-muted-foreground">Añadido el {row.createdAt}</p>
                  <p className="break-all text-xs leading-5 text-muted-foreground">Por {row.addedBy}</p>
                </div>
                {canManage && row.email !== MASTER_EMAIL ? <Button variant="ghost" className="h-10 text-destructive" disabled={pending} onClick={() => { setConfirmEmail(row.email); setMessage(null); }} aria-label={`Revocar acceso de ${row.email}`}><Trash2 aria-hidden="true" />Quitar</Button> : null}
              </div>
              {confirmEmail === row.email ? (
                <div className="mt-4 border-l-2 border-destructive bg-muted p-4" role="group" aria-label={`Confirmar revocación de ${row.email}`}>
                  <p className="text-sm leading-6">Este correo perderá acceso y se cerrarán sus sesiones. ¿Quieres continuar?</p>
                  <div className="mt-3 flex flex-wrap gap-3">
                    <Button variant="destructive" className="h-10" disabled={pending} onClick={() => remove(row.email)}>{pending ? "Revocando…" : "Sí, revocar acceso"}</Button>
                    <Button variant="outline" className="h-10" disabled={pending} onClick={() => setConfirmEmail(null)}>Cancelar</Button>
                  </div>
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      </section>
      <aside>
        {canManage ? (
          <form onSubmit={submit} noValidate className="border border-border bg-secondary/50 p-6">
            <MailPlus className="mb-5 size-6 text-primary" strokeWidth={1.5} aria-hidden="true" />
            <h2 className="text-base font-medium">Autorizar un correo</h2>
            <p className="mb-6 mt-2 text-xs leading-6 text-muted-foreground">La persona podrá ingresar con su cuenta de Google y operar el sistema.</p>
            <label htmlFor="authorized-email" className="mb-2 block text-xs font-medium">Correo de Google</label>
            <Input id="authorized-email" type="email" name="email" autoComplete="email" placeholder="nombre@continental.edu.pe" value={email} onChange={(event) => { setEmail(event.target.value); setMessage(null); }} disabled={pending} maxLength={254} className="h-11 bg-background" aria-invalid={message?.success === false} aria-describedby={message ? "access-feedback" : undefined} required />
            <Button type="submit" className="mt-4 h-11 w-full" disabled={pending}>{pending ? "Guardando…" : "Añadir correo"}</Button>
          </form>
        ) : (
          <div className="border-l-2 border-primary p-6">
            <ShieldCheck className="mb-4 size-6 text-primary" aria-hidden="true" />
            <h2 className="text-sm font-medium">Gestión de acceso</h2>
            <p className="mt-3 text-sm leading-7 text-muted-foreground">Solo el correo maestro puede añadir o quitar correos. Contacta al responsable de distribución si necesitas un cambio.</p>
          </div>
        )}
        {message ? <p id="access-feedback" role={message.success ? "status" : "alert"} className={`mt-4 text-sm leading-6 ${message.success ? "text-primary" : "text-destructive"}`}>{message.message}</p> : null}
        <p className="mt-6 text-xs leading-6 text-muted-foreground">El correo maestro se conserva para garantizar la continuidad del acceso.</p>
      </aside>
    </div>
  );
}
