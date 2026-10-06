import "server-only";
import { z } from "zod";
import { getPublicOrigin } from "@/lib/payments/config";
import { trackingTokenSchema } from "./submission";

// The fragment is read by the WordPress embed receiver, not sent as a WP query
// or referrer. APP_URL continues to identify the Next application for OAuth.
export function customerTrackingUrl(token: string) {
  const validToken = trackingTokenSchema.parse(token);
  const origin = getPublicOrigin();
  const configured = process.env.WORDPRESS_ORDER_URL?.trim();
  const page = configured || (new URL(origin).hostname === "modulo-gestor-pedidos.vercel.app" ? "https://fondoeditorial.continental.edu.pe/pedido/" : undefined);
  if (!page) return `${origin}/seguimiento/${validToken}`;
  const target = new URL(z.url().max(2000).parse(page));
  const local = process.env.NODE_ENV !== "production" && ["localhost", "127.0.0.1"].includes(target.hostname);
  if ((target.protocol !== "https:" && !(local && target.protocol === "http:")) || target.username || target.password || target.search || target.hash) throw new Error("WORDPRESS_ORDER_URL_INVALID");
  target.hash = `seguimiento/${validToken}`;
  return target.toString();
}
