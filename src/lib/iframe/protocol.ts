import { z } from "zod";

export const iframeInitSchema = z.object({ type: z.literal("fec:iframe:init"), version: z.literal(1) });
export const iframeHeightSchema = z.object({ type: z.literal("fec:iframe:height"), version: z.literal(1), height: z.number().int().min(128).max(100000) });
