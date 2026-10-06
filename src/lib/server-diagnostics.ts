// Error objects from Google/Drizzle can contain OAuth headers, SQL parameters,
// filenames or MIME mail bodies. Log only short machine codes, never the object.
function record(value: unknown): Record<string, unknown> | undefined {
  return value !== null && typeof value === "object" ? value as Record<string, unknown> : undefined;
}
function machineCode(value: unknown): string | undefined {
  const code = typeof value === "number" ? String(value) : value;
  return typeof code === "string" && /^[a-zA-Z0-9_.-]{1,80}$/.test(code) ? code : undefined;
}
export function safeErrorDetails(error: unknown) {
  const details: { stage?: string; code?: string; status?: number; reason?: string } = {};
  let current = record(error);
  for (let depth = 0; current && depth < 6; depth++) {
    details.stage ??= machineCode(current.stage);
    details.code ??= machineCode(current.code);
    const response = record(current.response);
    const status = response?.status ?? current.status ?? current.code;
    if (typeof status === "number" && Number.isInteger(status) && status >= 100 && status <= 599) details.status ??= status;
    const apiError = record(record(response?.data)?.error);
    if (Array.isArray(apiError?.errors)) {
      for (const item of apiError.errors) details.reason ??= machineCode(record(item)?.reason);
    }
    current = record(current.cause ?? current.sourceError);
  }
  return details;
}
export function reportServerError(operation: string, error: unknown) {
  console.error(`[${operation}]`, safeErrorDetails(error));
}
