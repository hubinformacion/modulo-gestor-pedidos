import { z } from "zod";

export const maxMailTestPdfBytes = 3 * 1024 * 1024;
const copies = z.string().trim().max(2600).transform((value) => value ? [...new Set(value.split(";").map((email) => email.trim().toLowerCase()))] : [])
  .pipe(z.array(z.email("Revisa los correos de copia; sepáralos con punto y coma.").max(254)).max(9, "Usa como máximo nueve correos de copia."));

export const mailEndpointTestSchema = z.strictObject({
  to: z.string().trim().toLowerCase().pipe(z.email("Ingresa un destinatario válido.").max(254)),
  cc: copies,
  bcc: copies,
  subject: z.string().trim().min(1, "Ingresa el asunto.").max(200).refine((value) => !/[\r\n\0]/.test(value), "El asunto debe ocupar una sola línea."),
  html: z.string().trim().min(1, "Ingresa el mensaje.").max(30_000, "El mensaje admite hasta 30 000 caracteres."),
}).refine((value) => value.cc.length + value.bcc.length <= 9, "Usa como máximo diez destinatarios en total.");

export type MailEndpointTestInput = z.infer<typeof mailEndpointTestSchema>;
export type MailEndpointTestResult = {
  success: boolean;
  message: string;
  httpStatus?: number;
  providerMessageId?: string;
};
