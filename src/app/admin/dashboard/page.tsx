import { redirect } from "next/navigation";
export default async function LegacyDashboardPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const values = await searchParams;
  const query = new URLSearchParams();
  for (const key of ["tab", "from", "to", "imprint", "manager"]) if (typeof values[key] === "string") query.set(key, values[key]);
  redirect(`/admin/reporte${query.size ? `?${query}` : ""}`);
}
