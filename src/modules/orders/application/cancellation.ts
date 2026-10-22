import { withDatabase } from "@/db";
import type { AuthorizedActor } from "@/modules/access/domain/policy";
import { cancelPurchaseRecord } from "@/modules/orders/data/cancellation";
import type { CancellationInput } from "@/modules/orders/domain/cancellation";
import "server-only";

export { CancellationError } from "@/modules/orders/domain/cancellation";
export async function cancelPurchase(input: CancellationInput, actor?: AuthorizedActor) {
  return withDatabase((db) => db.transaction((tx) => cancelPurchaseRecord(tx, input, actor)));
}
