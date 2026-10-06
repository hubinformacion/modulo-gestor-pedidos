import { safeErrorDetails } from "@/lib/server-diagnostics";

function records(error: unknown) {
  const values: Record<string, unknown>[] = [];
  let current = error;
  for (let depth = 0; current && typeof current === "object" && depth < 6; depth++) {
    const value = current as Record<string, unknown>;
    values.push(value); current = value.cause ?? value.sourceError;
  }
  return values;
}
function socketEvent(error: unknown) {
  return records(error).some((value) => value.type === "error" && value.constructor?.name === "ErrorEvent");
}
export function isDatabaseFailure(error: unknown) {
  return socketEvent(error) || records(error).some((value) => (typeof value.query === "string" && Array.isArray(value.params)) || value.name === "NeonDbError" || (typeof value.code === "string" && /^[0-9A-Z]{5}$/.test(value.code)));
}
export function transientDatabaseFailure(error: unknown) {
  const { code, status } = safeErrorDetails(error);
  return socketEvent(error) || Boolean(code && (/^08/.test(code) || ["ECONNRESET", "ECONNREFUSED", "ETIMEDOUT", "EAI_AGAIN", "53300", "57P01", "57P02", "57P03"].includes(code))) || Boolean(status && [429, 500, 502, 503, 504].includes(status)) || records(error).some((value) => ["AbortError", "TimeoutError", "TypeError"].includes(String(value.name)));
}
export class DatabaseOperationError extends Error {
  readonly code?: string;
  readonly stage: string;
  readonly status?: number;
  constructor(error: unknown, stage: string) {
    super("No pudimos completar la consulta a la base de datos. Intenta nuevamente.");
    this.name = "DatabaseOperationError";
    const details = safeErrorDetails(error);
    this.code = details.code ?? (socketEvent(error) ? "DB_WEBSOCKET_ERROR" : undefined);
    this.status = details.status;
    this.stage = stage;
    // Deliberately no raw cause: React serializes Error.cause, while ErrorEvent,
    // driver classes and request/SQL objects are not serializable or safe props.
  }
}
