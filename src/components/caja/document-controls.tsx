"use client";
import { useState, useTransition } from "react";
import dynamic from "next/dynamic";
import type { DraftPdf } from "./document-pond";
import { sileo } from "sileo";
import { Button } from "@/components/ui/button";
import { finalizeSaleAction } from "@/app/caja/actions";
import { finalizeSaleSchema } from "@/lib/caja/validation";
const DocumentPond = dynamic(() => import("./document-pond"), { ssr: false, loading: () => <p className="text-xs text-muted-foreground">Cargando área de PDF…</p> });
export function SaleDocumentControls({ id, cycle, initialVersion, initialDocument }: { id: string; cycle: number; initialVersion: string; initialDocument: DraftPdf | null }) {
  const [document, setDocument] = useState(initialDocument); const [version, setVersion] = useState(initialVersion);
  const [busy, setBusy] = useState(false); const [error, setError] = useState(""); const [pending, startTransition] = useTransition();
  return <div className="mt-4" data-order-editing={busy || pending ? "true" : undefined}>
    <DocumentPond id={id} cycle={cycle} disabled={pending} initialDocument={initialDocument} onBusy={setBusy} onError={setError} onRemoved={(value) => { setDocument(null); setVersion(value); }} onUploaded={(file) => { setDocument(file); setVersion(file.version); setError(""); }} />
    {document ? <a href={document.href} target="_blank" rel="noopener noreferrer" className="mt-2 inline-block text-xs font-medium text-primary underline">Ver PDF en Drive ↗</a> : null}<p className="mt-2 text-[10px] leading-5 text-muted-foreground">PDF · hasta 3 MB. Para cambiarlo, retira el borrador desde FilePond y adjunta otro.</p>
    <Button className="mt-4 h-11 w-full" disabled={!document || busy || pending || Boolean(error)} onClick={() => {
      const parsed = finalizeSaleSchema.safeParse({ id, version, documentId: document?.id }); if (!parsed.success) { setError("Adjunta y revisa el PDF antes de finalizar."); return; }
      startTransition(async () => { try { const result = await finalizeSaleAction(parsed.data); if (result.success) { setError(""); sileo.success({ title: "Solicitud finalizada" }); } else { setError(result.message); sileo.error({ title: result.message }); } } catch { setError("No se pudo finalizar. Actualiza la solicitud y reintenta."); } });
    }}>{pending ? "Finalizando…" : "Finalizar solicitud"}</Button><p className="mt-3 text-[10px] leading-5 text-muted-foreground">Al finalizar confirmas el PDF y notificas a Fondo Editorial.</p>{error ? <p role="alert" className="mt-3 text-xs leading-6 text-destructive">{error}</p> : null}
  </div>;
}
