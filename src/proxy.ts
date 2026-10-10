import { NextResponse, type NextRequest } from "next/server";
import { withDatabase } from "@/db";
import { getAuthorizedRequestSession } from "@/lib/access";
import { AccessError } from "@/lib/access-policy";

export async function proxy(request: NextRequest) {
  try {
    const session = await withDatabase((db) => getAuthorizedRequestSession(db, request.headers));
    const isCaja = request.nextUrl.pathname.startsWith("/tesoreria-recaudacion");
    if ((isCaja && session.actor.role !== "caja") || (!isCaja && session.actor.role !== "gestor")) {
      if (request.headers.has("next-action")) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403, headers: { "Cache-Control": "no-store" } });
      const response = NextResponse.redirect(new URL(session.actor.role === "caja" ? "/tesoreria-recaudacion" : "/admin/pedidos", request.url));
      for (const cookie of session.responseHeaders.getSetCookie()) response.headers.append("Set-Cookie", cookie);
      response.headers.set("Cache-Control", "private, no-store");
      return response;
    }
    const response = NextResponse.next();
    for (const cookie of session.responseHeaders.getSetCookie()) response.headers.append("Set-Cookie", cookie);
    response.headers.set("Cache-Control", "private, no-store");
    return response;
  } catch (error) {
    const code = error instanceof AccessError ? error.code : "UNAVAILABLE";
    if (request.headers.has("next-action")) {
      // Reject direct mutation requests instead of redirecting a POST to login.
      return NextResponse.json({ error: code }, {
        status: code === "UNAUTHENTICATED" ? 401 : code === "FORBIDDEN" ? 403 : 503,
        headers: { "Cache-Control": "no-store" },
      });
    }
    if (code === "UNAVAILABLE") {
      return new NextResponse(`<!doctype html><html lang="es"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Servicio temporalmente no disponible</title><body style="margin:0;background:white;font-family:Inter,Arial,sans-serif;color:#191922"><main style="max-width:440px;margin:12vh auto;padding:24px"><h1 style="font-size:22px">No pudimos cargar esta sección</h1><p style="font-size:14px;line-height:1.8">No pudimos comprobar tu sesión por un problema temporal. Reintenta en unos momentos.</p><button type="button" onclick="window.location.reload()" style="background:#6802c1;color:white;border:0;border-radius:8px;padding:12px 18px;cursor:pointer">Volver a intentar</button></main></body></html>`, { status: 503, headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "private, no-store", "Retry-After": "5" } });
    }
    const url = new URL("/login", request.url);
    if (code !== "UNAUTHENTICATED") {
      url.searchParams.set("error", code === "FORBIDDEN" ? "access_denied" : "service_unavailable");
    }
    return NextResponse.redirect(url);
  }
}

export const config = { matcher: ["/admin/:path*", "/tesoreria-recaudacion/:path*"] };
