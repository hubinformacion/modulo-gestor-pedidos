import "server-only";

import { withReadDatabase } from "@/db";
import { orderSaleIssuances, paymentReceipts, paymentUploads, pickupEvidence, saleDocuments } from "@/db/schema";
import { and, eq, isNotNull } from "drizzle-orm";

export async function orderAttachmentPreview(orderId: string, kind: "comprobante" | "evidencia" | "documento", fileId: string) {
  return withReadDatabase(async (db) => {
    if (kind === "comprobante") {
      const [file] = await db.select({ driveId: paymentReceipts.driveFileId, hash: paymentUploads.contentHash, mimeType: paymentUploads.mimeType })
        .from(paymentReceipts)
        .innerJoin(paymentUploads, and(
          eq(paymentUploads.id, paymentReceipts.uploadId),
          eq(paymentUploads.orderId, paymentReceipts.orderId),
          eq(paymentUploads.publisherImprint, paymentReceipts.publisherImprint),
          eq(paymentUploads.driveFileId, paymentReceipts.driveFileId),
        ))
        .where(and(eq(paymentReceipts.id, fileId), eq(paymentReceipts.orderId, orderId)));
      return file;
    }
    if (kind === "evidencia") {
      const [file] = await db.select({ driveId: pickupEvidence.driveFileId, hash: pickupEvidence.contentHash, mimeType: pickupEvidence.mimeType })
        .from(pickupEvidence)
        .where(and(eq(pickupEvidence.id, fileId), eq(pickupEvidence.orderId, orderId), isNotNull(pickupEvidence.uploadedAt)));
      return file;
    }
    const [file] = await db.select({ driveId: saleDocuments.driveFileId, hash: saleDocuments.contentHash, mimeType: saleDocuments.mimeType })
      .from(saleDocuments)
      .innerJoin(orderSaleIssuances, eq(orderSaleIssuances.id, saleDocuments.issuanceId))
      .where(and(eq(saleDocuments.id, fileId), eq(orderSaleIssuances.orderId, orderId), eq(saleDocuments.mimeType, "application/pdf"), isNotNull(saleDocuments.uploadedAt)));
    return file;
  });
}
