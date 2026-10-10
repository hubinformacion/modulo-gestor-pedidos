"use client";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { sileo } from "sileo";
import { assignCajaAction } from "@/app/tesoreria-recaudacion/actions";
import { cajaAssignmentSchema } from "@/lib/caja/validation";
export function CajaAssignmentControls({ id, version, mine, assigned, assignedName }: { id: string; version: string; mine: boolean; assigned: boolean; assignedName: string | null }) {
  const [pending, startTransition] = useTransition(); const [error, setError] = useState(""); const [reason, setReason] = useState(""); const [mode, setMode] = useState<"claim" | "release" | "takeover" | null>(null);
  return <section className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-muted/15 p-4" data-order-editing={pending ? "true" : undefined}><div><h2 className="text-xs font-semibold">Atención de Tesorería Recaudación</h2><p className="mt-1 text-xs text-muted-foreground">{assigned ? `Responsable: ${assignedName || "Tesorería Recaudación"}` : "Disponible para el equipo de esta unidad de negocio."}</p></div><Button type="button" variant={mine ? "outline" : "default"} disabled={pending} className="cursor-pointer" onClick={() => {
    if (document.querySelector('[data-order-editing="true"]')) { setError("Finaliza la carga o edición antes de cambiar la atención."); return; }
    if (assigned && !mode) { setMode(mine ? "release" : "takeover"); return; }
    if (assigned && !mine && reason.trim().length < 5) { setError("Indica el motivo (mínimo 5 caracteres)."); return; }
    const parsed = cajaAssignmentSchema.safeParse({ id, version, operation: mode ?? (mine ? "release" : assigned ? "takeover" : "claim"), reason });
    if (!parsed.success) { setError("Actualiza la solicitud."); return; }
    startTransition(async () => { try { const result = await assignCajaAction(parsed.data); if (result.success) { setError(""); sileo.success({ title: result.message }); } else setError(result.message); } catch { setError("No se pudo cambiar la atención. Reintenta."); } });
  }}>{pending ? "Guardando…" : mode === "release" ? "Confirmar liberación" : mode === "takeover" ? "Confirmar reasignación" : mine ? "Liberar solicitud" : assigned ? "Reasignar atención" : "Tomar atención"}</Button>{assigned && !mine && !mode ? <Button type="button" variant="outline" onClick={() => setMode("release")}>Desasignar con motivo</Button> : null}{mode ? <label className="w-full text-xs font-medium">Motivo del cambio{mine ? " (opcional)" : ""}<textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Indica por qué necesitas cambiar la atención" maxLength={1000} disabled={pending} className="mt-2 min-h-20 w-full rounded-lg border border-input p-3 text-sm" /></label> : null}{error ? <p role="alert" className="w-full text-xs text-destructive">{error}</p> : null}</section>;
}
