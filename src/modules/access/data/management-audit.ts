import type { Database } from "@/db";
import { managementAudit } from "@/db/schema";
import type { ManagementAuditEvent } from "@/modules/access/domain/audit-labels";
import type { AuthorizedActor } from "@/modules/access/domain/policy";
import "server-only";

type Transaction = Parameters<Parameters<Database["transaction"]>[0]>[0];
type AuditActor = Pick<AuthorizedActor, "userId" | "email" | "name" | "role">;
// Only explicitly selected business fields belong here. Never pass request,
// provider, auth/session, SQL or credential objects to an audit record.
export async function writeManagementAudit(tx: Pick<Transaction, "insert">, actor: AuditActor, event: ManagementAuditEvent, resource: string, target: string, details: Record<string, unknown> = {}) {
  await tx.insert(managementAudit).values({ actorUserId: actor.userId, actorEmail: actor.email, actorName: actor.name, actorRole: actor.role, event, resource, target, details });
}
export function accessSnapshot(row: { role: string; publisherImprint: string | null; publisherImprints: string[]; treasuryService: boolean } | undefined) {
  return row ? { role: row.role, units: row.publisherImprints.length ? row.publisherImprints : row.publisherImprint ? [row.publisherImprint] : [], service: row.treasuryService } : null;
}
