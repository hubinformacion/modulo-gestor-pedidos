"use client";
import { useEffect, useRef, useState } from "react";
import { FilePond, registerPlugin } from "react-filepond";
import FileValidateType from "filepond-plugin-file-validate-type";
import FileValidateSize from "filepond-plugin-file-validate-size";
import { removeSaleDraftAction, uploadSaleAction } from "@/app/tesoreria-recaudacion/actions";
import { saleFileSchema, uploadSaleSchema, type SaleFormat } from "@/modules/treasury/domain/documents";
registerPlugin(FileValidateType, FileValidateSize);
export type DraftSaleFile = { id: string; name: string; size: number };
export default function DocumentPond({ id, cycle, format, disabled, locked, initialDocument, onUploaded, onRemoved, onBusy, onError }: { id: string; cycle: number; format: SaleFormat; disabled: boolean; locked: boolean; initialDocument: DraftSaleFile | null; onUploaded: (file: DraftSaleFile & { version: string }) => void; onRemoved: (version: string) => void; onBusy: (value: boolean) => void; onError: (value: string) => void }) {
  const label = format.toUpperCase();
  const types = format === "pdf" ? ["application/pdf"] : [".xml", "application/xml", "text/xml"];
  const pond = useRef<FilePond>(null);
  const uploading = useRef(false);
  const removal = useRef<Promise<boolean> | null>(null);
  const [processing, setProcessing] = useState(false);
  useEffect(() => {
    if (initialDocument && pond.current && !pond.current.getFiles().length) {
      void pond.current.addFile(initialDocument.id, { type: "local", file: { name: initialDocument.name, size: initialDocument.size, type: format === "pdf" ? "application/pdf" : "application/xml" } }).catch(() => { onError("No pudimos mostrar el borrador. Actualiza la solicitud."); onBusy(false); });
    }
  }, [initialDocument, format, onBusy, onError]);
  return <div className="caja-document-pond"><FilePond ref={pond} credits={false} disabled={disabled} allowBrowse={!locked} allowDrop={!locked} allowPaste={false} allowMultiple={false} maxFiles={1} allowReplace={false} instantUpload allowRevert forceRevert allowRemove={!processing}
    beforeRemoveFile={(file) => {
      if (uploading.current || locked || disabled) return false;
      if (removal.current) return removal.current;
      const documentId = file.serverId || (typeof file.source === "string" ? file.source : "");
      if (!documentId) return true;
      onBusy(true);
      removal.current = removeSaleDraftAction({ id, cycle, documentId, format }).then((result) => { if (!result.success) { onError(result.message); return false; } onRemoved(result.version); onError(""); return true; }).catch(() => { onError("No pudimos retirar el borrador. Pulsa retirar para reintentar."); return false; }).finally(() => { removal.current = null; onBusy(false); });
      return removal.current;
    }}
    acceptedFileTypes={types} allowFileTypeValidation={format === "pdf"} maxFileSize="3MB"
    labelIdle={`Arrastra el ${label} o <span class="filepond--label-action">selecciona un archivo</span>`}
    labelFileTypeNotAllowed={`Adjunta un ${label}`} fileValidateTypeLabelExpectedTypes={`Formato permitido: ${label}`}
    labelMaxFileSizeExceeded={`El ${label} supera 3 MB`} labelMaxFileSize="Máximo 3 MB"
    labelButtonRemoveItem="Retirar borrador" labelButtonUndoItemProcessing="Retirar borrador"
    labelFileProcessing={`Cargando ${label}`} labelFileProcessingComplete={`${label} adjunto · pendiente de finalizar`}
    labelFileProcessingError="No se completó la carga" labelTapToRetry="Pulsa para reintentar" labelTapToCancel="" labelTapToUndo="Retirar borrador"
    onaddfilestart={() => onBusy(true)} onaddfile={(error, item) => {
      if (error) { onBusy(false); onError(`Adjunta un ${label} de hasta 3 MB.`); return; }
      if (typeof item.source !== "string") item.setMetadata("uploadId", crypto.randomUUID(), true);
      else onBusy(false);
      onError("");
    }}
    onremovefile={(error) => { if (!error) onError(""); }}
    onprocessfilestart={() => { uploading.current = true; setProcessing(true); onBusy(true); }}
    onprocessfile={() => { uploading.current = false; setProcessing(false); onBusy(false); }}
    server={{ remove: (_source, load) => load(), revert: (_source, load) => load(), process: (_field, file, metadata, load, error, progress) => {
      const parsed = uploadSaleSchema.safeParse({ id, cycle, format, uploadId: metadata.uploadId }); const actual = new File([file], file.name, { type: file.type });
      if (!parsed.success || !saleFileSchema.safeParse(actual).success || !file.name.toLowerCase().endsWith(`.${format}`)) {
        const message = `Adjunta un ${label} de hasta 3 MB.`;
        error(message);
        onError(message);
        return;
      }
      const data = new FormData(); data.set("id", id); data.set("cycle", String(cycle)); data.set("uploadId", parsed.data.uploadId); data.set("format", format); data.set("file", actual);
      progress(false, 0, file.size); let resolved = false;
      void uploadSaleAction(data).then((result) => { resolved = true; if (!result.success) { error(result.message); onError(result.message); return; } progress(true, file.size, file.size); load(result.documentId); onError(""); onUploaded({ id: result.documentId, name: result.fileName, size: file.size, version: result.version }); }).catch(() => { resolved = true; error(`No se pudo cargar el ${label}.`); onError("Reintenta sin retirar el archivo."); }).finally(() => { uploading.current = false; setProcessing(false); onBusy(false); });
      return { abort: () => { if (!resolved) onError("La carga sigue en curso. Espera a que termine."); } };
    } }} /></div>;
}
