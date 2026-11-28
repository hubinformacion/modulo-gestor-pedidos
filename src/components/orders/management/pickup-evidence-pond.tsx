"use client";

import { useState } from "react";
import { CheckCircle2 } from "lucide-react";
import { entryIsLoading, OrderFilePond, storeStatus } from "@/components/orders/filepond";
import { AttachmentPreview } from "@/components/orders/management/attachment-preview";
import { pickupImageSchema, pickupUploadSchema } from "@/modules/orders/domain/management";
import { uploadPickupEvidenceAction } from "@/app/admin/operations";

export default function PickupEvidencePond({ id, version, disabled, existingEvidenceId, onUploaded, onBusyChange, onErrorChange }: {
  id: string; version: string; disabled: boolean; existingEvidenceId: string | null;
  onUploaded: (id: string) => void; onBusyChange: (busy: boolean) => void; onErrorChange: (error: string) => void;
}) {
  const [uploading, setUploading] = useState(false);

  async function save(image: File, uploadId: string) {
    if (!pickupUploadSchema.safeParse({ id, version, uploadId }).success || !pickupImageSchema.safeParse(image).success) {
      const message = "Usa JPG o PNG de hasta 3 MB.";
      onErrorChange(message);
      throw new Error(message);
    }
    onErrorChange("");
    const data = new FormData();
    data.set("id", id);
    data.set("version", version);
    data.set("uploadId", uploadId);
    data.set("image", image);
    const result = await uploadPickupEvidenceAction(data).catch(() => null);
    if (!result?.success) {
      const message = result?.message ?? "No se pudo adjuntar. Reintenta sin retirar la imagen.";
      onErrorChange(message);
      throw new Error(message);
    }
    onUploaded(result.evidenceId);
    setUploading(false);
    onBusyChange(false);
    return result.evidenceId;
  }

  if (existingEvidenceId) return <>
    <p role="status" className="flex items-center gap-2 text-xs text-emerald-700"><CheckCircle2 aria-hidden="true" className="size-4" />Imagen adjunta.</p>
    <AttachmentPreview kind="evidencia" orderId={id} fileId={existingEvidenceId} name="Evidencia de entrega" />
  </>;

  return <>
    <OrderFilePond name="pickup-evidence" locked={disabled || uploading} label="Adjuntar evidencia de entrega"
      accept="image/jpeg,image/png" describedBy="pickup-evidence-formats" save={save} onentrieschange={({ detail }) => {
        const busy = detail.some((entry) => entryIsLoading(entry) || ["STORE_QUEUED", "STORE_BUSY"].includes(storeStatus(entry) ?? ""));
        setUploading(busy);
        onBusyChange(busy);
        if (!detail.length) onErrorChange("");
      }} />
    <p id="pickup-evidence-formats" className="mt-2 text-xs text-muted-foreground">JPG o PNG · hasta 3 MB.</p>
  </>;
}
