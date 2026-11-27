"use client";

import { useState, useTransition } from "react";
import { saveTreasuryMailboxAction } from "@/app/admin/treasury-mailboxes";
import { ImprintBadge } from "@/components/catalog/imprint-badge";
import { notifyAction } from "@/components/feedback/notify-action";
import { Button } from "@/components/ui/button";
import type { Imprint } from "@/modules/orders/domain/types";
import { treasuryMailboxSchema } from "@/modules/settings/domain/treasury-mailboxes";

export function TreasuryMailboxes({ mailboxes, canManage }: {
  mailboxes: { imprint: Imprint; email: string }[];
  canManage: boolean;
}) {
  return (
    <div className="mt-5 grid gap-4 md:grid-cols-2">
      {(["universidad", "instituto"] as const).map((imprint) => {
        const current = mailboxes.find((mailbox) => mailbox.imprint === imprint)?.email ?? "";
        return <Mailbox key={`${imprint}:${current}`} imprint={imprint} current={current} canManage={canManage} />;
      })}
    </div>
  );
}

function Mailbox({ imprint, current, canManage }: { imprint: Imprint; current: string; canManage: boolean }) {
  const [email, setEmail] = useState(current);
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();
  const inputId = `mailbox-${imprint}`;

  function save() {
    setError("");
    const parsed = treasuryMailboxSchema.safeParse({ imprint, email: email.trim(), previousEmail: current });
    if (!parsed.success) { setError("Ingresa un correo válido."); return; }
    startTransition(async () => {
      try {
        const result = await notifyAction(() => saveTreasuryMailboxAction(parsed.data), {
          loading: { title: "Guardando buzón", description: "Actualizamos el destinatario del sello." },
          success: { title: parsed.data.email ? "Buzón actualizado" : "Buzón retirado", description: "El cambio se aplica a las próximas validaciones." },
          error: { title: "No se pudo guardar el buzón", description: "Revisa el mensaje junto al campo." },
        });
        if (!result.success) setError(result.message);
      } catch {
        setError("No se pudo guardar el buzón.");
      }
    });
  }

  return (
    <form noValidate className="rounded-xl border border-border p-5" onSubmit={(event) => { event.preventDefault(); save(); }}>
      <ImprintBadge imprint={imprint} />
      <label htmlFor={inputId} className="mt-4 block text-xs font-medium">Correo destinatario</label>
      <input
        id={inputId}
        type="email"
        value={email}
        readOnly={!canManage}
        disabled={pending}
        onChange={(event) => setEmail(event.target.value)}
        maxLength={254}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? `${inputId}-error` : canManage ? `${inputId}-hint` : undefined}
        className="mt-2 h-11 w-full rounded-lg border border-input px-3 text-sm"
      />
      {canManage ? <>
        <p id={`${inputId}-hint`} className="mt-2 text-xs text-muted-foreground">Deja el campo vacío para retirar el buzón.</p>
        <Button type="submit" disabled={pending || email.trim() === current} className="mt-3" size="sm">Guardar buzón</Button>
      </> : !current ? <p className="mt-2 text-xs text-muted-foreground">Sin buzón configurado.</p> : null}
      {error ? <p id={`${inputId}-error`} role="alert" className="mt-3 text-xs text-destructive">{error}</p> : null}
    </form>
  );
}
