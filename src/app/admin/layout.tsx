import { WorkspaceShell } from "@/components/workspace/workspace-shell";
import { canAttendOrders } from "@/modules/access/domain/policy";
import { requirePageAccess } from "@/modules/access/application/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const actor = await requirePageAccess();
  return <WorkspaceShell profile={{ name: actor.name, email: actor.email, image: actor.image, master: !canAttendOrders(actor) }}>{children}</WorkspaceShell>;
}
