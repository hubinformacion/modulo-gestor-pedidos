import "server-only";
import { asc, eq } from "drizzle-orm";
import { withDatabase } from "@/db";
import { campuses } from "@/db/schema";
import type { Campus } from "@/lib/orders/types";

export function toPublicCampus(row: typeof campuses.$inferSelect): Campus {
  return {
    id: row.id, name: row.name, libraryAddress: row.libraryAddress, libraryLocation: row.libraryLocation,
    ...(row.latitude !== null && row.longitude !== null ? { coordinates: { latitude: Number(row.latitude), longitude: Number(row.longitude) } } : {}),
    ...(row.googleMapsEmbedUrl ? { googleMapsEmbedUrl: row.googleMapsEmbedUrl } : {}),
  };
}

export async function getActiveCampuses(): Promise<Campus[]> {
  return withDatabase(async (db) => (await db.select().from(campuses).where(eq(campuses.status, "ACTIVO")).orderBy(asc(campuses.name))).map(toPublicCampus));
}
