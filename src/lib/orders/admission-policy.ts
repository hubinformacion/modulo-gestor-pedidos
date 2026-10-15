import { z } from "zod";
const limit = z.number().int().min(1).max(100_000);
export const admissionPolicySchema = z.object({ emailQuarterHour: limit, emailDay: limit, ipQuarterHour: limit, globalDay: limit, pendingEmail: limit }).strict();
export type AdmissionPolicy = z.infer<typeof admissionPolicySchema>;
export const initialAdmissionPolicy: AdmissionPolicy = { emailQuarterHour: 3, emailDay: 10, ipQuarterHour: 20, globalDay: 200, pendingEmail: 3 };
export const admissionUpdateSchema = z.object({ policy: admissionPolicySchema, version: z.string().datetime() }).strict();
export const admissionFields = [
  { key: "emailQuarterHour", label: "Pedidos por correo cada 15 minutos", detail: "Protege frente a envíos repetidos del mismo comprador." },
  { key: "emailDay", label: "Pedidos por correo al día", detail: "El día se calcula con la hora de Perú." },
  { key: "pendingEmail", label: "Pedidos pendientes de pago por correo", detail: "Los pedidos cancelados o en distribución no cuentan como pendientes." },
  { key: "ipQuarterHour", label: "Pedidos por conexión cada 15 minutos", detail: "Una red de campus puede compartir una misma IP entre compradores." },
  { key: "globalDay", label: "Pedidos diarios en todo el sistema", detail: "Tope compartido entre todas las instancias de la aplicación." },
] as const;
