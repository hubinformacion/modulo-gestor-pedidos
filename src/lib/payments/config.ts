import "server-only";
import { formatCci } from "./bank-format";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { z } from "zod";
import { asc, eq } from "drizzle-orm";
import { withDatabase } from "@/db";
import { bankAccounts, paymentGuides, campuses, treasuryMailboxes, pickupContacts, deliveryRates } from "@/db/schema";
import { isAuthConfigured } from "@/lib/env";
import { getWordPressOrigins } from "@/lib/iframe/config";
import { deliveryZoneLabels } from "@/lib/delivery/rates-validation";
import type { Imprint } from "@/lib/orders/types";

const bankSchema = z.object({
  bank: z.string().trim().min(2), holder: z.string().trim().min(2),
  currency: z.literal("PEN"), account: z.string().trim().min(5).max(80),
  cci: z.string().transform((value) => value.replace(/[ -]/g, "")).pipe(z.string().regex(/^\d{20}$/)).transform(formatCci),
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

export async function getPaymentSetupStatus(configuration: {
  bankRows: (typeof bankAccounts.$inferSelect)[];
  campusRows: (typeof campuses.$inferSelect)[];
  mailboxRows: (typeof treasuryMailboxes.$inferSelect)[];
  supportRows: (typeof pickupContacts.$inferSelect)[];
  rateRows: (typeof deliveryRates.$inferSelect)[];
}) {
  // Reuse the authorized page snapshot instead of querying every setting twice.
  const banks = bankAccountsFromRows(configuration.bankRows.filter((row) => row.status === "ACTIVO"));
  const sites = configuration.campusRows.filter((row) => row.status === "ACTIVO");
  const mailboxes = configuration.mailboxRows;
  const support = configuration.supportRows.filter((row) => row.status === "ACTIVO");
  const rates = configuration.rateRows;
  const guides = await Promise.all((Object.keys(pdfNames) as PaymentOrderType[]).map(async (type) => {
    try { await readPaymentGuide(type); return { group: "Pagos y documentos", label: pdfNames[type], ready: true, detail: "PDF local presente con firma y tamaño válidos." }; }
    catch { return { group: "Pagos y documentos", label: pdfNames[type], ready: false, detail: "Revisa el archivo PDF y su tamaño máximo de 3 MiB." }; }
  }));
  let originReady = false; let embedReady = false;
  try { getPublicOrigin(); originReady = true; } catch { /* Missing configuration. */ }
  try { embedReady = getWordPressOrigins().length > 0; } catch { /* Invalid origin configuration. */ }
  return [
    { group: "Aplicación y acceso", label: "Base de datos", ready: true, detail: "Las consultas de configuración se completaron." },
    { group: "Aplicación y acceso", label: "Acceso con Google", ready: isAuthConfigured(), detail: "URL de autenticación, secreto de sesión y cliente OAuth presentes; no comprueba el login real." },
    { group: "Aplicación y acceso", label: "Dirección pública", ready: originReady, detail: "APP_URL tiene un formato válido; no comprueba DNS ni disponibilidad externa." },
    { group: "Aplicación y acceso", label: "WordPress autorizado para iframe", ready: embedReady, detail: "WORDPRESS_ORIGINS contiene orígenes válidos; no comprueba el bloque publicado en WordPress." },
    { group: "Google y servicios", label: "Credenciales propietarias Drive / Gmail", ready: googleConfigured(), detail: "Variables presentes. Usa la comprobación manual para validar token, buzón y carpeta." },
    { group: "Google y servicios", label: "Protección del cron de permisos", ready: (process.env.CRON_SECRET?.length ?? 0) >= 32, detail: "Secreto de al menos 32 caracteres; no acredita que el cron esté habilitado en Vercel." },
    { group: "Pagos y documentos", label: "Cuentas activas de ambos sellos", ready: Boolean(banks), detail: "Revisa titular, cuenta y CCI. La validación de formato no confirma la titularidad bancaria." }, ...guides,
    { group: "Entrega y recojo", label: "Campus activos con horario", ready: sites.length > 0 && sites.every((site) => site.pickupHours.trim()), detail: `${sites.length} campus activos. Todos deben tener un horario de recojo.` },
    { group: "Entrega y recojo", label: "Personal de apoyo activo", ready: support.length > 0, detail: `${support.length} personas disponibles para coordinar recojos, sin acceso al sistema.` },
    ...(["lima_callao", "provincia"] as const).map((zone) => ({ group: "Entrega y recojo", label: `Delivery · ${deliveryZoneLabels[zone]}`, ready: rates.some((rate) => rate.zone === zone && rate.status === "ACTIVO"), detail: "Una tarifa ausente o inactiva deshabilita el delivery para esta zona." })),
    ...(["universidad", "instituto"] as const).map((unit) => ({ group: "Tesorería Recaudación", label: `Buzón de servicio · ${unit === "universidad" ? "Universidad" : "Instituto"}`, ready: mailboxes.some((row) => row.publisherImprint === unit), detail: "Destinatario interno configurado; no se comprueba la recepción de correo." })),
  ];
}

export async function readOrderPaymentGuide(order: { orderType: PaymentOrderType; paymentGuideHash: string | null }) {
  if (!order.paymentGuideHash) return readPaymentGuide(order.orderType);
  const [guide] = await withDatabase((db) => db.select({ content: paymentGuides.contentBase64 }).from(paymentGuides).where(eq(paymentGuides.hash, order.paymentGuideHash!)));
  if (!guide) throw new Error("PAYMENT_GUIDE_NOT_FOUND");
  return { filename: pdfNames[order.orderType], content: Buffer.from(guide.content, "base64") };
}
