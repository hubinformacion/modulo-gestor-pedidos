import "server-only";
import { eq } from "drizzle-orm";
import type { Database } from "@/db";
import { bankAccounts } from "@/db/schema";
import type { AuthorizedActor } from "@/lib/access-policy";
import { assertAuthorized } from "@/lib/transaction-access";
import type { BankForm, BankResult } from "./banks-validation";

export async function saveBank(db: Database, actor: AuthorizedActor, data: BankForm, id?: string): Promise<BankResult> {
  return db.transaction(async (tx) => {
    await assertAuthorized(tx, actor);
    const values = { publisherImprint: data.publisherImprint, bank: data.bank, holder: data.holder, account: data.account, cci: data.cci, currency: data.currency, status: data.status };
    if (id) {
      const changed = await tx.update(bankAccounts).set(values).where(eq(bankAccounts.id, id)).returning({ id: bankAccounts.id });
      if (!changed.length) return { success: false, message: "La cuenta ya no existe. Actualiza la página." };
    } else await tx.insert(bankAccounts).values(values);
    return { success: true, message: id ? "Cuenta actualizada." : "Cuenta creada." };
  });
}
export async function deleteBank(db: Database, actor: AuthorizedActor, id: string): Promise<BankResult> {
  return db.transaction(async (tx) => {
    await assertAuthorized(tx, actor);
    const removed = await tx.delete(bankAccounts).where(eq(bankAccounts.id, id)).returning({ id: bankAccounts.id });
    return { success: Boolean(removed.length), message: removed.length ? "Cuenta eliminada. Los pedidos anteriores conservan sus datos de pago." : "La cuenta ya no existe." };
  });
}
