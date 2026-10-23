import type { Database } from "@/db";
import type { AuthorizedActor } from "@/modules/access/domain/policy";
import { addInternalNoteRecord, assignOrderRecord, dispatchOrderRecord, reviewPaymentRecord } from "@/modules/orders/data/management";
import type { assignmentSchema, dispatchSchema, internalNoteSchema, reviewSchema } from "@/modules/orders/domain/management";
import "server-only";
import type { z } from "zod";

export async function reviewPayment(db: Database, actor: AuthorizedActor, data: z.infer<typeof reviewSchema>) {
  return db.transaction((tx) => reviewPaymentRecord(tx, actor, data));
}
export async function dispatchOrder(db: Database, actor: AuthorizedActor, data: z.infer<typeof dispatchSchema>) {
  return db.transaction((tx) => dispatchOrderRecord(tx, actor, data));
}
export async function assignOrder(db: Database, actor: AuthorizedActor, data: z.infer<typeof assignmentSchema>) {
  return db.transaction((tx) => assignOrderRecord(tx, actor, data));
}
export async function addInternalNote(db: Database, actor: AuthorizedActor, data: z.infer<typeof internalNoteSchema>) {
  return db.transaction((tx) => addInternalNoteRecord(tx, actor, data));
}
