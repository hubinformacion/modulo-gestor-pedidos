export class CancellationError extends Error { }
export type CancellationInput = { token?: string; id?: string; version: string; reason: string };
