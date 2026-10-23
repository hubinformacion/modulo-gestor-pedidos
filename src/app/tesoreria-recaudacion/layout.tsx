import type { Metadata } from "next";
import { WorkspaceShell } from "@/components/workspace/workspace-shell";
import { requireCajaAccess } from "@/modules/access/application/session";
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 180;
export const metadata: Metadata = { title: "Tesorería Recaudación", robots: { index: false, follow: false }, referrer: "no-referrer" };
export default async function CajaLayout({ children }: { children: React.ReactNode }) {
  const actor = await requireCajaAccess();
  return <WorkspaceShell kind="treasury" profile={{ name: actor.name, email: actor.email, image: actor.image, units: actor.publisherImprints.map((unit) => unit === "universidad" ? "Universidad" : "Instituto"), service: actor.treasuryService }}>{children}</WorkspaceShell>;
}
