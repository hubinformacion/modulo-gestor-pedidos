import "server-only";
import { createHash } from "node:crypto";
import { and, asc, eq, inArray, notLike, sql } from "drizzle-orm";
import { nanoid } from "nanoid";
import { bankAccountsFromRows, paymentSetupReady, readPaymentGuide } from "@/lib/payments/config";
import { withDatabase } from "@/db";
import { bankAccounts, books, campuses, orderCounters, orderEmails, orderActivity, orderItems, orders, paymentGuides } from "@/db/schema";
import { toPublicCampus } from "@/lib/campuses/catalog";
import { createOrderDraftSchema } from "./validation";
import { calculateQuote } from "./pricing";
import { centsToDecimal } from "./money";
import { resolveLocation } from "./geography";
import { consentVersion, OrderInputError, submissionSchema } from "./submission";

export async function createOrder(input: unknown) {
  const parsed = submissionSchema.safeParse(input);
  if (!parsed.success) throw new OrderInputError("Revisa tus datos y acepta la política para continuar.");
  const data = parsed.data;
  const ready = await paymentSetupReady();
  // Hash the user's immutable draft; never hash/trust any client prices.
  const draftHash = createHash("sha256").update(JSON.stringify(data)).digest("hex");
  return withDatabase((db) => db.transaction(async (tx) => {
    await tx.execute(sql`SET LOCAL lock_timeout = '10s'`);
    await tx.execute(sql`SET LOCAL statement_timeout = '20s'`);
    await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${data.requestId}))`);
    const [existing] = await tx.select({ trackingToken: orders.trackingToken, draftHash: orders.draftHash }).from(orders).where(eq(orders.requestId, data.requestId));
    if (existing) {
      if (existing.draftHash !== draftHash) throw new OrderInputError("Este intento ya corresponde a otro pedido. Recarga para iniciar uno nuevo.");
      return existing.trackingToken;
    }
    const accounts = bankAccountsFromRows(await tx.select().from(bankAccounts).where(eq(bankAccounts.status, "ACTIVO")).orderBy(asc(bankAccounts.id)).for("share"));
    if (!accounts || !ready) throw new OrderInputError("El registro de pedidos no está disponible temporalmente. Conserva tus datos e inténtalo más tarde.");
    // Lock in a fixed order: competing carts cannot oversell or deadlock on books.
    const catalog = await tx.select().from(books).where(and(inArray(books.id, data.cart.map((item) => item.bookId)), eq(books.status, "ACTIVO"), notLike(books.inventoryCode, "DEMO-%"))).orderBy(asc(books.id)).for("update");
    const activeCampuses = await tx.select().from(campuses).where(eq(campuses.status, "ACTIVO")).orderBy(asc(campuses.id)).for("share");
    const validated = createOrderDraftSchema(catalog, activeCampuses.map(toPublicCampus)).safeParse(data);
    if (!validated.success) throw new OrderInputError(validated.error.issues[0]?.message ?? "Revisa tus datos.");
    const { cart, buyer, delivery } = validated.data;
    const quote = calculateQuote(catalog, cart, buyer.type, delivery);
    if (!quote.orderType || !quote.shippingKnown) throw new OrderInputError("Completa la entrega para continuar.");
    const { rows: [clock] } = await tx.execute<{ year: number }>(sql`SELECT extract(year FROM current_timestamp AT TIME ZONE 'America/Lima')::int AS year`);
    const year = clock.year;
    // UPSERT acquires the year's row lock. Rollback also rolls back its increment.
    const [counter] = await tx.insert(orderCounters).values({ year, lastNumber: 1 }).onConflictDoUpdate({ target: orderCounters.year, set: { lastNumber: sql`${orderCounters.lastNumber} + 1` } }).returning();
    const university = quote.accounts.find((account) => account.imprint === "universidad");
    const institute = quote.accounts.find((account) => account.imprint === "instituto");
    const location = resolveLocation(delivery.district);
    const guide = await readPaymentGuide(quote.orderType);
    const guideHash = createHash("sha256").update(guide.content).digest("hex");
    await tx.insert(paymentGuides).values({ hash: guideHash, contentBase64: guide.content.toString("base64") }).onConflictDoNothing();
    const token = nanoid(32);
    const [order] = await tx.insert(orders).values({
      requestId: data.requestId, draftHash, consentAcceptedAt: new Date(), consentVersion, paymentAccounts: accounts, paymentGuideHash: guideHash,
      orderNumber: `${counter.lastNumber}-${year}`, trackingToken: token, orderType: quote.orderType,
      customerType: buyer.type, customerCampus: buyer.campus || null, customerName: buyer.name,
      customerEmail: buyer.email, customerPhone: buyer.phone, customerDocument: buyer.document,
      deliveryType: delivery.type, deliveryCampus: delivery.campus || null, deliveryZone: location?.zone ?? null,
      deliveryDepartment: location?.department.name ?? null, deliveryCity: location?.district.name ?? null,
      deliveryProvince: location?.province.name ?? null, deliveryDistrict: location?.district.name ?? null, deliveryUbigeo: delivery.district || null,
      deliveryAddress: delivery.address, deliveryReference: delivery.reference || null, deliveryRecipient: delivery.recipient,
      deliveryRecipientType: delivery.recipientType, deliveryRecipientDocument: delivery.recipientDocument, deliveryRecipientPhone: delivery.recipientPhone,
      subtotalUniversidad: centsToDecimal(university?.subtotal ?? 0), subtotalInstituto: centsToDecimal(institute?.subtotal ?? 0),
      shippingCost: centsToDecimal(quote.shippingCost), shippingUniversidad: centsToDecimal(university?.shipping ?? 0), shippingInstituto: centsToDecimal(institute?.shipping ?? 0),
      totalUniversidad: centsToDecimal(university?.total ?? 0), totalInstituto: centsToDecimal(institute?.total ?? 0), total: centsToDecimal(quote.total),
      billingRuc: buyer.billingRuc || null, billingBusinessName: buyer.billingBusinessName || null,
      paymentStatusUniversidad: university ? "PENDIENTE" : "NO_APLICA", paymentStatusInstituto: institute ? "PENDIENTE" : "NO_APLICA",
    }).returning({ id: orders.id });
    await tx.insert(orderItems).values(quote.lines.map((line) => ({ orderId: order.id, bookId: line.book.id, bookTitle: line.book.title, publisherImprint: line.book.publisherImprint, unitPrice: centsToDecimal(line.unitPrice), quantity: line.quantity, subtotal: centsToDecimal(line.subtotal) })));
    for (const line of quote.lines) await tx.update(books).set({ stock: sql`${books.stock} - ${line.quantity}` }).where(eq(books.id, line.book.id));
    await tx.insert(orderActivity).values({ orderId: order.id, eventType: "PEDIDO_RECIBIDO", detail: "Registramos tu pedido." });
    await tx.insert(orderEmails).values({ orderId: order.id });
    return token;
  }));
}
