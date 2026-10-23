import { z } from "zod";

const version = z.iso.datetime();
const price = z.string().trim().regex(/^\d{1,10}(\.\d{1,2})?$/, "Usa un importe en soles con hasta dos decimales.");
export const bookSchema = z.object({
  inventoryCode: z.string().trim().min(1, "Ingresa el código.").max(80),
  title: z.string().trim().min(1, "Ingresa el título.").max(300),
  author: z.string().trim().min(1, "Ingresa el autor.").max(200),
  publisherImprint: z.enum(["universidad", "instituto"]),
  standardPrice: price, communityPrice: price,
  stock: z.number().int().min(0).max(2147483647), status: z.enum(["ACTIVO", "INACTIVO"]),
});
export const saveBookSchema = z.object({ book: bookSchema, id: z.uuid().optional(), version: version.optional() }).refine((value) => Boolean(value.id) === Boolean(value.version), "Actualiza la publicación antes de editarla.");
export const deleteBookSchema = z.object({ id: z.uuid(), version });
export type BookForm = z.infer<typeof bookSchema>;
export type BookRow = BookForm & { id: string; version: string };
export const emptyBook: BookForm = { inventoryCode: "", title: "", author: "", publisherImprint: "universidad", standardPrice: "", communityPrice: "", stock: 0, status: "INACTIVO" };
