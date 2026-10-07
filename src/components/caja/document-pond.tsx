"use client";
import { useRef, useState } from "react";
import { FilePond, registerPlugin } from "react-filepond";
import type { FilePondInitialFile } from "filepond";
import FileValidateType from "filepond-plugin-file-validate-type";
import FileValidateSize from "filepond-plugin-file-validate-size";
import { removeSaleDraftAction, uploadSaleAction } from "@/app/caja/actions";
import { pdfSchema, uploadSaleSchema } from "@/lib/caja/validation";
registerPlugin(FileValidateType, FileValidateSize);
export type DraftPdf = { id: string; name: string; size: number; href: string };
export default function DocumentPond({ id, cycle, disabled, initialDocument, onUploaded, onRemoved, onBusy, onError }: { id: string; cycle: number; disabled: boolean; initialDocument: DraftPdf | null; onUploaded: (file: DraftPdf & { version: string }) => void; onRemoved: (version: string) => void; onBusy: (value: boolean) => void; onError: (value: string) => void }) {
  const [busy, setBusy] = useState(false);
  const links = useRef(new Map(initialDocument ? [[initialDocument.id, initialDocument.href]] : []));
  const [files, setFiles] = useState<(FilePondInitialFile | File | Blob | string)[]>(() => initialDocument ? [{ source: initialDocument.id, options: { type: "local", file: { name: initialDocument.name, size: initialDocument.size, type: "application/pdf" } } }] : []);
  function remove(source: string, load: () => void, error: (text: string) => void) {
    setBusy(true); onBusy(true);
    void removeSaleDraftAction({ id, cycle, documentId: source }).then((result) => { if (!result.success) { error(result.message); onError(result.message); return; } onRemoved(result.version); onError(""); load(); }).catch(() => { error("No se pudo retirar el borrador."); onError("Reintenta retirar el PDF."); }).finally(() => { setBusy(false); onBusy(false); });
  }
  return <div className="caja-document-pond"><FilePond files={files} onupdatefiles={(items) => setFiles(items.map((item) => typeof item.source === "string" ? { source: item.source, options: { type: "local" as const, file: { name: item.filename, size: item.fileSize, type: "application/pdf" } } } : item.source))} credits={false} disabled={disabled} allowMultiple={false} maxFiles={1} instantUpload allowRevert forceRevert allowRemove={!busy} acceptedFileTypes={["application/pdf"]} maxFileSize="3MB" labelIdle='Arrastra el PDF o <span class="filepond--label-action">selecciona un archivo</span>' labelFileTypeNotAllowed="Adjunta un PDF" fileValidateTypeLabelExpectedTypes="Formato permitido: PDF" labelMaxFileSizeExceeded="El PDF supera 3 MB" labelMaxFileSize="Máximo 3 MB" labelButtonRemoveItem="Retirar borrador" labelButtonUndoItemProcessing="Retirar borrador" labelFileProcessing="Cargando PDF" labelFileProcessingComplete="PDF adjunto · pendiente de finalizar" labelFileProcessingError="No se completó la carga" labelTapToRetry="Pulsa para reintentar" labelTapToCancel="" labelTapToUndo="Retirar borrador"
    onactivatefile={(file) => { const documentId = file.serverId || (typeof file.source === "string" ? file.source : ""); if (documentId) window.open(links.current.get(documentId) ?? `/caja/${id}/archivos/${documentId}`, "_blank", "noopener,noreferrer"); }}
    onaddfilestart={() => onBusy(true)} onaddfile={(error, item) => { if (error) { onBusy(false); onError("Adjunta un PDF de hasta 3 MB."); return; } if (typeof item.source !== "string") item.setMetadata("uploadId", crypto.randomUUID(), true); onBusy(false); onError(""); }}
    onprocessfilestart={() => { setBusy(true); onBusy(true); }} onprocessfile={(error) => { setBusy(false); onBusy(false); if (error) onError("No se completó la carga. Reintenta sin retirar el PDF."); }} onremovefile={(error) => { if (!error) { onBusy(false); onError(""); } }}
    server={{ remove, revert: remove, process: (_field, file, metadata, load, error, progress) => {
      const parsed = uploadSaleSchema.safeParse({ id, cycle, uploadId: metadata.uploadId }); const pdf = new File([file], file.name, { type: file.type });
      if (!parsed.success || !pdfSchema.safeParse(pdf).success) { error("Adjunta un PDF de hasta 3 MB."); return; }
      const data = new FormData(); data.set("id", id); data.set("cycle", String(cycle)); data.set("uploadId", parsed.data.uploadId); data.set("file", pdf);
      progress(false, 0, file.size); let resolved = false;
      void uploadSaleAction(data).then((result) => { resolved = true; if (!result.success) { error(result.message); onError(result.message); return; } links.current.set(result.documentId, result.href); progress(true, file.size, file.size); load(result.documentId); onError(""); onUploaded({ id: result.documentId, name: result.fileName, size: file.size, version: result.version, href: result.href }); }).catch(() => { resolved = true; error("No se pudo cargar el PDF."); onError("Reintenta sin retirar el archivo."); }).finally(() => { setBusy(false); onBusy(false); });
      return { abort: () => { if (!resolved) onError("La carga sigue en curso. Espera a que termine."); } };
    } }} /></div>;
}
