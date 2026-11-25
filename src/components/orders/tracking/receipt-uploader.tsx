"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { type FilePondFile } from "filepond";
import { FilePond, registerPlugin } from "react-filepond";
import FileValidateType from "filepond-plugin-file-validate-type";
import FileValidateSize from "filepond-plugin-file-validate-size";
import { Button } from "@/components/ui/button";
import { type Imprint } from "@/modules/orders/domain/types";
import { ReceiptAcknowledgement } from "@/components/orders/tracking/receipt-acknowledgement";
import { receiptFileSchema, receiptMetadataSchema } from "@/modules/orders/domain/receipt-upload";
import { uploadReceiptAction } from "@/app/seguimiento/[tracking_token]/actions";

registerPlugin(FileValidateType, FileValidateSize);

function LocalPreview({ name, type, url }: { name: string; type: string; url: string }) {
  if (type === "application/pdf") {
    return <>
      <iframe title={`Vista previa de ${name}`} src={url} className="h-80 w-full rounded-md border border-border bg-white" referrerPolicy="no-referrer" />
      <a href={url} target="_blank" rel="noopener noreferrer" className="mt-2 inline-block text-xs font-medium text-primary underline">Abrir PDF en otra pestaña</a>
    </>;
  }
  // eslint-disable-next-line @next/next/no-img-element -- Private local blob, never sent to an optimizer.
  return <img src={url} alt={`Vista previa de ${name}`} className="max-h-80 max-w-full rounded-md object-contain" />;
}

export default function ReceiptUploader({ token, imprint }: { token: string; imprint: Imprint }) {
  const pond = useRef<FilePond>(null);
  const sending = useRef(false);
  const [files, setFiles] = useState<FilePondFile[]>([]);
  const [preview, setPreview] = useState<{ id: string; url: string; name: string; type: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    if (saved && !document.querySelector('[data-order-editing="true"]')) router.refresh();
  }, [saved, router]);

  useEffect(() => {
    if (preview) return () => URL.revokeObjectURL(preview.url);
  }, [preview]);

  function updateFiles(items: FilePondFile[]) {
    setFiles([...items]);
    setPreview((current) => current && items.some((item) => item.id === current.id && !item.serverId) ? current : null);
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
  const previews = pending.filter((item) => item.getMetadata("uploadId") && item.file instanceof Blob);
  return <div className="receipt-pond" data-order-editing={files.length || busy ? "true" : undefined}>
    <FilePond ref={pond} credits={false} name={`comprobante-${imprint}`} allowMultiple maxFiles={8} instantUpload={false} maxParallelUploads={1} allowProcess={false} allowRevert={false}
      allowBrowse={!busy} allowDrop={!busy} allowPaste={!busy} beforeRemoveFile={() => !sending.current}
      acceptedFileTypes={["application/pdf", "image/jpeg", "image/png"]} maxFileSize="3MB"
      labelIdle='Arrastra tu comprobante o <span class="filepond--label-action">selecciona archivos</span>'
      labelFileTypeNotAllowed="Usa PDF, JPG o PNG" fileValidateTypeLabelExpectedTypes="Formatos permitidos: PDF, JPG y PNG"
      labelMaxFileSizeExceeded="El archivo supera 3 MB" labelMaxFileSize="Máximo 3 MB"
      labelFileProcessing="Adjuntando al pedido" labelFileProcessingComplete="Adjunto · pendiente de revisión" labelFileProcessingError="No se completó la carga"
      labelTapToRetry="" labelTapToCancel="" labelTapToUndo="" labelButtonRemoveItem="Retirar archivo"
      onupdatefiles={updateFiles}
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
    <p className="mt-3 text-xs leading-6 text-muted-foreground">PDF, JPG o PNG de hasta 3 MB por archivo. Revisa los archivos antes de enviarlos.</p>
    {previews.length > 0 ? <ul className="mt-3 space-y-2">{previews.map((item) => <li key={item.id} className="space-y-2">
      <button type="button" className="min-h-11 break-all text-left text-xs font-medium text-primary underline underline-offset-4"
        aria-expanded={preview?.id === item.id} onClick={() => {
          if (preview?.id === item.id) setPreview(null);
          else if (item.file instanceof Blob) setPreview({ id: item.id, url: URL.createObjectURL(item.file), name: item.filename, type: item.file.type });
        }}>
        {preview?.id === item.id ? "Cerrar vista previa" : "Previsualizar"} · {item.filename}
      </button>
      {preview?.id === item.id ? <LocalPreview name={preview.name} type={preview.type} url={preview.url} /> : null}
    </li>)}</ul> : null}
    {files.length > 0 ? <Button type="button" className="mt-3 min-h-11" disabled={!ready || busy} onClick={() => void confirm()}>
      {busy ? "Enviando…" : "Confirmar envío de comprobantes"}
    </Button> : null}
    {message ? <p role="alert" className="mt-3 text-xs leading-6 text-destructive">{message}</p> : null}
  </div>;
}
