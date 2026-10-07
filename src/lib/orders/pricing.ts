import { toCents } from "./money";
import { resolveShippingZone } from "./geography";
import type { CatalogBook, CartSelection, CustomerKind, DeliveryDraft, Imprint } from "./types";

export function bookPrice(book: CatalogBook, customer: CustomerKind, at = Date.now()) {
  const baseUnitPrice = toCents(customer === "comunidad_continental" ? book.communityPrice : book.standardPrice);
  const offer = book.promotions?.filter((rule) => Date.parse(rule.startsAt) <= at && Date.parse(rule.endsAt) > at)
    .map((rule) => ({ ...rule, percent: customer === "comunidad_continental" ? rule.communityPercent : rule.publicPercent }))
    .filter((rule) => rule.percent > 0).sort((a, b) => b.percent - a.percent || a.id.localeCompare(b.id))[0];
  const unitPrice = offer ? Math.round(baseUnitPrice * (100 - offer.percent) / 100) : baseUnitPrice;
  const discount = baseUnitPrice - unitPrice;
  return { baseUnitPrice, unitPrice, discountPercent: discount > 0 ? offer?.percent ?? 0 : 0, promotionId: discount > 0 ? offer?.id ?? null : null, promotionName: discount > 0 ? offer?.name ?? null : null };
}

export function calculateQuote(
  catalog: CatalogBook[], cart: CartSelection[], customer: CustomerKind,
  delivery: Pick<DeliveryDraft, "type" | "district">, at = Date.now(),
) {
  const catalogById = new Map(catalog.map((book) => [book.id, book]));
  const seen = new Set<string>();
  const lines = cart.map((item) => {
    const book = catalogById.get(item.bookId);
    if (!book || seen.has(item.bookId) || !Number.isInteger(item.quantity) || item.quantity < 1) {
      throw new Error("Revisa las publicaciones y sus cantidades.");
    }
    seen.add(item.bookId);
    const price = bookPrice(book, customer, at);
    const unitPrice = price.unitPrice;
    const subtotal = unitPrice * item.quantity;
    if (!Number.isSafeInteger(subtotal)) throw new Error("Importe fuera de rango.");
    return { book, quantity: item.quantity, ...price, subtotal, discount: (price.baseUnitPrice - unitPrice) * item.quantity };
  });
  const hasUniversidad = lines.some((line) => line.book.publisherImprint === "universidad");
  const hasInstituto = lines.some((line) => line.book.publisherImprint === "instituto");
  const orderType: "solo_universidad" | "solo_instituto" | "mixto" | null = hasUniversidad && hasInstituto ? "mixto" : hasUniversidad ? "solo_universidad" : hasInstituto ? "solo_instituto" : null;
  const zone = resolveShippingZone(delivery.district);
  const shippingKnown = delivery.type === "recojo_campus" || zone !== "";
  const shippingCost = lines.length === 0 || delivery.type === "recojo_campus" ? 0 : zone === "lima_callao" ? 1500 : zone === "provincia" ? 2500 : 0;
  const accounts = (Object.keys({ universidad: 0, instituto: 0 }) as Imprint[])
    .filter((imprint) => lines.some((line) => line.book.publisherImprint === imprint))
    .map((imprint) => {
      const subtotal = lines.filter((line) => line.book.publisherImprint === imprint).reduce((sum, line) => sum + line.subtotal, 0);
      const shipping = imprint === (hasUniversidad ? "universidad" : "instituto") ? shippingCost : 0;
      return { imprint, subtotal, shipping, total: subtotal + shipping };
    });
  const discountTotal = lines.reduce((sum, line) => sum + line.discount, 0);
  const subtotal = accounts.reduce((sum, account) => sum + account.subtotal, 0);
  const total = subtotal + shippingCost;
  if (!Number.isSafeInteger(total)) throw new Error("Importe fuera de rango.");
  return { lines, accounts, orderType, discountTotal, originalSubtotal: subtotal + discountTotal, subtotal, shippingCost, shippingKnown, total, quantity: lines.reduce((sum, line) => sum + line.quantity, 0) };
}

export type OrderQuote = ReturnType<typeof calculateQuote>;

// UI expectation is compared only for consent/staleness, never used as pricing.
export function quoteStamp(quote: OrderQuote) {
  return JSON.stringify({ items: quote.lines.map((line) => [line.book.id, line.quantity, line.unitPrice, line.promotionId]).sort((a, b) => String(a[0]).localeCompare(String(b[0]))), shipping: quote.shippingCost });
}
