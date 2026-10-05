import type { BuyerDraft, DeliveryDraft } from "./types";

export function resolveRecipient(delivery: DeliveryDraft, buyer: BuyerDraft) {
  return delivery.recipientType === "comprador"
    ? { name: buyer.name, document: buyer.document, phone: buyer.phone }
    : { name: delivery.recipient, document: delivery.recipientDocument, phone: delivery.recipientPhone };
}
