import "server-only";
import { z } from "zod";
export function getPublicOrigin() {
  const origin = new URL(z.url().parse(process.env.APP_URL));
  if (origin.protocol !== "https:" && !(process.env.NODE_ENV !== "production" && origin.hostname === "localhost" && origin.protocol === "http:")) throw new Error("INVALID_APP_URL");
  return origin.origin;
}
