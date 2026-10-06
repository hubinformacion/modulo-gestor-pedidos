import { z } from "zod";

export const MASTER_EMAIL = "distribucionfe@continental.edu.pe";

export const authorizedEmailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .max(254, "El correo es demasiado largo.")
  .pipe(z.email("Ingresa un correo válido."));

export function isMasterEmail(email: string): boolean {
  return email.trim().toLowerCase() === MASTER_EMAIL;
}

export type AccessErrorCode = "UNAUTHENTICATED" | "FORBIDDEN" | "UNAVAILABLE";

export class AccessError extends Error {
  constructor(public readonly code: AccessErrorCode) {
    super(code === "UNAUTHENTICATED"
      ? "Inicia sesión para continuar."
      : code === "FORBIDDEN"
        ? "Tu cuenta no tiene permiso para realizar esta operación."
        : "El servicio no está disponible. Intenta nuevamente.");
    this.name = "AccessError";
  }
}

export type AuthorizedActor = {
  userId: string;
  sessionId: string;
  email: string;
  name: string;
  role: "gestor" | "caja";
  publisherImprint: "universidad" | "instituto" | null;
};

export type AccessActionResult = {
  success: boolean;
  message: string;
};
