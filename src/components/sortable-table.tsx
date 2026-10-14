"use client";
import { Children, cloneElement, isValidElement, useState, type ComponentProps, type ReactNode } from "react";
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import { orderLabels, paymentLabels } from "@/lib/admin/validation";
import { imprintNames } from "@/lib/orders/types";
type Props = { "aria-sort"?: "ascending" | "descending" | "none"; children?: ReactNode; value?: string | number; defaultValue?: string | number; status?: string; imprint?: string; "data-sort-value"?: string | number; colSpan?: number; className?: string };
const labels: Record<string, string> = { ...orderLabels, ...paymentLabels, ...imprintNames, ACTIVO: "Activo", INACTIVO: "Inactivo", FINALIZADA: "Finalizada", DEVUELTA: "Por corregir", PENDIENTE: "Pendiente", ANULADA: "Anulada" };
function text(node: ReactNode): string {
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(text).join(" ");
  if (!isValidElement<Props>(node)) return "";
  return String(node.props["data-sort-value"] ?? node.props.value ?? node.props.defaultValue ?? (node.props.status ? labels[node.props.status] ?? node.props.status : node.props.imprint ? labels[node.props.imprint] ?? node.props.imprint : text(node.props.children)));
}
function compare(a: string, b: string) {
  const price = (value: string) => /^S\/\s*[\d,.]+$/.test(value.trim()) ? Number(value.replace(/[^\d.]/g, "")) : null;
  const pa = price(a); const pb = price(b); if (pa !== null && pb !== null) return pa - pb;
  return a.localeCompare(b, "es", { numeric: true, sensitivity: "base" });
}
export function SortableTable({ children, ...props }: ComponentProps<"table">) {
  const [sort, setSort] = useState<{ column: number; desc: boolean } | null>(null);
  return <table {...props}>{Children.map(children, (section) => {
    if (!isValidElement<Props>(section)) return section;
    if (section.type === "thead") return cloneElement(section, {}, Children.map(section.props.children, (row) => {
      if (!isValidElement<Props>(row)) return row;
      return cloneElement(row, {}, Children.map(row.props.children, (cell, i) => {
        if (!isValidElement<Props>(cell) || !text(cell.props.children).trim() || text(cell.props.children).trim().toLowerCase() === "acciones") return cell;
        const selected = sort?.column === i; const Icon = selected ? sort.desc ? ArrowDown : ArrowUp : ArrowUpDown;
        return cloneElement(cell, { "aria-sort": selected ? sort.desc ? "descending" : "ascending" : "none" } as Props, <button type="button" className="inline-flex cursor-pointer items-center gap-1.5 text-inherit focus-visible:outline-primary" aria-label={`Ordenar por ${text(cell.props.children)}`} onClick={() => { if (document.querySelector('[data-order-editing="true"]')) return; setSort({ column: i, desc: selected ? !sort.desc : false }); }}>{cell.props.children}<Icon className={`size-3 shrink-0 ${selected ? "text-primary" : "opacity-40"}`} aria-hidden="true" /></button>);
      }));
    }));
    if (section.type === "tbody" && sort) {
      const rows = Children.toArray(section.props.children); const sortable = rows.every((row) => isValidElement<Props>(row) && !Children.toArray(row.props.children).some((cell) => isValidElement<Props>(cell) && (cell.props.colSpan ?? 1) > 1));
      if (!sortable) return section;
      return cloneElement(section, {}, [...rows].sort((a, b) => {
        if (!isValidElement<Props>(a) || !isValidElement<Props>(b)) return 0;
        return compare(text(Children.toArray(a.props.children)[sort.column]), text(Children.toArray(b.props.children)[sort.column])) * (sort.desc ? -1 : 1);
      }));
    }
    return section;
  })}</table>;
}
