"use client";
import { FilePond, registerPlugin } from "react-filepond";
import FileValidateType from "filepond-plugin-file-validate-type";
import FileValidateSize from "filepond-plugin-file-validate-size";
registerPlugin(FileValidateType, FileValidateSize);

export default function PickupEvidencePond({ disabled, onChange, onBusyChange }: {
  disabled: boolean; onChange: (file: File | null, uploadId: string, error?: string) => void; onBusyChange: (busy: boolean) => void;
}) {
  return <FilePond name="pickup-evidence" credits={false} disabled={disabled} allowMultiple={false} maxFiles={1} allowProcess={false} instantUpload={false} allowRevert={false}
    acceptedFileTypes={["image/jpeg", "image/png"]} maxFileSize="3MB"
    labelIdle='Arrastra la foto o <span class="filepond--label-action">selecciona una imagen</span>'
    labelFileTypeNotAllowed="Usa JPG o PNG" fileValidateTypeLabelExpectedTypes="Formatos permitidos: JPG y PNG"
    labelMaxFileSizeExceeded="La imagen supera 3 MB" labelMaxFileSize="Máximo 3 MB" labelButtonRemoveItem="Retirar imagen"
    onaddfilestart={() => onBusyChange(true)}
    onaddfile={(error, item) => {
      onBusyChange(false);
      if (error) { onChange(null, "", "Selecciona un JPG o PNG de hasta 3 MB, o retira la imagen para continuar sin ella."); return; }
      const file = new File([item.file], item.filename, { type: item.fileType });
      const uploadId = crypto.randomUUID(); item.setMetadata("uploadId", uploadId, true);
      onChange(file, uploadId);
    }}
    onremovefile={() => { onBusyChange(false); onChange(null, ""); }} />;
}
