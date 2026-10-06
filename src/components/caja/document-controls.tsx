"use client";
import { useState, useTransition } from "react";
import dynamic from "next/dynamic";
import { CheckCircle2 } from "lucide-react";
import { sileo } from "sileo";
import { Button } from "@/components/ui/button";
import { finalizeSaleAction } from "@/app/caja/actions";
import { finalizeSaleSchema } from "@/lib/caja/validation";
const DocumentPond = dynamic(() => import("./document-pond"), { ssr: false, loading: () => <p className="text-xs text-muted-foreground">Cargando área de PDF…</p> });
export function SaleDocumentControls({ id, cycle, initialVersion, initialDocument }: { id: string; cycle: number; initialVersion: string; initialDocument: { id: string; name: string } | null }) {
  const [document, setDocument] = useState(initialDocument); const [version, setVersion] = useState(initialVersion);
  const [replacing, setReplacing] = useState(false); const [busy, setBusy] = useState(false); const [error, setError] = useState(""); const [pending, startTransition] = useTransition();
  return <div className="mt-4" data-order-editing={busy || replacing || pending ? "true" : undefined}>
    {document ? <div className="rounded-lg bg-emerald-50 p-3 text-xs"><p className="flex items-center gap-2 font-medium text-emerald-800"><CheckCircle2 className="size-4" />PDF adjunto</p><a href={`/caja/${id}/archivos/${document.id}`} target="_blank" rel="noopener noreferrer" className="mt-2 block break-words font-medium text-primary underline">{document.name}</a><p className="mt-2 text-[10px] leading-5 text-muted-foreground">Revisa el archivo antes de finalizar.</p></div> : null}
    {!document || replacing ? <div className="mt-3"><DocumentPond id={id} cycle={cycle} disabled={pending} onBusy={setBusy} onError={setError} onUploaded={(file) => { setDocument({ id: file.id, name: file.name }); setVersion(file.version); setReplacing(false); setError(""); }} /><p className="mt-2 text-[10px] text-muted-foreground">PDF · hasta 3 MB.</p>{document ? <Button variant="ghost" className="mt-2 h-8 text-xs" disabled={busy} onClick={() => { setReplacing(false); setError(""); }}>Conservar PDF actual</Button> : null}</div> : <Button variant="ghost" className="mt-2 h-8 px-0 text-xs text-primary" disabled={pending || busy} onClick={() => setReplacing(true)}>Reemplazar PDF</Button>}
    <Button className="mt-4 h-11 w-full" disabled={!document || busy || pending || replacing} onClick={() => {
      const parsed = finalizeSaleSchema.safeParse({ id, version, documentId: document?.id }); if (!parsed.success) { setError("Adjunta y revisa el PDF antes de finalizar."); return; }
      startTransition(async () => { try { const result = await finalizeSaleAction(parsed.data); if (result.success) { setError(""); sileo.success({ title: "Solicitud finalizada" }); } else { setError(result.message); sileo.error({ title: result.message }); } } catch { setError("No se pudo finalizar. Actualiza la solicitud y reintenta."); } });
    }}>{pending ? "Finalizando…" : "Finalizar solicitud"}</Button><p className="mt-3 text-[10px] leading-5 text-muted-foreground">Al finalizar confirmas el PDF y notificas al gestor.</p>{error ? <p role="alert" className="mt-3 text-xs leading-6 text-destructive">{error}</p> : null}
  </div>;
}
