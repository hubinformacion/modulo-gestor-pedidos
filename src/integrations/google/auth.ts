import { googleConfigured } from "@/shared/config/google";
import { OAuth2Client } from "google-auth-library";
import "server-only";
export function ownerAuth() {
  if (!googleConfigured()) throw new Error("GOOGLE_NOT_CONFIGURED");
  const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID, process.env.GOOGLE_CLIENT_SECRET);
  client.setCredentials({ refresh_token: process.env.GOOGLE_REFRESH_TOKEN });
  return client;
}
export class GoogleOperationError extends Error {
  constructor(public readonly stage: string, cause: unknown) { super("GOOGLE_OPERATION_FAILED", { cause }); }
}
export async function retryOnce<T>(operation: () => Promise<T>, stage: string | (() => string) = "google.request"): Promise<T> {
  try { return await operation(); }
  catch {
    try { return await operation(); }
    catch (cause) { throw new GoogleOperationError(typeof stage === "function" ? stage() : stage, cause); }
  }
}
