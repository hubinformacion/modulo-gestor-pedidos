"use client";
import { useState } from "react";
import { FilePond, registerPlugin } from "react-filepond";
import FileValidateSize from "filepond-plugin-file-validate-size";
import FileValidateType from "filepond-plugin-file-validate-type";
import { useRouter } from "next/navigation";
import { uploadTreasurySupportingAction } from "@/app/admin/treasury-actions";
registerPlugin(FileValidateSize, FileValidateType);
export default function SupportingPond({ id }: { id: string }) {
  const [busy, setBusy] = useState(false); const router = useRouter();
  return <div data-treasury-upload-busy={busy ? "true" : undefined} data-order-editing={busy ? "true" : undefined}><FilePond allowMultiple maxFiles={5} credits={false} acceptedFileTypes={["application/pdf", "image/jpeg", "image/png"]} maxFileSize="3MB" labelIdle='Arrastra documentos de subsanación o <span class="filepond--label-action">selecciona archivos</span>' onaddfilestart={() => setBusy(true)} onprocessfiles={() => { setBusy(false); router.refresh(); }} onerror={() => setBusy(false)} onremovefile={() => setBusy(false)} server={{ process: (_field, file, metadata, load, error, progress, abort) => {
    let stopped = false; const data = new FormData(); metadata.uploadId ??= crypto.randomUUID(); data.set("id", id); data.set("uploadId", String(metadata.uploadId)); data.set("file", file); progress(false, 0, file.size);
    void uploadTreasurySupportingAction(data).then((result) => { if (stopped) return; if (result.success) load(result.id); else error(result.message); }).catch(() => { if (!stopped) error("No se pudo completar la carga."); });
    return { abort: () => { stopped = true; abort(); } };
  } }} /></div>;
}
