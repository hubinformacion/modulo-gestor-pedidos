import { ownerAuth } from "@/integrations/google/auth";
import { reportServerError, safeErrorDetails } from "@/shared/logging/server-diagnostics";
import { drive } from "googleapis/build/src/apis/drive/index.js";
import { gmail } from "googleapis/build/src/apis/gmail/index.js";
import "server-only";

export type IntegrationCheck = { label: string; ready: boolean; detail: string };
function problem(error: unknown) {
  const details = safeErrorDetails(error);
  if (details.reason === "invalid_grant") return "Google rechazó el refresh token. Vuelve a autorizar la cuenta y actualiza la variable en Vercel.";
  if (details.reason === "invalid_client") return "Revisa el cliente OAuth y su secreto en las variables del entorno.";
  if (details.status === 403) return "Revisa los permisos OAuth, las API habilitadas y las políticas de Google Workspace.";
  if (details.status === 404) return "No se encontró la carpeta o la cuenta no tiene acceso.";
  return "No se pudo comprobar la conexión. Revisa la configuración o reintenta más tarde.";
}
// Manual diagnostic only: no messages, files, ACL changes or scheduled checks.
export async function checkGoogleConnection(): Promise<IntegrationCheck[]> {
  const auth = ownerAuth();
  auth.transporter.defaults.timeout = 10_000;
  auth.transporter.defaults.retry = false;
  try { await auth.getAccessToken(); }
  catch (error) { reportServerError("integration.google.oauth", error); return [{ label: "Autorización Google", ready: false, detail: problem(error) }]; }
  const checks: Promise<IntegrationCheck>[] = [
    (async () => {
      try {
        const { data } = await drive({ version: "v3", auth }).files.get({ fileId: process.env.GOOGLE_DRIVE_FOLDER_ID!, fields: "mimeType,trashed", supportsAllDrives: true }, { timeout: 10_000, retry: false });
        const ready = data.mimeType === "application/vnd.google-apps.folder" && !data.trashed;
        return { label: "Carpeta de Google Drive", ready, detail: ready ? "La cuenta puede consultar la carpeta configurada. No se cargaron archivos ni se cambiaron permisos." : "El identificador no corresponde a una carpeta disponible." };
      } catch (error) { reportServerError("integration.google.drive", error); return { label: "Carpeta de Google Drive", ready: false, detail: problem(error) }; }
    })(),
    (async () => {
      try {
        const { data } = await gmail({ version: "v1", auth }).users.getProfile({ userId: "me", fields: "emailAddress" }, { timeout: 10_000, retry: false });
        const ready = data.emailAddress?.toLowerCase() === process.env.GOOGLE_OWNER_EMAIL?.trim().toLowerCase();
        return { label: "Cuenta de Gmail", ready, detail: ready ? "El buzón autenticado corresponde al remitente configurado. No se envió ningún correo." : "El token pertenece a un buzón distinto del remitente configurado." };
      } catch (error) { reportServerError("integration.google.gmail", error); return { label: "Cuenta de Gmail", ready: false, detail: problem(error) }; }
    })(),
    (async () => {
      try {
        const info = await auth.getTokenInfo(auth.credentials.access_token!);
        const scopes = new Set(info.scopes);
        const fullMail = scopes.has("https://mail.google.com/");
        const read = fullMail || ["gmail.metadata", "gmail.readonly", "gmail.modify"].some((scope) => scopes.has(`https://www.googleapis.com/auth/${scope}`));
        const send = fullMail || ["gmail.send", "gmail.compose", "gmail.modify"].some((scope) => scopes.has(`https://www.googleapis.com/auth/${scope}`));
        const ready = scopes.has("https://www.googleapis.com/auth/drive") && read && send;
        return { label: "Permisos OAuth", ready, detail: ready ? "El token incluye permisos para Drive, envío y metadatos de Gmail; esto no acredita un envío real." : "Faltan permisos de Drive, envío o metadatos de Gmail. Vuelve a autorizar con los scopes requeridos." };
      } catch (error) { reportServerError("integration.google.scopes", error); return { label: "Permisos OAuth", ready: false, detail: problem(error) }; }
    })(),
  ];
  return [{ label: "Autorización Google", ready: true, detail: "Google aceptó el refresh token." }, ...await Promise.all(checks)];
}
