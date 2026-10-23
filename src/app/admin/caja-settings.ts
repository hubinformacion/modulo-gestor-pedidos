"use server";
import { writeManagementAudit, accessSnapshot } from "@/modules/access/data/management-audit";
import { headers } from "next/headers";
import { after } from "next/server";
import { revalidatePath } from "next/cache";
import { and, eq, sql } from "drizzle-orm";
import { withDatabase } from "@/db";
import { authorizedEmails, treasuryMailboxes, user, session } from "@/db/schema";
import { getAuthorizedSession } from "@/modules/access/application/session";
import { AccessError, isMasterEmail } from "@/modules/access/domain/policy";
import { assertAuthorized } from "@/modules/access/data/transaction-access";
import { releaseCajaAssignments } from "@/modules/treasury/data/release-assignments";
import { treasuryScopes } from "@/modules/treasury/domain/scope";
import { teamSchema, mailboxSchema } from "@/modules/treasury/domain/notes";
import { synchronizeCajaFileReaders } from "@/integrations/google/treasury-readers";
import { DatabaseOperationError } from "@/db/errors";
import { reportServerError } from "@/shared/logging/server-diagnostics";
class SettingsError extends Error {}
function rejectReserved(email: string) { if (isMasterEmail(email) || email === process.env.GOOGLE_OWNER_EMAIL?.trim().toLowerCase()) throw new SettingsError("Usa una cuenta distinta del maestro de Fondo Editorial y del propietario Google."); }
function fail(error: unknown) { if (!(error instanceof SettingsError || error instanceof AccessError)) reportServerError("treasury.settings", error); return { success: false, message: error instanceof SettingsError || error instanceof AccessError ? error.message : error instanceof DatabaseOperationError ? "Se interrumpió la conexión con la base de datos. Actualiza la configuración para comprobar si el cambio quedó guardado antes de reintentar." : "No pudimos guardar los accesos." }; }
function refreshed() {
  revalidatePath("/admin/configuracion"); revalidatePath("/tesoreria-recaudacion", "layout");
  after(async () => { try { await synchronizeCajaFileReaders(); } catch (error) { reportServerError("treasury.access.sync", error); } });
}
export async function saveTreasuryTeamAction(input: unknown) {
  const parsed = teamSchema.safeParse(input); if (!parsed.success) return { success: false, message: "Selecciona un correo y al menos una unidad de negocio." };
  try {
    const h = await headers();
    await withDatabase(async (db) => {
      const actor = await getAuthorizedSession(db, h); if (!isMasterEmail(actor.email)) throw new AccessError("FORBIDDEN");
      await db.transaction(async (tx) => {
        await tx.execute(sql`SET LOCAL lock_timeout = '10s'`);
        await tx.execute(sql`SET LOCAL statement_timeout = '20s'`);
        await tx.execute(sql`SET LOCAL idle_in_transaction_session_timeout = '30s'`);
        await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext('treasury-access'))`); await assertAuthorized(tx, actor);
        const { email, operation } = parsed.data; const imprints = [...new Set(parsed.data.imprints)].sort(); rejectReserved(email);
        const [current] = await tx.select().from(authorizedEmails).where(eq(authorizedEmails.email, email)).for("update");
        if (current && (current.role !== "caja" || current.treasuryService)) throw new SettingsError("Este correo tiene otro acceso o es un buzón de servicio.");
        const owners = await tx.select({ id: user.id }).from(user).where(eq(user.email, email));
        if (operation === "remove") {
          if (!current) throw new SettingsError("El correo ya no tiene acceso.");
          await tx.delete(authorizedEmails).where(eq(authorizedEmails.email, email));
        } else if (current) {
          if (JSON.stringify(treasuryScopes(current).sort()) === JSON.stringify(imprints)) return;
          await tx.update(authorizedEmails).set({ publisherImprint: imprints[0], publisherImprints: imprints }).where(eq(authorizedEmails.email, email));
        } else await tx.insert(authorizedEmails).values({ email, role: "caja", publisherImprint: imprints[0], publisherImprints: imprints, addedBy: actor.email });
        const [updatedAccess] = await tx.select().from(authorizedEmails).where(eq(authorizedEmails.email, email));
        await writeManagementAudit(tx, actor, operation === "remove" ? "ACCESS_REVOKED" : current ? "ACCESS_CHANGED" : "ACCESS_CREATED", "access", email, { previous: accessSnapshot(current), next: accessSnapshot(updatedAccess) });
        await releaseCajaAssignments(tx, owners.map((owner) => owner.id), actor);
        for (const owner of owners) await tx.delete(session).where(eq(session.userId, owner.id));
      });
    }); refreshed(); return { success: true, message: parsed.data.operation === "remove" ? "Acceso revocado." : "Accesos de Tesorería Recaudación guardados." };
  } catch (error) { return fail(error); }
}
export async function saveTreasuryMailboxAction(input: unknown) {
  const parsed = mailboxSchema.safeParse(input); if (!parsed.success) return { success: false, message: "Ingresa un correo de servicio válido." };
  try {
    const h = await headers();
    await withDatabase(async (db) => {
      const actor = await getAuthorizedSession(db, h); if (!isMasterEmail(actor.email)) throw new AccessError("FORBIDDEN");
      await db.transaction(async (tx) => {
        await tx.execute(sql`SET LOCAL lock_timeout = '10s'`);
        await tx.execute(sql`SET LOCAL statement_timeout = '20s'`);
        await tx.execute(sql`SET LOCAL idle_in_transaction_session_timeout = '30s'`);
        await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext('treasury-access'))`); await assertAuthorized(tx, actor);
        const { email, imprint, previousEmail } = parsed.data;
        const [current] = await tx.select().from(treasuryMailboxes).where(eq(treasuryMailboxes.publisherImprint, imprint)).for("update");
        // A manual repeat after an ambiguous COMMIT acknowledges the already
        // committed value without resetting its date or replaying side effects.
        if ((current?.email ?? "") === email) return;
        if ((current?.email ?? "") !== previousEmail) throw new SettingsError("El buzón cambió. Actualiza la página.");
        if (email) {
          rejectReserved(email);
          const [member] = await tx.select().from(authorizedEmails).where(eq(authorizedEmails.email, email)).for("update");
          if (member && member.role !== "caja") throw new SettingsError("El correo ya tiene acceso como gestor de Fondo Editorial.");
          const existingMailboxes = await tx.select().from(treasuryMailboxes).where(eq(treasuryMailboxes.email, email));
          const scopes = [...new Set([...existingMailboxes.map((row) => row.publisherImprint), imprint])].sort();
          if (member && !member.treasuryService) {
            const owners = await tx.select({ id: user.id }).from(user).where(eq(user.email, email));
            await releaseCajaAssignments(tx, owners.map((owner) => owner.id), actor);
            for (const owner of owners) await tx.delete(session).where(eq(session.userId, owner.id));
          }
          if (member) await tx.update(authorizedEmails).set({ publisherImprint: scopes[0], publisherImprints: scopes, treasuryService: true }).where(eq(authorizedEmails.email, email));
          else await tx.insert(authorizedEmails).values({ email, role: "caja", publisherImprint: imprint, publisherImprints: [imprint], treasuryService: true, addedBy: actor.email });
          const [serviceAccess] = await tx.select().from(authorizedEmails).where(eq(authorizedEmails.email, email));
          await writeManagementAudit(tx, actor, member ? "ACCESS_CHANGED" : "ACCESS_CREATED", "access", email, { previous: accessSnapshot(member), next: accessSnapshot(serviceAccess) });
          await tx.insert(treasuryMailboxes).values({ publisherImprint: imprint, email }).onConflictDoUpdate({ target: treasuryMailboxes.publisherImprint, set: { email, createdAt: new Date() } });
        } else await tx.delete(treasuryMailboxes).where(eq(treasuryMailboxes.publisherImprint, imprint));
        await writeManagementAudit(tx, actor, "MAILBOX_CHANGED", "treasury_mailbox", imprint, { previousEmail, email });
        if (previousEmail) {
          const [previousAccess] = await tx.select().from(authorizedEmails).where(eq(authorizedEmails.email, previousEmail));
          const others = await tx.select().from(treasuryMailboxes).where(eq(treasuryMailboxes.email, previousEmail));
          if (!others.length) await tx.delete(authorizedEmails).where(and(eq(authorizedEmails.email, previousEmail), eq(authorizedEmails.treasuryService, true)));
          else await tx.update(authorizedEmails).set({ publisherImprint: others[0].publisherImprint, publisherImprints: others.map((row) => row.publisherImprint) }).where(eq(authorizedEmails.email, previousEmail));
          const [remainingAccess] = await tx.select().from(authorizedEmails).where(eq(authorizedEmails.email, previousEmail));
          await writeManagementAudit(tx, actor, remainingAccess ? "ACCESS_CHANGED" : "ACCESS_REVOKED", "access", previousEmail, { previous: accessSnapshot(previousAccess), next: accessSnapshot(remainingAccess) });
          const owners = await tx.select({ id: user.id }).from(user).where(eq(user.email, previousEmail));
          for (const owner of owners) await tx.delete(session).where(eq(session.userId, owner.id));
        }
      });
    }); refreshed(); return { success: true, message: "Buzón de servicio actualizado. No se reenviarán avisos históricos." };
  } catch (error) { return fail(error); }
}
