import "server-only";
import { previousSaleDocuments } from "@/lib/caja/document-history";
import { BillingBadge } from "./billing-badge";
import { headers } from "next/headers";
import { and, desc, eq, sql } from "drizzle-orm";
import { withDatabase, withReadDatabase } from "@/db";
import { cajaRequests, saleDocumentBatches, saleDocuments } from "@/db/schema";
import { getAuthorizedSession } from "@/lib/access";
import { ImprintBadge } from "@/components/order-wizard/imprint-badge";
import { cajaLabels } from "@/lib/caja/validation";
import { ReturnSaleControls } from "./return-controls";
import { ReceiptText } from "lucide-react";
import { after } from "next/server";
import { deliverCajaEmail } from "@/lib/caja/email";
const dates = new Intl.DateTimeFormat("es-PE", { dateStyle: "medium", timeStyle: "short", timeZone: "America/Lima" });
export async function AdminSaleDocuments({ orderId, canReturn, invoice }: { orderId: string; canReturn: boolean; invoice: boolean }) {
  const requestHeaders = await headers(); await withDatabase((db) => getAuthorizedSession(db, requestHeaders));
  const { requests, documents, batches } = await withReadDatabase(async (db) => {
    const requests = await db.select().from(cajaRequests).where(eq(cajaRequests.orderId, orderId));
    const documents = await db.select({ document: saleDocuments, requestId: cajaRequests.id }).from(saleDocuments).innerJoin(cajaRequests, eq(saleDocuments.requestId, cajaRequests.id)).where(and(eq(cajaRequests.orderId, orderId), sql`${saleDocuments.uploadedAt} IS NOT NULL`)).orderBy(desc(saleDocuments.createdAt));
    const batches = await db.select({ ids: saleDocumentBatches.documentIds }).from(saleDocumentBatches).where(eq(saleDocumentBatches.orderId, orderId));
    return { requests, documents, batches };
  });
  after(async () => { for (const request of requests) await deliverCajaEmail(request.id); });
  return <section className="rounded-xl border border-border p-4 sm:p-5"><div className="flex flex-wrap items-center justify-between gap-3"><h2 className="flex items-center gap-2 text-sm font-semibold"><ReceiptText className="size-4 text-primary" />Boletas y facturas</h2><BillingBadge invoice={invoice} /></div><p className="mt-2 text-xs leading-6 text-muted-foreground">Emisión por caja, independiente de la entrega del pedido.</p>{!requests.length ? <p className="mt-4 text-xs text-muted-foreground">Las solicitudes se generan al verificar cada pago.</p> : <div className={`mt-4 grid gap-3 ${requests.length > 1 ? "xl:grid-cols-2" : ""}`}>{requests.map((request) => {
    const files = documents.filter((row) => row.requestId === request.id).map((row) => row.document);
    const current = files.find((file) => file.id === (["FINALIZADA", "ANULADA"].includes(request.status) ? request.finalizedDocumentId : request.draftDocumentId));
    const history = previousSaleDocuments(files, request.cycle, current?.id ?? null, batches.flatMap((batch) => batch.ids), request.finalizedDocumentId);
    return <div key={request.id} className="rounded-lg border border-border p-4"><div className="flex flex-wrap items-center justify-between gap-2"><ImprintBadge imprint={request.publisherImprint} /><span className="text-[10px] font-semibold text-muted-foreground">{cajaLabels[request.status]}</span></div>{request.assignedName ? <p className="mt-2 text-[10px] text-muted-foreground">Responsable de caja: {request.assignedName}</p> : !["FINALIZADA", "ANULADA"].includes(request.status) ? <p className="mt-2 text-[10px] text-muted-foreground">Sin asignar en caja</p> : null}{current ? <a href={current.driveViewUrl!} target="_blank" rel="noopener noreferrer" className="mt-3 block break-words text-xs font-medium text-primary underline">{current.fileName}{!["FINALIZADA", "ANULADA"].includes(request.status) ? " · Borrador" : ""}</a> : <p className="mt-3 text-xs text-muted-foreground">Pendiente de documento.</p>}{request.status === "FINALIZADA" && request.finalizedAt ? <p className="mt-2 text-[10px] text-muted-foreground">{request.finalizedBy} · {dates.format(request.finalizedAt)}</p> : null}{request.status === "DEVUELTA" ? <p className="mt-3 rounded-md bg-amber-50 p-3 text-xs leading-6 text-amber-900">{request.returnReason}</p> : null}{request.status === "FINALIZADA" && canReturn ? <ReturnSaleControls id={request.id} version={request.updatedAt.toISOString()} /> : null}{history.length > 0 ? <details open className="mt-3"><summary className="cursor-pointer text-[10px] font-medium text-muted-foreground">Archivos anteriores</summary><ul className="mt-2 space-y-2">{history.map((file) => <li key={file.id}><a href={file.driveViewUrl!} target="_blank" rel="noopener noreferrer" className="break-words text-xs text-primary underline">{file.fileName}</a><p className="text-[10px] text-muted-foreground">Documento anterior · {dates.format(file.uploadedAt!)}</p></li>)}</ul></details> : null}</div>;
  })}</div>}</section>;
}
