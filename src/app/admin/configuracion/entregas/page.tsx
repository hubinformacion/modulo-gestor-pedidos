import type { Metadata } from "next";
import { asc } from "drizzle-orm";
import { CampusesPanel } from "@/components/settings/campuses-panel";
import { DeliveryRatesSettings } from "@/components/settings/delivery-rates-settings";
import { PickupSupportSettings } from "@/components/settings/pickup-support-settings";
import { SettingsPage, SettingsSection } from "@/components/settings/settings-page";
import { withReadDatabase } from "@/db";
import { campuses, deliveryRates, pickupContacts } from "@/db/schema";
import { requirePageAccess } from "@/modules/access/application/session";
import { deliveryZoneLabels } from "@/modules/settings/domain/delivery-rates";

export const metadata: Metadata = { title: "Entregas" };

export default async function DeliverySettingsPage() {
  await requirePageAccess();
  const [rates, sites, support] = await withReadDatabase((db) => Promise.all([
    db.select().from(deliveryRates).orderBy(asc(deliveryRates.zone)),
    db.select().from(campuses).orderBy(asc(campuses.name)),
    db.select().from(pickupContacts).orderBy(asc(pickupContacts.name)),
  ]));
  const disabledZones = (["lima_callao", "provincia"] as const)
    .filter((zone) => rates.every((rate) => rate.zone !== zone || rate.status !== "ACTIVO"))
    .map((zone) => deliveryZoneLabels[zone]);
  const activeSites = sites.filter((site) => site.status === "ACTIVO");
  return (
    <SettingsPage title="Entregas" description="Administra el delivery y el recojo de publicaciones en biblioteca.">
      <nav aria-label="Secciones de entregas" className="flex flex-wrap gap-x-5 gap-y-2 border-b border-border pb-4 text-sm">
        <a className="font-medium text-primary underline-offset-4 hover:underline focus-visible:underline" href="#delivery-rates">Tarifas</a>
        <a className="font-medium text-primary underline-offset-4 hover:underline focus-visible:underline" href="#pickup-sites">Campus</a>
        <a className="font-medium text-primary underline-offset-4 hover:underline focus-visible:underline" href="#pickup-support">Personal de apoyo</a>
      </nav>
      <div className="space-y-8 divide-y divide-border [&>section+section]:pt-8">
        <SettingsSection id="delivery-rates" title="Tarifas de delivery" description="Los cambios de precio se aplican a los pedidos nuevos.">
          {disabledZones.length ? <p className="mt-3 text-sm text-amber-800">Delivery sin tarifa activa en {disabledZones.join(" y ")}.</p> : null}
          <DeliveryRatesSettings rows={rates.map((row) => ({
            zone: row.zone, price: row.price, status: row.status, version: row.updatedAt.toISOString(),
          }))} />
        </SettingsSection>
        <SettingsSection id="pickup-sites" title="Campus y bibliotecas" description="Configura las ubicaciones y horarios de los puntos de recojo.">
          {!activeSites.length || activeSites.some((site) => !site.pickupHours.trim()) ? (
            <p className="mt-3 text-sm text-amber-800">El recojo requiere campus activos con horario de atención.</p>
          ) : null}
          <CampusesPanel rows={sites.map((row) => ({
            id: row.id, name: row.name, libraryAddress: row.libraryAddress, libraryLocation: row.libraryLocation,
            pickupHours: row.pickupHours, latitude: row.latitude ?? "", longitude: row.longitude ?? "",
            googleMapsEmbedUrl: row.googleMapsEmbedUrl ?? "", status: row.status,
          }))} />
        </SettingsSection>
        <SettingsSection id="pickup-support" title="Personal de apoyo para recojo" description="Contactos que ayudan a coordinar las entregas en biblioteca.">
          {support.every((row) => row.status !== "ACTIVO") ? <p className="mt-3 text-sm text-amber-800">Registra un contacto activo para habilitar el despacho a biblioteca.</p> : null}
          <PickupSupportSettings rows={support.map((row) => ({
            id: row.id, name: row.name, email: row.email, status: row.status, version: row.updatedAt.toISOString(),
          }))} />
        </SettingsSection>
      </div>
    </SettingsPage>
  );
}
