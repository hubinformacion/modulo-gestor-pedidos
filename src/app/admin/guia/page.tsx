import { requirePageAccess } from "@/modules/access/application/session";
import { managerGuide } from "@/components/guides/content";
import { WorkflowGuide } from "@/components/guides/workflow-guide";
import { WorkspacePageHeading } from "@/components/workspace/page-heading";
export const metadata = { title: "Guía del gestor" };
export default async function ManagerGuidePage() {
  await requirePageAccess();
  return <><WorkspacePageHeading eyebrow="Ayuda para gestores" title="Guía de uso" description="Conoce qué revisar, qué acciones registrar y cómo coordinar cada pedido." /><WorkflowGuide guide={managerGuide} /></>;
}
