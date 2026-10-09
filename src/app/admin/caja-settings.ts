"use server";
import { headers } from "next/headers";
import { after } from "next/server";
import { revalidatePath } from "next/cache";
import { and, eq, sql } from "drizzle-orm";
import { withDatabase } from "@/db";
import { authorizedEmails, session, user } from "@/db/schema";
import { getAuthorizedSession } from "@/lib/access";
import { AccessError, isMasterEmail } from "@/lib/access-policy";
import { assertAuthorized } from "@/lib/transaction-access";
import { cajaSettingsSchema } from "@/lib/caja/validation";
import { CajaError } from "@/lib/caja/service";
import { releaseCajaAssignments } from "@/lib/caja/release-assignments";
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
        const { email, imprint, operation } = parsed.data;
        if (isMasterEmail(email) || email === process.env.GOOGLE_OWNER_EMAIL?.trim().toLowerCase()) throw new CajaError("Usa una cuenta de caja distinta del maestro y del propietario Google.");
        const [current] = await tx.select().from(authorizedEmails).where(eq(authorizedEmails.email, email)).for("update");
        if (operation === "add") {
          if (current) throw new CajaError("Este correo ya tiene acceso. Revócalo antes de cambiar su rol o sello.");
          await tx.insert(authorizedEmails).values({ email, role: "caja", publisherImprint: imprint, addedBy: actor.email });
        } else {
          if (!current || current.role !== "caja" || current.publisherImprint !== imprint) throw new CajaError("El acceso cambió. Actualiza la página.");
          await tx.delete(authorizedEmails).where(and(eq(authorizedEmails.email, email), eq(authorizedEmails.role, "caja"), eq(authorizedEmails.publisherImprint, imprint)));
          const owners = await tx.select({ id: user.id }).from(user).where(eq(user.email, email));
          await releaseCajaAssignments(tx, owners.map((owner) => owner.id), actor);
          for (const owner of owners) await tx.delete(session).where(eq(session.userId, owner.id));
        }
      });
    });
    revalidatePath("/admin/configuracion"); revalidatePath("/caja", "layout");
    after(async () => {
      try { await synchronizeDriveReaders(); }
      catch (error) { reportServerError("caja.config.recovery", error); }
    });
    return { success: true, message: parsed.data.operation === "add" ? "Responsable de caja añadido." : "Acceso revocado y solicitudes abiertas liberadas." };
  } catch (error) {
    if (!(error instanceof AccessError || error instanceof CajaError)) reportServerError("caja.config.failed", error);
    return { success: false, message: error instanceof AccessError || error instanceof CajaError ? error.message : "No se pudo actualizar el acceso de caja." };
  }
}
