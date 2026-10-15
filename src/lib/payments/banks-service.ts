import "server-only";
import { writeManagementAudit } from "@/lib/audit/management";
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
    const [previous] = id ? await tx.select().from(bankAccounts).where(eq(bankAccounts.id, id)).for("update") : [];
    let targetId = id;
    if (id) {
      const changed = await tx.update(bankAccounts).set(values).where(eq(bankAccounts.id, id)).returning({ id: bankAccounts.id });
      if (!changed.length) return { success: false, message: "La cuenta ya no existe. Actualiza la página." };
    } else { const [created] = await tx.insert(bankAccounts).values(values).returning({ id: bankAccounts.id }); targetId = created.id; }
    await writeManagementAudit(tx, actor, id ? "BANK_CHANGED" : "BANK_CREATED", "bank", targetId!, { previous: previous ? Object.fromEntries(Object.keys(values).map((field) => [field, previous[field as keyof typeof previous]])) : null, next: values });
    return { success: true, message: id ? "Cuenta actualizada." : "Cuenta creada." };
  });
}
export async function deleteBank(db: Database, actor: AuthorizedActor, id: string): Promise<BankResult> {
  return db.transaction(async (tx) => {
    await assertAuthorized(tx, actor);
    const removed = await tx.delete(bankAccounts).where(eq(bankAccounts.id, id)).returning();
    if (removed.length) await writeManagementAudit(tx, actor, "BANK_DELETED", "bank", id, { bank: removed[0].bank, unit: removed[0].publisherImprint });
    return { success: Boolean(removed.length), message: removed.length ? "Cuenta eliminada. Los pedidos anteriores conservan sus datos de pago." : "La cuenta ya no existe." };
  });
}
