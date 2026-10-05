"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { FilePond, registerPlugin } from "react-filepond";
import { FileStatus, type FilePondFile } from "filepond";
import FileValidateType from "filepond-plugin-file-validate-type";
import FileValidateSize from "filepond-plugin-file-validate-size";
import ImagePreview from "filepond-plugin-image-preview";
import { sileo } from "sileo";
import { Button } from "@/components/ui/button";
import { imprintNames, type Imprint } from "@/lib/orders/types";
import { confirmReceiptSchema, receiptFileSchema, receiptMetadataSchema } from "@/lib/payments/validation";
import { confirmReceiptAction, uploadReceiptAction } from "@/app/seguimiento/[tracking_token]/actions";

registerPlugin(FileValidateType, FileValidateSize, ImagePreview);

export default function ReceiptUploader({ token, imprint, hasUnconfirmedReceipt }: { token: string; imprint: Imprint; hasUnconfirmedReceipt: boolean }) {
  const [files, setFiles] = useState<FilePondFile[]>([]);
  const [hasSavedFile, setHasSavedFile] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [confirming, startTransition] = useTransition();
  const router = useRouter();
  const hasUnfinishedFiles = files.some((file) => file.status !== FileStatus.PROCESSING_COMPLETE);
  const canConfirm = (hasUnconfirmedReceipt || hasSavedFile) && !hasUnfinishedFiles;
  return <div>
    <FilePond name={`comprobante-${imprint}`} allowMultiple maxFiles={8} instantUpload maxParallelUploads={1} allowRevert={false} disabled={confirming}
      acceptedFileTypes={["application/pdf", "image/jpeg", "image/png"]} maxFileSize="3MB" imagePreviewHeight={90}
      labelIdle={`Arrastra el comprobante de ${imprintNames[imprint]} o <span class="filepond--label-action">selecciona archivos</span>`}
      labelFileTypeNotAllowed="Usa PDF, JPG o PNG" fileValidateTypeLabelExpectedTypes="Formatos permitidos: PDF, JPG y PNG"
      labelMaxFileSizeExceeded="El archivo supera 3 MB" labelMaxFileSize="Máximo 3 MB"
      labelFileProcessing="Cargando comprobante" labelFileProcessingComplete="Archivo cargado" labelFileProcessingError="No se completó la carga"
      labelTapToRetry="Pulsa para reintentar" labelTapToCancel="" labelTapToUndo="" labelButtonRemoveItem="Retirar archivo"
      onaddfile={(error, item) => { if (!error) item.setMetadata("uploadId", crypto.randomUUID(), true); }}
      onupdatefiles={setFiles}
      onprocessfile={(error) => { setFiles((current) => [...current]); if (!error) { setHasSavedFile(true); setMessage(null); router.refresh(); } }}
      server={{ process: (_field, file, metadata, load, error, progress) => {
        const validated = receiptMetadataSchema.safeParse({ token, uploadId: metadata.uploadId, imprint });
        const actual = new File([file], file.name, { type: file.type });
        if (!validated.success || !receiptFileSchema.safeParse(actual).success) { error("Usa PDF, JPG o PNG de hasta 3 MB."); return; }
        const data = new FormData();
        data.set("token", token); data.set("uploadId", validated.data.uploadId); data.set("imprint", imprint); data.set("file", actual);
        progress(false, 0, file.size);
        let active = true;
        void uploadReceiptAction(data).then((result) => {
          if (!active) return;
          if (!result.success) { error(result.message); setMessage(result.message); return; }
          progress(true, file.size, file.size); load(result.receiptId);
        }).catch(() => { if (active) { const message = "No se completó la carga. Reintenta con el archivo seleccionado."; error(message); setMessage(message); } });
        return { abort: () => { active = false; } };
      } }} />
    <p className="mt-3 text-xs leading-6 text-muted-foreground">El archivo se carga al adjuntarlo. PDF, JPG o PNG de hasta 3 MB. Confirma cuando estén cargados todos los comprobantes de este sello.</p>
    <Button type="button" className="mt-4 h-10 px-4" disabled={confirming || !canConfirm} onClick={() => {
      const parsed = confirmReceiptSchema.safeParse({ token, imprint });
      if (!parsed.success) { setMessage("El enlace del pedido no es válido."); return; }
      setMessage(null);
      startTransition(async () => {
        try {
          const result = await confirmReceiptAction(parsed.data);
          if (!result.success) { setMessage(result.message); sileo.error({ title: result.message }); return; }
          setHasSavedFile(false); sileo.success({ title: result.message }); router.refresh();
        } catch { setMessage("No se pudo confirmar. Los archivos permanecen guardados; reintenta."); }
      });
    }}>{confirming ? "Confirmando…" : "Confirmar envío para revisión"}</Button>
    {message ? <p role="alert" className="mt-3 text-xs leading-6 text-destructive">{message}</p> : null}
  </div>;
}
