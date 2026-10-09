export type DurationMetric = { hours: number | null; sample: number };
export type DashboardData = {
  asOf: string;
  period: { count: number; delivered: number; cancelled: number; requestedCents: number; verifiedCents: number; deliveredCents: number };
  times: { assignment: DurationMetric; dispatch: DurationMetric; delivery: DurationMetric; emission: DurationMetric };
  trend: { day: string; count: number; requestedCents: number; verifiedCents: number }[];
  live: { unassigned: number; waiting: number; review: number; distribution: number; dispatched: number; cashPending: number };
  stock: { units: number; titles: number; exhausted: number; low: number; alerts: { id: string; title: string; imprint: string; stock: number }[] };
  topBooks: { id: string; title: string; quantity: number; cents: number }[];
  managers: { id: string | null; name: string; open: number; delivered: number; count: number }[];
  cash: { completed: number; pending: number };
};
