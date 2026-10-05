import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { and, eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { Database } from "@/db";
import * as schema from "@/db/schema";
import { seedMaster } from "@/db/seed-master";
import { createAuth } from "@/lib/auth";
import { getAuthorizedSession } from "@/lib/access";
import { addAuthorizedEmail, removeAuthorizedEmail } from "@/lib/authorized-emails";
import { MASTER_EMAIL, type AuthorizedActor } from "@/lib/access-policy";
import type { AuthEnvironment } from "@/lib/env";
import { addEmailAction, removeEmailAction } from "@/app/admin/correos/actions";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { withDatabase } from "@/db";

vi.mock("next/headers", () => ({ headers: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/db", () => ({ withDatabase: vi.fn() }));

const env: AuthEnvironment = {
  DATABASE_URL: "postgresql://test:test@localhost/test",
  BETTER_AUTH_URL: "http://localhost:3000",
  BETTER_AUTH_SECRET: "test-only-secret-at-least-thirty-two-characters",
  GOOGLE_CLIENT_ID: "test-client.apps.googleusercontent.com",
  GOOGLE_CLIENT_SECRET: "test-client-secret",
};

let pg: PGlite;
let db: Database;
let master: AuthorizedActor;
let masterHeaders: Headers;

async function oauthAttempt(email: string, verified = true, subject = `google-${email.toLowerCase()}`) {
  const auth = createAuth(db, env);
  const context = await auth.$context;
  const provider = context.socialProviders.find((item) => item.id === "google");
  if (!provider) throw new Error("Google provider missing");
  // Only Google's external code exchange and identity response are simulated.
  // State/PKCE, callback, transactions, hooks and signed cookies are real.
  vi.spyOn(provider, "validateAuthorizationCode").mockResolvedValue({ accessToken: "test-google-access-token", scopes: ["openid", "email", "profile"] });
  vi.spyOn(provider, "getUserInfo").mockResolvedValue({
    user: { email, emailVerified: verified, name: "Equipo Editorial" },
    data: { sub: subject, email, email_verified: verified, name: "Equipo Editorial" },
  });
  const start = await auth.handler(new Request(`${env.BETTER_AUTH_URL}/api/auth/sign-in/social`, {
    method: "POST", headers: { "Content-Type": "application/json", Origin: env.BETTER_AUTH_URL },
    body: JSON.stringify({ provider: "google", callbackURL: `${env.BETTER_AUTH_URL}/admin`, errorCallbackURL: `${env.BETTER_AUTH_URL}/login` }),
  }));
  const { url } = await start.json() as { url: string };
  if (!url) throw new Error(`OAuth initiation failed: ${start.status}`);
  const state = new URL(url).searchParams.get("state");
  const callback = new URL(`${env.BETTER_AUTH_URL}/api/auth/callback/google`);
  callback.searchParams.set("state", state ?? "");
  callback.searchParams.set("code", "test-authorization-code");
  const cookies = start.headers.getSetCookie().map((value) => value.split(";")[0]).join("; ");
  const response = await auth.handler(new Request(callback, { headers: { Cookie: cookies } }));
  const requestHeaders = new Headers({ cookie: response.headers.getSetCookie().map((value) => value.split(";")[0]).join("; ") });
  return { response, requestHeaders };
}

async function login(email: string) {
  const { response, requestHeaders } = await oauthAttempt(email);
  if (response.headers.get("location") !== `${env.BETTER_AUTH_URL}/admin`) {
    throw new Error(`OAuth test failed: ${response.status} ${response.headers.get("location")}`);
  }
  return { actor: await getAuthorizedSession(db, requestHeaders), requestHeaders };
}

beforeAll(async () => {
  for (const [key, value] of Object.entries(env)) vi.stubEnv(key, value);
  pg = new PGlite();
  // Apply the actual generated migration, including constraints and FKs.
  const journal = JSON.parse(readFileSync(new URL("../drizzle/meta/_journal.json", import.meta.url), "utf8")) as { entries: { tag: string }[] };
  for (const entry of journal.entries) {
    await pg.exec(readFileSync(new URL(`../drizzle/${entry.tag}.sql`, import.meta.url), "utf8"));
  }
  // Both drivers use Drizzle's PostgreSQL query API. Only the test transport
  // differs; production always uses Neon, never PGlite.
  db = drizzle({ client: pg, schema }) as unknown as Database;
  vi.mocked(withDatabase).mockImplementation(<T>(work: (database: Database) => Promise<T>) => work(db));
});

beforeEach(async () => {
  await pg.exec('TRUNCATE "session", "account", "verification", "user", "authorized_emails" CASCADE');
  await seedMaster(db);
  const loggedIn = await login(MASTER_EMAIL);
  master = loggedIn.actor;
  masterHeaders = loggedIn.requestHeaders;
  vi.mocked(headers).mockResolvedValue(masterHeaders);
  vi.mocked(revalidatePath).mockClear();
});

afterAll(async () => {
  await pg?.close();
  vi.unstubAllEnvs();
});

describe("schema, seed and Google identity gates", () => {
  it("seeds the master idempotently without duplicating or overwriting metadata", async () => {
    const before = await db.select().from(schema.authorizedEmails);
    await seedMaster(db);
    await seedMaster(db);
    expect(await db.select().from(schema.authorizedEmails)).toEqual(before);
    expect(before).toHaveLength(1);
    expect(before[0].addedBy).toBe(MASTER_EMAIL);
  });

  it("rejects an unauthorized identity before writing a user or session", async () => {
    const { response } = await oauthAttempt("outsider@gmail.com");
    expect(response.headers.get("location")).toContain("/login?error=");
    expect(await db.select().from(schema.user).where(eq(schema.user.email, "outsider@gmail.com"))).toHaveLength(0);
    expect(await db.select().from(schema.session)).toHaveLength(1);
  });

  it("rejects an unverified identity even when its email is authorized", async () => {
    await addAuthorizedEmail(db, master, "unverified@gmail.com");
    const { response } = await oauthAttempt("unverified@gmail.com", false);
    expect(response.headers.get("location")).toContain("/login?error=");
    expect(await db.select().from(schema.user).where(eq(schema.user.email, "unverified@gmail.com"))).toHaveLength(0);
  });

  it("allows the first login of a preauthorized email and stores it normalized", async () => {
    expect((await addAuthorizedEmail(db, master, "  EQUIPO@GMAIL.COM  ")).success).toBe(true);
    const { requestHeaders } = await oauthAttempt("EQUIPO@GMAIL.COM");
    expect((await getAuthorizedSession(db, requestHeaders)).email).toBe("equipo@gmail.com");
    expect((await login("equipo@gmail.com")).actor.email).toBe("equipo@gmail.com");
  });

  it("enforces normalized email and uniqueness constraints in PostgreSQL", async () => {
    await expect(db.insert(schema.authorizedEmails).values({ email: "UPPER@gmail.com", addedBy: MASTER_EMAIL })).rejects.toThrow();
    await expect(db.insert(schema.authorizedEmails).values({ email: MASTER_EMAIL, addedBy: MASTER_EMAIL })).rejects.toThrow();
  });

  it("rejects a returning Google identity whose provider email changed to an unauthorized address", async () => {
    await addAuthorizedEmail(db, master, "team@gmail.com");
    await login("team@gmail.com");
    const { response } = await oauthAttempt("outsider@gmail.com", true, "google-team@gmail.com");
    expect(response.headers.get("location")).toContain("/login?error=access_denied");
    const [owner] = await db.select().from(schema.user).where(eq(schema.user.email, "team@gmail.com"));
    expect(await db.select().from(schema.session).where(eq(schema.session.userId, owner.id))).toHaveLength(1);
    expect(await db.select().from(schema.user).where(eq(schema.user.email, "outsider@gmail.com"))).toHaveLength(0);
  });
});

describe("session and authorization checks", () => {
  it("rejects missing and forged session cookies", async () => {
    await expect(getAuthorizedSession(db, new Headers())).rejects.toMatchObject({ code: "UNAUTHENTICATED" });
    await expect(getAuthorizedSession(db, new Headers({ cookie: "fec.session_token=forged.signature" }))).rejects.toMatchObject({ code: "UNAUTHENTICATED" });
  });

  it("rejects expired sessions", async () => {
    await db.update(schema.session).set({ expiresAt: new Date(Date.now() - 60_000) }).where(eq(schema.session.id, master.sessionId));
    await expect(getAuthorizedSession(db, masterHeaders)).rejects.toMatchObject({ code: "UNAUTHENTICATED" });
  });

  it("rechecks the table even if the signed session still exists", async () => {
    await addAuthorizedEmail(db, master, "team@gmail.com");
    const member = await login("team@gmail.com");
    await db.delete(schema.authorizedEmails).where(eq(schema.authorizedEmails.email, member.actor.email));
    await expect(getAuthorizedSession(db, member.requestHeaders)).rejects.toMatchObject({ code: "FORBIDDEN" });
    const context = await createAuth(db, env).$context;
    await expect(context.internalAdapter.createSession(member.actor.userId)).rejects.toMatchObject({ status: "FORBIDDEN" });
  });

  it("denies access on database failure", async () => {
    const brokenDb = { select: () => { throw new Error("database offline"); } } as unknown as Database;
    await expect(getAuthorizedSession(brokenDb, masterHeaders)).rejects.toMatchObject({ code: "UNAVAILABLE" });
  });
});

describe("master-only access management and server actions", () => {
  it("validates server input and reports duplicates without changing the list", async () => {
    expect((await addEmailAction({ email: "not-a-string@gmail.com" })).success).toBe(false);
    expect((await addEmailAction("invalid")).success).toBe(false);
    expect((await addEmailAction(MASTER_EMAIL.toUpperCase())).success).toBe(false);
    expect(await db.select().from(schema.authorizedEmails)).toHaveLength(1);
  });

  it("records the authenticated master as added_by and revalidates after a successful action", async () => {
    expect((await addEmailAction("new@gmail.com")).success).toBe(true);
    const [row] = await db.select().from(schema.authorizedEmails).where(eq(schema.authorizedEmails.email, "new@gmail.com"));
    expect(row.addedBy).toBe(MASTER_EMAIL);
    expect(revalidatePath).toHaveBeenCalledWith("/admin", "layout");
  });

  it("rejects direct add/remove actions from another authorized member", async () => {
    await addAuthorizedEmail(db, master, "team@gmail.com");
    const member = await login("team@gmail.com");
    vi.mocked(headers).mockResolvedValue(member.requestHeaders);
    expect((await addEmailAction("new@gmail.com")).success).toBe(false);
    expect((await removeEmailAction(MASTER_EMAIL)).success).toBe(false);
    expect(await db.select().from(schema.authorizedEmails)).toHaveLength(2);
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("rejects direct actions without a session", async () => {
    vi.mocked(headers).mockResolvedValue(new Headers());
    expect((await addEmailAction("new@gmail.com")).success).toBe(false);
    expect((await removeEmailAction(MASTER_EMAIL)).success).toBe(false);
    expect(await db.select().from(schema.authorizedEmails)).toHaveLength(1);
  });

  it("protects the master and returns a clear error for a nonexistent target", async () => {
    expect((await removeEmailAction(` ${MASTER_EMAIL.toUpperCase()} `)).success).toBe(false);
    expect((await removeEmailAction("absent@gmail.com")).success).toBe(false);
    expect(await db.select().from(schema.authorizedEmails)).toHaveLength(1);
  });

  it("atomically removes authorization and all target sessions without affecting the master", async () => {
    await addAuthorizedEmail(db, master, "team@gmail.com");
    const member = await login("team@gmail.com");
    await login("team@gmail.com");
    expect((await removeEmailAction(member.actor.email)).success).toBe(true);
    expect(await db.select().from(schema.session).where(eq(schema.session.userId, member.actor.userId))).toHaveLength(0);
    expect((await getAuthorizedSession(db, masterHeaders)).email).toBe(MASTER_EMAIL);
    await expect(getAuthorizedSession(db, member.requestHeaders)).rejects.toMatchObject({ code: "UNAUTHENTICATED" });
    vi.mocked(headers).mockResolvedValue(member.requestHeaders);
    expect((await addEmailAction("new@gmail.com")).success).toBe(false);
  });

  it("rolls back the removed email if deleting its sessions fails", async () => {
    await addAuthorizedEmail(db, master, "team@gmail.com");
    const member = await login("team@gmail.com");
    await pg.exec(`CREATE FUNCTION deny_session_delete() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'test failure'; END $$;
      CREATE TRIGGER deny_session_delete BEFORE DELETE ON "session" FOR EACH ROW EXECUTE FUNCTION deny_session_delete();`);
    try {
      expect((await removeEmailAction(member.actor.email)).success).toBe(false);
      expect(await db.select().from(schema.authorizedEmails).where(eq(schema.authorizedEmails.email, member.actor.email))).toHaveLength(1);
      expect(await db.select().from(schema.session).where(eq(schema.session.userId, member.actor.userId))).toHaveLength(1);
    } finally {
      await pg.exec('DROP TRIGGER deny_session_delete ON "session"; DROP FUNCTION deny_session_delete()');
    }
  });

  it("rechecks the master's session inside the transaction", async () => {
    await db.delete(schema.session).where(and(eq(schema.session.id, master.sessionId), eq(schema.session.userId, master.userId)));
    await expect(addAuthorizedEmail(db, master, "new@gmail.com")).rejects.toMatchObject({ code: "UNAUTHENTICATED" });
    expect(await db.select().from(schema.authorizedEmails)).toHaveLength(1);
  });

  it("allows a previously revoked member to log in again after reauthorization", async () => {
    await addAuthorizedEmail(db, master, "team@gmail.com");
    const first = await login("team@gmail.com");
    await removeAuthorizedEmail(db, master, first.actor.email);
    await addAuthorizedEmail(db, master, first.actor.email);
    const second = await login(first.actor.email);
    expect(second.actor.userId).toBe(first.actor.userId);
    expect(second.actor.sessionId).not.toBe(first.actor.sessionId);
    await expect(getAuthorizedSession(db, first.requestHeaders)).rejects.toMatchObject({ code: "UNAUTHENTICATED" });
  });
});
