import type { Metadata } from "next";
import { asc } from "drizzle-orm";
import { AuthorizedEmailsPanel } from "@/components/settings/authorized-emails-panel";
import { SettingsPage } from "@/components/settings/settings-page";
import { withReadDatabase } from "@/db";
import { authorizedEmails } from "@/db/schema";
import { requirePageAccess } from "@/modules/access/application/session";
import { isMasterEmail } from "@/modules/access/domain/policy";

export const metadata: Metadata = { title: "Accesos" };

const dates = new Intl.DateTimeFormat("es-PE", {
  day: "2-digit", month: "short", year: "numeric", timeZone: "America/Lima",
});

export default async function AccessSettingsPage() {
  const actor = await requirePageAccess();
  const rows = await withReadDatabase((db) => db.select().from(authorizedEmails)
    .orderBy(asc(authorizedEmails.createdAt), asc(authorizedEmails.email)));
  return (
    <SettingsPage title="Accesos" description="Administra quién puede ingresar al Gestor con su cuenta de Google.">
      <AuthorizedEmailsPanel canManage={isMasterEmail(actor.email)} rows={rows.map((row) => ({
        email: row.email, addedBy: row.addedBy, createdAt: dates.format(row.createdAt),
      }))} />
    </SettingsPage>
  );
}
