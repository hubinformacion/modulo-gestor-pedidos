import type { Database } from "@/db";
import { orderAdmissionCounters, orderAdmissionPolicy, orders } from "@/db/schema";
import { admissionPolicySchema } from "@/modules/orders/domain/admission-policy";
import { OrderInputError } from "@/modules/orders/domain/submission";
import { and, eq, sql } from "drizzle-orm";
import { createHmac } from "node:crypto";
import { isIP } from "node:net";
import "server-only";

type Tx = Parameters<Parameters<Database["transaction"]>[0]>[0];
const denied = () => new OrderInputError("No podemos registrar otro pedido en este momento. Conserva tus datos e inténtalo más tarde o contacta con Fondo Editorial.");
export async function admitOrder(tx: Tx, email: string, headers: Pick<Headers, "get">) {
  await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext('order-admission'))`);
  const { rows: [clock] } = await tx.execute<{ at: string }>(sql`SELECT clock_timestamp()::text AS at`);
  const at = new Date(clock.at);
  const [row] = await tx.select().from(orderAdmissionPolicy).where(eq(orderAdmissionPolicy.id, "orders")).for("share");
  if (!row) throw denied(); // Fail closed until installation/seed is complete.
  const policy = admissionPolicySchema.parse({ emailQuarterHour: row.emailQuarterHour, emailDay: row.emailDay, ipQuarterHour: row.ipQuarterHour, globalDay: row.globalDay, pendingEmail: row.pendingEmail });
  const secret = process.env.BETTER_AUTH_SECRET;
  if (!secret || secret.length < 32) throw denied();
  const hash = (value: string) => createHmac("sha256", secret).update(value).digest("hex");
  const rawIp = process.env.VERCEL === "1" ? headers.get("x-vercel-forwarded-for")?.split(",")[0]?.trim() : undefined;
  const ip = rawIp && isIP(rawIp) ? (isIP(rawIp) === 6 ? new URL(`http://[${rawIp}]`).hostname : rawIp) : "shared-unknown";
  const quarter = new Date(Math.floor(at.getTime() / 900_000) * 900_000);
  const day = new Date(Math.floor((at.getTime() - 18_000_000) / 86_400_000) * 86_400_000 + 18_000_000);
  const emailKey = hash(`email:${email.trim().toLowerCase()}`);
  // Fixed ordering and atomic UPSERTs serialize simultaneous requests across instances.
  for (const [key, windowStart, maximum] of [
    ["global:day", day, policy.globalDay],
    [`email:day:${emailKey}`, day, policy.emailDay],
    [`email:quarter:${emailKey}`, quarter, policy.emailQuarterHour],
    [`ip:quarter:${hash(`ip:${ip}`)}`, quarter, policy.ipQuarterHour],
  ] as const) {
    const [accepted] = await tx.insert(orderAdmissionCounters).values({ key, windowStart, count: 1 }).onConflictDoUpdate({
      target: orderAdmissionCounters.key, set: {
        windowStart,
        count: sql`CASE WHEN ${orderAdmissionCounters.windowStart} = ${windowStart} THEN ${orderAdmissionCounters.count} + 1 ELSE 1 END`,
      }, setWhere: sql`${orderAdmissionCounters.windowStart} <> ${windowStart} OR ${orderAdmissionCounters.count} < ${maximum}`
    }).returning({ key: orderAdmissionCounters.key });
    if (!accepted) throw denied();
  }
  const [pending] = await tx.select({ count: sql<number>`count(*)::int` }).from(orders).where(and(eq(orders.customerEmail, email), eq(orders.orderStatus, "PENDIENTE_PAGO")));
  if (pending.count >= policy.pendingEmail) throw denied();
}
