import { z } from "zod";
import { and, eq, inArray } from "drizzle-orm";
import { withReadDatabase } from "@/db";
import { cajaRequests, orders, saleDocuments } from "@/db/schema";
import { trackingTokenSchema } from "@/lib/orders/submission";
import { salePdfBytes } from "@/lib/caja/service";
import { reportServerError } from "@/lib/server-diagnostics";
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export async function GET(_request: Request, { params }: { params: Promise<{ tracking_token: string; documentId: string }> }) {
  const responseHeaders = { "Cache-Control": "private, no-store", "Referrer-Policy": "no-referrer", "X-Robots-Tag": "noindex, nofollow", "X-Content-Type-Options": "nosniff" };
  const parsed = z.object({ tracking_token: trackingTokenSchema, documentId: z.uuid() }).safeParse(await params);
  if (!parsed.success) return new Response(null, { status: 404, headers: responseHeaders });
  try {
    const [record] = await withReadDatabase((db) => db.select({ driveId: saleDocuments.driveFileId, hash: saleDocuments.contentHash, fileName: saleDocuments.fileName, imprint: cajaRequests.publisherImprint, number: orders.orderNumber, ruc: orders.billingRuc }).from(orders).innerJoin(cajaRequests, eq(cajaRequests.orderId, orders.id)).innerJoin(saleDocuments, eq(saleDocuments.id, cajaRequests.finalizedDocumentId)).where(and(eq(orders.trackingToken, parsed.data.tracking_token), eq(saleDocuments.id, parsed.data.documentId), inArray(cajaRequests.status, ["FINALIZADA", "ANULADA"]))));
    if (!record) return new Response(null, { status: 404, headers: responseHeaders });
    const bytes = await salePdfBytes(record.driveId, record.hash);
    return new Response(new Uint8Array(bytes), { headers: { ...responseHeaders, "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(record.fileName)}` } });
  } catch (error) { reportServerError("customer.document.download", error); return new Response(null, { status: 503, headers: responseHeaders }); }
}
