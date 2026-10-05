"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { FilePond, registerPlugin } from "react-filepond";
import type { FilePondFile } from "filepond";
import FileValidateType from "filepond-plugin-file-validate-type";
import FileValidateSize from "filepond-plugin-file-validate-size";
import ImagePreview from "filepond-plugin-image-preview";
import { sileo } from "sileo";
import { Button } from "@/components/ui/button";
import { imprintNames, type Imprint } from "@/lib/orders/types";
import { receiptFileSchema, receiptMetadataSchema } from "@/lib/payments/validation";
import { uploadReceiptAction } from "@/app/seguimiento/[tracking_token]/actions";

registerPlugin(FileValidateType, FileValidateSize, ImagePreview);

export default function ReceiptUploader({ token, writable }: { token: string; writable: Imprint[] }) {
  const pond = useRef<FilePond>(null);
  const [files, setFiles] = useState<FilePondFile[]>([]);
  const [busy, startTransition] = useTransition();
  const router = useRouter();
  return <div>
    <FilePond ref={pond} allowMultiple maxFiles={8} instantUpload={false} maxParallelUploads={1} allowRevert={false} allowProcess={false} disabled={busy || writable.length === 0}
      acceptedFileTypes={["application/pdf", "image/jpeg", "image/png"]} maxFileSize="3MB" imagePreviewHeight={100}
      labelIdle='Arrastra tus comprobantes o <span class="filepond--label-action">selecciona archivos</span>'
      labelFileTypeNotAllowed="Usa PDF, JPG o PNG" fileValidateTypeLabelExpectedTypes="Formatos permitidos: PDF, JPG y PNG"
      labelMaxFileSizeExceeded="El archivo supera 3 MB" labelMaxFileSize="Máximo 3 MB"
      labelFileProcessing="Guardando comprobante" labelFileProcessingComplete="Comprobante guardado" labelFileProcessingError="No se completó la carga"
      labelTapToRetry="Pulsa para reintentar" labelTapToCancel="" labelTapToUndo="" labelButtonRemoveItem="Retirar archivo"
      onaddfile={(error, item) => {
        if (error) return;
        item.setMetadata("uploadId", crypto.randomUUID());
        item.setMetadata("imprint", writable.length === 1 ? writable[0] : "");
      }}
      onupdatefiles={setFiles}
      server={{ process: (_field, file, metadata, load, error, progress) => {
        const validated = receiptMetadataSchema.safeParse({ token, uploadId: metadata.uploadId, imprint: metadata.imprint });
        const actual = new File([file], file.name, { type: file.type });
        const validFile = receiptFileSchema.safeParse(actual);
        if (!validated.success || !validFile.success) { error("Asigna el sello y usa PDF, JPG o PNG de hasta 3 MB."); return; }
        const data = new FormData();
        data.set("token", token); data.set("uploadId", validated.data.uploadId); data.set("imprint", validated.data.imprint); data.set("file", actual);
        progress(false, 0, file.size);
        let active = true;
        startTransition(async () => {
          try {
            const result = await uploadReceiptAction(data);
            if (!active) return;
            if (!result.success) { error(result.message); sileo.error({ title: "No se completó la carga", description: result.message }); return; }
            progress(true, file.size, file.size); load(result.receiptId);
            sileo.success({ title: "Comprobante guardado" }); router.refresh();
          } catch { if (active) error("No se completó la carga. Reintenta con el archivo seleccionado."); }
        });
        return { abort: () => { active = false; } };
      } }} />
    {files.length ? <ul className="mt-4 space-y-3">
      {files.map((item) => <li key={item.id} className="rounded-lg border border-border p-3">
        <label htmlFor={`imprint-${item.id}`} className="mb-2 block truncate text-xs font-medium">Sello del comprobante: {item.filename}</label>
        <select id={`imprint-${item.id}`} value={String(item.getMetadata("imprint") ?? "")} disabled={busy || Boolean(item.serverId)} className="h-10 w-full rounded-lg border border-border bg-white px-3 text-xs disabled:opacity-60" onChange={(event) => { item.setMetadata("imprint", event.target.value); setFiles([...files]); }}>
          <option value="">Selecciona el sello</option>{writable.map((imprint) => <option key={imprint} value={imprint}>{imprintNames[imprint]}</option>)}
        </select>
      </li>)}
    </ul> : null}
    <Button className="mt-4 h-11" disabled={busy || !files.some((file) => !file.serverId) || files.some((file) => !file.serverId && !file.getMetadata("imprint"))} onClick={() => {
      startTransition(async () => { try { await pond.current?.processFiles(); } catch { /* FilePond retains failed files and their upload IDs. */ } });
    }}>{busy ? "Guardando…" : "Enviar comprobantes"}</Button>
    <p className="mt-3 text-xs leading-6 text-muted-foreground">PDF, JPG o PNG de hasta 3 MB por archivo. Cada comprobante se asocia a su sello. Si falla una carga, reintenta antes de retirar el archivo.</p>
  </div>;
}
