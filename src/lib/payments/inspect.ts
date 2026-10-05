import "server-only";
import { createHash } from "node:crypto";
import { receiptFileSchema } from "./validation";

export async function validateReceipt(file: File) {
  const parsed = receiptFileSchema.safeParse(file);
  if (!parsed.success) throw new Error(parsed.error.issues[0].message);
  const bytes = Buffer.from(await file.arrayBuffer());
  const signatures = {
    "application/pdf": bytes.subarray(0, 5).equals(Buffer.from("%PDF-")),
    "image/jpeg": bytes.subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff])),
    "image/png": bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])),
  };
  if (!signatures[file.type as keyof typeof signatures]) throw new Error("El contenido del archivo no coincide con su tipo.");
  const filename = file.name.replace(/[\x00-\x1f\x7f/\\]/g, "_").trim().slice(0, 180) || "comprobante";
  return { bytes, filename, hash: createHash("sha256").update(bytes).digest("hex") };
}
