import type { Database } from "@/db";
import { authorizedEmails, session, user } from "@/db/schema";
import { AccessError, canAttendOrders, type AuthorizedActor } from "@/modules/access/domain/policy";
import { and, eq, gt } from "drizzle-orm";
import "server-only";

type Transaction = Parameters<Parameters<Database["transaction"]>[0]>[0];

export async function assertAuthorized(tx: Transaction, actor: AuthorizedActor) {
  // Share lock coordinates with revocation: permissions remain valid through commit.
  const [allowed] = await tx.select().from(authorizedEmails).where(eq(authorizedEmails.email, actor.email)).for("share");
  if (!allowed || allowed.role !== "gestor") throw new AccessError("FORBIDDEN");
  const [current] = await tx.select({ id: session.id }).from(session).innerJoin(user, eq(user.id, session.userId)).where(and(
    eq(session.id, actor.sessionId), eq(session.userId, actor.userId), gt(session.expiresAt, new Date()), eq(user.email, actor.email), eq(user.emailVerified, true),
  ));
  if (!current) throw new AccessError("UNAUTHENTICATED");
}

export async function assertOrderOperator(tx: Transaction, actor: AuthorizedActor) {
  await assertAuthorized(tx, actor);
  if (!canAttendOrders(actor)) throw new AccessError("FORBIDDEN");
}
