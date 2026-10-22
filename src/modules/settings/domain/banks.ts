import { z } from "zod";

export const bankIdSchema = z.uuid();
export const bankFormSchema = z.object({
  publisherImprint: z.enum(["universidad", "instituto"]),
  bank: z.string().trim().min(2, "Indica el banco.").max(80),
  holder: z.string().trim().max(200),
  account: z.string().trim().regex(/^[0-9 -]{5,40}$/, "Ingresa un número de cuenta válido."),
  cci: z.string().trim().transform((value) => value.replace(/[ -]/g, "")).pipe(z.string().regex(/^\d{0,20}$/, "El CCI contiene solo números y hasta 20 dígitos.")),
  currency: z.literal("PEN"),
  status: z.enum(["ACTIVO", "INACTIVO"]),
}).superRefine((data, ctx) => {
  if (data.status === "ACTIVO") {
    if (data.holder.length < 2) ctx.addIssue({ code: "custom", path: ["holder"], message: "Completa el titular antes de activar la cuenta." });
    if (data.cci.length !== 20) ctx.addIssue({ code: "custom", path: ["cci"], message: "El CCI debe tener 20 dígitos para activar la cuenta." });
  }
});
export const bankUpdateSchema = bankFormSchema.safeExtend({ id: bankIdSchema });
export type BankForm = z.infer<typeof bankFormSchema>;
export type BankAdminRow = BankForm & { id: string };
export type BankResult = { success: boolean; message: string; fieldErrors?: Record<string, string> };
export const emptyBank: BankForm = { publisherImprint: "universidad", bank: "", holder: "", account: "", cci: "", currency: "PEN", status: "INACTIVO" };
