"use server";
import { headers } from "next/headers";
import { after } from "next/server";
import { revalidatePath } from "next/cache";
import { eq, sql } from "drizzle-orm";
import { withDatabase } from "@/db";
import { authorizedEmails, session, user } from "@/db/schema";
import { getAuthorizedSession } from "@/lib/access";
import { AccessError, isMasterEmail } from "@/lib/access-policy";
import { assertAuthorized } from "@/lib/transaction-access";
import { cajaSettingsSchema } from "@/lib/caja/validation";
import { CajaError } from "@/lib/caja/service";
import { recoverCajaMail } from "@/lib/caja/email";
import { synchronizeDriveReaders } from "@/lib/payments/drive-access";
import { reportServerError } from "@/lib/server-diagnostics";
export async function saveCajaResponsibleAction(input: unknown) {
  const parsed = cajaSettingsSchema.safeParse(input);
  if (!parsed.success) return { success: false, message: "Ingresa un correo válido." };
  try {
    const requestHeaders = await headers();
    await withDatabase(async (db) => {
      const actor = await getAuthorizedSession(db, requestHeaders);
      if (!isMasterEmail(actor.email)) throw new AccessError("FORBIDDEN");
      await db.transaction(async (tx) => {
        await assertAuthorized(tx, actor);
        await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${`caja-responsible:${parsed.data.imprint}`}))`);
        const [current] = await tx.select().from(authorizedEmails).where(eq(authorizedEmails.publisherImprint, parsed.data.imprint)).for("update");
        if ((current?.email ?? "") !== parsed.data.previousEmail) throw new CajaError("La configuración cambió. Actualiza la página.");
        if (current?.email === parsed.data.email) return;
        if (parsed.data.email && (isMasterEmail(parsed.data.email) || parsed.data.email === process.env.GOOGLE_OWNER_EMAIL?.trim().toLowerCase())) throw new CajaError("Usa una cuenta exclusiva de caja, distinta del maestro y del propietario Google.");
        if (parsed.data.email) {
          const [existing] = await tx.select().from(authorizedEmails).where(eq(authorizedEmails.email, parsed.data.email));
          if (existing) throw new CajaError("Este correo ya tiene otro acceso. Usa una cuenta diferente o revoca su acceso anterior.");
        }
        if (current) {
          await tx.delete(authorizedEmails).where(eq(authorizedEmails.email, current.email));
          const [owner] = await tx.select({ id: user.id }).from(user).where(eq(user.email, current.email));
          if (owner) await tx.delete(session).where(eq(session.userId, owner.id));
        }
        if (parsed.data.email) await tx.insert(authorizedEmails).values({ email: parsed.data.email, role: "caja", publisherImprint: parsed.data.imprint, addedBy: actor.email });
      });
    });
    revalidatePath("/admin/configuracion");
    after(async () => {
      try { await synchronizeDriveReaders(); await recoverCajaMail(); }
      catch (error) { reportServerError("caja.config.recovery", error); }
    });
    return { success: true, message: parsed.data.email ? "Responsable de caja actualizado." : "Acceso de caja revocado." };
  } catch (error) {
    if (!(error instanceof AccessError || error instanceof CajaError)) reportServerError("caja.config.failed", error);
    return { success: false, message: error instanceof AccessError || error instanceof CajaError ? error.message : "No se pudo actualizar el acceso de caja." };
  }
}
