import { imprintNames, type Imprint } from "@/modules/orders/domain/types";
import { cn } from "@/shared/utils/cn";

export function ImprintBadge({ imprint }: { imprint: Imprint }) {
  return <span className={cn("inline-flex items-center justify-center align-middle text-center rounded-md px-2 py-1 text-[10px] font-semibold", imprint === "universidad" ? "bg-secondary text-primary" : "bg-[#e4000b]/10 text-[#e4000b]")}>{imprintNames[imprint]}</span>;
}
