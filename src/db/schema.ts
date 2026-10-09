import { sql } from "drizzle-orm";
import { user as authUser } from "./auth-schema";
import { type AnyPgColumn, boolean, check, index, integer, jsonb, numeric, pgEnum, pgTable, primaryKey, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";

export * from "./auth-schema";

export const publisherImprint = pgEnum("publisher_imprint", ["universidad", "instituto"]);
export const bookStatus = pgEnum("book_status", ["ACTIVO", "INACTIVO"]);
export const orderType = pgEnum("order_type", ["solo_universidad", "solo_instituto", "mixto"]);
export const customerType = pgEnum("customer_type", ["comunidad_continental", "publico_general"]);
export const deliveryType = pgEnum("delivery_type", ["recojo_campus", "delivery"]);
export const deliveryZone = pgEnum("delivery_zone", ["lima_callao", "provincia"]);
export const orderStatus = pgEnum("order_status", ["PENDIENTE_PAGO", "EN_PREPARACION", "DESPACHADO", "ENTREGADO", "CANCELADO"]);
export const paymentStatus = pgEnum("payment_status", ["NO_APLICA", "PENDIENTE", "EN_REVISION", "VERIFICADO", "RECHAZADO"]);
export const recipientType = pgEnum("recipient_type", ["comprador", "otra_persona"]);

const timestamps = () => ({
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull().$onUpdate(() => new Date()),
});

// Exact decimal strings: convert to integer céntimos for application arithmetic.
const money = (name: string) => numeric(name, { precision: 12, scale: 2 });

export const campuses = pgTable("campuses", {
  id: text("id").default(sql`gen_random_uuid()::text`).primaryKey(),
  name: text("name").notNull(),
  libraryAddress: text("library_address").notNull(),
  libraryLocation: text("library_location").default("").notNull(),
  latitude: numeric("latitude", { precision: 10, scale: 7 }),
  longitude: numeric("longitude", { precision: 10, scale: 7 }),
  googleMapsEmbedUrl: text("google_maps_embed_url"),
  status: bookStatus("status").default("ACTIVO").notNull(),
  ...timestamps(),
}, (table) => [
  uniqueIndex("campuses_name_unique").on(sql`lower(btrim(${table.name}))`),
  check("campuses_nonempty_fields", sql`btrim(${table.name}) <> '' AND btrim(${table.libraryAddress}) <> ''`),
  check("campuses_valid_coordinates", sql`(${table.latitude} IS NULL AND ${table.longitude} IS NULL) OR (${table.latitude} IS NOT NULL AND ${table.longitude} IS NOT NULL AND ${table.latitude} BETWEEN -90 AND 90 AND ${table.longitude} BETWEEN -180 AND 180)`),
  check("campuses_valid_map_url", sql`${table.googleMapsEmbedUrl} IS NULL OR ${table.googleMapsEmbedUrl} ~ '^https://(www[.]google[.]com|maps[.]google[.]com)/maps/embed([?]|/)'`),
]);

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

// Allocate numbers by locking the year's row inside the order transaction.
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
  requestId: uuid("request_id").unique(),
  draftHash: text("draft_hash"),
  consentAcceptedAt: timestamp("consent_accepted_at", { withTimezone: true }),
  consentVersion: text("consent_version"),
  paymentAccounts: jsonb("payment_accounts"),
  paymentGuideHash: text("payment_guide_hash").references(() => paymentGuides.hash, { onDelete: "restrict" }),
  trackingToken: text("tracking_token").notNull().unique(),
  orderType: orderType("order_type").notNull(),
  customerType: customerType("customer_type").notNull(),
  customerCampus: text("customer_campus").references(() => campuses.id, { onDelete: "restrict" }),
  customerName: text("customer_name").notNull(),
  customerEmail: text("customer_email").notNull(),
  customerPhone: text("customer_phone").notNull(),
  customerDocument: text("customer_document").notNull(),
  deliveryType: deliveryType("delivery_type").notNull(),
  deliveryCampus: text("delivery_campus").references(() => campuses.id, { onDelete: "restrict" }),
  deliveryZone: deliveryZone("delivery_zone"),
  deliveryDepartment: text("delivery_department"),
  deliveryCity: text("delivery_city"),
  deliveryProvince: text("delivery_province"),
  deliveryDistrict: text("delivery_district"),
  deliveryUbigeo: text("delivery_ubigeo"),
  // Also stores the library address snapshot for campus pickup.
  deliveryAddress: text("delivery_address").notNull(),
  deliveryLibraryLocation: text("delivery_library_location"),
  deliveryMapUrl: text("delivery_map_url"),
  deliveryReference: text("delivery_reference"),
  deliveryRecipient: text("delivery_recipient").notNull(),
  deliveryRecipientType: recipientType("delivery_recipient_type").default("comprador").notNull(),
  deliveryRecipientDocument: text("delivery_recipient_document"),
  deliveryRecipientPhone: text("delivery_recipient_phone"),
  subtotalUniversidad: money("subtotal_universidad").notNull(),
  subtotalInstituto: money("subtotal_instituto").notNull(),
  shippingCost: money("shipping_cost").notNull(),
  shippingUniversidad: money("shipping_universidad").notNull(),
  shippingInstituto: money("shipping_instituto").notNull(),
  totalUniversidad: money("total_universidad").notNull(),
  totalInstituto: money("total_instituto").notNull(),
  total: money("total").notNull(),
  discountTotal: money("discount_total").default("0").notNull(),
  couponId: uuid("coupon_id").references((): AnyPgColumn => coupons.id, { onDelete: "restrict" }),
  couponCode: text("coupon_code"),
  couponPercent: integer("coupon_percent"),
  billingRuc: text("billing_ruc"),
  billingBusinessName: text("billing_business_name"),
  cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
  cancellationSource: text("cancellation_source").$type<"comprador" | "gestor">(),
  cancellationReason: text("cancellation_reason"),
  stockRestoredAt: timestamp("stock_restored_at", { withTimezone: true }),
  orderStatus: orderStatus("order_status").default("PENDIENTE_PAGO").notNull(),
  // Required explicitly: creation must set the inapplicable imprint to NO_APLICA.
  paymentStatusUniversidad: paymentStatus("payment_status_universidad").notNull(),
  paymentStatusInstituto: paymentStatus("payment_status_instituto").notNull(),
  // Confirming again after rejection requires a newly uploaded receipt.
  submittedReceiptUniversidad: uuid("submitted_receipt_universidad").references((): AnyPgColumn => paymentReceipts.id, { onDelete: "restrict" }),
  submittedReceiptInstituto: uuid("submitted_receipt_instituto").references((): AnyPgColumn => paymentReceipts.id, { onDelete: "restrict" }),
  assignedTo: text("assigned_to").references(() => authUser.id, { onDelete: "restrict" }),
  assignedName: text("assigned_name"),
  assignedAt: timestamp("assigned_at", { withTimezone: true }),
  rejectionUniversidad: text("rejection_universidad"),
  rejectionInstituto: text("rejection_instituto"),
  courier: text("courier"),
  shippingTrackingCode: text("shipping_tracking_code"),
  shippingTrackingUrl: text("shipping_tracking_url"),
  dispatchedAt: timestamp("dispatched_at", { withTimezone: true }),
  deliveredAt: timestamp("delivered_at", { withTimezone: true }),
  ...timestamps(),
}, (table) => [
  index("orders_assigned_status_idx").on(table.assignedTo, table.orderStatus),
  index("orders_created_at_idx").on(table.createdAt),
  index("orders_status_created_at_idx").on(table.orderStatus, table.createdAt),
  index("orders_payment_status_idx").on(table.paymentStatusUniversidad, table.paymentStatusInstituto),
  index("orders_customer_campus_idx").on(table.customerCampus),
  index("orders_delivery_campus_idx").on(table.deliveryCampus),
  check("orders_other_recipient_fields", sql`${table.deliveryRecipientType} <> 'otra_persona' OR (coalesce(${table.deliveryRecipientDocument}, '') ~ '^[0-9]{8}$' AND coalesce(${table.deliveryRecipientPhone}, '') ~ '^[+]?[0-9 ()-]{7,24}$')`),
  check("orders_ubigeo_zone", sql`${table.deliveryUbigeo} IS NULL OR (${table.deliveryType} = 'delivery' AND ${table.deliveryUbigeo} ~ '^[0-9]{6}$' AND ((${table.deliveryZone} = 'lima_callao' AND left(${table.deliveryUbigeo}, 4) IN ('1501', '0701')) OR (${table.deliveryZone} = 'provincia' AND left(${table.deliveryUbigeo}, 4) NOT IN ('1501', '0701'))))`),
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
  bookTitle: text("book_title"),
  bookCode: text("book_code"),
  baseUnitPrice: money("base_unit_price"),
  discountPercent: integer("discount_percent").default(0).notNull(),
  promotionId: uuid("promotion_id").references((): AnyPgColumn => promotions.id, { onDelete: "restrict" }),
  promotionName: text("promotion_name"),
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
  uploadId: uuid("upload_id").unique().references(() => paymentUploads.id, { onDelete: "restrict" }),
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
  role: text("role").$type<"gestor" | "caja">().default("gestor").notNull(),
  publisherImprint: publisherImprint("publisher_imprint"),
  addedBy: text("added_by").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index("authorized_emails_caja_imprint_idx").on(table.publisherImprint).where(sql`${table.role} = 'caja'`),
  check("authorized_emails_role", sql`(${table.role} = 'gestor' AND ${table.publisherImprint} IS NULL) OR (${table.role} = 'caja' AND ${table.publisherImprint} IS NOT NULL)`),
  check("authorized_emails_master_role", sql`${table.email} <> 'distribucionfe@continental.edu.pe' OR ${table.role} = 'gestor'`),
  check("authorized_emails_normalized", sql`${table.email} = lower(btrim(${table.email}))`),
]);

