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
          <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">Activa una cuenta con titular y CCI válidos por cada sello para recibir depósitos.</p>
        ) : null}
        <BankAccountsPanel rows={rows.map((row) => ({ ...row, currency: "PEN" }))} />
      </SettingsSection>
      <SettingsSection className="rounded-xl border border-border bg-white p-4 sm:p-5" id="payment-guides" title="Guías de pago" description="PDF que reciben los compradores según el sello de su pedido.">
        <ul className="mt-4 grid divide-y divide-border border-t border-border @min-[38rem]:grid-cols-3 @min-[38rem]:divide-x @min-[38rem]:divide-y-0">
          {guides.map(({ label, ready }) => (
            <li key={label} className="flex min-w-0 flex-wrap items-center justify-between gap-x-4 gap-y-1 py-3 text-sm last:pb-0 @min-[38rem]:block @min-[38rem]:not-first:pl-4 @min-[38rem]:not-last:pr-4 @min-[38rem]:pb-0">
              <span className="break-words">{label}</span>
              <span className={`text-xs @min-[38rem]:mt-1 @min-[38rem]:block ${ready ? "text-emerald-700" : "text-amber-800"}`}>{ready ? "Válida" : "Revisar PDF (hasta 3 MiB)"}</span>
            </li>
          ))}
        </ul>
      </SettingsSection>
    </SettingsPage>
  );
}
