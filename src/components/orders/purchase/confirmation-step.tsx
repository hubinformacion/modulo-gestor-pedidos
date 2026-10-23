import { courierEstimate } from "@/modules/orders/domain/courier";
import { Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { type BuyerDraft, type Campus, type DeliveryDraft } from "@/modules/orders/domain/types";
import { InvoiceFields } from "@/components/orders/purchase/invoice-fields";
import type { FieldErrors } from "@/components/ui/form-fields";
import { CampusLocation } from "@/components/orders/purchase/campus-location";
import { resolveLocation } from "@/modules/orders/domain/geography";
import { resolveRecipient } from "@/modules/orders/domain/recipient";

export function ConfirmationStep({ buyer, delivery, campuses, errors, onBuyerChange, onEdit }: {
  buyer: BuyerDraft; delivery: DeliveryDraft; campuses: Campus[]; errors: FieldErrors; onBuyerChange: (buyer: BuyerDraft) => void;
  onEdit: (step: number) => void;
}) {
  const campus = campuses.find((option) => option.id === delivery.campus);
  const location = resolveLocation(delivery.district);
  const recipient = resolveRecipient(delivery, buyer);
  return (
    <div className="space-y-6">
      <section className="rounded-xl border border-border p-5" aria-labelledby="confirm-buyer">
        <div className="mb-4 flex items-center justify-between gap-3"><h3 id="confirm-buyer" className="text-sm font-semibold">Comprador</h3><EditButton onClick={() => onEdit(1)} label="Editar comprador" /></div>
        <dl className="grid gap-x-5 gap-y-4 text-sm sm:grid-cols-2">
          <Detail label="Nombre" value={buyer.name} /><Detail label="Documento" value={buyer.document} />
          <Detail label="Correo" value={buyer.email} /><Detail label="Teléfono" value={buyer.phone} />
          <Detail label="Tipo de comprador" value={buyer.type === "comunidad_continental" ? "Comunidad Continental" : "Público general"} />
          {buyer.type === "comunidad_continental" ? <Detail label="Sede" value={campuses.find((option) => option.id === buyer.campus)?.name ?? ""} /> : null}

        </dl>
      </section>
      <section className="rounded-xl border border-border p-5" aria-labelledby="confirm-delivery">
        <div className="mb-4 flex items-center justify-between gap-3"><h3 id="confirm-delivery" className="text-sm font-semibold">Entrega</h3><EditButton onClick={() => onEdit(2)} label="Editar entrega" /></div>
        <dl className="grid gap-x-5 gap-y-4 text-sm sm:grid-cols-2">
          <Detail label="Modalidad" value={delivery.type === "recojo_campus" ? "Recojo en biblioteca" : location?.zone === "lima_callao" ? "Delivery · Lima / Callao" : "Delivery · Provincia"} />
          <Detail label={delivery.type === "recojo_campus" ? "Recoge" : "Recibe"} value={recipient.name} />
          <Detail label={delivery.type === "recojo_campus" ? "Documento de quien recoge" : "Documento de quien recibe"} value={recipient.document} />
          <Detail label={delivery.type === "recojo_campus" ? "Teléfono de quien recoge" : "Teléfono de quien recibe"} value={recipient.phone} />
          {delivery.type === "delivery" ? <>
            <div className="sm:col-span-2"><Detail label="Dirección" value={delivery.address} /></div>
            <Detail label="Departamento" value={location?.department.name ?? ""} /><Detail label="Provincia" value={location?.province.name ?? ""} /><Detail label="Distrito" value={location?.district.name ?? ""} />
            {delivery.reference ? <div className="sm:col-span-2"><Detail label="Referencia" value={delivery.reference} /></div> : null}
          </> : null}
        </dl>
        {delivery.type === "delivery" ? <p className="mt-4 text-xs leading-6 text-muted-foreground">{courierEstimate(location?.zone)}</p> : null}
        {delivery.type === "recojo_campus" && campus ? <div className="mt-5"><CampusLocation campus={campus} /></div> : null}
      </section>
      <InvoiceFields buyer={buyer} delivery={delivery} errors={errors} onChange={onBuyerChange} />
    </div>
  );
}

function EditButton({ onClick, label }: { onClick: () => void; label: string }) {
  return <Button variant="ghost" className="h-10 gap-1.5 text-xs text-primary" onClick={onClick} aria-label={label}><Pencil className="size-3" aria-hidden="true" />Editar</Button>;
}

function Detail({ label, value }: { label: string; value: string }) {
  return <div><dt className="text-xs text-muted-foreground">{label}</dt><dd className="mt-1 break-words leading-6">{value}</dd></div>;
}
