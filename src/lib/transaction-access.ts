import "server-only";
import { and, eq, gt } from "drizzle-orm";
import type { Database } from "@/db";
import { authorizedEmails, session, user } from "@/db/schema";
import { AccessError, type AuthorizedActor } from "@/lib/access-policy";

type Transaction = Parameters<Parameters<Database["transaction"]>[0]>[0];

export async function assertAuthorized(tx: Transaction, actor: AuthorizedActor) {
  // Share lock coordinates with revocation: permissions remain valid through commit.
  const [allowed] = await tx.select({ email: authorizedEmails.email }).from(authorizedEmails).where(eq(authorizedEmails.email, actor.email)).for("share");
  if (!allowed) throw new AccessError("FORBIDDEN");
  const [current] = await tx.select({ id: session.id }).from(session).innerJoin(user, eq(user.id, session.userId)).where(and(
    eq(session.id, actor.sessionId), eq(session.userId, actor.userId), gt(session.expiresAt, new Date()), eq(user.email, actor.email), eq(user.emailVerified, true),
  ));
  if (!current) throw new AccessError("UNAUTHENTICATED");
}

