import { z } from "zod";

const databaseSchema = z.object({
  DATABASE_URL: z.url().refine((value) => /^postgres(ql)?:\/\//.test(value)),
});

export const applicationUrlSchema = z.url().refine((value) => {
  try {
    const url = new URL(value);
    const local = process.env.NODE_ENV !== "production" && ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
    return (url.protocol === "https:" || (url.protocol === "http:" && local)) &&
      !url.username && !url.password && url.pathname === "/" && !url.search && !url.hash;
  } catch {
    return false;
  }
}).transform((value) => new URL(value).origin);

const authSchema = databaseSchema.extend({
  BETTER_AUTH_SECRET: z.string().min(32),
  APP_URL: applicationUrlSchema,
  GOOGLE_CLIENT_ID: z.string().min(1),
  GOOGLE_CLIENT_SECRET: z.string().min(1),
});

export type AuthEnvironment = z.infer<typeof authSchema>;

export class ConfigurationError extends Error {
  constructor() {
    super("La configuración del servicio está incompleta.");
    this.name = "ConfigurationError";
  }
}

export function getDatabaseUrl(): string {
  const result = databaseSchema.safeParse(process.env);
  if (!result.success) throw new ConfigurationError();
  return result.data.DATABASE_URL;
}

export function getAuthEnvironment(): AuthEnvironment {
  const result = authSchema.safeParse(process.env);
  if (!result.success) throw new ConfigurationError();
  return result.data;
}

export function isAuthConfigured(): boolean {
  return authSchema.safeParse(process.env).success;
}
