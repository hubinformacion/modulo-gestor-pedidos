import { withDatabase } from "@/db";
import { getAuthorizedSession } from "@/modules/access/application/session";
import { listOrdersRecord, orderDetailRecord } from "@/modules/orders/data/admin";
import { filterSchema } from "@/modules/orders/domain/management";
import { headers } from "next/headers";
import "server-only";
import type { z } from "zod";

export async function listOrders(filters: z.infer<typeof filterSchema>) {
  const requestHeaders = await headers();
  const actor = await withDatabase((db) => getAuthorizedSession(db, requestHeaders));
  return listOrdersRecord(filters, actor);
}
export async function orderDetail(id: string) {
  const requestHeaders = await headers();
  await withDatabase((db) => getAuthorizedSession(db, requestHeaders));
  return orderDetailRecord(id);
}
