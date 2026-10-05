import type { Database } from "./index";
import { authorizedEmails } from "./schema";
import { MASTER_EMAIL } from "../lib/access-policy";

export async function seedMaster(db: Database): Promise<void> {
  await db.insert(authorizedEmails).values({
    email: MASTER_EMAIL, addedBy: MASTER_EMAIL,
  }).onConflictDoNothing();
}
