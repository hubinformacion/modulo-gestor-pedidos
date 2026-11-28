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
      <div className="grid items-start gap-7 @min-[56rem]:grid-cols-[minmax(0,1fr)_minmax(0,1.7fr)]">
        <SettingsSection id="mail-providers" title="Servicios de envío" description="El proveedor activo envía los avisos generales. Los avisos a Tesorería salen por Gmail.">
          <ul className="mt-5 divide-y divide-border border-y border-border">
            {providers.map(({ name, configured, provider }) => (
              <li key={provider} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 py-3 text-sm">
                <span className="font-medium">{name}{provider === activeProvider ? <span className="ml-2 text-xs text-primary">Activo</span> : null}</span>
                <span className={configured ? "text-muted-foreground" : "text-amber-800"}>{configured ? "Configurado" : "Configuración pendiente"}</span>
              </li>
            ))}
          </ul>
        </SettingsSection>
        <SettingsSection id="treasury-recipients" title="Buzones de Tesorería" description="Reciben el voucher y los datos de emisión al verificar un pago. Estos buzones funcionan como destinatarios de correo.">
          <TreasuryMailboxes canManage={canManage} mailboxes={mailboxes} />
        </SettingsSection>
      </div>
      {canManage ? <div className="border-t border-border pt-6"><MailTemplateGallery endpointConfigured={endpointConfigured} activeProvider={activeProvider} /></div> : null}
    </SettingsPage>
  );
}
