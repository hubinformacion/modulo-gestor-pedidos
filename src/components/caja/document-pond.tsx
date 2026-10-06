"use client";
import { useState } from "react";
import { FilePond, registerPlugin } from "react-filepond";
import FileValidateType from "filepond-plugin-file-validate-type";
import FileValidateSize from "filepond-plugin-file-validate-size";
import { uploadSaleAction } from "@/app/caja/actions";
import { pdfSchema, uploadSaleSchema } from "@/lib/caja/validation";
registerPlugin(FileValidateType, FileValidateSize);
export default function DocumentPond({ id, cycle, disabled, onUploaded, onBusy, onError }: { id: string; cycle: number; disabled: boolean; onUploaded: (file: { id: string; name: string; version: string }) => void; onBusy: (value: boolean) => void; onError: (value: string) => void }) {
  const [uploading, setUploading] = useState(false);
  return <FilePond credits={false} disabled={disabled} allowMultiple={false} maxFiles={1} instantUpload allowRevert={false} allowRemove={!uploading} acceptedFileTypes={["application/pdf"]} maxFileSize="3MB" labelIdle='Arrastra el PDF o <span class="filepond--label-action">selecciona un archivo</span>' labelFileTypeNotAllowed="Adjunta un PDF" fileValidateTypeLabelExpectedTypes="Formato permitido: PDF" labelMaxFileSizeExceeded="El PDF supera 3 MB" labelMaxFileSize="Máximo 3 MB" labelButtonRemoveItem="Retirar archivo" labelFileProcessing="Cargando PDF" labelFileProcessingComplete="PDF adjunto" labelFileProcessingError="No se completó la carga" labelTapToRetry="Pulsa para reintentar" labelTapToCancel="" labelTapToUndo=""
    onaddfilestart={() => onBusy(true)} onaddfile={(error, item) => { if (error) { onBusy(false); onError("Adjunta un PDF de hasta 3 MB."); return; } item.setMetadata("uploadId", crypto.randomUUID(), true); onError(""); }}
    onprocessfilestart={() => { setUploading(true); onBusy(true); }} onprocessfile={(error) => { setUploading(false); onBusy(false); if (error) onError("No se completó la carga. Reintenta sin retirar el PDF."); }} onremovefile={() => { onBusy(false); onError(""); }}
    server={{ revert: null, remove: null, process: (_field, file, metadata, load, error, progress) => {
      const parsed = uploadSaleSchema.safeParse({ id, cycle, uploadId: metadata.uploadId }); const pdf = new File([file], file.name, { type: file.type });
      if (!parsed.success || !pdfSchema.safeParse(pdf).success) { error("Adjunta un PDF de hasta 3 MB."); return; }
      const data = new FormData(); data.set("id", id); data.set("cycle", String(cycle)); data.set("uploadId", parsed.data.uploadId); data.set("file", pdf);
      progress(false, 0, file.size); let resolved = false;
      void uploadSaleAction(data).then((result) => { resolved = true; if (!result.success) { error(result.message); onError(result.message); return; } progress(true, file.size, file.size); load(result.documentId); onError(""); onUploaded({ id: result.documentId, name: result.fileName, version: result.version }); }).catch(() => { resolved = true; error("No se pudo cargar el PDF."); onError("Reintenta sin retirar el archivo."); }).finally(() => { setUploading(false); onBusy(false); });
      return { abort: () => { if (!resolved) onError("La carga sigue en curso. Espera a que termine."); } };
    } }} />;
}
