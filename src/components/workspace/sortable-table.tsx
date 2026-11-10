"use client";
import { Children, cloneElement, isValidElement, useId, useState, type ComponentProps, type ReactNode } from "react";
import { Select } from "@/components/ui/select";
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import { orderLabels, paymentLabels } from "@/modules/orders/domain/management";
import { imprintNames } from "@/modules/orders/domain/types";
type Props = { role?: ComponentProps<"td">["role"]; "aria-sort"?: "ascending" | "descending" | "none"; children?: ReactNode; value?: string | number; defaultValue?: string | number; status?: string; imprint?: string; "data-sort-value"?: string | number; colSpan?: number; className?: string };
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
export function SortableTable({ children, className, ...props }: ComponentProps<"table">) {
  const [sort, setSort] = useState<{ column: number; desc: boolean } | null>(null);
  const sortId = useId();
  const columns: string[] = [];
  Children.forEach(children, (section) => {
    if (!isValidElement<Props>(section) || section.type !== "thead") return;
    Children.forEach(section.props.children, (row) => {
      if (isValidElement<Props>(row)) Children.forEach(row.props.children, (cell) => {
        if (isValidElement<Props>(cell)) columns.push(text(cell.props.children).trim());
      });
    });
  });
  const sortableColumns = columns.map((label, column) => ({ label, column })).filter(({ label }) => label && label.toLowerCase() !== "acciones");
  function changeSort(next: { column: number; desc: boolean }) {
    if (!document.querySelector('[data-order-editing="true"]')) setSort(next);
  }
  return <div className="min-w-0"><div className="flex flex-wrap items-end gap-3 border-b border-border p-4 md:hidden">
    <div className="min-w-0 flex-1"><label htmlFor={sortId} className="mb-2 block text-xs font-medium">Ordenar por</label><Select id={sortId} value={sort ? String(sort.column) : ""} onValueChange={(value) => { if (document.querySelector('[data-order-editing="true"]')) return; if (value === "") setSort(null); else changeSort({ column: Number(value), desc: sort?.desc ?? false }); }}>
      <option value="">Orden original</option>{sortableColumns.map(({ label, column }) => <option key={column} value={String(column)}>{label}</option>)}
    </Select></div>
    <button type="button" disabled={!sort} className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-border px-3 text-xs font-medium disabled:opacity-50" onClick={() => { if (sort) changeSort({ ...sort, desc: !sort.desc }); }} aria-label={sort?.desc ? "Cambiar a orden ascendente" : "Cambiar a orden descendente"}>{sort?.desc ? <ArrowDown className="size-4" aria-hidden="true" /> : <ArrowUp className="size-4" aria-hidden="true" />}{sort?.desc ? "Descendente" : "Ascendente"}</button>
  </div><table {...props} role="table" className={`responsive-table ${className ?? ""}`}>{Children.map(children, (section) => {
    if (!isValidElement<Props>(section)) return section;
    if (section.type === "thead") return cloneElement(section, {}, Children.map(section.props.children, (row) => {
      if (!isValidElement<Props>(row)) return row;
      return cloneElement(row, {}, Children.map(row.props.children, (cell, i) => {
        if (!isValidElement<Props>(cell) || !text(cell.props.children).trim() || text(cell.props.children).trim().toLowerCase() === "acciones") return cell;
        const selected = sort?.column === i; const Icon = selected ? sort.desc ? ArrowDown : ArrowUp : ArrowUpDown;
        return cloneElement(cell, { "aria-sort": selected ? sort.desc ? "descending" : "ascending" : "none" } as Props, <><span className="md:hidden">{cell.props.children}</span><button type="button" className="hidden cursor-pointer items-center gap-1.5 text-inherit focus-visible:outline-primary md:inline-flex" aria-label={`Ordenar por ${text(cell.props.children)}`} onClick={() => changeSort({ column: i, desc: selected ? !sort.desc : false })}>{cell.props.children}<Icon className={`size-3 shrink-0 ${selected ? "text-primary" : "opacity-40"}`} aria-hidden="true" /></button></>);
      }));
    }));
    if (section.type === "tbody") {
      const rows = Children.toArray(section.props.children); const sortable = rows.every((row) => isValidElement<Props>(row) && !Children.toArray(row.props.children).some((cell) => isValidElement<Props>(cell) && (cell.props.colSpan ?? 1) > 1));
      const ordered = !sort || !sortable ? rows : [...rows].sort((a, b) => {
        if (!isValidElement<Props>(a) || !isValidElement<Props>(b)) return 0;
        return compare(text(Children.toArray(a.props.children)[sort.column]), text(Children.toArray(b.props.children)[sort.column])) * (sort.desc ? -1 : 1);
      });
      return cloneElement(section, { role: "rowgroup" }, ordered.map((row) => {
        if (!isValidElement<Props>(row)) return row;
        return cloneElement(row, { role: "row" }, Children.map(row.props.children, (cell, index) => {
          if (!isValidElement<Props>(cell) || (cell.props.colSpan ?? 1) > 1) return cell;
          return cloneElement(cell, { role: cell.type === "th" ? "rowheader" : "cell" }, <><span className="mobile-cell-label" aria-hidden="true">{columns[index]}</span><div className="mobile-cell-value">{cell.props.children}</div></>);
        }));
      }));
    }
    return section;
  })}</table></div>;
}
