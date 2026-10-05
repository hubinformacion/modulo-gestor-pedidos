"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { desc, eq } from "drizzle-orm";
import { withDatabase } from "@/db";
import { books, orderItems, orders, paymentReceipts } from "@/db/schema";
import { getAuthorizedSession } from "@/lib/access";
import { AccessError } from "@/lib/access-policy";
import { assertAuthorized } from "@/lib/transaction-access";
import { deleteBookSchema, dispatchSchema, reviewSchema, saveBookSchema, type ActionResult } from "@/lib/admin/validation";

function code(error: unknown): string | undefined {
  if (!error || typeof error !== "object") return;
  if ("code" in error && typeof error.code === "string") return error.code;
  if ("cause" in error) return code(error.cause);
}
function failure(error: unknown): ActionResult {
  return { success: false, message: error instanceof AccessError ? error.message : error instanceof OperationError ? error.message : code(error) === "23505" ? "Ese código de inventario ya existe." : code(error) === "23503" ? "La publicación tiene pedidos asociados. Desactívala para conservar el historial." : "No se pudo guardar. Actualiza la página e intenta nuevamente." };
}
class OperationError extends Error {}
function checkVersion(actual: Date, expected: string) {
  if (actual.toISOString() !== expected) throw new OperationError("Los datos cambiaron desde que abriste esta vista. Actualiza la página antes de continuar.");
}

export async function reviewPaymentAction(input: unknown): Promise<ActionResult> {
  const parsed = reviewSchema.safeParse(input);
  if (!parsed.success) return { success: false, message: "Selecciona un comprobante y una decisión válidos." };
  try {
    const requestHeaders = await headers();
    const token = await withDatabase(async (db) => {
      const actor = await getAuthorizedSession(db, requestHeaders);
      return db.transaction(async (tx) => {
        await assertAuthorized(tx, actor);
        const data = parsed.data;
        const [order] = await tx.select().from(orders).where(eq(orders.id, data.id)).for("update");
        if (!order) throw new OperationError("El pedido no existe.");
        checkVersion(order.updatedAt, data.version);
        const status = data.imprint === "universidad" ? order.paymentStatusUniversidad : order.paymentStatusInstituto;
        if (order.orderStatus !== "PENDIENTE_PAGO" || status !== "EN_REVISION") throw new OperationError("Este pago ya no está pendiente de revisión.");
        const receipts = await tx.select().from(paymentReceipts).where(eq(paymentReceipts.orderId, order.id)).orderBy(desc(paymentReceipts.uploadedAt), desc(paymentReceipts.id));
        if (receipts.find((row) => row.publisherImprint === data.imprint)?.id !== data.receiptId) throw new OperationError("Hay un comprobante más reciente. Actualiza la página y revísalo.");
        const universidad = data.imprint === "universidad" ? data.decision : order.paymentStatusUniversidad;
        const instituto = data.imprint === "instituto" ? data.decision : order.paymentStatusInstituto;
        const complete = [universidad, instituto].every((value) => value === "NO_APLICA" || value === "VERIFICADO");
        await tx.update(orders).set({ paymentStatusUniversidad: universidad, paymentStatusInstituto: instituto, orderStatus: complete ? "EN_PREPARACION" : "PENDIENTE_PAGO" }).where(eq(orders.id, order.id));
        return order.trackingToken;
      });
    });
    revalidatePath("/admin/pedidos", "layout");
    revalidatePath(`/seguimiento/${token}`);
    return { success: true, message: parsed.data.decision === "VERIFICADO" ? "Pago verificado." : "Pago rechazado. El comprador puede enviar un comprobante nuevo para este sello." };
  } catch (error) { return failure(error); }
}

