"use client";
import { useState, useTransition } from "react";
import { notifyAction } from "@/lib/ui/notifications";
import { Button } from "@/components/ui/button";
import { addTreasuryNoteAction, addObservationAction } from "@/app/tesoreria-recaudacion/operations";
import { noteSchema, observationSchema } from "@/lib/treasury/validation";
export function TreasuryComposer({ id, version, note = false }: { id: string; version: string; note?: boolean }) {
  const [content, setContent] = useState("");
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();
  return <form noValidate data-order-editing={pending || content ? "true" : undefined} className="space-y-3" onSubmit={(event) => {
    event.preventDefault();
    const input = { id, version, content };
    const parsed = note ? noteSchema.safeParse(input) : observationSchema.safeParse(input);
    if (!parsed.success) { setError(parsed.error.issues[0].message); return; }
    startTransition(async () => {
      try {
        const result = await notifyAction(() => note ? addTreasuryNoteAction(input) : addObservationAction(input), {
          loading: { title: note ? "Guardando nota" : "Registrando observación", description: note ? "Añadimos el comentario privado para Tesorería Recaudación." : "Registramos la corrección que debe coordinar Fondo Editorial." },
          success: { title: note ? "Nota guardada" : "Observación registrada", description: note ? "El equipo podrá consultar la nota con su autor y fecha." : "Fondo Editorial debe resolver la observación antes de finalizar la emisión." },
          error: { title: note ? "No se pudo guardar la nota" : "No se pudo registrar la observación", description: "El texto permanece en el formulario para reintentar." },
        });
        if (result.success) { setContent(""); setError(""); } else setError(result.message);
      } catch { setError("No se pudo registrar. Reintenta."); }
    });
  }}>
    <label className="block text-xs font-medium">{note ? "Nota privada para el equipo" : "Corrección solicitada a Fondo Editorial"}<textarea value={content} onChange={(event) => setContent(event.target.value)} disabled={pending} maxLength={2000} placeholder={note ? "Añade un comentario para tu equipo…" : "Describe qué datos, importes o documentos se deben revisar…"} className="mt-2 min-h-24 w-full rounded-lg border border-input bg-white p-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-primary/20" /></label>
    <div className="flex items-center justify-end"><Button disabled={pending || !content.trim()} size="sm" type="submit">{pending ? "Guardando…" : note ? "Añadir nota" : "Registrar observación"}</Button></div>
    {error ? <p role="alert" className="text-xs text-destructive">{error}</p> : null}
  </form>;
}
