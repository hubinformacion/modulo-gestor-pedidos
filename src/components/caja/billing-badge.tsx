import { ReceiptText } from "lucide-react";
export function BillingBadge({ invoice }: { invoice: boolean }) {
  return <span className="inline-flex items-center gap-2 rounded-lg border border-primary/20 bg-secondary px-3 py-2 text-xs font-semibold text-primary"><ReceiptText className="size-4" aria-hidden="true" />{invoice ? "Factura solicitada" : "Boleta solicitada"}</span>;
}
