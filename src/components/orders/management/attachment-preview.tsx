import { StoredAttachmentPreview } from "@/components/orders/stored-attachment-preview";

export function AttachmentPreview({ orderId, fileId, name, kind, mimeType }: {
  orderId: string;
  fileId: string;
  name: string;
  kind: "comprobante" | "evidencia" | "documento";
  mimeType?: string | null;
}) {
  if (kind !== "evidencia" && mimeType !== "application/pdf" && mimeType !== "image/jpeg" && mimeType !== "image/png") return null;
  const url = `/admin/pedidos/${orderId}/vista-previa/${kind}/${fileId}`;
  return <StoredAttachmentPreview url={url} name={name} />;
}
