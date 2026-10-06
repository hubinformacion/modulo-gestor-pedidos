"use client";
import { useState } from "react";
import { FilePond, registerPlugin } from "react-filepond";
import FileValidateType from "filepond-plugin-file-validate-type";
import FileValidateSize from "filepond-plugin-file-validate-size";
import { CheckCircle2 } from "lucide-react";
import { pickupImageSchema, pickupUploadSchema } from "@/lib/admin/validation";
import { uploadPickupEvidenceAction } from "@/app/admin/operations";
registerPlugin(FileValidateType, FileValidateSize);

export default function PickupEvidencePond({ id, version, disabled, existingEvidenceId, onUploaded, onBusyChange, onErrorChange }: {
  id: string; version: string; disabled: boolean; existingEvidenceId: string | null;
  onUploaded: (id: string) => void; onBusyChange: (busy: boolean) => void; onErrorChange: (error: string) => void;
}) {
  const [uploading, setUploading] = useState(false);
  if (existingEvidenceId) return <p role="status" className="flex items-center gap-2 text-xs text-emerald-700"><CheckCircle2 className="size-4" />Imagen adjunta.</p>;
  return <><FilePond name="pickup-evidence" credits={false} disabled={disabled} allowMultiple={false} maxFiles={1} instantUpload allowRevert={false} allowRemove={!uploading}
    acceptedFileTypes={["image/jpeg", "image/png"]} maxFileSize="3MB"
    labelIdle='Arrastra la foto o <span class="filepond--label-action">selecciona una imagen</span>'
    labelFileTypeNotAllowed="Usa JPG o PNG" fileValidateTypeLabelExpectedTypes="Formatos permitidos: JPG y PNG"
    labelMaxFileSizeExceeded="La imagen supera 3 MB" labelMaxFileSize="Máximo 3 MB" labelButtonRemoveItem="Retirar imagen"
    labelFileProcessing="Adjuntando imagen" labelFileProcessingComplete="Imagen adjunta" labelFileProcessingError="No se completó la carga"
    labelTapToRetry="Pulsa para reintentar" labelTapToCancel="" labelTapToUndo=""
    onaddfilestart={() => onBusyChange(true)}
    onaddfile={(error, item) => {
      if (error) { onBusyChange(false); onErrorChange("Usa JPG o PNG de hasta 3 MB."); return; }
      item.setMetadata("uploadId", crypto.randomUUID(), true); onErrorChange("");
    }}
    onprocessfilestart={() => { setUploading(true); onBusyChange(true); }}
    onprocessfile={(error, item) => {
      setUploading(false); onBusyChange(false);
      if (error) onErrorChange("No se completó la carga. Reintenta o retira la imagen.");
      else { onErrorChange(""); onUploaded(item.serverId); }
    }}
    onremovefile={() => { onBusyChange(false); onErrorChange(""); }}
    server={{ revert: null, remove: null, process: (_field, file, metadata, load, error, progress) => {
      const valid = pickupUploadSchema.safeParse({ id, version, uploadId: metadata.uploadId });
      const image = new File([file], file.name, { type: file.type });
      if (!valid.success || !pickupImageSchema.safeParse(image).success) { error("Usa JPG o PNG de hasta 3 MB."); return; }
      const data = new FormData(); data.set("id", id); data.set("version", version); data.set("uploadId", valid.data.uploadId); data.set("image", image);
      progress(false, 0, file.size);
      let resolved = false;
      void uploadPickupEvidenceAction(data).then((result) => {
        resolved = true;
        if (!result.success) { error(result.message); onErrorChange(result.message); return; }
        onErrorChange(""); progress(true, file.size, file.size); load(result.evidenceId); onUploaded(result.evidenceId);
      }).catch(() => { resolved = true; const message = "No se pudo adjuntar. Reintenta sin retirar la imagen."; error(message); onErrorChange(message); }).finally(() => { setUploading(false); onBusyChange(false); });
      // Server Actions cannot cancel a committed upload. Keep closing blocked
      // until the request resolves even if the FilePond processing is aborted.
      return { abort: () => { if (!resolved) onErrorChange("La carga sigue en curso. Espera a que termine."); } };
    } }} />
    <p className="mt-2 text-[10px] text-muted-foreground">JPG o PNG · hasta 3 MB.</p></>;
}
