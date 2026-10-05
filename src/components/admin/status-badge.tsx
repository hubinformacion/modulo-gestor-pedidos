import { cn } from "@/lib/utils";
import { orderLabels, paymentLabels } from "@/lib/admin/validation";

export function StatusBadge({ status }: { status: keyof typeof orderLabels | keyof typeof paymentLabels }) {
  const label = status in orderLabels ? orderLabels[status as keyof typeof orderLabels] : paymentLabels[status as keyof typeof paymentLabels];
  return <span className={cn("inline-flex rounded-md px-2 py-1 text-[11px] font-medium", status === "RECHAZADO" || status === "CANCELADO" ? "bg-red-50 text-red-700" : status === "VERIFICADO" || status === "ENTREGADO" ? "bg-emerald-50 text-emerald-700" : status === "EN_REVISION" ? "bg-amber-50 text-amber-800" : status === "NO_APLICA" ? "bg-muted text-muted-foreground" : "bg-secondary text-primary")}>{label}</span>;
}
