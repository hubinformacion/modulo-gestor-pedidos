import "server-only";
import { sql } from "drizzle-orm";
import { z } from "zod";
import { withReadDatabase } from "@/db";
import { requireCajaAccess } from "@/lib/access";
import type { TreasurySummary } from "./dashboard-types";

export const treasurySummaryFilters = z.object({
  days: z.enum(["30", "90"]).catch("30"),
  imprint: z.enum(["", "universidad", "instituto"]).catch(""),
});
export async function treasurySummary(filters: z.infer<typeof treasurySummaryFilters>) {
  const actor = await requireCajaAccess();
  const scopes = actor.publisherImprints.filter((imprint) => !filters.imprint || imprint === filters.imprint);
  // A single read-only statement, scoped before aggregation. The browser receives
  // aggregate counts only, never customer data, document IDs or other units.
  const permitted = scopes.length ? sql`r.publisher_imprint::text IN (${sql.join(scopes.map((imprint) => sql`${imprint}`), sql`, `)})` : sql`false`;
  const payload = sql<TreasurySummary>`(
    WITH bounds AS (
      SELECT (current_timestamp AT TIME ZONE 'America/Lima')::date AS today,
        (current_timestamp AT TIME ZONE 'America/Lima')::date - (${Number(filters.days)}::integer - 1) AS first_day
    ), scoped AS MATERIALIZED (
      SELECT r.id, r.publisher_imprint, r.status, r.created_at, r.finalized_at, r.assigned_to,
        o.billing_ruc IS NOT NULL AS invoice,
        EXISTS (SELECT 1 FROM treasury_observations t WHERE t.request_id = r.id AND t.resolved_at IS NULL) AS observed
      FROM caja_requests r INNER JOIN orders o ON o.id = r.order_id WHERE ${permitted}
    ), live AS MATERIALIZED (SELECT * FROM scoped WHERE status IN ('PENDIENTE', 'DEVUELTA')),
    issued AS MATERIALIZED (
      SELECT s.* FROM scoped s, bounds b WHERE s.status = 'FINALIZADA'
        AND s.finalized_at >= (b.first_day::timestamp AT TIME ZONE 'America/Lima')
        AND s.finalized_at < ((b.today + 1)::timestamp AT TIME ZONE 'America/Lima')
    ), received AS (
      SELECT (s.created_at AT TIME ZONE 'America/Lima')::date AS day, count(*) AS total
      FROM scoped s, bounds b WHERE s.created_at >= (b.first_day::timestamp AT TIME ZONE 'America/Lima')
        AND s.created_at < ((b.today + 1)::timestamp AT TIME ZONE 'America/Lima') GROUP BY 1
    ), finished AS (
      SELECT (finalized_at AT TIME ZONE 'America/Lima')::date AS day, count(*) AS total FROM issued GROUP BY 1
    )
    SELECT json_build_object(
      'asOf', current_timestamp::text,
      'live', (SELECT json_build_object(
        'unassigned', count(*) FILTER (WHERE assigned_to IS NULL AND NOT observed),
        'attending', count(*) FILTER (WHERE assigned_to IS NOT NULL AND NOT observed),
        'observed', count(*) FILTER (WHERE observed),
        'mine', count(*) FILTER (WHERE assigned_to = ${actor.userId}),
        'returned', count(*) FILTER (WHERE status = 'DEVUELTA')
      ) FROM live),
      'period', (SELECT json_build_object(
        'received', (SELECT coalesce(sum(total), 0) FROM received),
        'finished', count(*), 'invoices', count(*) FILTER (WHERE invoice), 'receipts', count(*) FILTER (WHERE NOT invoice),
        'medianHours', percentile_cont(0.5) WITHIN GROUP (ORDER BY extract(epoch FROM (finalized_at - created_at)) / 3600)
          FILTER (WHERE finalized_at >= created_at),
        'sample', count(*) FILTER (WHERE finalized_at >= created_at)
      ) FROM issued),
      'trend', (SELECT coalesce(json_agg(json_build_object('day', d.day::date::text, 'received', coalesce(r.total, 0), 'finished', coalesce(f.total, 0)) ORDER BY d.day), '[]'::json)
        FROM bounds b CROSS JOIN LATERAL generate_series(b.first_day::timestamp, b.today::timestamp, interval '1 day') d(day)
        LEFT JOIN received r ON r.day = d.day::date LEFT JOIN finished f ON f.day = d.day::date),
      'units', (SELECT coalesce(json_agg(json_build_object('imprint', u.publisher_imprint,
        'open', (SELECT count(*) FROM live l WHERE l.publisher_imprint = u.publisher_imprint),
        'finished', (SELECT count(*) FROM issued i WHERE i.publisher_imprint = u.publisher_imprint)) ORDER BY u.publisher_imprint), '[]'::json)
        FROM (SELECT DISTINCT publisher_imprint FROM scoped) u)
    )
  )`;
  const [result] = await withReadDatabase((db) => db.select({ payload }).from(sql`(SELECT 1) AS treasury_summary`));
  return { data: result.payload, imprints: actor.publisherImprints, service: actor.treasuryService };
}
