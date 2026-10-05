import { afterEach, describe, expect, it, vi } from "vitest";
import { ConfigurationError, getAuthEnvironment, isAuthConfigured } from "@/lib/env";

afterEach(() => vi.unstubAllEnvs());

describe("configuration failure handling", () => {
  it.each(["", "not-a-url", "ftp://localhost", "http://untrusted.example"])("handles invalid auth URL %s without leaking values or throwing in the login page", (value) => {
    vi.stubEnv("DATABASE_URL", "postgresql://test:private-password@localhost/test");
    vi.stubEnv("BETTER_AUTH_URL", value);
    vi.stubEnv("BETTER_AUTH_SECRET", "test-secret-at-least-thirty-two-characters");
    vi.stubEnv("GOOGLE_CLIENT_ID", "test-client");
    vi.stubEnv("GOOGLE_CLIENT_SECRET", "test-secret");
    expect(isAuthConfigured()).toBe(false);
    expect(getAuthEnvironment).toThrow(ConfigurationError);
    expect(getAuthEnvironment).toThrow("La configuración del servicio está incompleta.");
  });
});
