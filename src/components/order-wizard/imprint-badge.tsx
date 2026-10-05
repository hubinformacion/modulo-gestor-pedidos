import { imprintNames, type Imprint } from "@/lib/orders/types";
import { cn } from "@/lib/utils";

export function ImprintBadge({ imprint }: { imprint: Imprint }) {
  return <span className={cn("inline-flex rounded-md px-2 py-1 text-[10px] font-semibold", imprint === "universidad" ? "bg-secondary text-primary" : "bg-[#e4000b]/10 text-[#e4000b]")}>{imprintNames[imprint]}</span>;
}
