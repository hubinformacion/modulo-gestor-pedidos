import type { Imprint } from "@/modules/orders/domain/types";
import { z } from "zod";
import { formatCci } from "./bank-format";

const bankSchema = z.object({
  bank: z.string().trim().min(2), holder: z.string().trim().min(2),
  currency: z.literal("PEN"), account: z.string().trim().min(5).max(80),
  cci: z.string().transform((value) => value.replace(/[ -]/g, "")).pipe(z.string().regex(/^\d{20}$/)).transform(formatCci),
});
export const bankAccountsSchema = z.object({ universidad: z.array(bankSchema).min(1), instituto: z.array(bankSchema).min(1) });
export type BankAccount = z.infer<typeof bankSchema>;
type BankAccountInput = Omit<BankAccount, "currency"> & { currency: string; publisherImprint: Imprint };
export function bankAccountsFromRows(rows: BankAccountInput[]): Record<Imprint, BankAccount[]> | null {
  const parsed = bankAccountsSchema.safeParse({ universidad: rows.filter((row) => row.publisherImprint === "universidad"), instituto: rows.filter((row) => row.publisherImprint === "instituto") });
  return parsed.success ? parsed.data : null;
}
