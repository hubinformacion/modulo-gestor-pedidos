import { withDatabase } from "@/db";
import { createOrderRecord } from "@/modules/orders/data/create";
import { OrderInputError, submissionSchema } from "@/modules/orders/domain/submission";
import { paymentSetupReady } from "@/modules/settings/application/payment-config";
import { createHash } from "node:crypto";
import "server-only";

export async function createOrder(input: unknown, requestHeaders: Pick<Headers, "get">) {
  const parsed = submissionSchema.safeParse(input);
  if (!parsed.success) throw new OrderInputError("Revisa tus datos y acepta la política para continuar.");
  const data = parsed.data;
  const ready = await paymentSetupReady();
  // Hash the user's immutable draft; never hash/trust any client prices.
  const immutableDraft: Record<string, unknown> = { ...data }; delete immutableDraft.expectedQuote;
  if (!data.couponCode) delete immutableDraft.couponCode;
  const draftHash = createHash("sha256").update(JSON.stringify(immutableDraft)).digest("hex");
  return withDatabase((db) => db.transaction((tx) => createOrderRecord(tx, data, ready, draftHash, requestHeaders)));
}
