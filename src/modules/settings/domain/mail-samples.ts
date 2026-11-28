import { z } from "zod";

export const mailSampleOptions = {
  PEDIDO_RECIBIDO: { label: "Pedido registrado", stage: "Registro y revisión" },
  COMPROBANTE_RECIBIDO: { label: "Comprobantes recibidos · gestores", stage: "Registro y revisión" },
  PAGO_RECHAZADO: { label: "Pago observado · comprador", stage: "Registro y revisión" },
  TESORERIA_EMISION: { label: "Tesorería Recaudación · emisión", stage: "Validación y emisión" },
  PAGO_VERIFICADO: { label: "Pago confirmado · comprador", stage: "Validación y emisión" },
  DOCUMENTOS_VENTA: { label: "Boleta o factura · comprador", stage: "Validación y emisión" },
  DOCUMENTOS_CORREGIDOS: { label: "Documentos corregidos", stage: "Validación y emisión" },
  DESPACHADO: { label: "Despacho o aviso de recojo", stage: "Distribución y entrega" },
  APOYO_RECOJO: { label: "Aviso al personal de apoyo", stage: "Distribución y entrega" },
  ENTREGADO: { label: "Pedido entregado", stage: "Distribución y entrega" },
  CANCELADO: { label: "Cancelación por el comprador", stage: "Cierres alternativos" },
  ANULADO: { label: "Anulación por un gestor", stage: "Cierres alternativos" },
} as const;

export type MailSampleKey = keyof typeof mailSampleOptions;

const mailSampleFields = z.strictObject({
  template: z.enum(Object.keys(mailSampleOptions) as [MailSampleKey, ...MailSampleKey[]]),
  variant: z.enum(["universidad", "instituto", "mixto"]),
  delivery: z.enum(["delivery", "recojo_campus"]),
  billing: z.enum(["boleta", "factura"]).default("boleta"),
});

function usesSingleTreasurySeal({ template, variant }: z.infer<typeof mailSampleFields>) {
  return template !== "TESORERIA_EMISION" || variant !== "mixto";
}

const treasurySealError = { path: ["variant"], message: "Selecciona un sello para la solicitud a Tesorería." };

export const mailSampleSelectionSchema = mailSampleFields.refine(usesSingleTreasurySeal, treasurySealError);

export const mailSampleSendSchema = mailSampleFields.extend({
  destination: z.string().trim().toLowerCase().pipe(z.email("Ingresa un destinatario válido.").max(254)),
  provider: z.enum(["gmail", "endpoint"]),
}).refine(usesSingleTreasurySeal, treasurySealError);

export type MailSampleSelection = z.infer<typeof mailSampleSelectionSchema>;
export type MailSamplePreview = { subject: string; html: string; attachmentNames: string[] };
export type MailSamplePreviewResult = { success: true; preview: MailSamplePreview } | { success: false; message: string };
