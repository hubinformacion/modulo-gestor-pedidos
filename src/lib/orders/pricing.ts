import { toCents } from "./money";
import type { CatalogBook, CartSelection, CustomerKind, DeliveryDraft, Imprint } from "./types";

export function calculateQuote(
  catalog: CatalogBook[], cart: CartSelection[], customer: CustomerKind,
  delivery: Pick<DeliveryDraft, "type" | "zone">,
) {
  const catalogById = new Map(catalog.map((book) => [book.id, book]));
  const seen = new Set<string>();
  const lines = cart.map((item) => {
    const book = catalogById.get(item.bookId);
    if (!book || seen.has(item.bookId) || !Number.isInteger(item.quantity) || item.quantity < 1 || item.quantity > book.stock) {
      throw new Error("Revisa las publicaciones y sus cantidades.");
    }
    seen.add(item.bookId);
    const unitPrice = toCents(customer === "comunidad_continental" ? book.communityPrice : book.standardPrice);
    const subtotal = unitPrice * item.quantity;
    if (!Number.isSafeInteger(subtotal)) throw new Error("Importe fuera de rango.");
    return { book, quantity: item.quantity, unitPrice, subtotal };
  });
  const hasUniversidad = lines.some((line) => line.book.publisherImprint === "universidad");
  const hasInstituto = lines.some((line) => line.book.publisherImprint === "instituto");
  const orderType = hasUniversidad && hasInstituto ? "mixto" : hasUniversidad ? "solo_universidad" : hasInstituto ? "solo_instituto" : null;
  const shippingKnown = delivery.type === "recojo_campus" || delivery.zone !== "";
  const shippingCost = lines.length === 0 || delivery.type === "recojo_campus" ? 0 : delivery.zone === "lima_callao" ? 1500 : delivery.zone === "provincia" ? 2500 : 0;
  const accounts = (Object.keys({ universidad: 0, instituto: 0 }) as Imprint[])
    .filter((imprint) => lines.some((line) => line.book.publisherImprint === imprint))
    .map((imprint) => {
      const subtotal = lines.filter((line) => line.book.publisherImprint === imprint).reduce((sum, line) => sum + line.subtotal, 0);
      const shipping = imprint === (hasUniversidad ? "universidad" : "instituto") ? shippingCost : 0;
      return { imprint, subtotal, shipping, total: subtotal + shipping };
    });
  const subtotal = accounts.reduce((sum, account) => sum + account.subtotal, 0);
  const total = subtotal + shippingCost;
  if (!Number.isSafeInteger(total)) throw new Error("Importe fuera de rango.");
  return { lines, accounts, orderType, subtotal, shippingCost, shippingKnown, total, quantity: lines.reduce((sum, line) => sum + line.quantity, 0) };
}

export type OrderQuote = ReturnType<typeof calculateQuote>;
