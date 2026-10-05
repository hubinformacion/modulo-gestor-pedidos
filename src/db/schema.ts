import { sql } from "drizzle-orm";
import { check, pgTable, text, timestamp } from "drizzle-orm/pg-core";

export * from "./auth-schema";

export const authorizedEmails = pgTable("authorized_emails", {
  email: text("email").primaryKey(),
  addedBy: text("added_by").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  check("authorized_emails_normalized", sql`${table.email} = lower(btrim(${table.email}))`),
]);
