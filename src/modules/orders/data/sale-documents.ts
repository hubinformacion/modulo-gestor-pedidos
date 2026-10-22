import { withReadDatabase } from "@/db";
import { cajaRequests, saleDocuments } from "@/db/schema";
import { and, eq, inArray } from "drizzle-orm";
import "server-only";

export async function customerSaleDocuments(orderId: string) {
  return withReadDatabase((db) => db.select({ id: saleDocuments.id, imprint: cajaRequests.publisherImprint, finalizedAt: cajaRequests.finalizedAt }).from(cajaRequests).innerJoin(saleDocuments, eq(saleDocuments.id, cajaRequests.finalizedDocumentId)).where(and(eq(cajaRequests.orderId, orderId), inArray(cajaRequests.status, ["FINALIZADA", "ANULADA"]))));
}
