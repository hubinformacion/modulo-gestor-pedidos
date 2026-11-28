"use client";

import { useMemo, useRef, useState } from "react";
import type { FilePondElement, FilePondEntrySource } from "filepond";
import { entryIsLoading, OrderFilePond, storeStatus } from "@/components/orders/filepond";
import { Button } from "@/components/ui/button";
import { removeSaleDraftAction, uploadSaleAction } from "@/app/admin/sale-document-actions";
import { saleFileSchema, uploadSaleSchema, type SaleFormat } from "@/modules/orders/domain/sale-documents";

export type DraftSaleFile = { id: string; name: string; size: number; url: string };

export default function DocumentPond({ id, orderId, cycle, format, disabled, locked, initialDocument, onUploaded, onRemoved, onBusy, onError }: {
  id: string;
  orderId: string;
  cycle: number;
  format: SaleFormat;
  disabled: boolean;
  locked: boolean;
  initialDocument: DraftSaleFile | null;
  onUploaded: (file: DraftSaleFile & { version: string }) => void;
  onRemoved: (version: string) => void;
  onBusy: (value: boolean) => void;
  onError: (value: string) => void;
}) {
  const label = format.toUpperCase();
  const pond = useRef<FilePondElement>(null);
  const saving = useRef(false);
  const removing = useRef(false);
  const [busy, setBusy] = useState(false);
  const [draft, setDraft] = useState(initialDocument);
  const entries = useMemo<FilePondEntrySource[]>(() => {
    if (!initialDocument) return [];
    const { id, name, size } = initialDocument;
    return [{
      id, name, size,
      src: format === "pdf"
        ? `/admin/pedidos/${orderId}/vista-previa/documento/${id}`
        : new File([], name, { type: "application/xml" }),
      state: { value: id },
    }];
  }, [initialDocument, orderId, format]);

  function changeBusy(value: boolean) {
    setBusy(value);
    onBusy(value);
  }

  async function save(file: File, uploadId: string) {
    if (!uploadSaleSchema.safeParse({ id, cycle, format, uploadId }).success ||
      !saleFileSchema.safeParse(file).success || !file.name.toLowerCase().endsWith(`.${format}`)) {
      const message = `Adjunta un ${label} de hasta 3 MB.`;
      onError(message);
      throw new Error(message);
    }
    saving.current = true;
    changeBusy(true);
    onError("");
    const data = new FormData();
    data.set("id", id);
    data.set("cycle", String(cycle));
    data.set("uploadId", uploadId);
    data.set("format", format);
    data.set("file", file);
    try {
      const result = await uploadSaleAction(data).catch(() => null);
      if (!result?.success) {
        const message = result?.message ?? `No se pudo cargar el ${label}. Reintenta sin retirar el archivo.`;
        onError(message);
        throw new Error(message);
      }
      const saved = { id: result.documentId, name: result.fileName, size: file.size, url: result.driveViewUrl };
      setDraft(saved);
      onUploaded({ ...saved, version: result.version });
      return result.documentId;
    } finally {
      saving.current = false;
      changeBusy(false);
    }
  }

  async function remove() {
    if (!draft || locked || disabled || saving.current || removing.current) return;
    removing.current = true;
    changeBusy(true);
    try {
      const result = await removeSaleDraftAction({ id, cycle, documentId: draft.id, format }).catch(() => null);
      if (!result?.success) {
        onError(result?.message ?? "No pudimos retirar el borrador. Vuelve a intentarlo.");
        return;
      }
      const uploader = pond.current;
      uploader?.removeEntries(...uploader.currentEntries.map(({ id }) => id));
      setDraft(null);
      onRemoved(result.version);
      onError("");
    } finally {
      removing.current = false;
      changeBusy(false);
    }
  }

  return <>
    <OrderFilePond ref={pond} locked={disabled || locked || busy || Boolean(draft)} accept={format === "pdf" ? "application/pdf" : ".xml"}
      label={`Adjuntar ${label}`} entries={entries} save={save} onentrieschange={({ detail }) => {
        if (saving.current || removing.current) return;
        const working = detail.some((entry) => !entry.state.value &&
          (entryIsLoading(entry) || ["STORE_QUEUED", "STORE_BUSY"].includes(storeStatus(entry) ?? "")));
        changeBusy(working);
        if (!detail.length) onError("");
      }} />
    {draft ? <Button type="button" variant="ghost" size="sm" className="mt-1 px-2" disabled={disabled || locked || busy} onClick={() => void remove()}>
      Retirar borrador
    </Button> : null}
  </>;
}
