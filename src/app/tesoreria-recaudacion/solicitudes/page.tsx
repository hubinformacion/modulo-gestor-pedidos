import { redirect } from "next/navigation";
export default async function LegacyInboxPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const values = await searchParams;
  const query = new URLSearchParams();
  for (const key of ["state", "owner", "imprint", "q", "sort", "dir", "page"]) if (typeof values[key] === "string") query.set(key, values[key]);
  redirect(`/tesoreria-recaudacion${query.size ? `?${query}` : ""}`);
}
