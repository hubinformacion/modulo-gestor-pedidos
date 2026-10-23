import type { Database } from "@/db";
import type { AuthorizedActor } from "@/modules/access/domain/policy";
import { deleteBookRecord, saveBookRecord } from "@/modules/catalog/data/management";
import type { deleteBookSchema, saveBookSchema } from "@/modules/catalog/domain/validation";
import "server-only";
import type { z } from "zod";

export async function saveBook(db: Database, actor: AuthorizedActor, data: z.infer<typeof saveBookSchema>) {
  return db.transaction((tx) => saveBookRecord(tx, actor, data));
}
export async function deleteBook(db: Database, actor: AuthorizedActor, data: z.infer<typeof deleteBookSchema>) {
  return db.transaction((tx) => deleteBookRecord(tx, actor, data));
}
