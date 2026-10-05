import { sql } from "drizzle-orm";
import { check, index, integer, numeric, pgEnum, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

export * from "./auth-schema";

export const publisherImprint = pgEnum("publisher_imprint", ["universidad", "instituto"]);
export const bookStatus = pgEnum("book_status", ["ACTIVO", "INACTIVO"]);
export const orderType = pgEnum("order_type", ["solo_universidad", "solo_instituto", "mixto"]);
export const customerType = pgEnum("customer_type", ["comunidad_continental", "publico_general"]);
export const deliveryType = pgEnum("delivery_type", ["recojo_campus", "delivery"]);
export const deliveryZone = pgEnum("delivery_zone", ["lima_callao", "provincia"]);
export const orderStatus = pgEnum("order_status", ["PENDIENTE_PAGO", "EN_PREPARACION", "DESPACHADO", "ENTREGADO", "CANCELADO"]);
export const paymentStatus = pgEnum("payment_status", ["NO_APLICA", "PENDIENTE", "EN_REVISION", "VERIFICADO", "RECHAZADO"]);

const timestamps = () => ({
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull().$onUpdate(() => new Date()),
});

// Exact decimal strings: convert to integer céntimos for application arithmetic.
const money = (name: string) => numeric(name, { precision: 12, scale: 2 });

export const books = pgTable("books", {
  id: uuid("id").defaultRandom().primaryKey(),
  inventoryCode: text("inventory_code").notNull().unique(),
  title: text("title").notNull(),
  author: text("author").notNull(),
  publisherImprint: publisherImprint("publisher_imprint").notNull(),
  standardPrice: money("standard_price").notNull(),
  communityPrice: money("community_price").notNull(),
  stock: integer("stock").default(0).notNull(),
  status: bookStatus("status").default("ACTIVO").notNull(),
  ...timestamps(),
}, (table) => [
  index("books_status_imprint_idx").on(table.status, table.publisherImprint),
  check("books_nonempty_fields", sql`btrim(${table.inventoryCode}) <> '' AND btrim(${table.title}) <> '' AND btrim(${table.author}) <> ''`),
  check("books_nonnegative_prices", sql`${table.standardPrice} >= 0 AND ${table.communityPrice} >= 0`),
  check("books_nonnegative_stock", sql`${table.stock} >= 0`),
]);

// Allocate numbers by locking the year's row inside the order transaction (phase 4).
export const orderCounters = pgTable("order_counters", {
  year: integer("year").primaryKey(),
  lastNumber: integer("last_number").default(0).notNull(),
}, (table) => [
  check("order_counters_valid_year", sql`${table.year} BETWEEN 2000 AND 9999`),
  check("order_counters_nonnegative_number", sql`${table.lastNumber} >= 0`),
]);

export const orders = pgTable("orders", {
  id: uuid("id").defaultRandom().primaryKey(),
  orderNumber: text("order_number").notNull().unique(),
  trackingToken: text("tracking_token").notNull().unique(),
  orderType: orderType("order_type").notNull(),
  customerType: customerType("customer_type").notNull(),
  customerCampus: text("customer_campus"),
  customerName: text("customer_name").notNull(),
  customerEmail: text("customer_email").notNull(),
  customerPhone: text("customer_phone").notNull(),
  customerDocument: text("customer_document").notNull(),
  deliveryType: deliveryType("delivery_type").notNull(),
  deliveryCampus: text("delivery_campus"),
  deliveryZone: deliveryZone("delivery_zone"),
  deliveryDepartment: text("delivery_department"),
  deliveryCity: text("delivery_city"),
  // Also stores the library address snapshot for campus pickup.
  deliveryAddress: text("delivery_address").notNull(),
  deliveryReference: text("delivery_reference"),
  deliveryRecipient: text("delivery_recipient").notNull(),
  subtotalUniversidad: money("subtotal_universidad").notNull(),
  subtotalInstituto: money("subtotal_instituto").notNull(),
  shippingCost: money("shipping_cost").notNull(),
  shippingUniversidad: money("shipping_universidad").notNull(),
  shippingInstituto: money("shipping_instituto").notNull(),
  totalUniversidad: money("total_universidad").notNull(),
  totalInstituto: money("total_instituto").notNull(),
  total: money("total").notNull(),
  billingRuc: text("billing_ruc"),
  billingBusinessName: text("billing_business_name"),
  orderStatus: orderStatus("order_status").default("PENDIENTE_PAGO").notNull(),
  // Required explicitly: creation must set the inapplicable imprint to NO_APLICA.
  paymentStatusUniversidad: paymentStatus("payment_status_universidad").notNull(),
  paymentStatusInstituto: paymentStatus("payment_status_instituto").notNull(),
  courier: text("courier"),
  ...timestamps(),
}, (table) => [
  index("orders_created_at_idx").on(table.createdAt),
  index("orders_status_created_at_idx").on(table.orderStatus, table.createdAt),
  index("orders_payment_status_idx").on(table.paymentStatusUniversidad, table.paymentStatusInstituto),
  check("orders_number_format", sql`${table.orderNumber} ~ '^[1-9][0-9]*-[0-9]{4}$'`),
  check("orders_tracking_token_format", sql`${table.trackingToken} ~ '^[A-Za-z0-9_-]{24,}$'`),
  check("orders_customer_fields", sql`btrim(${table.customerName}) <> '' AND btrim(${table.customerPhone}) <> '' AND btrim(${table.customerDocument}) <> '' AND ${table.customerEmail} = lower(btrim(${table.customerEmail})) AND ${table.customerEmail} ~ '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$'`),
  check("orders_community_requirements", sql`${table.customerType} <> 'comunidad_continental' OR (coalesce(btrim(${table.customerCampus}), '') <> '' AND ${table.customerEmail} ~ '^[^[:space:]@]+@continental[.]edu[.]pe$')`),
  check("orders_delivery_fields", sql`btrim(${table.deliveryAddress}) <> '' AND btrim(${table.deliveryRecipient}) <> '' AND (
    (${table.deliveryType} = 'recojo_campus' AND coalesce(btrim(${table.deliveryCampus}), '') <> '' AND ${table.deliveryZone} IS NULL AND ${table.shippingCost} = 0)
    OR (${table.deliveryType} = 'delivery' AND ${table.deliveryCampus} IS NULL AND ${table.deliveryZone} IS NOT NULL AND (
      (${table.deliveryZone} = 'lima_callao' AND ${table.shippingCost} = 15)
      OR (${table.deliveryZone} = 'provincia' AND ${table.shippingCost} = 25 AND coalesce(btrim(${table.deliveryDepartment}), '') <> '' AND coalesce(btrim(${table.deliveryCity}), '') <> '')
    ))
  )`),
  check("orders_nonnegative_amounts", sql`${table.subtotalUniversidad} >= 0 AND ${table.subtotalInstituto} >= 0 AND ${table.shippingCost} >= 0 AND ${table.shippingUniversidad} >= 0 AND ${table.shippingInstituto} >= 0 AND ${table.totalUniversidad} >= 0 AND ${table.totalInstituto} >= 0 AND ${table.total} >= 0`),
  check("orders_totals_consistent", sql`${table.shippingCost} = ${table.shippingUniversidad} + ${table.shippingInstituto} AND ${table.totalUniversidad} = ${table.subtotalUniversidad} + ${table.shippingUniversidad} AND ${table.totalInstituto} = ${table.subtotalInstituto} + ${table.shippingInstituto} AND ${table.total} = ${table.totalUniversidad} + ${table.totalInstituto}`),
  check("orders_imprint_amounts", sql`(
    (${table.orderType} = 'solo_universidad' AND ${table.subtotalInstituto} = 0 AND ${table.shippingInstituto} = 0)
    OR (${table.orderType} = 'solo_instituto' AND ${table.subtotalUniversidad} = 0 AND ${table.shippingUniversidad} = 0)
    OR (${table.orderType} = 'mixto' AND ${table.shippingInstituto} = 0)
  )`),
  check("orders_payment_applicability", sql`(
    (${table.orderType} = 'solo_universidad' AND ${table.paymentStatusUniversidad} <> 'NO_APLICA' AND ${table.paymentStatusInstituto} = 'NO_APLICA')
    OR (${table.orderType} = 'solo_instituto' AND ${table.paymentStatusUniversidad} = 'NO_APLICA' AND ${table.paymentStatusInstituto} <> 'NO_APLICA')
    OR (${table.orderType} = 'mixto' AND ${table.paymentStatusUniversidad} <> 'NO_APLICA' AND ${table.paymentStatusInstituto} <> 'NO_APLICA')
  )`),
  check("orders_verified_before_preparation", sql`${table.orderStatus} NOT IN ('EN_PREPARACION', 'DESPACHADO', 'ENTREGADO') OR (
    (${table.orderType} = 'solo_universidad' AND ${table.paymentStatusUniversidad} = 'VERIFICADO')
    OR (${table.orderType} = 'solo_instituto' AND ${table.paymentStatusInstituto} = 'VERIFICADO')
    OR (${table.orderType} = 'mixto' AND ${table.paymentStatusUniversidad} = 'VERIFICADO' AND ${table.paymentStatusInstituto} = 'VERIFICADO')
  )`),
  check("orders_billing_pair", sql`(${table.billingRuc} IS NULL AND ${table.billingBusinessName} IS NULL) OR (${table.billingRuc} IS NOT NULL AND ${table.billingBusinessName} IS NOT NULL AND ${table.billingRuc} ~ '^[0-9]{11}$' AND btrim(${table.billingBusinessName}) <> '')`),
]);

export const orderItems = pgTable("order_items", {
  id: uuid("id").defaultRandom().primaryKey(),
  orderId: uuid("order_id").notNull().references(() => orders.id, { onDelete: "restrict" }),
  bookId: uuid("book_id").notNull().references(() => books.id, { onDelete: "restrict" }),
  publisherImprint: publisherImprint("publisher_imprint").notNull(),
  unitPrice: money("unit_price").notNull(),
  quantity: integer("quantity").notNull(),
  subtotal: money("subtotal").notNull(),
}, (table) => [
  index("order_items_order_id_idx").on(table.orderId),
  index("order_items_book_id_idx").on(table.bookId),
  check("order_items_positive_quantity", sql`${table.quantity} > 0`),
  check("order_items_price_consistent", sql`${table.unitPrice} >= 0 AND ${table.subtotal} = ${table.unitPrice} * ${table.quantity}`),
]);

export const paymentReceipts = pgTable("payment_receipts", {
  id: uuid("id").defaultRandom().primaryKey(),
  orderId: uuid("order_id").notNull().references(() => orders.id, { onDelete: "restrict" }),
  publisherImprint: publisherImprint("publisher_imprint").notNull(),
  driveFileId: text("drive_file_id").notNull().unique(),
  driveViewUrl: text("drive_view_url").notNull(),
  fileName: text("file_name").notNull(),
  uploadedAt: timestamp("uploaded_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index("payment_receipts_order_imprint_idx").on(table.orderId, table.publisherImprint),
  check("payment_receipts_nonempty_fields", sql`btrim(${table.driveFileId}) <> '' AND btrim(${table.fileName}) <> ''`),
  check("payment_receipts_https_url", sql`${table.driveViewUrl} ~ '^https://'`),
]);

export const authorizedEmails = pgTable("authorized_emails", {
  email: text("email").primaryKey(),
  addedBy: text("added_by").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  check("authorized_emails_normalized", sql`${table.email} = lower(btrim(${table.email}))`),
]);
