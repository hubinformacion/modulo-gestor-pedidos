import { requireCajaAccess } from "@/lib/access";
import { treasuryGuide } from "@/lib/guides/content";
import { WorkflowGuide } from "@/components/guides/workflow-guide";
import { WorkspacePageHeading } from "@/components/workspace/page-heading";
export const metadata = { title: "Guía de Tesorería Recaudación" };
export default async function TreasuryGuidePage() {
  const actor = await requireCajaAccess();
  return <><WorkspacePageHeading eyebrow="Ayuda para Tesorería Recaudación" title="Guía de uso" description="Consulta el flujo de emisión, las correcciones y las responsabilidades de tu equipo." /><WorkflowGuide guide={treasuryGuide} service={actor.treasuryService} /></>;
}
