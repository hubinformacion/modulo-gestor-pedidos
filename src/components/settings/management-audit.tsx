import { ChevronDown, History } from "lucide-react";
import { managementAuditLabels, type ManagementAuditEvent } from "@/modules/access/domain/audit-labels";

type Row = { id: string; actorEmail: string; event: string; resource: string; target: string; createdAt: Date };
const dates = new Intl.DateTimeFormat("es-PE", { dateStyle: "short", timeStyle: "short", timeZone: "America/Lima" });

export function ManagementAuditPanel({ rows }: { rows: Row[] }) {
  return (
    <details open className="group min-w-0 overflow-hidden rounded-xl border border-border bg-white">
      <summary className="flex min-h-12 cursor-pointer flex-wrap items-center gap-x-2 gap-y-1 bg-muted/60 px-4 text-sm sm:px-5 font-semibold">
        <History className="size-4 text-primary" aria-hidden="true" />
        Registro de administración
        <span className="ml-auto text-xs font-normal text-muted-foreground">Últimos 30 cambios</span>
        <ChevronDown className="size-4 text-muted-foreground motion-safe:transition-transform group-open:rotate-180" aria-hidden="true" />
      </summary>
      <div className="border-t border-border">
        <p className="max-w-[65ch] px-4 py-3.5 text-xs leading-5 sm:px-5 text-muted-foreground">Registro exclusivo del maestro. Guarda autor, fecha y operación. Los cambios de permisos conservan los accesos anteriores y nuevos.</p>
        {rows.length ? (
          <div className="max-h-[28rem] overflow-auto rounded-b-xl outline-offset-[-2px]" role="region" aria-label="Cambios administrativos" tabIndex={0}>
            <table className="w-full min-w-[23rem] text-left text-xs">
              <thead className="sticky top-0">
                <tr className="border-y border-border text-muted-foreground">
                  <th scope="col" className="px-3 font-medium">Fecha</th>
                  <th scope="col" className="px-3 font-medium">Autor</th>
                  <th scope="col" className="px-3 font-medium">Operación</th>
                  <th scope="col" className="px-3 font-medium">Referencia</th>
                </tr>
              </thead>
              <tbody className="text-xs">
                {rows.map((row) => (
                  <tr key={row.id} className="border-b border-border last:border-0">
                    <td className="px-3 py-2 tabular-nums">{dates.format(row.createdAt)}</td>
                    <td className="break-all px-3 py-2">{row.actorEmail}</td>
                    <td className="px-3 py-2">{managementAuditLabels[row.event as ManagementAuditEvent] ?? row.event}</td>
                    <td className="max-w-64 break-all px-3 py-2 text-muted-foreground">{row.target}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <p className="border-t border-border px-5 py-4 text-xs text-muted-foreground">Los cambios registrados en la auditoría aparecerán aquí.</p>}
      </div>
    </details>
  );
}
