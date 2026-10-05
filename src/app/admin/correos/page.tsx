import type { Metadata } from "next";
import { asc } from "drizzle-orm";
import { withDatabase } from "@/db";
import { authorizedEmails } from "@/db/schema";
import { requirePageAccess, getAuthorizedSession } from "@/lib/access";
import { isMasterEmail } from "@/lib/access-policy";
import { headers } from "next/headers";
import { AuthorizedEmailsPanel } from "@/components/authorized-emails-panel";

export const metadata: Metadata = { title: "Correos autorizados" };

const dateFormat = new Intl.DateTimeFormat("es-PE", {
  day: "2-digit", month: "short", year: "numeric", timeZone: "America/Lima",
});

export default async function AuthorizedEmailsPage() {
  const actor = await requirePageAccess();
  const requestHeaders = await headers();
  const rows = await withDatabase(async (db) => {
    // Recheck at the data source, including when a layout is reused by Next.js.
    await getAuthorizedSession(db, requestHeaders);
    return db.select().from(authorizedEmails).orderBy(asc(authorizedEmails.createdAt), asc(authorizedEmails.email));
  });
  return (
    <>
      <p className="eyebrow text-muted-foreground">Administración / Acceso</p>
      <h1 className="editorial-heading mt-4 text-4xl sm:text-5xl">Correos autorizados.</h1>
      <p className="mt-5 max-w-xl text-sm leading-7 text-muted-foreground">El acceso del equipo se controla desde esta lista. Cada persona ingresa con su propia cuenta de Google.</p>
      <AuthorizedEmailsPanel canManage={isMasterEmail(actor.email)} rows={rows.map((row) => ({ email: row.email, addedBy: row.addedBy, createdAt: dateFormat.format(row.createdAt) }))} />
    </>
  );
}
