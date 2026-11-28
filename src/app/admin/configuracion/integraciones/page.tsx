import type { Metadata } from "next";
import { IntegrationStatusPanel } from "@/components/settings/integration-status-panel";
import { SettingsPage } from "@/components/settings/settings-page";
import { getWordPressOrigins } from "@/integrations/wordpress/config";
import { requirePageAccess } from "@/modules/access/application/session";
import { getPublicOrigin } from "@/shared/config/application";
import { isAuthConfigured } from "@/shared/config/env";
import { googleConfigured } from "@/shared/config/google";

export const metadata: Metadata = { title: "Integraciones" };

export default async function IntegrationSettingsPage() {
  await requirePageAccess();

  let originReady = false;
  let embedReady = false;
  try { getPublicOrigin(); originReady = true; } catch { /* Invalid or missing environment configuration. */ }
  try { embedReady = getWordPressOrigins().length > 0; } catch { /* Invalid WordPress origins. */ }

  return (
    <SettingsPage title="Integraciones" description="Consulta la configuración de publicación y verifica la conexión con Google.">
      <IntegrationStatusPanel rows={[
        { group: "Publicación", label: "Dirección pública", ready: originReady, detail: "Formato de APP_URL." },
        { group: "Publicación", label: "WordPress", ready: embedReady, detail: "Orígenes autorizados para incrustar el Gestor." },
        { group: "Google", label: "Inicio de sesión", ready: isAuthConfigured(), detail: "Configuración para autenticar con Google OAuth." },
        { group: "Google", label: "Credenciales de Drive y Gmail", ready: googleConfigured(), detail: "Configuración de la cuenta propietaria." },
        { group: "Google", label: "Tarea de permisos de Drive", ready: (process.env.CRON_SECRET?.length ?? 0) >= 32, detail: "Configuración del secreto de la tarea programada." },
      ]} />
    </SettingsPage>
  );
}
