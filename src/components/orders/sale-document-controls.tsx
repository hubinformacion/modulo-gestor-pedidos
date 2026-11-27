"use client";

import { useState, useTransition } from "react";
import dynamic from "next/dynamic";
import { finalizeSaleAction, reviseSaleAction } from "@/app/admin/sale-document-actions";
import { notifyAction } from "@/components/feedback/notify-action";
import type { DraftSaleFile } from "@/components/orders/sale-document-pond";
import { Button } from "@/components/ui/button";
import { finalizeSaleSchema, reviseSaleSchema } from "@/modules/orders/domain/sale-documents";

const DocumentPond = dynamic(() => import("@/components/orders/sale-document-pond"), {
  ssr: false,
  loading: () => <p className="text-xs text-muted-foreground">Cargando área de archivos…</p>,
});

export function SaleDocumentControls({ id, cycle, initialVersion, initialDocument, initialXml }: {
  id: string;
  cycle: number;
  initialVersion: string;
  initialDocument: DraftSaleFile | null;
  initialXml: DraftSaleFile | null;
}) {
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

  function confirm() {
    const parsed = finalizeSaleSchema.safeParse({ id, version, documentId: pdf?.id, xmlDocumentId: xml?.id });
    if (!parsed.success) { setError("Adjunta el PDF y el XML antes de confirmar."); return; }

    startTransition(async () => {
      try {
        const result = await notifyAction(() => finalizeSaleAction(parsed.data), {
          loading: { title: "Confirmando documentos", description: "Guardamos el PDF y el XML de la emisión." },
          success: { title: "Documentos confirmados", description: "Los archivos están disponibles en Seguimiento." },
          error: { title: "No se pudo confirmar", description: "Actualiza el pedido y vuelve a intentarlo." },
        });
        setError(result.success ? "" : result.message);
      } catch { setError("No se pudo confirmar. Actualiza el pedido y reintenta."); }
    });
  }

  return <div className="mt-4 space-y-4" data-sale-upload-busy={busy ? "true" : undefined} data-order-editing={busy ? "true" : undefined}>
    <p className="text-xs leading-5 text-muted-foreground">Adjunta el PDF y el XML recibidos por correo. Cada archivo puede pesar hasta 3 MB.</p>
    <div className="grid gap-4 lg:grid-cols-2">
      <section aria-label="PDF de la emisión" className="min-w-0">
        <p className="mb-2 text-xs font-semibold">PDF</p>
        <DocumentPond id={id} cycle={cycle} format="pdf" disabled={pending} locked={xmlBusy} initialDocument={initialDocument} onBusy={setPdfBusy} onError={setPdfError}
          onRemoved={(value) => { setPdf(null); advanceVersion(value); }} onUploaded={(file) => { setPdf(file); advanceVersion(file.version); setError(""); }} />
        {pdf ? <a href={pdf.url} target="_blank" rel="noopener noreferrer" className="text-xs font-medium text-primary underline underline-offset-4">Revisar PDF en Drive</a> : null}
        {pdfError ? <p role="alert" className="mt-2 text-xs text-destructive">{pdfError}</p> : null}
      </section>
      <section aria-label="XML de la emisión" className="min-w-0">
        <p className="mb-2 text-xs font-semibold">XML</p>
        <DocumentPond id={id} cycle={cycle} format="xml" disabled={pending} locked={pdfBusy} initialDocument={initialXml} onBusy={setXmlBusy} onError={setXmlError}
          onRemoved={(value) => { setXml(null); advanceVersion(value); }} onUploaded={(file) => { setXml(file); advanceVersion(file.version); setError(""); }} />
        {xml ? <a href={xml.url} target="_blank" rel="noopener noreferrer" className="text-xs font-medium text-primary underline underline-offset-4">Revisar XML en Drive</a> : null}
        {xmlError ? <p role="alert" className="mt-2 text-xs text-destructive">{xmlError}</p> : null}
      </section>
    </div>
    <div>
      <Button disabled={!pdf || !xml || busy || Boolean(pdfError || xmlError)} onClick={confirm}>{pending ? "Confirmando…" : "Confirmar documentos"}</Button>
      {error ? <p role="alert" className="mt-2 text-xs leading-6 text-destructive">{error}</p> : null}
    </div>
  </div>;
}

export function ReviseSaleControls({ id, version }: { id: string; version: string }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();

  return <div className="mt-4" data-order-editing={open || pending ? "true" : undefined}>
    {open ? <form onSubmit={(event) => {
      event.preventDefault();
      const parsed = reviseSaleSchema.safeParse({ id, version, reason });
      if (!parsed.success) { setError(parsed.error.issues[0].message); return; }
      startTransition(async () => {
        try {
          const result = await notifyAction(() => reviseSaleAction(parsed.data), {
            loading: { title: "Registrando corrección", description: "Guardamos el motivo y habilitamos la carga de archivos corregidos." },
            success: { title: "Corrección abierta", description: "La versión publicada sigue disponible hasta confirmar su reemplazo." },
            error: { title: "No se pudo abrir la corrección", description: "Actualiza el pedido y reintenta conservando el motivo." },
          });
          if (result.success) { setOpen(false); setReason(""); setError(""); }
          else setError(result.message);
        } catch { setError("No se pudo abrir la corrección."); }
      });
    }}>
      <label htmlFor={`sale-revision-${id}`} className="mb-2 block text-xs font-medium">Motivo de la corrección</label>
      <textarea id={`sale-revision-${id}`} value={reason} onChange={(event) => setReason(event.target.value)} minLength={5} maxLength={500} required disabled={pending} className="min-h-24 w-full rounded-lg border border-input p-3 text-xs leading-6" />
      <p className="mt-2 text-xs leading-5 text-muted-foreground">Coordina la corrección con Tesorería en el hilo de correo del sello.</p>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button type="submit" size="sm" disabled={pending}>{pending ? "Guardando…" : "Abrir corrección"}</Button>
        <Button variant="ghost" size="sm" type="button" disabled={pending} onClick={() => { setOpen(false); setError(""); }}>Cancelar</Button>
      </div>
      {error ? <p role="alert" className="mt-2 text-xs text-destructive">{error}</p> : null}
    </form> : <Button variant="outline" size="sm" onClick={() => setOpen(true)}>Registrar corrección</Button>}
  </div>;
}
