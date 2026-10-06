import "server-only";
import { cache } from "react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { withDatabase, type Database } from "@/db";
import { authorizedEmails } from "@/db/schema";
import { reportServerError } from "./server-diagnostics";
import { createAuth } from "./auth";
import { AccessError, authorizedEmailSchema, type AuthorizedActor } from "./access-policy";

type SessionIdentity = { user: { email: string; emailVerified: boolean; id: string; name: string }; session: { id: string } };
async function authorizeIdentity(db: Database, result: SessionIdentity | null): Promise<AuthorizedActor> {
  if (!result) throw new AccessError("UNAUTHENTICATED");
  const email = authorizedEmailSchema.safeParse(result.user.email);
  if (!result.user.emailVerified || !email.success) throw new AccessError("FORBIDDEN");
  const [allowed] = await db.select({ email: authorizedEmails.email }).from(authorizedEmails).where(eq(authorizedEmails.email, email.data)).limit(1);
  if (!allowed) throw new AccessError("FORBIDDEN");
  return { userId: result.user.id, sessionId: result.session.id, email: email.data, name: result.user.name };
}
function accessFailure(error: unknown): never {
  if (error instanceof AccessError) throw error;
  reportServerError("access.session.unavailable", error);
  throw new AccessError("UNAVAILABLE");
}
export async function getAuthorizedSession(db: Database, requestHeaders: Headers): Promise<AuthorizedActor> {
  try {
    const result = await createAuth(db).api.getSession({ headers: requestHeaders, query: { disableCookieCache: true, disableRefresh: true } });
    return await authorizeIdentity(db, result);
  } catch (error) { return accessFailure(error); }
}

// Only proxy can forward renewed cookies. RSC/actions retain authoritative,
// read-only session checks; every protected request still checks the allowlist.
export async function getAuthorizedRequestSession(db: Database, requestHeaders: Headers) {
  try {
    const result = await createAuth(db).api.getSession({ headers: requestHeaders, query: { disableCookieCache: true }, returnHeaders: true });
    const actor = await authorizeIdentity(db, result.response);
    return { actor, responseHeaders: result.headers };
  } catch (error) { return accessFailure(error); }
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
    if (code === "FORBIDDEN") redirect("/login?error=access_denied");
    throw new AccessError("UNAVAILABLE");
  }
  return actor;
});
