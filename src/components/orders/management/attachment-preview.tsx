import { PdfPreview } from "@/components/orders/pdf-preview";

export function AttachmentPreview({ orderId, fileId, name, kind, mimeType }: {
  orderId: string;
  fileId: string;
  name: string;
  kind: "comprobante" | "evidencia" | "documento";
  mimeType?: string | null;
}) {
  const url = `/admin/pedidos/${orderId}/vista-previa/${kind}/${fileId}`;
  if (mimeType === "application/pdf") return <PdfPreview name={name} url={url} />;
  if (kind !== "evidencia" && mimeType !== "image/jpeg" && mimeType !== "image/png") return null;
  // eslint-disable-next-line @next/next/no-img-element -- Keep private media behind the current user's authenticated request.
  return <img src={url} alt={`Vista previa de ${name}`} loading="lazy" className="mt-2 max-h-72 w-full rounded-md border border-border object-contain" />;
}
