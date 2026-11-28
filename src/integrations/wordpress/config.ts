import { z } from "zod";

export const embedOriginSchema = z.string().trim().pipe(z.url()).refine((value) => {
  const url = new URL(value);
  const local = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
  return (url.protocol === "https:" || (local && url.protocol === "http:")) && !url.hostname.includes("*") && !url.username && !url.password && url.pathname === "/" && !url.search && !url.hash;
}, "Usa un origen HTTPS exacto, sin ruta ni credenciales. HTTP solo se admite en localhost.").transform((value) => new URL(value).origin);

// This module also runs in next.config.ts: do not import server-only here.
export function getWordPressOrigins(value = process.env.WORDPRESS_ORIGINS ?? ""): string[] {
  if (!value.trim()) return [];
  const parsed = z.array(embedOriginSchema).max(20).safeParse(value.split(","));
  if (!parsed.success) throw new Error("WORDPRESS_ORIGINS_INVALID: configura hasta 20 orígenes exactos separados por comas; sin rutas ni comodines.");
  return [...new Set(parsed.data)];
}

export function getEmbedCsp(origins: string[]) {
  return `frame-ancestors 'self'${origins.length ? ` ${origins.join(" ")}` : ""}; frame-src 'self' https://www.google.com https://maps.google.com; object-src 'none'; base-uri 'self'`;
}
