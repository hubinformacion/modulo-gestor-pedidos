"use client";
import { useState, useTransition } from "react";
import { sileo } from "sileo";
import { addInternalNoteAction } from "@/app/admin/operations";
import { internalNoteSchema } from "@/lib/admin/validation";
import { Button } from "@/components/ui/button";

export function InternalNoteComposer({ id }: { id: string }) {
  const [content, setContent] = useState("");
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();
  return <form className="mt-4" data-order-editing={content || pending ? "true" : undefined} onSubmit={(event) => {
    event.preventDefault();
    const parsed = internalNoteSchema.safeParse({ id, content });
    if (!parsed.success) { setError(parsed.error.issues[0].message); return; }
    startTransition(async () => {
      try {
        const result = await addInternalNoteAction(parsed.data);
        if (result.success) { setContent(""); setError(""); sileo.success({ title: result.message }); }
        else setError(result.message);
      } catch { setError("No se pudo guardar. Tu comentario permanece aquí."); }
    });
  }}>
    <label htmlFor="internal-note" className="sr-only">Nueva nota interna</label>
    <textarea id="internal-note" value={content} onChange={(event) => setContent(event.target.value)} disabled={pending} maxLength={2000} placeholder="Ej. Coordinar el recojo por la tarde o confirmar un dato antes del despacho…" className="min-h-24 w-full resize-y rounded-lg border border-input bg-white px-3 py-2 text-xs leading-6 outline-none focus-visible:ring-2 focus-visible:ring-primary" aria-invalid={Boolean(error)} aria-describedby={error ? "internal-note-error" : "internal-note-help"} />
    <div className="mt-2 flex flex-wrap items-center justify-between gap-3"><p id="internal-note-help" className="text-[10px] text-muted-foreground">El comprador no verá este comentario.</p><Button type="submit" className="h-9 px-3 text-xs" disabled={pending || !content.trim()}>{pending ? "Guardando…" : "Guardar nota"}</Button></div>
    {error ? <p id="internal-note-error" role="alert" className="mt-2 text-xs text-destructive">{error}</p> : null}
  </form>;
}
