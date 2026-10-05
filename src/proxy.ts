import { NextResponse, type NextRequest } from "next/server";
import { withDatabase } from "@/db";
import { getAuthorizedSession } from "@/lib/access";
import { AccessError } from "@/lib/access-policy";

export async function proxy(request: NextRequest) {
  try {
    await withDatabase((db) => getAuthorizedSession(db, request.headers));
    const response = NextResponse.next();
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
    const url = new URL("/login", request.url);
    if (code !== "UNAUTHENTICATED") {
      url.searchParams.set("error", code === "FORBIDDEN" ? "access_denied" : "service_unavailable");
    }
    return NextResponse.redirect(url);
  }
}

export const config = { matcher: ["/admin/:path*"] };
