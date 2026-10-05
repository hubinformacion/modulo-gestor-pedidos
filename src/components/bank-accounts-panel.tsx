"use client";

import { useState, useTransition, type FormEvent } from "react";
import { sileo } from "sileo";
import { Button } from "@/components/ui/button";
import { Field, SelectField } from "@/components/order-wizard/fields";
import { ImprintBadge } from "@/components/order-wizard/imprint-badge";
import { createBankAction, updateBankAction, deleteBankAction } from "@/app/admin/bank-actions";
import { bankFormSchema, emptyBank, type BankForm, type BankAdminRow, type BankResult } from "@/lib/payments/banks-validation";

export function BankAccountsPanel({ rows }: { rows: BankAdminRow[] }) {
  const [form, setForm] = useState<BankForm>(emptyBank);
  const [editing, setEditing] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<BankResult | null>(null);
  const [pending, startTransition] = useTransition();
  function set<K extends keyof BankForm>(key: K, value: BankForm[K]) { setForm((current) => ({ ...current, [key]: value })); setErrors((current) => ({ ...current, [key]: "" })); setMessage(null); }
  function report(result: BankResult) { setMessage(result); setErrors(result.fieldErrors ?? {}); (result.success ? sileo.success : sileo.error)({ title: result.message }); }
  function cancel() { setEditing(null); setForm(emptyBank); setErrors({}); setMessage(null); }
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsed = bankFormSchema.safeParse(form);
    if (!parsed.success) {
      const fields: Record<string, string> = {};
      parsed.error.issues.forEach((issue) => { fields[String(issue.path[0])] ??= issue.message; });
      report({ success: false, message: "Revisa los datos de la cuenta.", fieldErrors: fields }); return;
    }
    startTransition(async () => {
      try { const result = editing ? await updateBankAction({ ...parsed.data, id: editing }) : await createBankAction(parsed.data); if (result.success) { setEditing(null); setForm(emptyBank); } report(result); }
      catch { report({ success: false, message: "No se pudo guardar. Reintenta." }); }
    });
  }
  return <div className="mt-6 grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
    <div className="divide-y divide-border rounded-xl border border-border">
      {rows.length ? rows.map((row) => <div key={row.id} className="p-5">
        <div className="flex items-center justify-between gap-3"><ImprintBadge imprint={row.publisherImprint} /><span className="text-[11px] text-muted-foreground">{row.status === "ACTIVO" ? "Activa" : "Inactiva"}</span></div>
        <p className="mt-3 text-sm font-semibold">{row.bank} · soles</p>
        <p className="mt-2 text-xs leading-6">Titular: {row.holder || "Pendiente de completar"}<br />Cuenta: {row.account}<br />CCI: {row.cci || "Pendiente de completar"}</p>
        {row.cci.length !== 20 || !row.holder ? <p className="mt-2 text-xs text-destructive">Completa titular y CCI válido antes de activar.</p> : null}
        <div className="mt-3 flex gap-2"><Button variant="outline" disabled={pending} onClick={() => { setEditing(row.id); setForm({ publisherImprint: row.publisherImprint, bank: row.bank, holder: row.holder, account: row.account, cci: row.cci, currency: row.currency, status: row.status }); setErrors({}); setMessage(null); document.getElementById("bank-form")?.scrollIntoView({ block: "start", behavior: "instant" }); }}>Editar</Button><Button variant="ghost" disabled={pending} onClick={() => setConfirmDelete(row.id)}>Eliminar</Button></div>
        {confirmDelete === row.id ? <div className="mt-3 rounded-lg border border-destructive/20 p-3"><p className="text-xs leading-6">¿Eliminar esta cuenta? Los pedidos anteriores conservan sus datos.</p><div className="mt-2 flex gap-2"><Button variant="destructive" disabled={pending} onClick={() => startTransition(async () => {
          try { const result = await deleteBankAction(row.id); if (result.success) { setConfirmDelete(null); if (editing === row.id) cancel(); } report(result); }
          catch { report({ success: false, message: "No se pudo eliminar la cuenta." }); }
        })}>Confirmar</Button><Button variant="outline" disabled={pending} onClick={() => setConfirmDelete(null)}>Cancelar</Button></div></div> : null}
      </div>) : <p className="p-5 text-sm text-muted-foreground">Añade las cuentas de ambos sellos.</p>}
    </div>
    <form id="bank-form" noValidate onSubmit={submit} className="scroll-mt-6 rounded-xl border border-border p-5">
      <h3 className="text-sm font-semibold">{editing ? "Editar cuenta" : "Añadir cuenta"}</h3>
      <p className="mt-2 text-xs leading-6 text-muted-foreground">Todas las cuentas están en soles. Solo se ofrecen las activas; puedes guardar datos pendientes como inactivos.</p>
      <fieldset disabled={pending} className="mt-5 space-y-4">
        <SelectField id="bank-imprint" label="Sello" value={form.publisherImprint} onChange={(event) => set("publisherImprint", event.target.value as BankForm["publisherImprint"])} error={errors.publisherImprint}><option value="universidad">Universidad Continental</option><option value="instituto">Instituto Continental</option></SelectField>
        <Field id="bank-name" label="Banco" placeholder="Ej. BCP o BBVA" value={form.bank} onChange={(event) => set("bank", event.target.value)} maxLength={80} error={errors.bank} required />
        <Field id="bank-holder" label="Titular de la cuenta" placeholder="Razón social exacta del titular" value={form.holder} onChange={(event) => set("holder", event.target.value)} maxLength={200} error={errors.holder} />
        <Field id="bank-number" label="Número de cuenta" placeholder="Número proporcionado por el banco" value={form.account} onChange={(event) => set("account", event.target.value)} maxLength={40} error={errors.account} required />
        <Field id="bank-cci" label="CCI" placeholder="20 dígitos" value={form.cci} onChange={(event) => set("cci", event.target.value)} maxLength={30} error={errors.cci} hint="Puedes pegarlo con guiones; se guardan solo los dígitos." />
        <SelectField id="bank-status" label="Estado" value={form.status} onChange={(event) => set("status", event.target.value as BankForm["status"])} error={errors.status}><option value="INACTIVO">Inactiva</option><option value="ACTIVO">Activa</option></SelectField>
        <Button type="submit" className="h-11 w-full" disabled={pending}>{pending ? "Guardando…" : editing ? "Guardar cambios" : "Crear cuenta"}</Button>
        {editing ? <Button type="button" variant="ghost" disabled={pending} onClick={cancel}>Cancelar edición</Button> : null}
      </fieldset>
      {message ? <p role={message.success ? "status" : "alert"} className="mt-4 text-xs leading-6">{message.message}</p> : null}
    </form>
  </div>;
}
