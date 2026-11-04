import "server-only";
import { z } from "zod";

const singleLine = z.string().trim().min(1).max(200).refine((value) => !/[\r\n\0]/.test(value));
const mailEndpointSchema = z.object({
  MAIL_ENDPOINT_URL: z.url().refine((value) => {
    try {
      const url = new URL(value);
      return url.protocol === "https:" && !url.username && !url.password && !url.search && !url.hash;
    } catch { return false; }
  }),
  MAIL_ENDPOINT_TOKEN: z.string().min(1).refine((value) => !/[\r\n\0]/.test(value)),
  MAIL_ENDPOINT_FROM: z.email(),
  MAIL_ENDPOINT_FROM_NAME: singleLine,
  MAIL_ENDPOINT_SYSTEM: singleLine,
  MAIL_ENDPOINT_BUSINESS_UNIT: singleLine,
});

export function getMailEndpointEnvironment() {
  return mailEndpointSchema.safeParse(process.env);
}

export function isMailEndpointConfigured(): boolean {
  return getMailEndpointEnvironment().success;
}
