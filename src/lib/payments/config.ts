import "server-only";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { z } from "zod";
import { asc, eq } from "drizzle-orm";
import { withDatabase } from "@/db";
import { bankAccounts, paymentGuides } from "@/db/schema";
import type { Imprint } from "@/lib/orders/types";

const bankSchema = z.object({
  bank: z.string().trim().min(2), holder: z.string().trim().min(2),
  currency: z.literal("PEN"), account: z.string().trim().min(5).max(80),
  cci: z.string().transform((value) => value.replace(/[ -]/g, "")).pipe(z.string().regex(/^\d{20}$/)),
});
export const bankAccountsSchema = z.object({ universidad: z.array(bankSchema).min(1), instituto: z.array(bankSchema).min(1) });
export type BankAccount = z.infer<typeof bankSchema>;
export function bankAccountsFromRows(rows: (typeof bankAccounts.$inferSelect)[]): Record<Imprint, BankAccount[]> | null {
  const parsed = bankAccountsSchema.safeParse({ universidad: rows.filter((row) => row.publisherImprint === "universidad"), instituto: rows.filter((row) => row.publisherImprint === "instituto") });
  return parsed.success ? parsed.data : null;
}
export async function getBankAccounts() {
  return withDatabase(async (db) => bankAccountsFromRows(await db.select().from(bankAccounts).where(eq(bankAccounts.status, "ACTIVO")).orderBy(asc(bankAccounts.bank), asc(bankAccounts.id))));
}

const pdfNames = { solo_universidad: "guia_pago_universidad.pdf", solo_instituto: "guia_pago_instituto.pdf", mixto: "guia_pago_mixta.pdf" } as const;
export type PaymentOrderType = keyof typeof pdfNames;
export async function readPaymentGuide(type: PaymentOrderType) {
  const filename = pdfNames[type];
  const content = await readFile(join(process.cwd(), "src/assets/pdfs", filename));
  if (!content.subarray(0, 5).equals(Buffer.from("%PDF-")) || content.length > 3 * 1024 * 1024) throw new Error("INVALID_PAYMENT_GUIDE");
  return { filename, content };
}

export function getPublicOrigin() {
  const origin = new URL(z.url().parse(process.env.APP_URL));
  if (origin.protocol !== "https:" && !(process.env.NODE_ENV !== "production" && origin.hostname === "localhost" && origin.protocol === "http:")) throw new Error("INVALID_APP_URL");
  return origin.origin;
}
export function googleConfigured() {
  return ["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET", "GOOGLE_REFRESH_TOKEN", "GOOGLE_DRIVE_FOLDER_ID", "GOOGLE_OWNER_EMAIL"].every((key) => Boolean(process.env[key]?.trim())) && z.email().safeParse(process.env.GOOGLE_OWNER_EMAIL).success;
}
export async function paymentSetupReady() {
  if (!googleConfigured() || !await getBankAccounts()) return false;
  try {
    getPublicOrigin();
    await Promise.all(Object.keys(pdfNames).map((type) => readPaymentGuide(type as PaymentOrderType)));
    return true;
  } catch { return false; }
}

export async function getOrderBankAccounts(snapshot: unknown) {
  const parsed = bankAccountsSchema.safeParse(snapshot);
  return parsed.success ? parsed.data : getBankAccounts();
}

export async function getPaymentSetupStatus() {
  const guides = await Promise.all((Object.keys(pdfNames) as PaymentOrderType[]).map(async (type) => {
    try { await readPaymentGuide(type); return { label: pdfNames[type], ready: true }; }
    catch { return { label: pdfNames[type], ready: false }; }
  }));
  let originReady = false;
  try { getPublicOrigin(); originReady = true; } catch { /* Missing configuration. */ }
  return [{ label: "Cuentas bancarias activas de ambos sellos", ready: Boolean(await getBankAccounts()) },
    { label: "Credenciales de cuenta propietaria para Drive y Gmail", ready: googleConfigured() },
    { label: "Dirección pública del sistema", ready: originReady }, ...guides];
}

export async function readOrderPaymentGuide(order: { orderType: PaymentOrderType; paymentGuideHash: string | null }) {
  if (!order.paymentGuideHash) return readPaymentGuide(order.orderType);
  const [guide] = await withDatabase((db) => db.select({ content: paymentGuides.contentBase64 }).from(paymentGuides).where(eq(paymentGuides.hash, order.paymentGuideHash!)));
  if (!guide) throw new Error("PAYMENT_GUIDE_NOT_FOUND");
  return { filename: pdfNames[order.orderType], content: Buffer.from(guide.content, "base64") };
}
