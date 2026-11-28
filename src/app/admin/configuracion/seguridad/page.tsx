import type { Metadata } from "next";
import { desc } from "drizzle-orm";
import { ManagementAuditPanel } from "@/components/settings/management-audit";
import { SecuritySettings } from "@/components/settings/security-settings";
import { SettingsPage } from "@/components/settings/settings-page";
import { withReadDatabase } from "@/db";
import { managementAudit, orderAdmissionPolicy } from "@/db/schema";
import { requirePageAccess } from "@/modules/access/application/session";
import { isMasterEmail } from "@/modules/access/domain/policy";
import { admissionPolicySchema } from "@/modules/orders/domain/admission-policy";

export const metadata: Metadata = { title: "Seguridad" };

export default async function SecuritySettingsPage() {
  const actor = await requirePageAccess();
  const canManage = isMasterEmail(actor.email);
  const [[policy], auditRows] = await withReadDatabase((db) => Promise.all([
    db.select().from(orderAdmissionPolicy).limit(1),
    canManage ? db.select({
      id: managementAudit.id, actorEmail: managementAudit.actorEmail, event: managementAudit.event,
      resource: managementAudit.resource, target: managementAudit.target, createdAt: managementAudit.createdAt,
    }).from(managementAudit).orderBy(desc(managementAudit.createdAt), desc(managementAudit.id)).limit(30) : Promise.resolve([]),
  ]));
  if (!policy) throw new Error("ADMISSION_POLICY_NOT_INITIALIZED");
  const values = admissionPolicySchema.parse({
    emailQuarterHour: policy.emailQuarterHour, emailDay: policy.emailDay,
    ipQuarterHour: policy.ipQuarterHour, globalDay: policy.globalDay, pendingEmail: policy.pendingEmail,
  });
  const version = policy.updatedAt.toISOString();
  return (
    <SettingsPage title="Seguridad" description={canManage ? "Consulta los límites de registro y el historial de cambios administrativos." : "Consulta los límites de registro de pedidos."}>
      <SecuritySettings key={version} policy={values} version={version} updatedBy={policy.updatedBy} canManage={canManage} />
      {canManage ? <ManagementAuditPanel rows={auditRows} /> : null}
    </SettingsPage>
  );
}
