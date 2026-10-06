import { z } from "zod";

const coordinate = (min: number, max: number) => z.string().trim().max(20).refine((value) => value === "" ||
  (/^-?[0-9]+(?:\.[0-9]{1,7})?$/.test(value) && Number(value) >= min && Number(value) <= max), `Usa un número entre ${min} y ${max}, con hasta 7 decimales.`);

export const campusSchema = z.object({
  name: z.string().trim().min(2, "Ingresa el nombre del campus.").max(120),
  libraryAddress: z.string().trim().min(5, "Ingresa la dirección de la biblioteca.").max(300),
  libraryLocation: z.string().trim().max(200, "Máximo 200 caracteres para la ubicación.").default(""),
  latitude: coordinate(-90, 90),
  longitude: coordinate(-180, 180),
  googleMapsEmbedUrl: z.string().trim().max(4000).refine((value) => {
    if (!value) return true;
    try {
      const url = new URL(value);
      return url.protocol === "https:" && !url.username && !url.password && !url.port &&
        ["www.google.com", "maps.google.com"].includes(url.hostname) &&
        ((url.pathname === "/maps/embed" && url.search.length > 1) || url.pathname.startsWith("/maps/embed/"));
    } catch { return false; }
  }, "Pega la URL src del mapa embebido de Google, no el HTML ni el enlace de compartir."),
  status: z.enum(["ACTIVO", "INACTIVO"]),
}).superRefine((campus, ctx) => {
  if (Boolean(campus.latitude) !== Boolean(campus.longitude)) {
    ctx.addIssue({ code: "custom", path: [campus.latitude ? "longitude" : "latitude"], message: "Completa ambas coordenadas o deja ambas vacías." });
  }
});

export const campusIdSchema = z.string().trim().min(1).max(120);
export const campusUpdateSchema = campusSchema.safeExtend({ id: campusIdSchema });
export type CampusForm = z.infer<typeof campusSchema>;
export type CampusAdminRow = CampusForm & { id: string };
export type CampusActionResult = { success: boolean; message: string; fieldErrors?: Record<string, string> };

export const emptyCampus: CampusForm = { name: "", libraryAddress: "", libraryLocation: "", latitude: "", longitude: "", googleMapsEmbedUrl: "", status: "ACTIVO" };
