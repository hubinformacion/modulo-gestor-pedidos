import "server-only";
import { sql } from "drizzle-orm";
import { withReadDatabase } from "@/db";
import { requirePageAccess } from "@/lib/access";
import type { DashboardFilters } from "./validation";
import type { DashboardData } from "./types";
import { dashboardQuery } from "./query";

export async function dashboardManagers() {
  await requirePageAccess();
  const [result] = await withReadDatabase((db) => db.select({ rows: sql<{ id: string; email: string }[]>`(
    SELECT coalesce(json_agg(json_build_object('id', email, 'email', email) ORDER BY email), '[]'::json) FROM (
      SELECT email FROM authorized_emails WHERE role = 'gestor'
      UNION SELECT u.email FROM "user" u INNER JOIN orders o ON o.assigned_to = u.id
    ) managers
  )` }).from(sql`(SELECT 1) AS manager_source`));
  return result.rows;
}

export async function getDashboard(filters: DashboardFilters): Promise<DashboardData> {
  await requirePageAccess();
  const payload = dashboardQuery(filters);
  const [row] = await withReadDatabase((db) => db.select({ payload }).from(sql`(SELECT 1) AS dashboard_source`));
  for (const cents of [row.payload.period.requestedCents, row.payload.period.verifiedCents, row.payload.period.deliveredCents,
    ...row.payload.trend.flatMap((point) => [point.requestedCents, point.verifiedCents]), ...row.payload.topBooks.map((book) => book.cents)]) {
    if (!Number.isSafeInteger(cents) || cents < 0) throw new Error("DASHBOARD_AMOUNT_OUT_OF_RANGE");
  }
  return row.payload;
}
