import "server-only";
import { and, eq, sql } from "drizzle-orm";
import { drive } from "googleapis/build/src/apis/drive/index.js";
import { withDatabase } from "@/db";
import { authorizedEmails, driveReaderGrants } from "@/db/schema";
import { ownerAuth } from "@/lib/google";
import { safeErrorDetails } from "@/lib/server-diagnostics";

export async function synchronizeDriveReaders(): Promise<void> {
  const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID?.trim();
  if (!folderId) return;
  const owner = process.env.GOOGLE_OWNER_EMAIL?.trim().toLowerCase();
  const api = drive({ version: "v3", auth: ownerAuth() });
  // A service-only advisory lock orders concurrent reconciliation jobs. Google
  // calls never lock orders/stock/auth rows. Individual ACL records commit as
  // each Google operation succeeds, preserving recovery after partial failure.
  await withDatabase((db) => db.transaction(async (tx) => {
    await tx.execute(sql`SET LOCAL lock_timeout = '10s'`);
    await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${`drive-readers:${folderId}`}))`);
    const allowed = new Set((await tx.select({ email: authorizedEmails.email }).from(authorizedEmails).where(eq(authorizedEmails.role, "gestor"))).map((row) => row.email));
    const managed = await tx.select().from(driveReaderGrants).where(eq(driveReaderGrants.folderId, folderId));
    for (const grant of managed) {
      if (allowed.has(grant.email) && grant.email !== owner) continue;
      try { await api.permissions.delete({ fileId: folderId, permissionId: grant.permissionId, supportsAllDrives: true }, { timeout: 15_000, retry: false }); }
      catch (error) { if (safeErrorDetails(error).status !== 404) throw error; }
      await withDatabase((writer) => writer.delete(driveReaderGrants).where(and(eq(driveReaderGrants.folderId, folderId), eq(driveReaderGrants.email, grant.email))));
    }
    const permissions: { id?: string | null; type?: string | null; role?: string | null; emailAddress?: string | null }[] = [];
    let pageToken: string | undefined;
    do {
      const response = await api.permissions.list({ fileId: folderId, supportsAllDrives: true, pageSize: 100, pageToken, fields: "nextPageToken,permissions(id,type,role,emailAddress)" }, { timeout: 15_000, retry: false });
      permissions.push(...(response.data.permissions ?? [])); pageToken = response.data.nextPageToken ?? undefined;
    } while (pageToken);
    for (const email of allowed) {
      if (email === owner) continue;
      const existing = permissions.find((item) => item.type === "user" && item.emailAddress?.toLowerCase() === email);
      // Pre-existing owners/writers are managed by the organization, not downgraded.
      if (existing && ["owner", "writer", "organizer", "fileOrganizer"].includes(existing.role ?? "")) continue;
      let permissionId = existing?.id;
      if (!permissionId) {
        const granted = await api.permissions.create({ fileId: folderId, supportsAllDrives: true, sendNotificationEmail: false, requestBody: { type: "user", role: "reader", emailAddress: email }, fields: "id" }, { timeout: 15_000, retry: false });
        permissionId = granted.data.id;
      }
      if (!permissionId) throw new Error("DRIVE_READER_ID_MISSING");
      await withDatabase((writer) => writer.insert(driveReaderGrants).values({ folderId, email, permissionId }).onConflictDoUpdate({ target: [driveReaderGrants.folderId, driveReaderGrants.email], set: { permissionId } }));
    }
  }));
  const { synchronizeCajaFileReaders } = await import("@/lib/caja/drive-access");
  await synchronizeCajaFileReaders();
}
