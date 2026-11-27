import { z } from "zod";
import { customerSaleDocumentFile } from "@/modules/orders/data/sale-documents";
import { trackingTokenSchema } from "@/modules/orders/domain/submission";
import { saleDocumentBytes } from "@/modules/orders/application/sale-documents";
import { reportServerError } from "@/shared/logging/server-diagnostics";
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export async function GET(request: Request, { params }: { params: Promise<{ tracking_token: string; documentId: string }> }) {
  const responseHeaders = { "Cache-Control": "private, no-store", "Referrer-Policy": "no-referrer", "X-Robots-Tag": "noindex, nofollow", "X-Content-Type-Options": "nosniff" };
  const parsed = z.object({ tracking_token: trackingTokenSchema, documentId: z.uuid() }).safeParse(await params);
  if (!parsed.success) return new Response(null, { status: 404, headers: responseHeaders });
  try {
    const record = await customerSaleDocumentFile(parsed.data.tracking_token, parsed.data.documentId);
    if (!record) return new Response(null, { status: 404, headers: responseHeaders });
    const bytes = await saleDocumentBytes(record.driveId, record.hash, record.mimeType);
    const disposition = record.mimeType === "application/pdf" && new URL(request.url).searchParams.get("vista") === "1" ? "inline" : "attachment";
    return new Response(new Uint8Array(bytes), { headers: { ...responseHeaders, "Content-Type": record.mimeType, "Content-Disposition": `${disposition}; filename*=UTF-8''${encodeURIComponent(record.fileName.toWellFormed()).replace(/['()*]/g, (character) => `%${character.charCodeAt(0).toString(16).toUpperCase()}`)}` } });
  } catch (error) { reportServerError("customer.document.download", error); return new Response(null, { status: 503, headers: responseHeaders }); }
}
