"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { FilePond, registerPlugin } from "react-filepond";
import FileValidateType from "filepond-plugin-file-validate-type";
import FileValidateSize from "filepond-plugin-file-validate-size";
import { type Imprint } from "@/lib/orders/types";
import { ReceiptAcknowledgement } from "./receipt-acknowledgement";
import { receiptFileSchema, receiptMetadataSchema } from "@/lib/payments/validation";
import { uploadReceiptAction } from "@/app/seguimiento/[tracking_token]/actions";

registerPlugin(FileValidateType, FileValidateSize);
export default function ReceiptUploader({ token, imprint }: { token: string; imprint: Imprint }) {
  const pond = useRef<FilePond>(null);
  const [selected, setSelected] = useState(false);
  const [busy, setBusy] = useState(0);
  const [saved, setSaved] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const router = useRouter();
  if (saved) return <ReceiptAcknowledgement imprint={imprint} />;
  return <div className="receipt-pond" data-order-editing={selected || busy > 0 ? "true" : undefined}>
    <FilePond ref={pond} credits={false} name={`comprobante-${imprint}`} allowMultiple maxFiles={8} instantUpload maxParallelUploads={1} allowRevert={false}
      acceptedFileTypes={["application/pdf", "image/jpeg", "image/png"]} maxFileSize="3MB"
      labelIdle={`Arrastra tu comprobante o <span class="filepond--label-action">selecciona archivos</span>`}
      labelFileTypeNotAllowed="Usa PDF, JPG o PNG" fileValidateTypeLabelExpectedTypes="Formatos permitidos: PDF, JPG y PNG"
      labelMaxFileSizeExceeded="El archivo supera 3 MB" labelMaxFileSize="Máximo 3 MB"
      labelFileProcessing="Adjuntando al pedido" labelFileProcessingComplete="Adjunto · pendiente de revisión" labelFileProcessingError="No se completó la carga"
      labelTapToRetry="Pulsa para reintentar" labelTapToCancel="" labelTapToUndo="" labelButtonRemoveItem="Retirar archivo"
      onupdatefiles={(files) => setSelected(files.length > 0)}
      onaddfile={(error, item) => { if (!error) item.setMetadata("uploadId", crypto.randomUUID(), true); }}
      onprocessfilestart={() => setBusy((count) => count + 1)} onprocessfileabort={() => setBusy((count) => Math.max(0, count - 1))}
      onprocessfile={(error) => { setBusy((count) => Math.max(0, count - 1)); if (!error) setMessage(null); }}
      onprocessfiles={() => {
        const files = pond.current?.getFiles() ?? [];
        if (files.length && files.every((file) => Boolean(file.serverId))) {
          setSaved(true);
          // Another imprint may still have queued or failed files. Keep it mounted.
          window.setTimeout(() => { if (!document.querySelector('[data-order-editing="true"]')) router.refresh(); }, 0);
        }
      }}
      server={{ revert: null, remove: null, process: (_field, file, metadata, load, error, progress) => {
        const valid = receiptMetadataSchema.safeParse({ token, uploadId: metadata.uploadId, imprint });
        const actual = new File([file], file.name, { type: file.type });
        if (!valid.success || !receiptFileSchema.safeParse(actual).success) { error("Usa PDF, JPG o PNG de hasta 3 MB."); return; }
        const data = new FormData(); data.set("token", token); data.set("uploadId", valid.data.uploadId); data.set("imprint", imprint); data.set("file", actual);
        progress(false, 0, file.size); let active = true;
        void uploadReceiptAction(data).then((result) => {
          if (!active) return;
          if (!result.success) { error(result.message); setMessage(result.message); return; }
          progress(true, file.size, file.size); load(result.receiptId);
        }).catch(() => { if (active) { const text = "No se pudo adjuntar. Conserva el archivo y pulsa reintentar."; error(text); setMessage(text); } });
        return { abort: () => { active = false; } };
      } }} />
    <p className="mt-3 text-xs leading-6 text-muted-foreground">Se adjunta automáticamente. PDF, JPG o PNG de hasta 3 MB por archivo.</p>
    {message ? <p role="alert" className="mt-3 text-xs leading-6 text-destructive">{message}</p> : null}
  </div>;
}
