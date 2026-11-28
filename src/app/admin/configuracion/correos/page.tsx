import type { Metadata } from "next";
import { MailTemplateGallery } from "@/components/settings/mail-template-gallery";
import { SettingsPage, SettingsSection } from "@/components/settings/settings-page";
import { TreasuryMailboxes } from "@/components/settings/treasury-settings";
import { withReadDatabase } from "@/db";
import { treasuryMailboxes } from "@/db/schema";
import { requirePageAccess } from "@/modules/access/application/session";
import { isMasterEmail } from "@/modules/access/domain/policy";
import { googleConfigured } from "@/shared/config/google";
import { getMailProvider } from "@/shared/config/mail";
import { isMailEndpointConfigured } from "@/shared/config/mail-endpoint";

export const metadata: Metadata = { title: "Correos" };

export default async function EmailSettingsPage() {
  const actor = await requirePageAccess();
  const canManage = isMasterEmail(actor.email);
  const mailboxes = await withReadDatabase((db) => db.select({
    imprint: treasuryMailboxes.publisherImprint, email: treasuryMailboxes.email,
  }).from(treasuryMailboxes));

  const activeProvider = getMailProvider();
  const endpointConfigured = isMailEndpointConfigured();
  const providers = [
    { name: "Gmail", configured: googleConfigured(), provider: "gmail" },
    { name: "Servicio institucional", configured: endpointConfigured, provider: "endpoint" },
  ];
  return (
    <SettingsPage title="Correos" description="Revisa el servicio de envío, las plantillas y los destinatarios de Tesorería.">
      {canManage ? <MailTemplateGallery endpointConfigured={endpointConfigured} activeProvider={activeProvider} /> : null}
      <div className="grid items-start gap-5 @min-[51rem]:grid-cols-[minmax(15rem,1fr)_minmax(0,2.2fr)] sm:gap-6">
        <SettingsSection className="rounded-xl border border-border bg-white p-4 sm:p-5" id="mail-providers" title="Servicios de envío" description="El proveedor activo envía los avisos generales. Tesorería recibe sus avisos por Gmail.">
          <ul className="mt-4 divide-y divide-border border-t border-border">
            {providers.map(({ name, configured, provider }) => (
              <li key={provider} className="flex min-w-0 flex-wrap items-center justify-between gap-x-3 gap-y-1 py-3 text-sm last:pb-0">
                <span className="font-medium">{name}{provider === activeProvider ? <span className="ml-2 inline-block rounded-md bg-secondary px-1.5 py-0.5 text-xs text-primary">Activo</span> : null}</span>
                <span className={`text-xs ${configured ? "text-muted-foreground" : "text-amber-800"}`}>{configured ? "Configurado" : "Configuración pendiente"}</span>
              </li>
            ))}
          </ul>
        </SettingsSection>
        <SettingsSection className="rounded-xl border border-border bg-white p-4 sm:p-5" id="treasury-recipients" title="Buzones de Tesorería" description="Al verificar un pago se envían el voucher y los datos de emisión al buzón del sello correspondiente.">
          <TreasuryMailboxes canManage={canManage} mailboxes={mailboxes} />
        </SettingsSection>
      </div>
    </SettingsPage>
  );
}
