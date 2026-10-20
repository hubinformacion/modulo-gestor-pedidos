import "server-only";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
export type MailArt = "received" | "review" | "verified" | "rejected" | "preparing" | "shipped" | "pickup" | "delivered";
export async function readMailArt(state: MailArt) {
  return readFile(join(process.cwd(), "src/assets/email", `${state}.png`));
}

export async function readMailLogo() { return readFile(join(process.cwd(), "src/assets/email/isotipo.png")); }
