import type { Metadata } from "next";
import { asc } from "drizzle-orm";
import { withDatabase, withReadDatabase } from "@/db";
import { authorizedEmails, bankAccounts, campuses } from "@/db/schema";
import { requirePageAccess, getAuthorizedSession } from "@/lib/access";
import { isMasterEmail } from "@/lib/access-policy";
import { headers } from "next/headers";
import { AuthorizedEmailsPanel } from "@/components/authorized-emails-panel";
import { getPaymentSetupStatus } from "@/lib/payments/config";
import { CampusesPanel } from "@/components/campuses-panel";
import { SettingsTabs } from "@/components/admin/settings-tabs";
import { BankAccountsPanel } from "@/components/bank-accounts-panel";

export const metadata: Metadata = { title: "Configuración" };

const dateFormat = new Intl.DateTimeFormat("es-PE", {
  day: "2-digit", month: "short", year: "numeric", timeZone: "America/Lima",
});

export default async function AuthorizedEmailsPage() {
  const actor = await requirePageAccess();
  const requestHeaders = await headers();
  // Recheck at the data source, including when a layout is reused by Next.js.
  await withDatabase((db) => getAuthorizedSession(db, requestHeaders));
  const [rows, campusRows, bankRows] = await withReadDatabase(async (db) => {
    return Promise.all([
      db.select().from(authorizedEmails).orderBy(asc(authorizedEmails.createdAt), asc(authorizedEmails.email)),
      db.select().from(campuses).orderBy(asc(campuses.name)),
      db.select().from(bankAccounts).orderBy(asc(bankAccounts.publisherImprint), asc(bankAccounts.bank)),
    ]);
  });
  const paymentSetup = await getPaymentSetupStatus();
  return (
    <>
      <h1 className="page-heading">Configuración</h1>
      <SettingsTabs emails={<section aria-labelledby="emails-title">
      <h2 id="emails-title" className="text-lg font-semibold tracking-tight">Correos autorizados</h2>
      <p className="mt-3 max-w-xl text-sm leading-6 text-muted-foreground">Controla quién puede ingresar al sistema. Cada persona utiliza su propia cuenta de Google.</p>
      <AuthorizedEmailsPanel canManage={isMasterEmail(actor.email)} rows={rows.map((row) => ({ email: row.email, addedBy: row.addedBy, createdAt: dateFormat.format(row.createdAt) }))} />
      </section>} campuses={<section aria-labelledby="campuses-title">
        <h2 id="campuses-title" className="text-lg font-semibold tracking-tight">Campus y bibliotecas</h2>
        <p className="mt-3 max-w-xl text-sm leading-6 text-muted-foreground">Gestiona las sedes y sus lugares de recojo. Puedes ajustar la ubicación exacta del mapa y desactivar campus temporalmente.</p>
        <CampusesPanel rows={campusRows.map((row) => ({ id: row.id, name: row.name, libraryAddress: row.libraryAddress, latitude: row.latitude ?? "", longitude: row.longitude ?? "", googleMapsEmbedUrl: row.googleMapsEmbedUrl ?? "", status: row.status }))} />
      </section>} banks={<section aria-labelledby="bank-accounts-title">
        <h2 id="bank-accounts-title" className="text-lg font-semibold tracking-tight">Cuentas bancarias</h2>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">Gestiona las alternativas de pago de cada sello. Los pedidos anteriores conservan las cuentas que recibieron al registrarse.</p>
        <BankAccountsPanel rows={bankRows.map((row) => ({ id: row.id, publisherImprint: row.publisherImprint, bank: row.bank, holder: row.holder, account: row.account, cci: row.cci, currency: "PEN", status: row.status }))} />
      </section>} integrations={<section aria-labelledby="payment-setup-title">
        <h2 id="payment-setup-title" className="text-lg font-semibold tracking-tight">Registro de pedidos y pagos</h2>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">El registro público se habilita cuando están disponibles las cuentas, guías y credenciales. Este listado comprueba la configuración; la conexión con Google se revisa al operar.</p>
        <ul className="mt-5 divide-y divide-border rounded-xl border border-border px-4">{paymentSetup.map((item) => <li key={item.label} className="flex items-center justify-between gap-3 py-3 text-xs"><span>{item.label}</span><span className={item.ready ? "font-medium text-primary" : "text-muted-foreground"}>{item.ready ? "Configurado" : "Pendiente"}</span></li>)}</ul>
      </section>} />
    </>
  );
}
