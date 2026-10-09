import "server-only";
import { sql } from "drizzle-orm";
import type { DashboardFilters } from "./validation";
import type { DashboardData } from "./types";

export function dashboardQuery(filters: DashboardFilters) {
  // One statement gives a consistent snapshot without loading buyer PII, tokens,
  // individual orders or file records into the browser. All amounts are cents.
  return sql<DashboardData>`(
    WITH scoped AS MATERIALIZED (
      SELECT o.*,
        CASE WHEN ${filters.imprint} = 'universidad' THEN o.total_universidad
             WHEN ${filters.imprint} = 'instituto' THEN o.total_instituto ELSE o.total END AS scoped_total,
        CASE WHEN ${filters.imprint} IN ('', 'universidad') AND o.payment_status_universidad = 'VERIFICADO' THEN o.total_universidad ELSE 0 END
        + CASE WHEN ${filters.imprint} IN ('', 'instituto') AND o.payment_status_instituto = 'VERIFICADO' THEN o.total_instituto ELSE 0 END AS verified_total
      FROM orders o WHERE
        (${filters.manager} = '' OR EXISTS (SELECT 1 FROM "user" u WHERE u.id = o.assigned_to AND lower(u.email) = ${filters.manager}))
        AND (${filters.imprint} = '' OR EXISTS (SELECT 1 FROM order_items i WHERE i.order_id = o.id AND i.publisher_imprint::text = ${filters.imprint}))
    ), cohort AS MATERIALIZED (
      SELECT * FROM scoped WHERE created_at >= (${filters.from}::date::timestamp AT TIME ZONE 'America/Lima')
        AND created_at < ((${filters.to}::date + 1)::timestamp AT TIME ZONE 'America/Lima')
    ), live AS (SELECT * FROM scoped WHERE order_status NOT IN ('ENTREGADO', 'CANCELADO')),
    inventory AS MATERIALIZED (
      SELECT * FROM books WHERE status = 'ACTIVO' AND inventory_code NOT LIKE 'DEMO-%'
        AND (${filters.imprint} = '' OR publisher_imprint::text = ${filters.imprint})
    ), first_attention AS (
      SELECT a.order_id, min(a.created_at) AS at FROM order_activity a
        INNER JOIN cohort c ON c.id = a.order_id WHERE a.event_type = 'ASIGNADO' GROUP BY a.order_id
    ), daily AS (
      SELECT (created_at AT TIME ZONE 'America/Lima')::date AS day, count(*) AS count,
        coalesce(sum(scoped_total) FILTER (WHERE order_status <> 'CANCELADO'), 0) * 100 AS requested,
        coalesce(sum(verified_total) FILTER (WHERE order_status <> 'CANCELADO'), 0) * 100 AS verified
      FROM cohort GROUP BY 1
    ), cash_cohort AS (
      SELECT r.* FROM caja_requests r INNER JOIN cohort c ON c.id = r.order_id
        WHERE c.order_status <> 'CANCELADO' AND (${filters.imprint} = '' OR r.publisher_imprint::text = ${filters.imprint})
    )
    SELECT json_build_object(
      'asOf', current_timestamp::text,
      'period', (SELECT json_build_object(
        'count', count(*), 'delivered', count(*) FILTER (WHERE order_status = 'ENTREGADO'),
        'cancelled', count(*) FILTER (WHERE order_status = 'CANCELADO'),
        'requestedCents', coalesce(sum(scoped_total) FILTER (WHERE order_status <> 'CANCELADO'), 0) * 100,
        'verifiedCents', coalesce(sum(verified_total) FILTER (WHERE order_status <> 'CANCELADO'), 0) * 100,
        'deliveredCents', coalesce(sum(scoped_total) FILTER (WHERE order_status = 'ENTREGADO'), 0) * 100) FROM cohort),
      'times', json_build_object(
        'assignment', (SELECT json_build_object('hours', percentile_cont(0.5) WITHIN GROUP (ORDER BY extract(epoch FROM (a.at - c.created_at)) / 3600), 'sample', count(*)) FROM cohort c INNER JOIN first_attention a ON a.order_id = c.id WHERE c.order_status <> 'CANCELADO' AND a.at >= c.created_at),
        'dispatch', (SELECT json_build_object('hours', percentile_cont(0.5) WITHIN GROUP (ORDER BY extract(epoch FROM (dispatched_at - created_at)) / 3600), 'sample', count(*)) FROM cohort WHERE order_status <> 'CANCELADO' AND dispatched_at >= created_at),
        'delivery', (SELECT json_build_object('hours', percentile_cont(0.5) WITHIN GROUP (ORDER BY extract(epoch FROM (delivered_at - created_at)) / 3600), 'sample', count(*)) FROM cohort WHERE order_status = 'ENTREGADO' AND delivered_at >= created_at),
        'emission', (SELECT json_build_object('hours', percentile_cont(0.5) WITHIN GROUP (ORDER BY extract(epoch FROM (finalized_at - created_at)) / 3600), 'sample', count(*)) FROM cash_cohort WHERE status = 'FINALIZADA' AND finalized_at >= created_at)
      ),
      'trend', (SELECT coalesce(json_agg(json_build_object('day', d.day::text, 'count', coalesce(a.count, 0), 'requestedCents', coalesce(a.requested, 0), 'verifiedCents', coalesce(a.verified, 0)) ORDER BY d.day), '[]'::json)
        FROM (SELECT generate_series(${filters.from}::date::timestamp, ${filters.to}::date::timestamp, interval '1 day')::date AS day) d LEFT JOIN daily a USING (day)),
      'live', (SELECT json_build_object(
        'unassigned', count(*) FILTER (WHERE assigned_to IS NULL),
        'waiting', count(*) FILTER (WHERE order_status = 'PENDIENTE_PAGO' AND payment_status_universidad <> 'EN_REVISION' AND payment_status_instituto <> 'EN_REVISION'),
        'review', count(*) FILTER (WHERE order_status = 'PENDIENTE_PAGO' AND (payment_status_universidad = 'EN_REVISION' OR payment_status_instituto = 'EN_REVISION')),
        'distribution', count(*) FILTER (WHERE order_status = 'EN_PREPARACION'), 'dispatched', count(*) FILTER (WHERE order_status = 'DESPACHADO'),
        'cashPending', (SELECT count(*) FROM caja_requests r INNER JOIN scoped l ON l.id = r.order_id WHERE l.order_status <> 'CANCELADO' AND r.status IN ('PENDIENTE', 'DEVUELTA') AND (${filters.imprint} = '' OR r.publisher_imprint::text = ${filters.imprint}))
      ) FROM live),
      'stock', (SELECT json_build_object('units', coalesce(sum(stock), 0), 'titles', count(*), 'exhausted', count(*) FILTER (WHERE stock = 0), 'low', count(*) FILTER (WHERE stock BETWEEN 1 AND 5),
        'alerts', (SELECT coalesce(json_agg(json_build_object('id', id, 'title', title, 'imprint', publisher_imprint, 'stock', stock) ORDER BY stock, title), '[]'::json) FROM (SELECT * FROM inventory WHERE stock <= 5 ORDER BY stock, title, id LIMIT 8) b)) FROM inventory),
      'topBooks', (SELECT coalesce(json_agg(json_build_object('id', b.id, 'title', b.title, 'quantity', b.quantity, 'cents', b.cents) ORDER BY b.quantity DESC, b.title), '[]'::json) FROM (
        SELECT i.book_id AS id, coalesce(max(i.book_title), max(b.title)) AS title, sum(i.quantity) AS quantity, sum(i.subtotal) * 100 AS cents
        FROM order_items i INNER JOIN cohort c ON c.id = i.order_id INNER JOIN books b ON b.id = i.book_id
        WHERE c.order_status <> 'CANCELADO' AND (${filters.imprint} = '' OR i.publisher_imprint::text = ${filters.imprint}) GROUP BY i.book_id ORDER BY quantity DESC, title LIMIT 5) b),
      'managers', (SELECT coalesce(json_agg(json_build_object('id', m.id, 'name', m.name, 'count', m.count, 'delivered', m.delivered, 'open', m.open) ORDER BY m.delivered DESC, m.name), '[]'::json) FROM (
        SELECT c.assigned_to AS id, coalesce(max(c.assigned_name), 'Sin asignar') AS name, count(*) FILTER (WHERE c.created_at >= (${filters.from}::date::timestamp AT TIME ZONE 'America/Lima') AND c.created_at < ((${filters.to}::date + 1)::timestamp AT TIME ZONE 'America/Lima')) AS count, count(*) FILTER (WHERE c.order_status = 'ENTREGADO' AND c.created_at >= (${filters.from}::date::timestamp AT TIME ZONE 'America/Lima') AND c.created_at < ((${filters.to}::date + 1)::timestamp AT TIME ZONE 'America/Lima')) AS delivered,
          (SELECT count(*) FROM live l WHERE l.assigned_to IS NOT DISTINCT FROM c.assigned_to) AS open
        FROM scoped c GROUP BY c.assigned_to) m WHERE m.count > 0 OR m.open > 0),
      'cash', (SELECT json_build_object('completed', count(*) FILTER (WHERE status = 'FINALIZADA'), 'pending', count(*) FILTER (WHERE status IN ('PENDIENTE', 'DEVUELTA'))) FROM cash_cohort)
    )
  )`;
}
