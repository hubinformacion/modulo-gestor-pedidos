import "server-only";
import { and, asc, eq, lte } from "drizzle-orm";
import { z } from "zod";
import { withReadDatabase } from "@/db";
import { authorizedEmails } from "@/db/schema";

// Resolve at every send: revoked managers lose access immediately. A new or
// reinstated manager is not copied on a recovery of an older event.
export async function managerMailCopies(eventCreatedAt: Date, recipients: readonly string[]) {
  const rows = await withReadDatabase((db) => db.select({ email: authorizedEmails.email }).from(authorizedEmails)
    .where(and(eq(authorizedEmails.role, "gestor"), lte(authorizedEmails.createdAt, eventCreatedAt))).orderBy(asc(authorizedEmails.email)));
  return [...new Set(rows.map((row) => z.email().parse(row.email).toLowerCase()))].filter((email) => !recipients.some((recipient) => email === recipient.toLowerCase()));
}
