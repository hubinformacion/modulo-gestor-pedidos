import { vi } from "vitest";

// Next marks server-only at compile time. Vitest runs trusted server code in Node.
vi.mock("server-only", () => ({}));
