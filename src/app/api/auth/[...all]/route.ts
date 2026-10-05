import { toNextJsHandler } from "better-auth/next-js";
import { withDatabase } from "@/db";
import { createAuth } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function handle(request: Request) {
  try {
    return await withDatabase((db) => {
      const handler = toNextJsHandler(createAuth(db));
      return request.method === "GET" ? handler.GET(request) : handler.POST(request);
    });
  } catch {
    console.error("[auth] No se pudo procesar la solicitud de autenticación.");
    return Response.json({ message: "El inicio de sesión no está disponible. Intenta nuevamente." }, {
      status: 503, headers: { "Cache-Control": "no-store" },
    });
  }
}

export const GET = handle;
export const POST = handle;
