"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { type FilePondFile } from "filepond";
import { FilePond } from "@/components/orders/filepond";
import { Button } from "@/components/ui/button";
import { type Imprint } from "@/modules/orders/domain/types";
import { ReceiptAcknowledgement } from "@/components/orders/tracking/receipt-acknowledgement";
import { receiptFileSchema, receiptMetadataSchema } from "@/modules/orders/domain/receipt-upload";
import { uploadReceiptAction } from "@/app/seguimiento/[tracking_token]/actions";


function LocalPdfPreview({ file, name }: { file: Blob; name: string }) {
  const frame = useRef<HTMLIFrameElement>(null);
  const link = useRef<HTMLAnchorElement>(null);

  useEffect(() => {
    const url = URL.createObjectURL(file);
    frame.current?.setAttribute("src", url);
    link.current?.setAttribute("href", url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  return (
    <li className="min-w-0">
      <iframe
        ref={frame}
        title={`Vista previa de ${name}`}
        className="h-64 w-full rounded-md border border-border bg-white sm:h-80"
        referrerPolicy="no-referrer"
      />
      <a ref={link} target="_blank" rel="noopener noreferrer" className="mt-2 inline-block break-all text-xs font-medium text-primary underline">
        Abrir PDF · {name}
      </a>
    </li>
  );
}

export default function ReceiptUploader({ token, imprint }: { token: string; imprint: Imprint }) {
  const pond = useRef<FilePond>(null);
  const sending = useRef(false);
  const [files, setFiles] = useState<FilePondFile[]>([]);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    if (saved && !document.querySelector('[data-order-editing="true"]')) router.refresh();
  }, [saved, router]);

  function updateFiles(items: FilePondFile[]) {
    setFiles([...items]);
    if (!sending.current && items.length && items.every((file) => file.serverId)) setSaved(true);
  }

  async function confirm() {
    const uploader = pond.current;
    const pending = uploader?.getFiles().filter((file) => !file.serverId) ?? [];
    if (!uploader || sending.current || !pending.length || pending.some((file) => !file.getMetadata("uploadId"))) return;
    sending.current = true;
    setBusy(true);
    setMessage(null);
    try {
      await Promise.allSettled(pending.map((file) => uploader.processFile(file.id)));
    } finally {
      sending.current = false;
      setBusy(false);
      updateFiles(uploader.getFiles());
    }
  }

  if (saved) return <ReceiptAcknowledgement imprint={imprint} />;
  const pending = files.filter((file) => !file.serverId);
  const ready = pending.length > 0 && pending.every((file) => file.getMetadata("uploadId"));
  const pdfPreviews = pending.filter((item) => item.getMetadata("uploadId") && item.fileType === "application/pdf" && item.file instanceof Blob);
  return <div className="receipt-pond" data-order-editing={files.length || busy ? "true" : undefined}>
    <FilePond ref={pond} credits={false} name={`comprobante-${imprint}`} allowMultiple maxFiles={8} allowReorder={!busy} itemInsertLocation="after" instantUpload={false} maxParallelUploads={1} allowProcess={false} allowRevert={false}
      allowBrowse={!busy} allowDrop={!busy} allowPaste={!busy} beforeRemoveFile={() => !sending.current}
      acceptedFileTypes={["application/pdf", "image/jpeg", "image/png"]} maxFileSize="3MB"
      labelIdle='Arrastra tu comprobante o <span class="filepond--label-action">selecciona archivos</span>'
      labelFileTypeNotAllowed="Usa PDF, JPG o PNG" fileValidateTypeLabelExpectedTypes="Formatos permitidos: PDF, JPG y PNG"
      labelMaxFileSizeExceeded="El archivo supera 3 MB" labelMaxFileSize="Máximo 3 MB"
      labelFileProcessing="Adjuntando al pedido" labelFileProcessingComplete="Adjunto · pendiente de revisión" labelFileProcessingError="No se completó la carga"
      labelTapToRetry="" labelTapToCancel="" labelTapToUndo="" labelButtonRemoveItem="Retirar archivo"
      imagePreviewMaxHeight={288}
      onupdatefiles={updateFiles} onreorderfiles={updateFiles}
      onaddfile={(error, item) => {
        if (!error) item.setMetadata("uploadId", crypto.randomUUID(), true);
        updateFiles(pond.current?.getFiles() ?? []);
      }}
      server={{ revert: null, remove: null, process: (_field, file, metadata, load, error, progress) => {
        const valid = receiptMetadataSchema.safeParse({ token, uploadId: metadata.uploadId, imprint });
        const actual = new File([file], file.name, { type: file.type });
        if (!valid.success || !receiptFileSchema.safeParse(actual).success) {
          const text = "Usa PDF, JPG o PNG de hasta 3 MB.";
          error(text);
          setMessage(text);
          return;
        }
        const data = new FormData(); data.set("token", token); data.set("uploadId", valid.data.uploadId); data.set("imprint", imprint); data.set("file", actual);
        progress(false, 0, file.size); let active = true;
        void uploadReceiptAction(data).then((result) => {
          if (!active) return;
          if (!result.success) { error(result.message); setMessage(result.message); return; }
          progress(true, file.size, file.size); load(result.receiptId);
        }).catch(() => { if (active) { const text = "No se pudo adjuntar. Conserva el archivo y vuelve a confirmar el envío."; error(text); setMessage(text); } });
        return { abort: () => { active = false; } };
      } }} />
    <p className="mt-3 text-xs leading-6 text-muted-foreground">Hasta ocho archivos PDF, JPG o PNG de hasta 3 MB cada uno. Arrástralos para ordenar la lista antes de confirmar.</p>
    {pdfPreviews.length ? <ul aria-label="Vistas previas de PDF" className="mt-3 space-y-3">
      {pdfPreviews.map((item) => <LocalPdfPreview key={item.id} file={item.file} name={item.filename} />)}
    </ul> : null}
    {files.length > 0 ? <Button type="button" className="mt-3 min-h-11" disabled={!ready || busy} onClick={() => void confirm()}>
      {busy ? "Enviando…" : "Confirmar envío de comprobantes"}
    </Button> : null}
    {message ? <p role="alert" className="mt-3 text-xs leading-6 text-destructive">{message}</p> : null}
  </div>;
}
