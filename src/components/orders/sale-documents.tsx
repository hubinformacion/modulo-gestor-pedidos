import "server-only";
import { ReceiptText } from "lucide-react";
import { ImprintBadge } from "@/components/catalog/imprint-badge";
import { AttachmentPreview } from "@/components/orders/management/attachment-preview";
import { ReviseSaleControls, SaleDocumentControls } from "@/components/orders/sale-document-controls";
import { DetailCardHeading } from "@/components/workspace/detail-card-heading";
import type { AuthorizedActor } from "@/modules/access/domain/policy";
import { adminSaleDocuments } from "@/modules/orders/data/sale-documents";
import { previousSaleDocuments } from "@/modules/orders/domain/sale-document-history";
import { saleIssuanceLabels } from "@/modules/orders/domain/sale-documents";

const dates = new Intl.DateTimeFormat("es-PE", { dateStyle: "medium", timeStyle: "short", timeZone: "America/Lima" });

export async function AdminSaleDocuments({ orderId, actor, invoice }: { orderId: string; actor: AuthorizedActor; invoice: boolean }) {
  const { issuances, documents, confirmedIds, canEdit } = await adminSaleDocuments(orderId, actor);
  return <section className="rounded-xl border border-border p-4 sm:p-5">
    <DetailCardHeading icon={ReceiptText} title="Boletas y facturas" aside={<span className="rounded-md bg-secondary px-3 py-1.5 text-xs font-semibold text-primary">{invoice ? "Factura" : "Boleta"}</span>} />
    {!issuances.length ? <p className="text-xs text-muted-foreground">La carga de documentos se habilita al verificar el pago del sello.</p> : <div className="divide-y divide-border">
      {issuances.map((issuance) => {
        const files = documents.filter((file) => file.issuanceId === issuance.id);
        const issuedIds = [issuance.finalizedDocumentId, issuance.finalizedXmlDocumentId];
        const draftIds = [issuance.draftDocumentId, issuance.draftXmlDocumentId];
        const issued = files.filter((file) => issuedIds.includes(file.id));
        const closed = issuance.status === "FINALIZADA" || issuance.status === "ANULADA";
        const version = issuance.updatedAt.toISOString();
        const initialFile = (id: string | null) => {
          const file = files.find((candidate) => candidate.id === id);
          return file?.driveViewUrl ? { id: file.id, name: file.fileName, size: file.size, url: file.driveViewUrl } : null;
        };
        const history = previousSaleDocuments(files, issuance.cycle, [...issuedIds, ...draftIds], confirmedIds, issuedIds);
        return <div key={issuance.id} className="py-4 first:pt-0 last:pb-0">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <ImprintBadge imprint={issuance.publisherImprint} />
            <span className="text-xs font-semibold text-muted-foreground">{saleIssuanceLabels[issuance.status]}</span>
          </div>
          {issued.length ? <>
            <ul className="mt-3 space-y-2">
              {issued.map((file) => <li key={file.id}>
                <a href={file.driveViewUrl!} target="_blank" rel="noopener noreferrer" className="break-words text-xs font-medium text-primary underline underline-offset-4">{file.fileName}</a>
                <AttachmentPreview kind="documento" orderId={orderId} fileId={file.id} name={file.fileName} mimeType={file.mimeType} />
              </li>)}
            </ul>
            {issuance.finalizedAt ? <p className="mt-2 text-xs text-muted-foreground">Publicado {dates.format(issuance.finalizedAt)} · {issuance.finalizedBy}</p> : null}
          </> : null}
          {issuance.status === "DEVUELTA" && issuance.returnReason ? <p className="mt-3 whitespace-pre-wrap break-words rounded-md bg-amber-50 p-3 text-xs leading-6 text-amber-900">{issuance.returnReason}</p> : null}
          {canEdit && !closed ? <SaleDocumentControls key={version} id={issuance.id} orderId={orderId} cycle={issuance.cycle} initialVersion={version} initialDocument={initialFile(issuance.draftDocumentId)} initialXml={initialFile(issuance.draftXmlDocumentId)} /> : null}
          {!canEdit && !closed ? <div className="mt-3 space-y-2">
            {files.filter((file) => draftIds.includes(file.id)).map((file) => <div key={file.id}>
              <p className="break-words text-xs"><a href={file.driveViewUrl!} target="_blank" rel="noopener noreferrer" className="text-primary underline underline-offset-4">{file.fileName}</a> · Borrador</p>
              <AttachmentPreview kind="documento" orderId={orderId} fileId={file.id} name={file.fileName} mimeType={file.mimeType} />
            </div>)}
            <p className="text-xs text-muted-foreground">La carga está a cargo del gestor responsable.</p>
          </div> : null}
          {canEdit && issuance.status === "FINALIZADA" ? <ReviseSaleControls id={issuance.id} version={version} /> : null}
          {history.length ? <details className="mt-4">
            <summary className="cursor-pointer text-xs font-medium text-muted-foreground">Archivos anteriores</summary>
            <ul className="mt-2 space-y-2">
              {history.map((file) => <li key={file.id}>
                <a href={file.driveViewUrl!} target="_blank" rel="noopener noreferrer" className="break-words text-xs text-primary underline underline-offset-4">{file.fileName}</a>
                <p className="text-xs text-muted-foreground">{dates.format(file.uploadedAt!)}</p>
                <AttachmentPreview kind="documento" orderId={orderId} fileId={file.id} name={file.fileName} mimeType={file.mimeType} />
              </li>)}
            </ul>
          </details> : null}
        </div>;
      })}
    </div>}
  </section>;
}
