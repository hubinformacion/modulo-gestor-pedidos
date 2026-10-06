import { Readable } from "node:stream";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { withDatabase } from "@/db";
import { paymentReceipts, paymentUploads } from "@/db/schema";
import { getAuthorizedSession } from "@/lib/access";
import { AccessError } from "@/lib/access-policy";
import { assertAuthorized } from "@/lib/transaction-access";
import { readFileFromDrive } from "@/lib/google";
import { reportServerError } from "@/lib/server-diagnostics";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const privateHeaders = { "Cache-Control": "private, no-store", "Referrer-Policy": "no-referrer", "X-Content-Type-Options": "nosniff" };

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const id = z.uuid().safeParse((await params).id);
    if (!id.success) return new Response("Comprobante no encontrado.", { status: 404, headers: privateHeaders });
    const receipt = await withDatabase(async (db) => {
      const actor = await getAuthorizedSession(db, request.headers);
      return db.transaction(async (tx) => {
        await assertAuthorized(tx, actor);
        const [row] = await tx.select({ fileId: paymentReceipts.driveFileId, fileName: paymentReceipts.fileName, mimeType: paymentUploads.mimeType }).from(paymentReceipts).leftJoin(paymentUploads, eq(paymentUploads.id, paymentReceipts.uploadId)).where(eq(paymentReceipts.id, id.data));
        return row;
      });
    });
    if (!receipt) return new Response("Comprobante no encontrado.", { status: 404, headers: privateHeaders });
    const stream = await readFileFromDrive(receipt.fileId);
    const mime = receipt.mimeType && ["application/pdf", "image/jpeg", "image/png"].includes(receipt.mimeType) ? receipt.mimeType : "application/octet-stream";
    const filename = encodeURIComponent(receipt.fileName).replace(/[!'()*]/g, (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`);
    return new Response(Readable.toWeb(stream) as ReadableStream, { headers: { ...privateHeaders, "Content-Type": mime, "Content-Disposition": `${mime === "application/octet-stream" ? "attachment" : "inline"}; filename*=UTF-8''${filename}` } });
  } catch (error) {
    if (error instanceof AccessError) return new Response(error.message, { status: error.code === "UNAUTHENTICATED" ? 401 : error.code === "FORBIDDEN" ? 403 : 503, headers: privateHeaders });
    reportServerError("receipt.view.failed", error);
    return new Response("No se pudo abrir el comprobante. Intenta nuevamente.", { status: 502, headers: privateHeaders });
  }
}
