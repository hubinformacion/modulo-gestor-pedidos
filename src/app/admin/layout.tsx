import { WorkspaceShell } from "@/components/workspace/workspace-shell";
import { canAttendOrders } from "@/lib/access-policy";
import { requirePageAccess } from "@/lib/access";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const actor = await requirePageAccess();
  return <WorkspaceShell kind="manager" profile={{ name: actor.name, email: actor.email, image: actor.image, units: [], service: !canAttendOrders(actor) }}>{children}</WorkspaceShell>;
}
