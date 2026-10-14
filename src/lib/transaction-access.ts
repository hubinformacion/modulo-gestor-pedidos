import "server-only";
import { treasuryScopes } from "./treasury/scope";
import { and, eq, gt } from "drizzle-orm";
import type { Database } from "@/db";
import { authorizedEmails, session, user } from "@/db/schema";
import { AccessError, type AuthorizedActor } from "@/lib/access-policy";

type Transaction = Parameters<Parameters<Database["transaction"]>[0]>[0];

export async function assertAccessRole(tx: Transaction, actor: AuthorizedActor, role: "gestor" | "caja") {
  // Share lock coordinates with revocation: permissions remain valid through commit.
  const [allowed] = await tx.select().from(authorizedEmails).where(eq(authorizedEmails.email, actor.email)).for("share");
  if (!allowed || allowed.role !== role || allowed.publisherImprint !== actor.publisherImprint || allowed.treasuryService !== actor.treasuryService || JSON.stringify(treasuryScopes(allowed).sort()) !== JSON.stringify([...actor.publisherImprints].sort())) throw new AccessError("FORBIDDEN");
  const [current] = await tx.select({ id: session.id }).from(session).innerJoin(user, eq(user.id, session.userId)).where(and(
    eq(session.id, actor.sessionId), eq(session.userId, actor.userId), gt(session.expiresAt, new Date()), eq(user.email, actor.email), eq(user.emailVerified, true),
  ));
  if (!current) throw new AccessError("UNAUTHENTICATED");
}

export async function assertAuthorized(tx: Transaction, actor: AuthorizedActor) { return assertAccessRole(tx, actor, "gestor"); }

export async function assertTreasuryOperator(tx: Transaction, actor: AuthorizedActor) {
  await assertAccessRole(tx, actor, "caja");
  if (actor.treasuryService) throw new AccessError("FORBIDDEN");
}
