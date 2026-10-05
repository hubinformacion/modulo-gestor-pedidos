import type { Campus } from "./types";

export function campusMapUrls(campus: Campus) {
  const coordinates = campus.coordinates;
  const validCoordinates = coordinates && Number.isFinite(coordinates.latitude) && Number.isFinite(coordinates.longitude) &&
    Math.abs(coordinates.latitude) <= 90 && Math.abs(coordinates.longitude) <= 180;
  const query = validCoordinates ? `${coordinates.latitude},${coordinates.longitude}` : `${campus.libraryAddress}, Perú`;
  const search = new URL("https://www.google.com/maps/search/");
  search.searchParams.set("api", "1");
  search.searchParams.set("query", query);
  const embed = new URL("https://maps.google.com/maps");
  embed.searchParams.set("q", query);
  embed.searchParams.set("hl", "es");
  embed.searchParams.set("z", "16");
  embed.searchParams.set("output", "embed");
  let embedUrl = embed.toString();
  let hasCustomEmbed = false;
  if (campus.googleMapsEmbedUrl) {
    try {
      const custom = new URL(campus.googleMapsEmbedUrl);
      if (custom.protocol === "https:" && ["www.google.com", "maps.google.com"].includes(custom.hostname) && (custom.pathname === "/maps/embed" || custom.pathname.startsWith("/maps/embed/"))) {
        embedUrl = custom.toString();
        hasCustomEmbed = true;
      }
    } catch { /* Use address search if the configured URL is invalid. */ }
  }
  return { embedUrl, searchUrl: search.toString(), approximate: !validCoordinates && !hasCustomEmbed };
}
