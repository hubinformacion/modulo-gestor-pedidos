import "server-only";
import { applicationUrlSchema } from "./env";
export function getPublicOrigin() {
  const result = applicationUrlSchema.safeParse(process.env.APP_URL);
  if (!result.success) throw new Error("INVALID_APP_URL");
  return result.data;
}
