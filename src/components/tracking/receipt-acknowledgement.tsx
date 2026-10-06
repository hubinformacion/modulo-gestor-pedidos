import { CheckCircle2 } from "lucide-react";
import { imprintNames, type Imprint } from "@/lib/orders/types";

export function ReceiptAcknowledgement({ imprint }: { imprint: Imprint }) {
  return <div role="status" className="flex gap-3 rounded-lg bg-emerald-50 p-4 text-xs leading-6 text-emerald-800">
    <CheckCircle2 className="mt-1 size-4 shrink-0" />
    <p>Tu comprobante de {imprintNames[imprint]} ya está adjunto y está en revisión. Te avisaremos por correo cuando termine.</p>
  </div>;
}
