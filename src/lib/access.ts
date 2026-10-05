import "server-only";
import { cache } from "react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { withDatabase, type Database } from "@/db";
import { authorizedEmails } from "@/db/schema";
import { createAuth } from "./auth";
import { AccessError, authorizedEmailSchema, type AuthorizedActor } from "./access-policy";

export async function getAuthorizedSession(db: Database, requestHeaders: Headers): Promise<AuthorizedActor> {
  try {
    const result = await createAuth(db).api.getSession({
      headers: requestHeaders,
      query: { disableCookieCache: true, disableRefresh: true },
    });
    if (!result) throw new AccessError("UNAUTHENTICATED");
    const email = authorizedEmailSchema.safeParse(result.user.email);
    if (!result.user.emailVerified || !email.success) throw new AccessError("FORBIDDEN");
    const [allowed] = await db.select({ email: authorizedEmails.email })
      .from(authorizedEmails).where(eq(authorizedEmails.email, email.data)).limit(1);
    if (!allowed) throw new AccessError("FORBIDDEN");
    return {
      userId: result.user.id,
      sessionId: result.session.id,
      email: email.data,
      name: result.user.name,
    };
  } catch (error) {
    if (error instanceof AccessError) throw error;
    throw new AccessError("UNAVAILABLE");
  }
}

// Only memoized within a React render. Actions call getAuthorizedSession again.
export const requirePageAccess = cache(async (): Promise<AuthorizedActor> => {
  const requestHeaders = await headers();
  let actor: AuthorizedActor;
  try {
    actor = await withDatabase((db) => getAuthorizedSession(db, requestHeaders));
  } catch (error) {
    const code = error instanceof AccessError ? error.code : "UNAVAILABLE";
    if (code === "UNAUTHENTICATED") redirect("/login");
    redirect(`/login?error=${code === "FORBIDDEN" ? "access_denied" : "service_unavailable"}`);
  }
  return actor;
});
