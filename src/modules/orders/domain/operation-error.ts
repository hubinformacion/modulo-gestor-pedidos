export class OperationError extends Error { }
export function checkVersion(actual: Date, expected: string) {
  if (actual.toISOString() !== expected) throw new OperationError("Los datos cambiaron desde que abriste esta vista. Actualiza la página antes de continuar.");
}
