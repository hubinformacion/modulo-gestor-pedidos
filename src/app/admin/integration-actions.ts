"use server";
import { z } from "zod";
import { headers } from "next/headers";
import { withDatabase } from "@/db";
import { getAuthorizedSession } from "@/modules/access/application/session";
import { checkGoogleConnection } from "@/integrations/google/health";
import { reportServerError } from "@/shared/logging/server-diagnostics";
export async function checkGoogleIntegrationAction(input: unknown) {
  if (!z.strictObject({}).safeParse(input).success) return { success: false as const, message: "Solicitud de comprobación inválida." };
  try {
    const requestHeaders = await headers();
    await withDatabase((db) => getAuthorizedSession(db, requestHeaders));
    return { success: true as const, message: "Comprobación completada.", checks: await checkGoogleConnection() };
  } catch (error) {
    reportServerError("integration.manual.check", error);
    return { success: false as const, message: "No se pudo comprobar la conexión. Revisa tu sesión y las credenciales del entorno." };
  }
}
