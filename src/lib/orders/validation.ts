import { z } from "zod";
import type { Campus, CatalogBook } from "./types";
import { departments, districtsFor, provincesFor } from "./geography";
import { resolveRecipient } from "./recipient";

export const phoneSchema = z.string().trim().regex(/^\+?[0-9 ()-]{7,24}$/, "Ingresa un teléfono válido.")
  .refine((phone) => { const length = phone.replace(/\D/g, "").length; return length >= 9 && length <= 15; }, "El teléfono debe tener de 9 a 15 dígitos.");

export function createCartSchema(catalog: CatalogBook[]) {
  const available = new Map(catalog.map((book) => [book.id, book]));
  return z.array(z.object({ bookId: z.uuid(), quantity: z.number().int().positive() }))
    .min(1, "Selecciona al menos una publicación.")
    .max(100, "Selecciona como máximo 100 publicaciones distintas.")
    .superRefine((items, ctx) => {
      const seen = new Set<string>();
      items.forEach((item, i) => {
        const book = available.get(item.bookId);
        if (!book || seen.has(item.bookId)) {
          ctx.addIssue({ code: "custom", path: [i, "bookId"], message: "Esta publicación no está disponible." });
        } else if (item.quantity > book.stock) {
          ctx.addIssue({ code: "custom", path: [i, "quantity"], message: `Solo hay ${book.stock} unidades de ${book.title}.` });
        }
        seen.add(item.bookId);
      });
    });
}

export function createBuyerSchema(campuses: Campus[]) {
  return z.object({
    type: z.enum(["comunidad_continental", "publico_general"]),
    campus: z.string().trim().max(120),
    name: z.string().trim().min(3, "Ingresa tu nombre completo.").max(160),
    email: z.string().trim().toLowerCase().max(254).pipe(z.email("Ingresa un correo válido.")),
    phone: phoneSchema,
    document: z.string().trim().regex(/^[a-zA-Z0-9-]{6,20}$/, "Ingresa un DNI, CE o pasaporte válido."),
    wantsInvoice: z.boolean(),
    billingRuc: z.string().trim().max(11, "El RUC debe tener 11 dígitos."),
    billingBusinessName: z.string().trim().max(200),
  }).superRefine((buyer, ctx) => {
    if (buyer.type === "comunidad_continental") {
      if (!campuses.some((campus) => campus.id === buyer.campus)) ctx.addIssue({ code: "custom", path: ["campus"], message: "Selecciona tu sede." });
      if (!/^[^@]+@continental\.edu\.pe$/.test(buyer.email)) ctx.addIssue({ code: "custom", path: ["email"], message: "Usa tu correo @continental.edu.pe." });
    }
    if (buyer.wantsInvoice) {
      if (!/^[0-9]{11}$/.test(buyer.billingRuc)) ctx.addIssue({ code: "custom", path: ["billingRuc"], message: "El RUC debe tener 11 dígitos." });
      if (buyer.billingBusinessName.length < 2) ctx.addIssue({ code: "custom", path: ["billingBusinessName"], message: "Ingresa la razón social." });
    }
  }).transform((buyer) => ({
    ...buyer, campus: buyer.type === "comunidad_continental" ? buyer.campus : "",
    billingRuc: buyer.wantsInvoice ? buyer.billingRuc : "",
    billingBusinessName: buyer.wantsInvoice ? buyer.billingBusinessName : "",
  }));
}

export function createDeliverySchema(campuses: Campus[]) {
  return z.object({
    type: z.enum(["recojo_campus", "delivery"]),
    campus: z.string().trim().max(120),
    department: z.string().trim().max(2),
    province: z.string().trim().max(4),
    district: z.string().trim().max(6),
    address: z.string().trim().max(300),
    reference: z.string().trim().max(300),
    recipientType: z.enum(["comprador", "otra_persona"]),
    recipient: z.string().trim().max(160),
    recipientDocument: z.string().trim().max(8),
    recipientPhone: z.string().trim().max(24),
  }).superRefine((delivery, ctx) => {
    if (delivery.type === "recojo_campus") {
      if (!campuses.some((campus) => campus.id === delivery.campus && campus.libraryAddress.trim())) {
        ctx.addIssue({ code: "custom", path: ["campus"], message: "Selecciona un campus con recojo disponible." });
      }
    } else {
      if (!departments.some((option) => option.id === delivery.department)) ctx.addIssue({ code: "custom", path: ["department"], message: "Selecciona el departamento." });
      if (!delivery.department || !provincesFor(delivery.department).some((option) => option.id === delivery.province)) ctx.addIssue({ code: "custom", path: ["province"], message: "Selecciona la provincia." });
      if (!delivery.province || !districtsFor(delivery.province).some((option) => option.id === delivery.district)) ctx.addIssue({ code: "custom", path: ["district"], message: "Selecciona el distrito." });
      if (delivery.address.length < 5) ctx.addIssue({ code: "custom", path: ["address"], message: "Ingresa la dirección completa." });
    }
    if (delivery.recipientType === "otra_persona") {
      if (delivery.recipient.length < 3) ctx.addIssue({ code: "custom", path: ["recipient"], message: "Ingresa los nombres y apellidos de la otra persona." });
      if (!/^[0-9]{8}$/.test(delivery.recipientDocument)) ctx.addIssue({ code: "custom", path: ["recipientDocument"], message: "El DNI debe tener 8 dígitos." });
      const phone = phoneSchema.safeParse(delivery.recipientPhone);
      if (!phone.success) ctx.addIssue({ code: "custom", path: ["recipientPhone"], message: phone.error.issues[0].message });
    }
  }).transform((delivery) => ({
    ...delivery,
    campus: delivery.type === "recojo_campus" ? delivery.campus : "",
    address: delivery.type === "recojo_campus" ? campuses.find((campus) => campus.id === delivery.campus)!.libraryAddress : delivery.address,
    department: delivery.type === "delivery" ? delivery.department : "",
    province: delivery.type === "delivery" ? delivery.province : "",
    district: delivery.type === "delivery" ? delivery.district : "",
    reference: delivery.type === "delivery" ? delivery.reference : "",
    recipient: delivery.recipientType === "otra_persona" ? delivery.recipient : "",
    recipientDocument: delivery.recipientType === "otra_persona" ? delivery.recipientDocument : "",
    recipientPhone: delivery.recipientType === "otra_persona" ? delivery.recipientPhone : "",
  }));
}

export function createOrderDraftSchema(catalog: CatalogBook[], campuses: Campus[]) {
  return z.object({ cart: createCartSchema(catalog), buyer: createBuyerSchema(campuses), delivery: createDeliverySchema(campuses) })
    .transform((draft) => {
      const recipient = resolveRecipient(draft.delivery, draft.buyer);
      return { ...draft, delivery: { ...draft.delivery, recipient: recipient.name, recipientDocument: recipient.document, recipientPhone: recipient.phone } };
    });
}

export const consentSchema = z.object({
  accepted: z.literal(true, { error: "Lee y acepta la política y autoriza el tratamiento de tus datos personales para continuar." }),
});
