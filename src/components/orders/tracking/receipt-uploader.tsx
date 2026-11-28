"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { type FilePondElement, type FilePondEntry } from "filepond";
import { canStoreEntry, OrderFilePond, storeStatus } from "@/components/orders/filepond";
import { Button } from "@/components/ui/button";
import { type Imprint } from "@/modules/orders/domain/types";
import { ReceiptAcknowledgement } from "@/components/orders/tracking/receipt-acknowledgement";
import { receiptFileSchema, receiptMetadataSchema } from "@/modules/orders/domain/receipt-upload";
import { uploadReceiptAction } from "@/app/seguimiento/[tracking_token]/actions";

export default function ReceiptUploader({ token, imprint }: { token: string; imprint: Imprint }) {
  const pond = useRef<FilePondElement>(null);
  const sending = useRef(new Set<string>());
  const [files, setFiles] = useState<FilePondEntry[]>([]);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const router = useRouter();
  const hintId = `comprobante-${imprint}-formatos`;

  useEffect(() => {
    if (saved && !document.querySelector('[data-order-editing="true"]')) router.refresh();
  }, [saved, router]);

  function updateFiles(items: FilePondEntry[]) {
    setFiles(items);
    for (const entry of items) {
      if (entry.state.value || storeStatus(entry) === "STORE_ERROR") sending.current.delete(entry.id);
    }
    if (!sending.current.size) {
      setBusy(false);
      if (items.length && items.every((entry) => entry.state.value)) setSaved(true);
    }
  }

  function confirm() {
    const uploader = pond.current;
    const pending = uploader?.currentEntries.filter((entry) => !entry.state.value) ?? [];
    if (!uploader || sending.current.size || !pending.length || !pending.every(canStoreEntry)) return;
    sending.current = new Set(pending.map(({ id }) => id));
    setMessage(null);
    setBusy(true);
    for (const { id } of pending) uploader.updateEntry(id, { state: { store: true, abort: false } });
  }

  async function save(file: File, uploadId: string) {
    try {
      if (!receiptMetadataSchema.safeParse({ token, uploadId, imprint }).success || !receiptFileSchema.safeParse(file).success) {
        throw new Error("Usa PDF, JPG o PNG de hasta 3 MB.");
      }
      const data = new FormData();
      data.set("token", token);
      data.set("uploadId", uploadId);
      data.set("imprint", imprint);
      data.set("file", file);
      const result = await uploadReceiptAction(data);
      if (!result.success) throw new Error(result.message);
      return result.receiptId;
    } catch (error) {
      const text = error instanceof Error && error.message ? error.message : "No se pudo adjuntar. Vuelve a confirmar el envío.";
      setMessage(text);
      throw new Error(text);
    }
  }

  if (saved) return <ReceiptAcknowledgement imprint={imprint} />;
  const pending = files.filter((entry) => !entry.state.value);
  const ready = pending.length > 0 && pending.every(canStoreEntry);
  return <div data-order-editing={files.length || busy ? "true" : undefined}>
    <OrderFilePond ref={pond} mode="batch" locked={busy} name={`comprobante-${imprint}`} label="Adjuntar comprobantes de pago"
      accept="application/pdf,image/jpeg,image/png" describedBy={hintId} onentrieschange={({ detail }) => updateFiles(detail)} save={save} />
    <p id={hintId} className="mt-2 text-xs leading-5 text-muted-foreground">Hasta ocho archivos PDF, JPG o PNG de 3 MB cada uno. Arrástralos para ordenar la lista antes de confirmar.</p>
    {files.length > 0 ? <Button type="button" className="mt-3 min-h-11" disabled={!ready || busy} onClick={confirm}>
      {busy ? "Enviando…" : "Confirmar envío de comprobantes"}
    </Button> : null}
    {message ? <p role="alert" className="mt-3 text-xs leading-6 text-destructive">{message}</p> : null}
  </div>;
}
