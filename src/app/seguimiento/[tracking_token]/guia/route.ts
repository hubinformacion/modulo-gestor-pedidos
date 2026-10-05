import { getTrackedOrder } from "@/lib/orders/tracking";
import { readOrderPaymentGuide } from "@/lib/payments/config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(_request: Request, { params }: { params: Promise<{ tracking_token: string }> }) {
  const { tracking_token } = await params;
  const tracking = await getTrackedOrder(tracking_token);
  if (!tracking) return new Response("Pedido no encontrado", { status: 404, headers: { "Cache-Control": "private, no-store" } });
  try {
    const { content, filename } = await readOrderPaymentGuide(tracking.order);
    return new Response(new Uint8Array(content), { headers: { "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="${filename}"`, "Cache-Control": "private, no-store", "Referrer-Policy": "no-referrer", "X-Content-Type-Options": "nosniff" } });
  } catch { return new Response("Guía temporalmente no disponible", { status: 503, headers: { "Cache-Control": "private, no-store" } }); }
}
