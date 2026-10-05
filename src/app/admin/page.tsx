import type { Metadata } from "next";
import { asc } from "drizzle-orm";
import { withDatabase } from "@/db";
import { authorizedEmails, campuses } from "@/db/schema";
import { requirePageAccess, getAuthorizedSession } from "@/lib/access";
import { isMasterEmail } from "@/lib/access-policy";
import { headers } from "next/headers";
import { AuthorizedEmailsPanel } from "@/components/authorized-emails-panel";
import { CampusesPanel } from "@/components/campuses-panel";

export const metadata: Metadata = { title: "Configuración" };

const dateFormat = new Intl.DateTimeFormat("es-PE", {
  day: "2-digit", month: "short", year: "numeric", timeZone: "America/Lima",
});

export default async function AuthorizedEmailsPage() {
  const actor = await requirePageAccess();
  const requestHeaders = await headers();
  const [rows, campusRows] = await withDatabase(async (db) => {
    // Recheck at the data source, including when a layout is reused by Next.js.
    await getAuthorizedSession(db, requestHeaders);
    return Promise.all([
      db.select().from(authorizedEmails).orderBy(asc(authorizedEmails.createdAt), asc(authorizedEmails.email)),
      db.select().from(campuses).orderBy(asc(campuses.name)),
    ]);
  });
  return (
    <>
      <h1 className="page-heading">Configuración</h1>
      <h2 className="mt-8 text-lg font-semibold tracking-tight">Correos autorizados</h2>
      <p className="mt-3 max-w-xl text-sm leading-6 text-muted-foreground">Controla quién puede ingresar al sistema. Cada persona utiliza su propia cuenta de Google.</p>
      <AuthorizedEmailsPanel canManage={isMasterEmail(actor.email)} rows={rows.map((row) => ({ email: row.email, addedBy: row.addedBy, createdAt: dateFormat.format(row.createdAt) }))} />
      <section className="mt-12 border-t border-border pt-8" aria-labelledby="campuses-title">
        <h2 id="campuses-title" className="text-lg font-semibold tracking-tight">Campus y bibliotecas</h2>
        <p className="mt-3 max-w-xl text-sm leading-6 text-muted-foreground">Gestiona las sedes y sus lugares de recojo. Puedes ajustar la ubicación exacta del mapa y desactivar campus temporalmente.</p>
        <CampusesPanel rows={campusRows.map((row) => ({ id: row.id, name: row.name, libraryAddress: row.libraryAddress, latitude: row.latitude ?? "", longitude: row.longitude ?? "", googleMapsEmbedUrl: row.googleMapsEmbedUrl ?? "", status: row.status }))} />
      </section>
    </>
  );
}
