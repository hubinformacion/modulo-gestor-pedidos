import { z } from "zod";
import { bookStatus, books, publisherImprint } from "../schema";

const demoBookSchema = z.object({
  inventoryCode: z.string().regex(/^DEMO-(UC|IC)-[0-9]{3}$/),
  title: z.string().startsWith("[DEMO] "),
  author: z.literal("Autor de demostración"),
  publisherImprint: z.enum(publisherImprint.enumValues),
  standardPrice: z.string().regex(/^[0-9]+\.[0-9]{2}$/),
  communityPrice: z.string().regex(/^[0-9]+\.[0-9]{2}$/),
  stock: z.number().int().nonnegative(),
  status: z.enum(bookStatus.enumValues),
});

// Fictional fixtures, never an official catalog. Inactive until explicitly enabled.
export const demoBooks = z.array(demoBookSchema).parse([
  {
    inventoryCode: "DEMO-UC-001", title: "[DEMO] Introducción a la investigación",
    author: "Autor de demostración", publisherImprint: "universidad",
    standardPrice: "60.00", communityPrice: "45.00", stock: 12, status: "INACTIVO",
  },
  {
    inventoryCode: "DEMO-UC-002", title: "[DEMO] Gestión y desarrollo",
    author: "Autor de demostración", publisherImprint: "universidad",
    standardPrice: "48.50", communityPrice: "36.50", stock: 8, status: "INACTIVO",
  },
  {
    inventoryCode: "DEMO-IC-001", title: "[DEMO] Fundamentos de tecnología",
    author: "Autor de demostración", publisherImprint: "instituto",
    standardPrice: "40.00", communityPrice: "30.00", stock: 15, status: "INACTIVO",
  },
  {
    inventoryCode: "DEMO-IC-002", title: "[DEMO] Herramientas para emprender",
    author: "Autor de demostración", publisherImprint: "instituto",
    standardPrice: "35.50", communityPrice: "27.00", stock: 10, status: "INACTIVO",
  },
]) satisfies (typeof books.$inferInsert)[];
