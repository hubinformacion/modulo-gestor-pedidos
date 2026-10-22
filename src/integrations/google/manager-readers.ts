import { withDatabase } from "@/db";
import { authorizedEmails, driveReaderGrants } from "@/db/schema";
import { ownerAuth } from "@/integrations/google/auth";
import { safeErrorDetails } from "@/shared/logging/server-diagnostics";
import { and, eq, sql } from "drizzle-orm";
import { drive, type drive_v3 } from "googleapis/build/src/apis/drive/index.js";
import "server-only";

export async function synchronizeDriveReaders(): Promise<void> {
  const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID?.trim();
  if (!folderId) return;
  const owner = process.env.GOOGLE_OWNER_EMAIL?.trim().toLowerCase();
  const api = drive({ version: "v3", auth: ownerAuth() });
  // Serializes application ACL operations only. Administrators must coordinate
  // manual edits of the same principal; Google offers no conditional ACL delete.
  await withDatabase((db) => db.transaction(async (tx) => {
    await tx.execute(sql`SET LOCAL lock_timeout = '10s'`);
    await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${`drive-readers:${folderId}`}))`);
    const members = await tx.select({ email: authorizedEmails.email }).from(authorizedEmails).where(eq(authorizedEmails.role, "gestor"));
    const grants = await tx.select().from(driveReaderGrants).where(eq(driveReaderGrants.folderId, folderId));
    const permissions: drive_v3.Schema$Permission[] = [];
    let pageToken: string | undefined;
    do {
      const response = await api.permissions.list({ fileId: folderId, supportsAllDrives: true, pageSize: 100, pageToken, fields: "nextPageToken,permissions(id,type,role,emailAddress,permissionDetails)" }, { timeout: 15_000, retry: false });
      permissions.push(...(response.data.permissions ?? [])); pageToken = response.data.nextPageToken ?? undefined;
    } while (pageToken);
    const allowed = async (email: string) => email !== owner && (await tx.select({ email: authorizedEmails.email }).from(authorizedEmails).where(and(eq(authorizedEmails.email, email), eq(authorizedEmails.role, "gestor")))).length > 0;
    const condition = (email: string) => and(eq(driveReaderGrants.folderId, folderId), eq(driveReaderGrants.email, email));
    const forget = (email: string) => withDatabase((writer) => writer.delete(driveReaderGrants).where(condition(email)));
    const remember = (email: string, permissionId: string | null) => withDatabase((writer) => writer.insert(driveReaderGrants).values({ folderId, email, permissionId }).onConflictDoUpdate({ target: [driveReaderGrants.folderId, driveReaderGrants.email], set: { permissionId } }));
    const directReader = (permission: drive_v3.Schema$Permission, email: string) => permission.type === "user" && permission.emailAddress?.toLowerCase() === email && permission.role === "reader" && !permission.permissionDetails?.some((detail) => detail.inherited);
    const readCurrent = async (permissionId: string) => {
      try { return (await api.permissions.get({ fileId: folderId, permissionId, supportsAllDrives: true, fields: "id,type,role,emailAddress,permissionDetails" }, { timeout: 15_000, retry: false })).data; }
      catch (error) { if (safeErrorDetails(error).status === 404) return null; throw error; }
    };
    const revoke = async (email: string, permissionId: string) => {
      // Inspect current role/inheritance immediately before deleting, rather
      // than trusting the original list or a historical database role.
      const current = await readCurrent(permissionId);
      if (current && directReader(current, email)) {
        try { await api.permissions.delete({ fileId: folderId, permissionId, supportsAllDrives: true }, { timeout: 15_000, retry: false }); }
        catch (error) { if (safeErrorDetails(error).status !== 404) throw error; }
      }
      await forget(email);
    };
    const emails = [...new Set([...members.map((row) => row.email), ...grants.map((row) => row.email)])].sort();
    for (const email of emails) {
      const grant = grants.find((row) => row.email === email);
      const existing = grant?.permissionId
        ? await readCurrent(grant.permissionId)
        : permissions.find((permission) => permission.type === "user" && permission.emailAddress?.toLowerCase() === email);
      if (grant?.permissionId && !existing && permissions.some((permission) => permission.type === "user" && permission.emailAddress?.toLowerCase() === email)) {
        await forget(email); // Replaced outside the application: preserve that permission.
        continue;
      }
      if (!grant && existing) continue; // Preexisting manual permissions are never adopted.
      if (grant && existing && !directReader(existing, email)) {
        await forget(email); // Owner/writer/inherited/manual replacement is not ours.
        continue;
      }
      if (grant && existing?.id) {
        if (!grant.permissionId) await remember(email, existing.id); // Recover lost create response.
        if (!await allowed(email)) await revoke(email, existing.id);
        continue;
      }
      if (!await allowed(email)) {
        // A null intent may correspond to an accepted but not yet visible
        // provider write. Keep it for bounded ACL reconciliation after revocation.
        if (grant?.permissionId) await forget(email);
        continue;
      }
      // Commit provenance BEFORE contacting Google. A timeout or failed ACK
      // leaves an identifiable intent, including if authorization is revoked.
      await remember(email, null);
      if (!await allowed(email)) continue;
      const created = await api.permissions.create({ fileId: folderId, supportsAllDrives: true, sendNotificationEmail: false, requestBody: { type: "user", role: "reader", emailAddress: email }, fields: "id" }, { timeout: 15_000, retry: false });
      if (!created.data.id) throw new Error("DRIVE_READER_ID_MISSING");
      await remember(email, created.data.id);
      if (!await allowed(email)) await revoke(email, created.data.id);
    }
  }));
  const { synchronizeCajaFileReaders } = await import("@/integrations/google/treasury-readers");
  await synchronizeCajaFileReaders();
}
