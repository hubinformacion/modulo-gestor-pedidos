import { z } from "zod";
import type { Campus, CatalogBook } from "./types";

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
    phone: z.string().trim().regex(/^\+?[0-9 ()-]{7,24}$/, "Ingresa un teléfono válido.")
      .refine((phone) => { const length = phone.replace(/\D/g, "").length; return length >= 9 && length <= 15; }, "El teléfono debe tener de 9 a 15 dígitos."),
    document: z.string().trim().regex(/^[a-zA-Z0-9-]{6,20}$/, "Ingresa un DNI, CE o pasaporte válido."),
    wantsInvoice: z.boolean(),
    billingRuc: z.string().trim().max(11, "El RUC debe tener 11 dígitos."),
    billingBusinessName: z.string().trim().max(200),
  }).superRefine((buyer, ctx) => {
    if (buyer.type === "comunidad_continental") {
      if (!campuses.some((campus) => campus.id === buyer.campus)) ctx.addIssue({ code: "custom", path: ["campus"], message: "Selecciona tu sede." });
      if (!/^[^@]+@continental\.edu\.pe$/.test(buyer.email)) ctx.addIssue({ code: "custom", path: ["email"], message: "Usa tu correo @continental.edu.pe para acceder al precio comunidad." });
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
    zone: z.enum(["", "lima_callao", "provincia"]),
    department: z.string().trim().max(100),
    city: z.string().trim().max(100),
    address: z.string().trim().max(300),
    reference: z.string().trim().max(300),
    recipient: z.string().trim().min(3, "Ingresa el nombre de quien recibe o recoge.").max(160),
  }).superRefine((delivery, ctx) => {
    if (delivery.type === "recojo_campus") {
      if (!campuses.some((campus) => campus.id === delivery.campus && campus.libraryAddress.trim())) {
        ctx.addIssue({ code: "custom", path: ["campus"], message: "Selecciona un campus con recojo disponible." });
      }
    } else {
      if (!delivery.zone) ctx.addIssue({ code: "custom", path: ["zone"], message: "Selecciona la zona de entrega." });
      if (delivery.address.length < 5) ctx.addIssue({ code: "custom", path: ["address"], message: "Ingresa la dirección completa." });
      if (delivery.zone === "provincia") {
        if (delivery.department.length < 2) ctx.addIssue({ code: "custom", path: ["department"], message: "Ingresa el departamento." });
        if (delivery.city.length < 2) ctx.addIssue({ code: "custom", path: ["city"], message: "Ingresa la ciudad." });
      }
    }
  }).transform((delivery) => ({
    ...delivery,
    campus: delivery.type === "recojo_campus" ? delivery.campus : "",
    zone: delivery.type === "recojo_campus" ? "" as const : delivery.zone,
    address: delivery.type === "recojo_campus" ? campuses.find((campus) => campus.id === delivery.campus)!.libraryAddress : delivery.address,
    department: delivery.type === "delivery" && delivery.zone === "provincia" ? delivery.department : "",
    city: delivery.type === "delivery" && delivery.zone === "provincia" ? delivery.city : "",
    reference: delivery.type === "delivery" ? delivery.reference : "",
  }));
}

export function createOrderDraftSchema(catalog: CatalogBook[], campuses: Campus[]) {
  return z.object({ cart: createCartSchema(catalog), buyer: createBuyerSchema(campuses), delivery: createDeliverySchema(campuses) });
}
