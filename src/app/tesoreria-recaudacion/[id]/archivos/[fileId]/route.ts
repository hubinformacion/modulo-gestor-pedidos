import { createHash } from "node:crypto";
import { ensureCajaFileReader } from "@/integrations/google/treasury-readers";
import { readSmallDriveFile } from "@/integrations/google/drive";
import { saleDocumentBytes } from "@/modules/treasury/application/documents";
import { receiptMimeType } from "@/modules/orders/domain/receipt";
import { maxReceiptBytes } from "@/modules/orders/domain/receipt-upload";
import { z } from "zod";
import { and, eq, inArray } from "drizzle-orm";
import { withDatabase, withReadDatabase } from "@/db";
import { cajaRequests, paymentReceipts, paymentUploads, saleDocuments, treasurySupportingFiles } from "@/db/schema";
import { getCajaSession } from "@/modules/access/application/session";
import { AccessError } from "@/modules/access/domain/policy";
import { reportServerError } from "@/shared/logging/server-diagnostics";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const responseHeaders = { "Cache-Control": "private, no-store", "Referrer-Policy": "no-referrer", "X-Content-Type-Options": "nosniff", "X-Robots-Tag": "noindex, nofollow" };

function serveFile(bytes: Buffer, mime: string, name: string, download: boolean) {
  const filename = encodeURIComponent(name.toWellFormed()).replace(/['()*]/g, (character) => `%${character.charCodeAt(0).toString(16).toUpperCase()}`);
  return new Response(new Uint8Array(bytes), { headers: {
    ...responseHeaders,
    "Content-Type": mime,
    "Content-Disposition": `${download ? "attachment" : "inline"}; filename*=UTF-8''${filename}`,
  } });
}

export async function GET(request: Request, { params }: { params: Promise<{ id: string; fileId: string }> }) {
  try {
    const parsed = z.object({ id: z.uuid(), fileId: z.uuid() }).safeParse(await params);
    if (!parsed.success) return new Response(null, { status: 404, headers: responseHeaders });
    const actor = await withDatabase((db) => getCajaSession(db, request.headers));
    const file = await withReadDatabase(async (db) => {
      const [item] = await db.select().from(cajaRequests).where(and(eq(cajaRequests.id, parsed.data.id), inArray(cajaRequests.publisherImprint, actor.publisherImprints)));
      if (!item) return null;
      const [document] = await db.select().from(saleDocuments).where(and(eq(saleDocuments.id, parsed.data.fileId), eq(saleDocuments.requestId, item.id)));
      if (document?.uploadedAt && document.driveViewUrl) return { kind: "sale" as const, driveId: document.driveFileId, url: document.driveViewUrl, name: document.fileName, hash: document.contentHash, mimeType: document.mimeType };

      const [receipt] = await db.select({ receipt: paymentReceipts, upload: paymentUploads })
        .from(paymentReceipts).leftJoin(paymentUploads, eq(paymentReceipts.uploadId, paymentUploads.id))
        .where(and(eq(paymentReceipts.id, parsed.data.fileId), eq(paymentReceipts.orderId, item.orderId), eq(paymentReceipts.publisherImprint, item.publisherImprint)));
      if (receipt) return { kind: "receipt" as const, driveId: receipt.receipt.driveFileId, url: receipt.receipt.driveViewUrl, name: receipt.receipt.fileName, upload: receipt.upload };

      const [support] = await db.select().from(treasurySupportingFiles).where(and(eq(treasurySupportingFiles.id, parsed.data.fileId), eq(treasurySupportingFiles.requestId, item.id)));
      if (support?.uploadedAt && support.driveViewUrl) return { kind: "support" as const, driveId: support.driveFileId, url: support.driveViewUrl };
      return null;
    });

    if (!file) return new Response(null, { status: 404, headers: responseHeaders });
    const mode = new URL(request.url).searchParams;
    const download = mode.get("download") === "1";
    if (download || mode.get("preview") === "1") {
      if (file.kind === "sale") {
        if (file.mimeType === "application/xml" && !download) return new Response(null, { status: 404, headers: responseHeaders });
        return serveFile(await saleDocumentBytes(file.driveId, file.hash, file.mimeType), file.mimeType, file.name, download);
      }
      if (file.kind === "receipt") {
        const bytes = await readSmallDriveFile(file.driveId, maxReceiptBytes);
        const mime = receiptMimeType(bytes);
        if (!mime) return new Response(null, { status: 415, headers: responseHeaders });
        if (file.upload && (file.upload.mimeType !== mime || file.upload.size !== bytes.length || file.upload.contentHash !== createHash("sha256").update(bytes).digest("hex"))) {
          return new Response(null, { status: 409, headers: responseHeaders });
        }
        return serveFile(bytes, mime, file.name, download);
      }
      return new Response(null, { status: 404, headers: responseHeaders });
    }
    if (file.kind === "sale" && file.mimeType === "application/xml") return new Response(null, { status: 404, headers: responseHeaders });
    await ensureCajaFileReader(actor, parsed.data.id, file.driveId, true);
    return new Response(null, { status: 302, headers: { ...responseHeaders, Location: file.url } });
  } catch (error) {
    if (error instanceof AccessError) return new Response(null, { status: error.code === "UNAUTHENTICATED" ? 401 : error.code === "FORBIDDEN" ? 403 : 503, headers: responseHeaders });
    reportServerError("caja.download.failed", error); return new Response(null, { status: 503, headers: responseHeaders });
  }
}
