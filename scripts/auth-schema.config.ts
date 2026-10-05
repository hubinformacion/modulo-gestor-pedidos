import { Pool } from "@neondatabase/serverless";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { drizzle } from "drizzle-orm/neon-serverless";
import * as schema from "../src/db/auth-schema";

// Schema generation only: the CLI never connects to this database.
// No environment credentials or server-only application modules are required.
export const auth = betterAuth({
  baseURL: "http://localhost:3000",
  secret: "schema-generation-only-not-a-runtime-secret",
  database: drizzleAdapter(
    drizzle({ client: new Pool({ connectionString: "postgresql://schema:generate@localhost/schema" }) }),
    { provider: "pg", schema },
  ),
});
