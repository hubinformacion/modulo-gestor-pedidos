import type { Metadata } from "next";
import { asc } from "drizzle-orm";
import { BankAccountsPanel } from "@/components/settings/bank-accounts-panel";
import { SettingsPage, SettingsSection } from "@/components/settings/settings-page";
import { withReadDatabase } from "@/db";
import { bankAccounts } from "@/db/schema";
import { requirePageAccess } from "@/modules/access/application/session";
import { getPaymentGuideStatuses } from "@/modules/settings/application/payment-config";
import { bankAccountsFromRows } from "@/modules/settings/domain/bank-accounts";

export const metadata: Metadata = { title: "Pagos" };

export default async function PaymentSettingsPage() {
  await requirePageAccess();
  const [rows, guides] = await Promise.all([
    withReadDatabase((db) => db.select().from(bankAccounts).orderBy(asc(bankAccounts.publisherImprint), asc(bankAccounts.bank))),
    getPaymentGuideStatuses(),
  ]);
  return (
    <SettingsPage title="Pagos" description="Configura las cuentas de depósito por sello y revisa las guías que recibe el comprador.">
      <SettingsSection id="bank-accounts" title="Cuentas bancarias" description="Los pedidos existentes conservan las cuentas que recibieron al registrarse.">
        {!bankAccountsFromRows(rows.filter((row) => row.status === "ACTIVO")) ? (
          <p className="mt-3 text-sm text-amber-800">Activa una cuenta con titular y CCI válidos por cada sello para recibir depósitos.</p>
        ) : null}
        <BankAccountsPanel rows={rows.map((row) => ({ ...row, currency: "PEN" }))} />
      </SettingsSection>
      <div className="border-t border-border pt-6">
        <SettingsSection id="payment-guides" title="Guías de pago" description="Verificación de firma y tamaño de los archivos que se adjuntan al pedido.">
          <ul className="mt-4 grid divide-y divide-border border-y border-border @min-[45rem]:grid-cols-3 @min-[45rem]:divide-x @min-[45rem]:divide-y-0">
            {guides.map(({ label, ready }) => (
              <li key={label} className="flex min-w-0 flex-wrap items-center justify-between gap-x-4 gap-y-1 py-3 text-sm @min-[45rem]:block @min-[45rem]:px-4">
                <span className="break-words">{label}</span>
                <span className={`@min-[45rem]:mt-1 @min-[45rem]:block ${ready ? "text-emerald-700" : "text-amber-800"}`}>{ready ? "Válida" : "Revisar PDF (hasta 3 MiB)"}</span>
              </li>
            ))}
          </ul>
        </SettingsSection>
      </div>
    </SettingsPage>
  );
}
