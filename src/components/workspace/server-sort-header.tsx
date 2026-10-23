import Link from "next/link";
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
export function ServerSortHeader({ label, field, path, filters }: { label: string; field: string; path: string; filters: Record<string, string | number> }) {
  const selected = filters.sort === field; const desc = selected && filters.dir === "desc"; const Icon = selected ? desc ? ArrowDown : ArrowUp : ArrowUpDown;
  const params = new URLSearchParams(Object.fromEntries(Object.entries({ ...filters, sort: field, dir: selected && !desc ? "desc" : "asc", page: 1 }).map(([key, value]) => [key, String(value)])));
  return <Link prefetch={false} href={`${path}?${params}`} className="inline-flex cursor-pointer items-center gap-1.5" aria-label={`Ordenar por ${label}`}><span>{label}</span><Icon className={`size-3 ${selected ? "text-primary" : "opacity-40"}`} aria-hidden="true" /></Link>;
}
