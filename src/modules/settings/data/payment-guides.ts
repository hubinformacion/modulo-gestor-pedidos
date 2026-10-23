import { readFile } from "node:fs/promises";
import { join } from "node:path";
import "server-only";

export const pdfNames = { solo_universidad: "guia_pago_universidad.pdf", solo_instituto: "guia_pago_instituto.pdf", mixto: "guia_pago_mixta.pdf" } as const;
export type PaymentOrderType = keyof typeof pdfNames;
export async function readPaymentGuide(type: PaymentOrderType) {
  const filename = pdfNames[type];
  const content = await readFile(join(process.cwd(), "src/resources/payment-guides", filename));
  if (!content.subarray(0, 5).equals(Buffer.from("%PDF-")) || content.length > 3 * 1024 * 1024) throw new Error("INVALID_PAYMENT_GUIDE");
  return { filename, content };
}
