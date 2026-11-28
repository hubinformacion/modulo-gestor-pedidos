import { withDatabase } from "@/db";
import { bankAccounts, paymentGuides } from "@/db/schema";
import { pdfNames, readPaymentGuide, type PaymentOrderType } from "@/modules/settings/data/payment-guides";
import { bankAccountsFromRows, bankAccountsSchema } from "@/modules/settings/domain/bank-accounts";
import { getPublicOrigin } from "@/shared/config/application";
import { getMailProvider } from "@/shared/config/mail";
import { isMailEndpointConfigured } from "@/shared/config/mail-endpoint";
import { googleConfigured } from "@/shared/config/google";
import { asc, eq } from "drizzle-orm";
import "server-only";

export async function getBankAccounts() {
  return withDatabase(async (db) => bankAccountsFromRows(await db.select().from(bankAccounts).where(eq(bankAccounts.status, "ACTIVO")).orderBy(asc(bankAccounts.bank), asc(bankAccounts.id))));
}



export async function paymentSetupReady() {
  if (!googleConfigured() || !await getBankAccounts()) return false;
  try {
    if (getMailProvider() === "endpoint" && !isMailEndpointConfigured()) return false;
    getPublicOrigin();
    await Promise.all(Object.keys(pdfNames).map((type) => readPaymentGuide(type as PaymentOrderType)));
    return true;
  } catch { return false; }
}

export async function getOrderBankAccounts(snapshot: unknown) {
  const parsed = bankAccountsSchema.safeParse(snapshot);
  return parsed.success ? parsed.data : getBankAccounts();
}

export function getPaymentGuideStatuses() {
  return Promise.all((Object.keys(pdfNames) as PaymentOrderType[]).map(async (type) => {
    const label = pdfNames[type];
    try {
      await readPaymentGuide(type);
      return { label, ready: true };
    } catch {
      return { label, ready: false };
    }
  }));
}

export async function readOrderPaymentGuide(order: { orderType: PaymentOrderType; paymentGuideHash: string | null }) {
  if (!order.paymentGuideHash) return readPaymentGuide(order.orderType);
  const [guide] = await withDatabase((db) => db.select({ content: paymentGuides.contentBase64 }).from(paymentGuides).where(eq(paymentGuides.hash, order.paymentGuideHash!)));
  if (!guide) throw new Error("PAYMENT_GUIDE_NOT_FOUND");
  return { filename: pdfNames[order.orderType], content: Buffer.from(guide.content, "base64") };
}
