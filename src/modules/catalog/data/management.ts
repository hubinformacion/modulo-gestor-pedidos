import type { Database } from "@/db";
import { books, orderItems } from "@/db/schema";
import { writeManagementAudit } from "@/modules/access/data/management-audit";
import { assertAuthorized } from "@/modules/access/data/transaction-access";
import type { AuthorizedActor } from "@/modules/access/domain/policy";
import { deleteBookSchema, saveBookSchema } from "@/modules/catalog/domain/validation";
import { OperationError, checkVersion } from "@/modules/orders/domain/operation-error";
import { eq } from "drizzle-orm";
import "server-only";
import { z } from "zod";

type Transaction = Parameters<Parameters<Database["transaction"]>[0]>[0];

export async function saveBookRecord(tx: Transaction, actor: AuthorizedActor, data: z.infer<typeof saveBookSchema>) {
  await assertAuthorized(tx, actor);
  const { id, version, book } = data;
  if (!id) { const [created] = await tx.insert(books).values(book).returning({ id: books.id }); await writeManagementAudit(tx, actor, "BOOK_CREATED", "book", created.id, { next: book }); return; }
  const [current] = await tx.select().from(books).where(eq(books.id, id)).for("update");
  if (!current) throw new OperationError("La publicación no existe.");
  checkVersion(current.updatedAt, version!);
  const [used] = await tx.select({ id: orderItems.id }).from(orderItems).where(eq(orderItems.bookId, id)).limit(1);
  if (used && current.publisherImprint !== book.publisherImprint) throw new OperationError("Una publicación con pedidos asociados no puede cambiar de sello.");
  await tx.update(books).set(book).where(eq(books.id, id));
  await writeManagementAudit(tx, actor, "BOOK_CHANGED", "book", id, { previous: Object.fromEntries(Object.keys(book).map((field) => [field, current[field as keyof typeof current]])), next: book });

}

export async function deleteBookRecord(tx: Transaction, actor: AuthorizedActor, data: z.infer<typeof deleteBookSchema>) {
  await assertAuthorized(tx, actor);
  const [current] = await tx.select().from(books).where(eq(books.id, data.id)).for("update");
  if (!current) throw new OperationError("La publicación no existe.");
  checkVersion(current.updatedAt, data.version);
  const [used] = await tx.select({ id: orderItems.id }).from(orderItems).where(eq(orderItems.bookId, current.id)).limit(1);
  if (used) throw new OperationError("La publicación tiene pedidos asociados. Desactívala para conservar el historial.");
  await tx.delete(books).where(eq(books.id, current.id));
  await writeManagementAudit(tx, actor, "BOOK_DELETED", "book", current.id, { inventoryCode: current.inventoryCode, title: current.title });

}
