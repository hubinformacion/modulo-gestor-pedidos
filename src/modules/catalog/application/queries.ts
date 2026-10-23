import { withDatabase } from "@/db";
import { getAuthorizedSession } from "@/modules/access/application/session";
import { inventoryRowsRecord } from "@/modules/catalog/data/inventory";
import { headers } from "next/headers";
import "server-only";

export async function inventoryRows() {
  const requestHeaders = await headers();
  await withDatabase((db) => getAuthorizedSession(db, requestHeaders));
  return inventoryRowsRecord();
}
