import "server-only";
import { getPublicOrigin } from "./application";

export type MailProvider = "gmail" | "endpoint";

export function getMailProvider(): MailProvider {
  const value = process.env.MAIL_PROVIDER?.trim() || "gmail";
  if (value !== "gmail" && value !== "endpoint") throw new Error("INVALID_MAIL_PROVIDER");
  return value;
}

export function getMailLogoUrl(): string {
  return new URL("/isotipo-blanco.png", getPublicOrigin()).toString();
}
