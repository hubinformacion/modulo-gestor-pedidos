import { z } from "zod";
import { and, eq, inArray, or } from "drizzle-orm";
import { withReadDatabase } from "@/db";
import { cajaRequests, orders, saleDocuments } from "@/db/schema";
import { trackingTokenSchema } from "@/modules/orders/domain/submission";
import { saleDocumentBytes } from "@/modules/treasury/application/documents";
import { reportServerError } from "@/shared/logging/server-diagnostics";
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export async function GET(_request: Request, { params }: { params: Promise<{ tracking_token: string; documentId: string }> }) {
  const responseHeaders = { "Cache-Control": "private, no-store", "Referrer-Policy": "no-referrer", "X-Robots-Tag": "noindex, nofollow", "X-Content-Type-Options": "nosniff" };
  const parsed = z.object({ tracking_token: trackingTokenSchema, documentId: z.uuid() }).safeParse(await params);
  if (!parsed.success) return new Response(null, { status: 404, headers: responseHeaders });
  try {
    const [record] = await withReadDatabase((db) => db.select({ driveId: saleDocuments.driveFileId, hash: saleDocuments.contentHash, fileName: saleDocuments.fileName, mimeType: saleDocuments.mimeType }).from(orders).innerJoin(cajaRequests, eq(cajaRequests.orderId, orders.id)).innerJoin(saleDocuments, and(eq(saleDocuments.requestId, cajaRequests.id), or(eq(saleDocuments.id, cajaRequests.finalizedDocumentId), eq(saleDocuments.id, cajaRequests.finalizedXmlDocumentId)))).where(and(eq(orders.trackingToken, parsed.data.tracking_token), eq(saleDocuments.id, parsed.data.documentId), inArray(cajaRequests.status, ["FINALIZADA", "ANULADA"]))));
    if (!record) return new Response(null, { status: 404, headers: responseHeaders });
    const bytes = await saleDocumentBytes(record.driveId, record.hash, record.mimeType);
    return new Response(new Uint8Array(bytes), { headers: { ...responseHeaders, "Content-Type": record.mimeType, "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(record.fileName.toWellFormed()).replace(/['()*]/g, (character) => `%${character.charCodeAt(0).toString(16).toUpperCase()}`)}` } });
  } catch (error) { reportServerError("customer.document.download", error); return new Response(null, { status: 503, headers: responseHeaders }); }
}
