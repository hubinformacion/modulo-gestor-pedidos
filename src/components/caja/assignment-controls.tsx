"use client";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { sileo } from "sileo";
import { assignCajaAction } from "@/app/caja/actions";
import { cajaAssignmentSchema } from "@/lib/caja/validation";
export function CajaAssignmentControls({ id, version, mine, assigned, assignedName }: { id: string; version: string; mine: boolean; assigned: boolean; assignedName: string | null }) {
  const [pending, startTransition] = useTransition(); const [error, setError] = useState("");
  return <section className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-muted/15 p-4" data-order-editing={pending ? "true" : undefined}><div><h2 className="text-xs font-semibold">Atención de caja</h2><p className="mt-1 text-xs text-muted-foreground">{assigned ? `Responsable: ${assignedName || "Caja"}` : "Disponible para el equipo de este sello."}</p></div>{!assigned || mine ? <Button type="button" variant={mine ? "outline" : "default"} disabled={pending} className="cursor-pointer" onClick={() => {
    if (document.querySelector('[data-order-editing="true"]')) { setError("Finaliza la carga o edición antes de cambiar la atención."); return; }
    const parsed = cajaAssignmentSchema.safeParse({ id, version, operation: mine ? "release" : "claim" });
    if (!parsed.success) { setError("Actualiza la solicitud."); return; }
    startTransition(async () => { try { const result = await assignCajaAction(parsed.data); if (result.success) { setError(""); sileo.success({ title: result.message }); } else setError(result.message); } catch { setError("No se pudo cambiar la atención. Reintenta."); } });
  }}>{pending ? "Guardando…" : mine ? "Liberar solicitud" : "Tomar atención"}</Button> : <span className="text-xs text-muted-foreground">Solo consulta</span>}{error ? <p role="alert" className="w-full text-xs text-destructive">{error}</p> : null}</section>;
}
