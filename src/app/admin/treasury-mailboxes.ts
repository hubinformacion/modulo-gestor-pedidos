"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { withDatabase } from "@/db";
import { authorizedEmails, treasuryMailboxes } from "@/db/schema";
import { getAuthorizedSession } from "@/modules/access/application/session";
import { AccessError } from "@/modules/access/domain/policy";
import { assertCurrentMaster } from "@/modules/access/data/authorized-emails";
import { writeManagementAudit } from "@/modules/access/data/management-audit";
import { treasuryMailboxSchema } from "@/modules/settings/domain/treasury-mailboxes";
import { reportServerError } from "@/shared/logging/server-diagnostics";

export async function saveTreasuryMailboxAction(input: unknown) {
  const parsed = treasuryMailboxSchema.safeParse(input);
  if (!parsed.success) return { success: false, message: "Ingresa un correo válido." };
  const { imprint, email, previousEmail } = parsed.data;
  const requestHeaders = await headers();
  try {
    const result = await withDatabase(async (db) => {
      const actor = await getAuthorizedSession(db, requestHeaders);
      return db.transaction(async (tx) => {
        await assertCurrentMaster(tx, actor);
        const [current] = await tx.select().from(treasuryMailboxes).where(eq(treasuryMailboxes.publisherImprint, imprint));
        if ((current?.email ?? "") !== previousEmail) {
          return { success: false, message: "El buzón cambió. Actualiza la página antes de guardar." };
        }
        if (email === previousEmail) return { success: true, message: "El buzón ya está actualizado." };
        if (email) {
          const [manager] = await tx.select({ email: authorizedEmails.email }).from(authorizedEmails).where(eq(authorizedEmails.email, email));
          if (manager || email === process.env.GOOGLE_OWNER_EMAIL?.trim().toLowerCase()) {
            return { success: false, message: "Usa un buzón distinto de los correos autorizados y del remitente institucional." };
          }
          await tx.insert(treasuryMailboxes).values({ publisherImprint: imprint, email })
            .onConflictDoUpdate({ target: treasuryMailboxes.publisherImprint, set: { email, createdAt: new Date(), updatedAt: new Date() } });
        } else {
          await tx.delete(treasuryMailboxes).where(eq(treasuryMailboxes.publisherImprint, imprint));
        }
        await writeManagementAudit(tx, actor, "MAILBOX_CHANGED", "treasury_mailbox", imprint, { previous: current?.email ?? null, next: email || null });
        return { success: true, message: email ? "Buzón actualizado." : "Buzón retirado." };
      });
    });
    if (result.success) revalidatePath("/admin/configuracion/correos");
    return result;
  } catch (error) {
    if (error instanceof AccessError) return { success: false, message: error.message };
    reportServerError("settings.treasury.mailbox", error);
    return { success: false, message: "No se pudo guardar el buzón." };
  }
}
