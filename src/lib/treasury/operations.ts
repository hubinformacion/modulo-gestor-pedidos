import "server-only";
import { randomUUID } from "node:crypto";
import { and, eq, isNull } from "drizzle-orm";
import { withDatabase } from "@/db";
import { treasuryNotes, treasuryActivity, treasuryObservations, cajaRequests } from "@/db/schema";
import { assertAuthorized, assertTreasuryOperator } from "@/lib/transaction-access";
import type { AuthorizedActor } from "@/lib/access-policy";
import { CajaError, lockRequest } from "@/lib/caja/service";
import type { z } from "zod";
import type { noteSchema, observationSchema, resolveSchema } from "./validation";
export async function addTreasuryNote(actor: AuthorizedActor, input: z.infer<typeof noteSchema>) {
  await withDatabase((db) => db.transaction(async (tx) => {
    await assertTreasuryOperator(tx, actor); const { request } = await lockRequest(tx, input.id);
    if (!actor.publisherImprints.includes(request.publisherImprint)) throw new CajaError("No tienes acceso a esta solicitud.");
    await tx.insert(treasuryNotes).values({ requestId: request.id, actorId: actor.userId, actorName: actor.name, content: input.content });
    await tx.insert(treasuryActivity).values({ requestId: request.id, actorId: actor.userId, actorName: actor.name, event: "NOTA", detail: "Añadió una nota interna de Tesorería Recaudación." });
  }));
}
export async function addObservation(actor: AuthorizedActor, input: z.infer<typeof observationSchema>) {
  await withDatabase((db) => db.transaction(async (tx) => {
    await assertTreasuryOperator(tx, actor); const { order, request } = await lockRequest(tx, input.id);
    if (!actor.publisherImprints.includes(request.publisherImprint) || request.assignedTo !== actor.userId) throw new CajaError("Toma la atención para registrar observaciones.");
    if (["FINALIZADA", "ANULADA"].includes(request.status) || order.orderStatus === "CANCELADO") throw new CajaError("La solicitud está cerrada.");
    if (request.updatedAt.toISOString() !== input.version) throw new CajaError("La solicitud cambió. Actualiza la página.");
    await tx.insert(treasuryObservations).values({ requestId: request.id, category: input.category, content: input.content, actorName: actor.name });
    await tx.update(cajaRequests).set({ draftDocumentId: null, assignmentToken: request.assignedTo ? randomUUID() : null, updatedAt: new Date() }).where(eq(cajaRequests.id, request.id));
    await tx.insert(treasuryActivity).values({ requestId: request.id, actorId: actor.userId, actorName: actor.name, event: "OBSERVACION", detail: `Registró una observación de ${input.category} para Fondo Editorial.` });
  }));
}
export async function resolveObservation(actor: AuthorizedActor, input: z.infer<typeof resolveSchema>) {
  await withDatabase((db) => db.transaction(async (tx) => {
    await assertAuthorized(tx, actor); const { order, request } = await lockRequest(tx, input.id);
    if (order.assignedTo !== actor.userId) throw new CajaError("Solo el gestor responsable del pedido puede resolver observaciones.");
    if (order.orderStatus === "CANCELADO") throw new CajaError("El pedido está anulado.");
    const [observation] = await tx.select().from(treasuryObservations).where(and(eq(treasuryObservations.id, input.observationId), eq(treasuryObservations.requestId, request.id), isNull(treasuryObservations.resolvedAt))).for("update");
    if (!observation) throw new CajaError("La observación ya fue resuelta o no corresponde a la solicitud.");
    await tx.update(treasuryObservations).set({ resolvedAt: new Date(), resolvedBy: actor.name, response: input.response, correction: input.correction ?? null }).where(eq(treasuryObservations.id, observation.id));
    await tx.update(cajaRequests).set({ draftDocumentId: null, assignmentToken: request.assignedTo ? randomUUID() : null, updatedAt: new Date() }).where(eq(cajaRequests.id, request.id));
    await tx.insert(treasuryActivity).values({ requestId: request.id, actorId: actor.userId, actorName: actor.name, event: "SUBSANACION", detail: `Fondo Editorial resolvió la observación de ${observation.category}.` });
  }));
}
