import type { Database } from "@/db";
import * as schema from "@/db/schema";
import { getAuthEnvironment, type AuthEnvironment } from "@/shared/config/env";
import { reportServerError } from "@/shared/logging/server-diagnostics";
import { authorizedEmailSchema } from "@/modules/access/domain/policy";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { APIError } from "better-auth/api";
import { eq } from "drizzle-orm";
import { AsyncLocalStorage } from "node:async_hooks";
import "server-only";

export function createAuth(db: Database, env: AuthEnvironment = getAuthEnvironment(), onFailure?: (error: unknown) => void) {
  type Transaction = Parameters<Parameters<Database["transaction"]>[0]>[0];
  const transactionScope = new AsyncLocalStorage<Transaction>();
  // Better Auth binds its adapter to the transaction, but application hooks
  // also need that connection (including reads of newly created users).
  const adapterFactory: ReturnType<typeof drizzleAdapter> = (options) => ({
    ...drizzleAdapter(db, { provider: "pg", schema, transaction: true })(options),
    transaction: (callback) => db.transaction((tx) => transactionScope.run(tx, () =>
      callback(drizzleAdapter(tx, { provider: "pg", schema, transaction: false })(options)),
    )),
  });

  async function assertAllowed(email: string, verified: boolean) {
    const parsed = authorizedEmailSchema.safeParse(email);
    if (!verified || !parsed.success) {
      throw new APIError("FORBIDDEN", { code: "access_denied", message: "ACCESS_DENIED" });
    }
    const [allowed] = await (transactionScope.getStore() ?? db).select({ email: schema.authorizedEmails.email })
      .from(schema.authorizedEmails)
      .where(eq(schema.authorizedEmails.email, parsed.data)).limit(1);
    if (!allowed) throw new APIError("FORBIDDEN", { code: "access_denied", message: "ACCESS_DENIED" });
    return parsed.data;
  }

  return betterAuth({
    appName: "Gestor de pedidos",
    baseURL: env.BETTER_AUTH_URL,
    secret: env.BETTER_AUTH_SECRET,
    trustedOrigins: [new URL(env.BETTER_AUTH_URL).origin],
    onAPIError: { errorURL: new URL("/login", env.BETTER_AUTH_URL).toString() },
    database: adapterFactory,
    emailAndPassword: { enabled: false },
    user: {
      // Validate the incoming Google identity on returning sign-ins as well:
      // a changed provider email must not inherit a formerly authorized address.
      validateUserInfo: async ({ user: providerUser, source }) => {
        if (source.method !== "oauth" || source.oauth?.providerId !== "google") {
          return { error: "ACCESS_DENIED" };
        }
        try {
          const email = await assertAllowed(providerUser.email ?? "", providerUser.emailVerified ?? false);
          if (source.action === "sign-in") {
            // Returning OAuth validation receives the selected local user ID
            // alongside the fresh provider email. Never carry an old address's
            // authority across a provider rename, even if both are allowed.
            if (typeof providerUser.id !== "string" || !providerUser.id) return { error: "access_denied" };
            const [owner] = await (transactionScope.getStore() ?? db).select({ email: schema.user.email })
              .from(schema.user).where(eq(schema.user.id, providerUser.id)).limit(1);
            const storedEmail = authorizedEmailSchema.safeParse(owner?.email);
            if (!storedEmail.success || storedEmail.data !== email) return { error: "access_denied" };
          }
        } catch (error) {
          if (error instanceof APIError && error.status === "FORBIDDEN") return { error: "access_denied" };
          throw error;
        }
      },
    },
    socialProviders: {
      google: {
        clientId: env.GOOGLE_CLIENT_ID,
        clientSecret: env.GOOGLE_CLIENT_SECRET,
        requireEmailVerification: true,
        // Only the identity scopes are requested. Drive/Gmail use the owner's
        // separate refresh token, never an administrator's tokens.
        scope: ["openid", "email", "profile"],
      },
    },
    account: { accountLinking: { enabled: false } },
    session: {
      expiresIn: 60 * 60 * 24 * 7,
      updateAge: 60 * 60 * 24,
      cookieCache: { enabled: false },
    },
    advanced: { cookiePrefix: "fec" },
    databaseHooks: {
      user: {
        create: {
          before: async (newUser) => {
            const email = await assertAllowed(newUser.email, newUser.emailVerified);
            return { data: { ...newUser, email } };
          },
        },
      },
      session: {
        create: {
          before: async (newSession) => {
            const [owner] = await (transactionScope.getStore() ?? db).select().from(schema.user)
              .where(eq(schema.user.id, newSession.userId)).limit(1);
            if (!owner) throw new APIError("FORBIDDEN", { code: "access_denied", message: "ACCESS_DENIED" });
            await assertAllowed(owner.email, owner.emailVerified);
            return { data: newSession };
          },
        },
      },
    },
    logger: {
      level: "error",
      log: (level, _message, ...args) => {
        if (level !== "error") return;
        const failure = args.find((value) => value instanceof Error || (value && typeof value === "object" && ("cause" in value || "query" in value || "type" in value)));
        if (failure) {
          if (onFailure) onFailure(failure);
          else reportServerError("auth.provider.failed", { stage: "auth.provider", cause: failure });
        }
      },
    },
  });
}
