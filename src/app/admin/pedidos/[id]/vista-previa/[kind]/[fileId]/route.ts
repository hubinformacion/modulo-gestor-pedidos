import { createHash } from "node:crypto";
import { z } from "zod";
import { withDatabase } from "@/db";
import { readSmallDriveFile } from "@/integrations/google/drive";
import { getAuthorizedSession } from "@/modules/access/application/session";
import { AccessError } from "@/modules/access/domain/policy";
import { orderAttachmentPreview } from "@/modules/orders/data/attachment-preview";
import { receiptMimeType } from "@/modules/orders/domain/receipt";
import { maxReceiptBytes } from "@/modules/orders/domain/receipt-upload";
import { reportServerError } from "@/shared/logging/server-diagnostics";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const parameters = z.object({ id: z.uuid(), kind: z.enum(["comprobante", "evidencia", "documento"]), fileId: z.uuid() });
const responseHeaders = {
  "Cache-Control": "private, no-store",
  "Referrer-Policy": "no-referrer",
  "X-Robots-Tag": "noindex, nofollow",
  "X-Content-Type-Options": "nosniff",
  "Cross-Origin-Resource-Policy": "same-origin",
  "X-Frame-Options": "SAMEORIGIN",
};

export async function GET(request: Request, { params }: { params: Promise<{ id: string; kind: string; fileId: string }> }) {
  const parsed = parameters.safeParse(await params);
  if (!parsed.success) return new Response(null, { status: 404, headers: responseHeaders });
  try {
    await withDatabase((db) => getAuthorizedSession(db, request.headers));
    const { id, kind, fileId } = parsed.data;
    const file = await orderAttachmentPreview(id, kind, fileId);
    if (!file) return new Response(null, { status: 404, headers: responseHeaders });
    const bytes = await readSmallDriveFile(file.driveId, maxReceiptBytes);
    const mimeType = receiptMimeType(bytes);
    if (!mimeType || file.mimeType !== mimeType || createHash("sha256").update(bytes).digest("hex") !== file.hash) {
      return new Response(null, { status: 404, headers: responseHeaders });
    }
    return new Response(new Uint8Array(bytes), { headers: { ...responseHeaders, "Content-Type": mimeType, "Content-Disposition": "inline" } });
  } catch (error) {
    if (error instanceof AccessError && error.code !== "UNAVAILABLE") {
      return new Response(null, { status: error.code === "UNAUTHENTICATED" ? 401 : 403, headers: responseHeaders });
    }
    reportServerError("admin.order.attachment_preview", error);
    return new Response(null, { status: 503, headers: responseHeaders });
  }
}
