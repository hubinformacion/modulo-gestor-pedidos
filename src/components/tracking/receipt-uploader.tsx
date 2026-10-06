"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { FilePond, registerPlugin } from "react-filepond";
import FileValidateType from "filepond-plugin-file-validate-type";
import FileValidateSize from "filepond-plugin-file-validate-size";
import ImagePreview from "filepond-plugin-image-preview";
import { CheckCircle2 } from "lucide-react";
import { imprintNames, type Imprint } from "@/lib/orders/types";
import { receiptFileSchema, receiptMetadataSchema } from "@/lib/payments/validation";
import { uploadReceiptAction } from "@/app/seguimiento/[tracking_token]/actions";

registerPlugin(FileValidateType, FileValidateSize, ImagePreview);
export default function ReceiptUploader({ token, imprint, handlerName }: { token: string; imprint: Imprint; handlerName: string | null }) {
  const pond = useRef<FilePond>(null);
  const [busy, setBusy] = useState(0);
  const [saved, setSaved] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const router = useRouter();
  return <div className="receipt-pond" data-order-editing={busy > 0 ? "true" : undefined}>
    <FilePond ref={pond} credits={false} name={`comprobante-${imprint}`} allowMultiple maxFiles={8} instantUpload maxParallelUploads={1} allowRevert={false}
      acceptedFileTypes={["application/pdf", "image/jpeg", "image/png"]} maxFileSize="3MB" imagePreviewHeight={90}
      labelIdle={`Arrastra tu comprobante o <span class="filepond--label-action">selecciona archivos</span>`}
      labelFileTypeNotAllowed="Usa PDF, JPG o PNG" fileValidateTypeLabelExpectedTypes="Formatos permitidos: PDF, JPG y PNG"
      labelMaxFileSizeExceeded="El archivo supera 3 MB" labelMaxFileSize="Máximo 3 MB"
      labelFileProcessing="Adjuntando al pedido" labelFileProcessingComplete="Adjunto · pendiente de revisión" labelFileProcessingError="No se completó la carga"
      labelTapToRetry="Pulsa para reintentar" labelTapToCancel="" labelTapToUndo="" labelButtonRemoveItem="Retirar archivo"
      onaddfile={(error, item) => { if (!error) item.setMetadata("uploadId", crypto.randomUUID(), true); }}
      onprocessfilestart={() => setBusy((count) => count + 1)} onprocessfileabort={() => setBusy((count) => Math.max(0, count - 1))}
      onprocessfile={(error, file) => { setBusy((count) => Math.max(0, count - 1)); if (!error) { setSaved(true); setMessage(null); window.setTimeout(() => pond.current?.removeFile(file.id, { revert: false, remove: false }), 0); } }} onprocessfiles={() => router.refresh()}
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
    {saved ? <div role="status" className="mt-3 flex gap-2 rounded-lg bg-emerald-50 p-3 text-xs leading-6 text-emerald-800"><CheckCircle2 className="mt-1 size-4 shrink-0" /><p>Tu comprobante de {imprintNames[imprint]} ya está adjunto. {handlerName ? `${handlerName} lo evaluará.` : "Un gestor lo evaluará."} Te avisaremos cuando termine la revisión.</p></div> : <p className="mt-3 text-xs leading-6 text-muted-foreground">Se adjunta automáticamente. PDF, JPG o PNG de hasta 3 MB por archivo.</p>}
    {message ? <p role="alert" className="mt-3 text-xs leading-6 text-destructive">{message}</p> : null}
  </div>;
}
