import { withReadDatabase } from "@/db";
import { cajaRequests, saleDocuments } from "@/db/schema";
import { and, eq, inArray, or } from "drizzle-orm";
import "server-only";

export async function customerSaleDocuments(orderId: string) {
  return withReadDatabase((db) => db.select({ id: saleDocuments.id, name: saleDocuments.fileName, mimeType: saleDocuments.mimeType, imprint: cajaRequests.publisherImprint, finalizedAt: cajaRequests.finalizedAt }).from(cajaRequests).innerJoin(saleDocuments, and(eq(saleDocuments.requestId, cajaRequests.id), or(eq(saleDocuments.id, cajaRequests.finalizedDocumentId), eq(saleDocuments.id, cajaRequests.finalizedXmlDocumentId)))).where(and(eq(cajaRequests.orderId, orderId), inArray(cajaRequests.status, ["FINALIZADA", "ANULADA"]))));
}
