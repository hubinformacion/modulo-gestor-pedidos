export type TreasurySummary = {
  asOf: string;
  live: { unassigned: number; attending: number; observed: number; mine: number; returned: number };
  period: { received: number; finished: number; invoices: number; receipts: number; medianHours: number | null; sample: number };
  trend: { day: string; received: number; finished: number }[];
  units: { imprint: "universidad" | "instituto"; open: number; finished: number }[];
};
