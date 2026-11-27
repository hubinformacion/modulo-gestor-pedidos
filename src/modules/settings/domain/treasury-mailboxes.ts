import { z } from "zod";
import { authorizedEmailSchema } from "@/modules/access/domain/policy";

export const treasuryMailboxSchema = z.object({
  imprint: z.enum(["universidad", "instituto"]),
  email: z.union([z.literal(""), authorizedEmailSchema]),
  previousEmail: z.union([z.literal(""), authorizedEmailSchema]),
});
