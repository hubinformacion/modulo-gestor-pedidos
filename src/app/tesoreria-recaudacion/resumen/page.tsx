import { redirect } from "next/navigation";
export default async function LegacySummaryPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const values = await searchParams;
  const query = new URLSearchParams();
  for (const key of ["from", "to", "imprint"]) if (typeof values[key] === "string") query.set(key, values[key]);
  redirect(`/tesoreria-recaudacion/reporte${query.size ? `?${query}` : ""}`);
}
