"use client";
import { PdfPreview } from "@/components/treasury/pdf-preview";
import { useState, useTransition } from "react";
import dynamic from "next/dynamic";
import type { DraftSaleFile } from "@/components/treasury/document-pond";
import { notifyAction } from "@/components/feedback/notify-action";
import { Button } from "@/components/ui/button";
import { finalizeSaleAction } from "@/app/tesoreria-recaudacion/actions";
import { finalizeSaleSchema } from "@/modules/treasury/domain/documents";

const DocumentPond = dynamic(() => import("@/components/treasury/document-pond"), { ssr: false, loading: () => <p className="text-xs text-muted-foreground">Cargando área de archivos…</p> });

export function SaleDocumentControls({ id, cycle, initialVersion, initialDocument, initialXml }: { id: string; cycle: number; initialVersion: string; initialDocument: DraftSaleFile | null; initialXml: DraftSaleFile | null }) {
  const [pdf, setPdf] = useState(initialDocument);
  const [xml, setXml] = useState(initialXml);
  const [version, setVersion] = useState(initialVersion);
  const [pdfBusy, setPdfBusy] = useState(false);
  const [xmlBusy, setXmlBusy] = useState(false);
  const [pdfError, setPdfError] = useState("");
  const [xmlError, setXmlError] = useState("");
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();
  const busy = pdfBusy || xmlBusy || pending;
  const advanceVersion = (value: string) => setVersion((previous) => value > previous ? value : previous);
  return <div className="mt-4 space-y-4" data-treasury-upload-busy={busy ? "true" : undefined} data-order-editing={busy ? "true" : undefined}>
    <section aria-label="PDF original de la emisión">
      <p className="mb-2 text-xs font-semibold">PDF original de la emisión</p>
      <DocumentPond id={id} cycle={cycle} format="pdf" disabled={pending} locked={xmlBusy} initialDocument={initialDocument} onBusy={setPdfBusy} onError={setPdfError}
        onRemoved={(value) => { setPdf(null); advanceVersion(value); }} onUploaded={(file) => { setPdf(file); advanceVersion(file.version); setError(""); }} />
      {pdf ? <PdfPreview requestId={id} documentId={pdf.id} name={pdf.name} /> : null}
      {pdfError ? <p role="alert" className="mt-2 text-xs text-destructive">{pdfError}</p> : null}
    </section>
    <section aria-label="XML de la emisión">
      <p className="mb-2 text-xs font-semibold">XML original de la emisión</p>
      <DocumentPond id={id} cycle={cycle} format="xml" disabled={pending} locked={pdfBusy} initialDocument={initialXml} onBusy={setXmlBusy} onError={setXmlError}
        onRemoved={(value) => { setXml(null); advanceVersion(value); }} onUploaded={(file) => { setXml(file); advanceVersion(file.version); setError(""); }} />
      {xml ? <a href={`/tesoreria-recaudacion/${id}/archivos/${xml.id}?download=1`} download className="text-xs font-medium text-primary underline">Descargar XML</a> : null}
      {xmlError ? <p role="alert" className="mt-2 text-xs text-destructive">{xmlError}</p> : null}
    </section>
    <p className="text-xs leading-5 text-muted-foreground">Adjunta un PDF y su XML original. Cada archivo puede pesar hasta 3 MB.</p>
    <Button className="h-11 w-full" disabled={!pdf || !xml || busy || Boolean(pdfError || xmlError)} onClick={() => {
      const parsed = finalizeSaleSchema.safeParse({ id, version, documentId: pdf?.id, xmlDocumentId: xml?.id });
      if (!parsed.success) { setError("Adjunta y revisa los dos archivos antes de finalizar."); return; }
      startTransition(async () => {
        try {
          const result = await notifyAction(() => finalizeSaleAction(parsed.data), {
            loading: { title: "Finalizando solicitud", description: "Confirmamos el PDF y el XML de la emisión." },
            success: { title: "Solicitud finalizada", description: "Los archivos quedaron confirmados. El envío al comprador se realiza cuando están completos los documentos requeridos." },
            error: { title: "No se pudo finalizar la solicitud", description: "Conserva los archivos y actualiza los datos antes de reintentar." },
          });
          setError(result.success ? "" : result.message);
        } catch { setError("No se pudo finalizar. Actualiza la solicitud y reintenta."); }
      });
    }}>{pending ? "Finalizando…" : "Finalizar solicitud"}</Button>
    <p className="text-xs leading-5 text-muted-foreground">Al finalizar confirmas los dos archivos y notificas a Fondo Editorial.</p>
    {error ? <p role="alert" className="text-xs leading-6 text-destructive">{error}</p> : null}
  </div>;
}
