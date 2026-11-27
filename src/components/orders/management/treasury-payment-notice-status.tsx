import type { listTreasuryPaymentNoticeStatuses } from "@/modules/orders/data/treasury-payment-notices";

type Notice = Awaited<ReturnType<typeof listTreasuryPaymentNoticeStatuses>>[number];

export function TreasuryPaymentNoticeStatus({ notice, cancelled }: { notice: Notice | undefined; cancelled: boolean }) {
  if (!notice) return null;
  const sent = notice.status === "ENVIADO";
  const messages: Record<Notice["status"], string> = {
    ENVIADO: notice.recipient ? `Enviado a ${notice.recipient}.` : "Enviado.",
    ERROR: cancelled ? "El aviso no se envió." : "No se pudo enviar. Gestiona el aviso desde el buzón de Fondo Editorial.",
    INCIERTO: cancelled ? "No se pudo confirmar el envío. Revisa el buzón de Fondo Editorial." : "No se pudo confirmar el envío. Revisa el buzón de Fondo Editorial antes de enviarlo manualmente.",
    OMITIDO: cancelled ? "Envío omitido por anulación del pedido." : "No hay un buzón de destino válido. Coordina el envío desde el buzón de Fondo Editorial.",
    NO_ENVIADO: "Envío pendiente de confirmación. Si el estado persiste, revisa el buzón de Fondo Editorial.",
    ENVIANDO: "Envío iniciado. Si el estado persiste, revisa el buzón de Fondo Editorial.",
  };
  return <dl className="mt-4 border-t border-border pt-3 text-xs leading-5">
    <dt className="font-medium">Aviso a Tesorería</dt>
    <dd className={`mt-1 break-words ${sent || (cancelled && ["OMITIDO", "ERROR"].includes(notice.status)) ? "text-muted-foreground" : "text-amber-900"}`}>
      {messages[notice.status]}{sent && cancelled ? " Coordina la anulación en el mismo hilo." : ""}
    </dd>
  </dl>;
}