// Durable upload intent: re-use the same Drive ID after network/database failures.
export const paymentUploads = pgTable("payment_uploads", {
  id: uuid("id").primaryKey(),
  orderId: uuid("order_id").notNull().references(() => orders.id, { onDelete: "restrict" }),
  publisherImprint: publisherImprint("publisher_imprint").notNull(),
  contentHash: text("content_hash").notNull(),
  driveFileId: text("drive_file_id").notNull().unique(),
  fileName: text("file_name").notNull(),
  mimeType: text("mime_type").notNull(),
  size: integer("size").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [index("payment_uploads_order_idx").on(table.orderId)]);

// A committed order remains recoverable even if Gmail is temporarily unavailable.
export const orderEmails = pgTable("order_emails", {
  orderId: uuid("order_id").primaryKey().references(() => orders.id, { onDelete: "restrict" }),
  status: text("status").default("PENDIENTE").notNull(),
  attempts: integer("attempts").default(0).notNull(),
  lastAttemptAt: timestamp("last_attempt_at", { withTimezone: true }),
  gmailMessageId: text("gmail_message_id"),
  gmailThreadId: text("gmail_thread_id"),
  rfcMessageId: text("rfc_message_id"),
  subjectHeader: text("subject_header"),
  headersVerified: boolean("headers_verified").default(false).notNull(),
  threadIssue: text("thread_issue"),
  lastRfcMessageId: text("last_rfc_message_id"),
  rfcReferences: jsonb("rfc_references").$type<string[]>().default([]).notNull(),
  leaseId: uuid("lease_id"),
  leaseUntil: timestamp("lease_until", { withTimezone: true }),
  sentAt: timestamp("sent_at", { withTimezone: true }),
}, (table) => [check("order_emails_valid_status", sql`${table.status} IN ('PENDIENTE', 'ENVIANDO', 'ENVIADO', 'ERROR')`)]);

export const orderNotifications = pgTable("order_notifications", {
  id: uuid("id").defaultRandom().primaryKey(),
  orderId: uuid("order_id").notNull().references(() => orders.id, { onDelete: "restrict" }),
  eventType: text("event_type").notNull(),
  payload: jsonb("payload").$type<Record<string, string>>().default({}).notNull(),
  publisherImprint: publisherImprint("publisher_imprint"),
  receiptId: uuid("receipt_id").references((): AnyPgColumn => paymentReceipts.id, { onDelete: "restrict" }),
  status: text("status").default("PENDIENTE").notNull(),
  attempts: integer("attempts").default(0).notNull(),
  lastAttemptAt: timestamp("last_attempt_at", { withTimezone: true }),
  gmailMessageId: text("gmail_message_id"),
  rfcMessageId: text("rfc_message_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index("order_notifications_order_idx").on(table.orderId, table.createdAt),
  index("order_notifications_retry_idx").on(table.status, table.lastAttemptAt),
  check("order_notifications_valid_event", sql`${table.eventType} IN ('COMPROBANTE_RECIBIDO', 'PAGO_VERIFICADO', 'PAGO_RECHAZADO', 'ASIGNADO', 'DESPACHADO', 'ENTREGADO', 'DOCUMENTOS_VENTA', 'CANCELADO')`),
  check("order_notifications_valid_status", sql`${table.status} IN ('PENDIENTE', 'ENVIANDO', 'ENVIADO', 'ERROR', 'OMITIDO')`),
  check("order_notifications_event_fields", sql`(${table.eventType} = 'COMPROBANTE_RECIBIDO' AND ${table.publisherImprint} IS NOT NULL AND ${table.receiptId} IS NOT NULL) OR (${table.eventType} IN ('PAGO_VERIFICADO', 'PAGO_RECHAZADO') AND ${table.publisherImprint} IS NOT NULL) OR ${table.eventType} IN ('ASIGNADO', 'DESPACHADO', 'ENTREGADO', 'DOCUMENTOS_VENTA', 'CANCELADO')`),
]);

export const orderActivity = pgTable("order_activity", {
  id: uuid("id").defaultRandom().primaryKey(),
  orderId: uuid("order_id").notNull().references(() => orders.id, { onDelete: "restrict" }),
  actorUserId: text("actor_user_id").references(() => authUser.id, { onDelete: "set null" }),
  actorName: text("actor_name"),
  eventType: text("event_type").notNull(),
  detail: text("detail").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [index("order_activity_order_idx").on(table.orderId, table.createdAt), index("order_activity_actor_idx").on(table.actorUserId, table.createdAt)]);

export const bankAccounts = pgTable("bank_accounts", {
  id: uuid("id").defaultRandom().primaryKey(),
  publisherImprint: publisherImprint("publisher_imprint").notNull(),
  bank: text("bank").notNull(),
  holder: text("holder").notNull(),
  currency: text("currency").default("PEN").notNull(),
  account: text("account").notNull(),
  cci: text("cci").notNull(),
  status: bookStatus("status").default("INACTIVO").notNull(),
  ...timestamps(),
}, (table) => [
  uniqueIndex("bank_accounts_unique").on(table.publisherImprint, sql`lower(btrim(${table.bank}))`, sql`regexp_replace(${table.account}, '[ -]', '', 'g')`),
  check("bank_accounts_currency", sql`${table.currency} = 'PEN'`),
  check("bank_accounts_active_fields", sql`${table.status} <> 'ACTIVO' OR (btrim(${table.bank}) <> '' AND btrim(${table.holder}) <> '' AND ${table.account} ~ '^[0-9 -]{5,40}$' AND ${table.cci} ~ '^[0-9]{20}$')`),
]);

// Immutable PDF versions keep old orders consistent after bank/guide changes.
export const paymentGuides = pgTable("payment_guides", {
  hash: text("hash").primaryKey(),
  contentBase64: text("content_base64").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

// Keep managed Drive ACLs after email revocation until Google removal succeeds.
export const driveReaderGrants = pgTable("drive_reader_grants", {
  folderId: text("folder_id").notNull(),
  email: text("email").notNull(),
  permissionId: text("permission_id").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [primaryKey({ columns: [table.folderId, table.email] }), uniqueIndex("drive_reader_grants_permission_unique").on(table.folderId, table.permissionId)]);

// Durable upload intent and private evidence, separate from payment receipts.
export const pickupEvidence = pgTable("pickup_evidence", {
  id: uuid("id").primaryKey(),
  orderId: uuid("order_id").notNull().references(() => orders.id, { onDelete: "restrict" }),
  actorUserId: text("actor_user_id").references(() => authUser.id, { onDelete: "set null" }),
  actorName: text("actor_name").notNull(),
  driveFileId: text("drive_file_id").notNull().unique(),
  driveViewUrl: text("drive_view_url"),
  fileName: text("file_name").notNull(),
  mimeType: text("mime_type").notNull(),
  contentHash: text("content_hash").notNull(),
  size: integer("size").notNull(),
  uploadedAt: timestamp("uploaded_at", { withTimezone: true }),
  confirmedAt: timestamp("confirmed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [index("pickup_evidence_order_idx").on(table.orderId), check("pickup_evidence_size", sql`${table.size} > 0 AND ${table.size} <= 3145728`), check("pickup_evidence_image_type", sql`${table.mimeType} IN ('image/jpeg','image/png')`)]);

// Caja is independent of delivery. One request per applicable imprint, with
// immutable upload revisions and separate internal Gmail conversations.
export const cajaRequests = pgTable("caja_requests", {
  id: uuid("id").defaultRandom().primaryKey(),
  orderId: uuid("order_id").notNull().references(() => orders.id, { onDelete: "restrict" }),
  publisherImprint: publisherImprint("publisher_imprint").notNull(),
  status: text("status").$type<"PENDIENTE" | "FINALIZADA" | "DEVUELTA" | "ANULADA">().default("PENDIENTE").notNull(),
  cycle: integer("cycle").default(1).notNull(),
  draftDocumentId: uuid("draft_document_id").references((): AnyPgColumn => saleDocuments.id, { onDelete: "restrict" }),
  finalizedDocumentId: uuid("finalized_document_id").references((): AnyPgColumn => saleDocuments.id, { onDelete: "restrict" }),
  returnReason: text("return_reason"),
  assignedTo: text("assigned_to").references(() => authUser.id, { onDelete: "restrict" }),
  assignedName: text("assigned_name"),
  assignedAt: timestamp("assigned_at", { withTimezone: true }),
  assignmentToken: uuid("assignment_token"),
  finalizedBy: text("finalized_by"),
  finalizedAt: timestamp("finalized_at", { withTimezone: true }),
  gmailThreadId: text("gmail_thread_id"),
  subjectHeader: text("subject_header"),
  lastRfcMessageId: text("last_rfc_message_id"),
  rfcReferences: jsonb("rfc_references").$type<string[]>().default([]).notNull(),
  leaseId: uuid("lease_id"),
  leaseUntil: timestamp("lease_until", { withTimezone: true }),
  ...timestamps(),
}, (table) => [
  uniqueIndex("caja_requests_order_imprint_unique").on(table.orderId, table.publisherImprint),
  check("caja_requests_assignment", sql`(${table.assignedTo} IS NULL AND ${table.assignedName} IS NULL AND ${table.assignedAt} IS NULL AND ${table.assignmentToken} IS NULL) OR (${table.assignedTo} IS NOT NULL AND ${table.assignedName} IS NOT NULL AND ${table.assignedAt} IS NOT NULL AND ${table.assignmentToken} IS NOT NULL)`),
  index("caja_requests_assigned_idx").on(table.assignedTo, table.status),
  index("caja_requests_inbox_idx").on(table.publisherImprint, table.status, table.createdAt),
  check("caja_requests_state", sql`${table.status} IN ('PENDIENTE','FINALIZADA','DEVUELTA','ANULADA') AND ${table.cycle} > 0`),
  check("caja_requests_finalized", sql`${table.status} <> 'FINALIZADA' OR (${table.finalizedDocumentId} IS NOT NULL AND ${table.finalizedAt} IS NOT NULL AND ${table.finalizedBy} IS NOT NULL)`),
]);
export const saleDocuments = pgTable("sale_documents", {
  id: uuid("id").primaryKey(),
  requestId: uuid("request_id").notNull().references(() => cajaRequests.id, { onDelete: "restrict" }),
  cycle: integer("cycle").notNull(),
  actorEmail: text("actor_email").notNull(),
  driveFileId: text("drive_file_id").notNull().unique(),
  driveViewUrl: text("drive_view_url"),
  contentHash: text("content_hash").notNull(),
  fileName: text("file_name").notNull(),
  size: integer("size").notNull(),
  uploadedAt: timestamp("uploaded_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [index("sale_documents_request_idx").on(table.requestId), check("sale_documents_size", sql`${table.size} BETWEEN 1 AND 3145728 AND ${table.cycle} > 0`)]);
export const cajaNotifications = pgTable("caja_notifications", {
  id: uuid("id").defaultRandom().primaryKey(),
  requestId: uuid("request_id").notNull().references(() => cajaRequests.id, { onDelete: "restrict" }),
  cycle: integer("cycle").notNull(),
  eventType: text("event_type").$type<"SOLICITUD" | "FINALIZADA" | "DEVUELTA" | "ANULADA">().notNull(),
  reason: text("reason"),
  status: text("status").default("PENDIENTE").notNull(),
  attempts: integer("attempts").default(0).notNull(),
  lastAttemptAt: timestamp("last_attempt_at", { withTimezone: true }),
  gmailMessageId: text("gmail_message_id"),
  rfcMessageId: text("rfc_message_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  uniqueIndex("caja_notifications_event_unique").on(table.requestId, table.cycle, table.eventType),
  index("caja_notifications_retry_idx").on(table.status, table.lastAttemptAt),
  check("caja_notifications_event", sql`${table.eventType} IN ('SOLICITUD','FINALIZADA','DEVUELTA','ANULADA')`),
  check("caja_notifications_state", sql`${table.status} IN ('PENDIENTE','ENVIANDO','ENVIADO','ERROR','OMITIDO')`),
]);
export const saleDocumentBatches = pgTable("sale_document_batches", {
  id: uuid("id").defaultRandom().primaryKey(),
  orderId: uuid("order_id").notNull().references(() => orders.id, { onDelete: "restrict" }),
  batchKey: text("batch_key").notNull().unique(),
  documentIds: jsonb("document_ids").$type<string[]>().notNull(),
  correction: boolean("correction").default(false).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

// Individual caja permissions, including unresolved provider acknowledgements.
export const driveFileReaderGrants = pgTable("drive_file_reader_grants", {
  driveFileId: text("drive_file_id").notNull(),
  email: text("email").notNull(),
  requestId: uuid("request_id").notNull().references(() => cajaRequests.id, { onDelete: "restrict" }),
  permissionId: text("permission_id"),
  managed: boolean("managed").default(true).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [primaryKey({ columns: [table.driveFileId, table.email] })]);

export const promotions = pgTable("promotions", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  communityPercent: integer("community_percent").default(0).notNull(),
  publicPercent: integer("public_percent").default(0).notNull(),
  scope: text("scope").$type<"all" | "selected">().notNull(),
  startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
  endsAt: timestamp("ends_at", { withTimezone: true }).notNull(),
  status: bookStatus("status").default("INACTIVO").notNull(),
  ...timestamps(),
}, (table) => [
  index("promotions_dates_idx").on(table.status, table.startsAt, table.endsAt),
  check("promotions_rates", sql`${table.communityPercent} BETWEEN 0 AND 99 AND ${table.publicPercent} BETWEEN 0 AND 99 AND (${table.communityPercent} > 0 OR ${table.publicPercent} > 0)`),
  check("promotions_scope", sql`${table.scope} IN ('all','selected')`),
  check("promotions_period", sql`${table.startsAt} < ${table.endsAt} AND btrim(${table.name}) <> ''`),
]);
export const promotionBooks = pgTable("promotion_books", {
  promotionId: uuid("promotion_id").notNull().references(() => promotions.id, { onDelete: "cascade" }),
  bookId: uuid("book_id").notNull().references(() => books.id, { onDelete: "restrict" }),
}, (table) => [primaryKey({ columns: [table.promotionId, table.bookId] }), index("promotion_books_book_idx").on(table.bookId)]);

export const coupons = pgTable("coupons", {
  id: uuid("id").defaultRandom().primaryKey(),
  code: text("code").notNull().unique(),
  percent: integer("percent").notNull(),
  audience: text("audience").$type<"all" | "comunidad_continental" | "publico_general">().default("all").notNull(),
  maxUses: integer("max_uses"),
  usedCount: integer("used_count").default(0).notNull(),
  startsAt: timestamp("starts_at", { withTimezone: true }),
  endsAt: timestamp("ends_at", { withTimezone: true }),
  status: bookStatus("status").default("INACTIVO").notNull(),
  ...timestamps(),
}, (table) => [
  check("coupons_code", sql`${table.code} ~ '^[A-Z0-9_-]{3,32}$'`),
  check("coupons_percent", sql`${table.percent} BETWEEN 1 AND 99`),
  check("coupons_audience", sql`${table.audience} IN ('all','comunidad_continental','publico_general')`),
  check("coupons_usage", sql`${table.usedCount} >= 0 AND (${table.maxUses} IS NULL OR (${table.maxUses} > 0 AND ${table.usedCount} <= ${table.maxUses}))`),
  check("coupons_dates", sql`${table.startsAt} IS NULL OR ${table.endsAt} IS NULL OR ${table.startsAt} < ${table.endsAt}`),
]);
export const couponRedemptions = pgTable("coupon_redemptions", {
  orderId: uuid("order_id").primaryKey().references(() => orders.id, { onDelete: "restrict" }),
  couponId: uuid("coupon_id").notNull().references(() => coupons.id, { onDelete: "restrict" }),
  releasedAt: timestamp("released_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [index("coupon_redemptions_coupon_idx").on(table.couponId)]);
