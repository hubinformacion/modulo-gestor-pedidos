import { z } from "zod";
const day = z.iso.date();
export function dashboardFiltersSchema(today: string) {
  return z.object({
    from: day.default(`${today.slice(0, 7)}-01`), to: day.default(today),
    imprint: z.enum(["", "universidad", "instituto"]).default(""),
    manager: z.union([z.literal(""), z.email().max(254)]).default(""),
  }).refine((value) => value.from <= value.to && (Date.parse(value.to) - Date.parse(value.from)) / 86400000 <= 365, "Selecciona un período de hasta 366 días con inicio anterior al fin.");
}
export type DashboardFilters = { from: string; to: string; imprint: "" | "universidad" | "instituto"; manager: string };
export const peruToday = () => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Lima", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
