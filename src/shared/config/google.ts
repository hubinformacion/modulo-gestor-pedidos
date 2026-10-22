import "server-only";
import { z } from "zod";
export function googleConfigured() {
  return ["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET", "GOOGLE_REFRESH_TOKEN", "GOOGLE_DRIVE_FOLDER_ID", "GOOGLE_OWNER_EMAIL"].every((key) => Boolean(process.env[key]?.trim())) && z.email().safeParse(process.env.GOOGLE_OWNER_EMAIL).success;
}
