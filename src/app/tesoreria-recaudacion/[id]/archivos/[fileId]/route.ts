import { ensureCajaFileReader } from "@/lib/caja/drive-access";
import { salePdfBytes } from "@/lib/caja/service";
import { z } from "zod";
import { and, eq, inArray } from "drizzle-orm";
import { withDatabase, withReadDatabase } from "@/db";
import { cajaRequests, paymentReceipts, saleDocuments, treasurySupportingFiles } from "@/db/schema";
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
      const [item] = await db.select().from(cajaRequests).where(and(eq(cajaRequests.id, parsed.data.id), inArray(cajaRequests.publisherImprint, actor.publisherImprints)));
      if (!item) return null;
      const [document] = await db.select().from(saleDocuments).where(and(eq(saleDocuments.id, parsed.data.fileId), eq(saleDocuments.requestId, item.id)));
      if (document?.uploadedAt) return { driveId: document.driveFileId, url: document.driveViewUrl!, name: document.fileName, hash: document.contentHash };
      const [receipt] = await db.select().from(paymentReceipts).where(and(eq(paymentReceipts.id, parsed.data.fileId), eq(paymentReceipts.orderId, item.orderId), eq(paymentReceipts.publisherImprint, item.publisherImprint)));
      const [support] = receipt ? [] : await db.select().from(treasurySupportingFiles).where(and(eq(treasurySupportingFiles.id, parsed.data.fileId), eq(treasurySupportingFiles.requestId, item.id)));
      if (support?.uploadedAt && support.driveViewUrl) return { driveId: support.driveFileId, url: support.driveViewUrl, name: support.fileName, hash: null };
      return receipt ? { driveId: receipt.driveFileId, url: receipt.driveViewUrl, name: receipt.fileName, hash: null } : null;
    });
    if (!file) return new Response(null, { status: 404, headers: responseHeaders });
    const mode = new URL(request.url).searchParams;
    if (file.hash && (mode.get("preview") === "1" || mode.get("download") === "1")) {
      const bytes = await salePdfBytes(file.driveId, file.hash);
      return new Response(new Uint8Array(bytes), { headers: { ...responseHeaders, "Content-Type": "application/pdf", "Content-Disposition": `${mode.get("download") === "1" ? "attachment" : "inline"}; filename*=UTF-8''${encodeURIComponent(file.name)}` } });
    }
    await ensureCajaFileReader(actor, parsed.data.id, file.driveId);
    return new Response(null, { status: 302, headers: { ...responseHeaders, Location: file.url } });
  } catch (error) {
    if (error instanceof AccessError) return new Response(null, { status: error.code === "UNAUTHENTICATED" ? 401 : error.code === "FORBIDDEN" ? 403 : 503, headers: responseHeaders });
    reportServerError("caja.download.failed", error); return new Response(null, { status: 503, headers: responseHeaders });
  }
}
