import { ensureCajaFileReader } from "@/lib/caja/drive-access";
import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { withDatabase, withReadDatabase } from "@/db";
import { cajaRequests, paymentReceipts, saleDocuments } from "@/db/schema";
import { getCajaSession } from "@/lib/access";
import { AccessError } from "@/lib/access-policy";
import { reportServerError } from "@/lib/server-diagnostics";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(request: Request, { params }: { params: Promise<{ id: string; fileId: string }> }) {
  const responseHeaders = { "Cache-Control": "private, no-store", "Referrer-Policy": "no-referrer", "X-Content-Type-Options": "nosniff", "X-Robots-Tag": "noindex, nofollow" };
  try {
    const parsed = z.object({ id: z.uuid(), fileId: z.uuid() }).safeParse(await params);
    if (!parsed.success) return new Response(null, { status: 404, headers: responseHeaders });
    const actor = await withDatabase((db) => getCajaSession(db, request.headers));
    const file = await withReadDatabase(async (db) => {
      const [item] = await db.select().from(cajaRequests).where(and(eq(cajaRequests.id, parsed.data.id), eq(cajaRequests.publisherImprint, actor.publisherImprint!)));
      if (!item) return null;
      const [document] = await db.select().from(saleDocuments).where(and(eq(saleDocuments.id, parsed.data.fileId), eq(saleDocuments.requestId, item.id)));
      if (document?.uploadedAt) return { driveId: document.driveFileId, url: document.driveViewUrl! };
      const [receipt] = await db.select().from(paymentReceipts).where(and(eq(paymentReceipts.id, parsed.data.fileId), eq(paymentReceipts.orderId, item.orderId), eq(paymentReceipts.publisherImprint, actor.publisherImprint!)));
      return receipt ? { driveId: receipt.driveFileId, url: receipt.driveViewUrl } : null;
    });
    if (!file) return new Response(null, { status: 404, headers: responseHeaders });
    await ensureCajaFileReader(actor, parsed.data.id, file.driveId);
    return new Response(null, { status: 302, headers: { ...responseHeaders, Location: file.url } });
  } catch (error) {
    if (error instanceof AccessError) return new Response(null, { status: error.code === "UNAUTHENTICATED" ? 401 : error.code === "FORBIDDEN" ? 403 : 503, headers: responseHeaders });
    reportServerError("caja.download.failed", error); return new Response(null, { status: 503, headers: responseHeaders });
  }
}
