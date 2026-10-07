import "server-only";
import { and, eq, isNull, or, sql } from "drizzle-orm";
import { drive } from "googleapis/build/src/apis/drive/index.js";
import { withDatabase } from "@/db";
import { authorizedEmails, cajaRequests, driveFileReaderGrants, paymentReceipts, saleDocuments } from "@/db/schema";
import { assertAccessRole } from "@/lib/transaction-access";
import { AccessError, type AuthorizedActor } from "@/lib/access-policy";
import { ownerAuth } from "@/lib/google";
import { reportServerError, safeErrorDetails } from "@/lib/server-diagnostics";

async function reconcileFile(fileId: string, email: string) {
  const api = drive({ version: "v3", auth: ownerAuth() });
  await withDatabase((db) => db.transaction(async (tx) => {
    // Service-only lock: no authentication, order or inventory lock across I/O.
    await tx.execute(sql`SET LOCAL lock_timeout = '10s'`);
    await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${`caja-file:${fileId}`}))`);
    const [grant] = await tx.select().from(driveFileReaderGrants).where(and(eq(driveFileReaderGrants.driveFileId, fileId), eq(driveFileReaderGrants.email, email)));
    if (!grant) return;
    const [allowed] = await tx.select({ email: authorizedEmails.email }).from(authorizedEmails).innerJoin(cajaRequests, eq(cajaRequests.publisherImprint, authorizedEmails.publisherImprint)).where(and(eq(authorizedEmails.role, "caja"), eq(authorizedEmails.email, email), eq(cajaRequests.id, grant.requestId)));
    const permissions = []; let pageToken: string | undefined;
    do {
      const response = await api.permissions.list({ fileId, supportsAllDrives: true, pageToken, fields: "nextPageToken,permissions(id,type,role,emailAddress,permissionDetails)" }, { timeout: 15_000, retry: false });
      permissions.push(...(response.data.permissions ?? [])); pageToken = response.data.nextPageToken ?? undefined;
    } while (pageToken);
    const existing = permissions.find((item) => item.type === "user" && item.emailAddress?.toLowerCase() === email);
    if (!allowed) {
      const effective = existing ?? permissions.find((item) => item.id === grant.permissionId);
      const removable = !effective || (effective.role === "reader" && !effective.permissionDetails?.some((detail) => detail.inherited));
      if (grant.managed && removable && (grant.permissionId || existing?.id)) {
        try { await api.permissions.delete({ fileId, permissionId: grant.permissionId ?? existing!.id!, supportsAllDrives: true }, { timeout: 15_000, retry: false }); }
        catch (error) { if (safeErrorDetails(error).status !== 404) throw error; }
      }
      await tx.delete(driveFileReaderGrants).where(and(eq(driveFileReaderGrants.driveFileId, fileId), eq(driveFileReaderGrants.email, email))); return;
    }
    const managed = !existing || (existing.role === "reader" && !existing.permissionDetails?.some((detail) => detail.inherited));
    const permissionId = existing?.id ?? (await api.permissions.create({ fileId, supportsAllDrives: true, sendNotificationEmail: false, requestBody: { type: "user", role: "reader", emailAddress: email }, fields: "id" }, { timeout: 15_000, retry: false })).data.id;
    if (!permissionId) throw new Error("CAJA_PERMISSION_ID_MISSING");
    // Commit provider acknowledgement independently so a later error cannot
    // orphan an ACL. Pending intents reconcile ambiguous create responses.
    await withDatabase((writer) => writer.update(driveFileReaderGrants).set({ permissionId, managed }).where(and(eq(driveFileReaderGrants.driveFileId, fileId), eq(driveFileReaderGrants.email, email))));
  }));
}
async function retryFile(fileId: string, email: string) { try { await reconcileFile(fileId, email); } catch { await reconcileFile(fileId, email); } }
export async function ensureCajaFileReader(actor: AuthorizedActor, requestId: string, fileId: string) {
  await withDatabase((db) => db.transaction(async (tx) => {
    await assertAccessRole(tx, actor, "caja");
    const [request] = await tx.select().from(cajaRequests).where(and(eq(cajaRequests.id, requestId), eq(cajaRequests.publisherImprint, actor.publisherImprint!)));
    if (!request) throw new AccessError("FORBIDDEN");
    const [document] = await tx.select({ id: saleDocuments.id }).from(saleDocuments).where(and(eq(saleDocuments.requestId, requestId), eq(saleDocuments.driveFileId, fileId), sql`${saleDocuments.uploadedAt} IS NOT NULL`));
    const [receipt] = document ? [] : await tx.select({ id: paymentReceipts.id }).from(paymentReceipts).where(and(eq(paymentReceipts.orderId, request.orderId), eq(paymentReceipts.publisherImprint, request.publisherImprint), eq(paymentReceipts.driveFileId, fileId)));
    if (!document && !receipt) throw new AccessError("FORBIDDEN");
    await tx.insert(driveFileReaderGrants).values({ driveFileId: fileId, email: actor.email, requestId }).onConflictDoNothing();
  }));
  await retryFile(fileId, actor.email);
  await withDatabase((db) => db.transaction(async (tx) => { await assertAccessRole(tx, actor, "caja"); }));
}
export async function synchronizeCajaFileReaders() {
  // Reconcile pending creates/revocations, not every established ACL daily.
  // File opening rechecks its grant; idle jobs must stay bounded on free Neon.
  const rows = await withDatabase((db) => db.select({ fileId: driveFileReaderGrants.driveFileId, email: driveFileReaderGrants.email }).from(driveFileReaderGrants)
    .leftJoin(cajaRequests, eq(cajaRequests.id, driveFileReaderGrants.requestId))
    .leftJoin(authorizedEmails, and(eq(authorizedEmails.email, driveFileReaderGrants.email), eq(authorizedEmails.role, "caja"), eq(authorizedEmails.publisherImprint, cajaRequests.publisherImprint)))
    .where(or(isNull(driveFileReaderGrants.permissionId), isNull(authorizedEmails.email)))
    .orderBy(sql`CASE WHEN ${authorizedEmails.email} IS NULL THEN 0 ELSE 1 END`).limit(25));
  const started = Date.now();
  for (const row of rows) {
    if (Date.now() - started >= 50_000) break;
    try { await retryFile(row.fileId, row.email); }
    catch (error) { reportServerError("caja.file.permission.pending", error); }
  }
}