export async function dispatchOrderAction(input: unknown): Promise<ActionResult> {
  const parsed = dispatchSchema.safeParse(input);
  if (!parsed.success) return { success: false, message: "Revisa el estado y los datos del despacho." };
  try {
    const requestHeaders = await headers();
    const token = await withDatabase(async (db) => {
      const actor = await getAuthorizedSession(db, requestHeaders);
      return db.transaction(async (tx) => {
        await assertAuthorized(tx, actor);
        const data = parsed.data;
        const [order] = await tx.select().from(orders).where(eq(orders.id, data.id)).for("update");
        if (!order) throw new OperationError("El pedido no existe.");
        checkVersion(order.updatedAt, data.version);
        if (![order.paymentStatusUniversidad, order.paymentStatusInstituto].every((status) => status === "NO_APLICA" || status === "VERIFICADO")) throw new OperationError("Verifica todos los pagos requeridos antes de despachar.");
        const expected = data.status === "DESPACHADO" ? "EN_PREPARACION" : "DESPACHADO";
        if (order.orderStatus !== expected) throw new OperationError("El pedido no admite ese cambio de estado.");
        if (data.status === "DESPACHADO" && order.deliveryType === "delivery" && !data.courier) throw new OperationError("Indica el courier para el envío a domicilio.");
        await tx.update(orders).set({ orderStatus: data.status, courier: data.status === "DESPACHADO" && order.deliveryType === "delivery" ? data.courier : order.courier }).where(eq(orders.id, order.id));
        return order.trackingToken;
      });
    });
    revalidatePath("/admin/pedidos", "layout"); revalidatePath(`/seguimiento/${token}`);
    return { success: true, message: parsed.data.status === "DESPACHADO" ? "Pedido despachado." : "Pedido entregado." };
  } catch (error) { return failure(error); }
}

export async function saveBookAction(input: unknown): Promise<ActionResult> {
  const parsed = saveBookSchema.safeParse(input);
  if (!parsed.success) return { success: false, message: parsed.error.issues[0]?.message ?? "Revisa los datos de la publicación." };
  try {
    const requestHeaders = await headers();
    await withDatabase(async (db) => {
      const actor = await getAuthorizedSession(db, requestHeaders);
      await db.transaction(async (tx) => {
        await assertAuthorized(tx, actor);
        const { id, version, book } = parsed.data;
        if (!id) { await tx.insert(books).values(book); return; }
        const [current] = await tx.select().from(books).where(eq(books.id, id)).for("update");
        if (!current) throw new OperationError("La publicación no existe.");
        checkVersion(current.updatedAt, version!);
        const [used] = await tx.select({ id: orderItems.id }).from(orderItems).where(eq(orderItems.bookId, id)).limit(1);
        if (used && current.publisherImprint !== book.publisherImprint) throw new OperationError("Una publicación con pedidos asociados no puede cambiar de sello.");
        await tx.update(books).set(book).where(eq(books.id, id));
      });
    });
    revalidatePath("/admin/inventario"); revalidatePath("/pedido"); revalidatePath("/admin/vista-previa");
    return { success: true, message: parsed.data.id ? "Publicación actualizada." : "Publicación creada." };
  } catch (error) { return failure(error); }
}

export async function deleteBookAction(input: unknown): Promise<ActionResult> {
  const parsed = deleteBookSchema.safeParse(input);
  if (!parsed.success) return { success: false, message: "Selecciona una publicación válida." };
  try {
    const requestHeaders = await headers();
    await withDatabase(async (db) => {
      const actor = await getAuthorizedSession(db, requestHeaders);
      await db.transaction(async (tx) => {
        await assertAuthorized(tx, actor);
        const [current] = await tx.select().from(books).where(eq(books.id, parsed.data.id)).for("update");
        if (!current) throw new OperationError("La publicación no existe.");
        checkVersion(current.updatedAt, parsed.data.version);
        const [used] = await tx.select({ id: orderItems.id }).from(orderItems).where(eq(orderItems.bookId, current.id)).limit(1);
        if (used) throw new OperationError("La publicación tiene pedidos asociados. Desactívala para conservar el historial.");
        await tx.delete(books).where(eq(books.id, current.id));
      });
    });
    revalidatePath("/admin/inventario"); revalidatePath("/pedido"); revalidatePath("/admin/vista-previa");
    return { success: true, message: "Publicación eliminada." };
  } catch (error) { return failure(error); }
}
