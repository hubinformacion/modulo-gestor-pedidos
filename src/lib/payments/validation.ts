import { z } from "zod";
import { trackingTokenSchema } from "@/lib/orders/submission";

export const maxReceiptBytes = 3 * 1024 * 1024;
export const receiptMetadataSchema = z.object({ token: trackingTokenSchema, uploadId: z.uuid(), imprint: z.enum(["universidad", "instituto"]) });
export const receiptFileSchema = z.instanceof(File).refine((file) => file.size > 0 && file.size <= maxReceiptBytes, "Cada archivo debe pesar hasta 3 MB.").refine((file) => ["application/pdf", "image/jpeg", "image/png"].includes(file.type), "Usa PDF, JPG o PNG.");

export const confirmReceiptSchema = z.object({ token: trackingTokenSchema, imprint: z.enum(["universidad", "instituto"]) });
