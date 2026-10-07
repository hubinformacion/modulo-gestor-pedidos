import { z } from "zod";
import { consentSchema } from "./validation";

export const submissionSchema = z.object({
  requestId: z.uuid(),
  cart: z.array(z.object({ bookId: z.uuid(), quantity: z.number().int().min(1).max(1000) })).min(1).max(100),
  expectedQuote: z.string().max(16000).optional(),
  buyer: z.unknown(), delivery: z.unknown(), consent: consentSchema,
});
export const trackingTokenSchema = z.string().regex(/^[A-Za-z0-9_-]{32}$/);
export const consentVersion = "2026-10-05";
export type OrderCreationResult = { success: true; trackingToken: string } | { success: false; message: string };
export class OrderInputError extends Error {}
