import { z } from "zod";

export const mailSampleOptions = {
  PEDIDO_RECIBIDO: "Pedido registrado",
  COMPROBANTE_RECIBIDO: "Comprobantes recibidos · gestores",
  PAGO_VERIFICADO: "Pago confirmado",
  PAGO_RECHAZADO: "Pago rechazado",
  DESPACHADO: "Despacho / listo para recojo",
  ENTREGADO: "Pedido entregado",
  CANCELADO: "Pedido cancelado por comprador",
  ANULADO: "Pedido anulado por gestor",
  DOCUMENTOS_VENTA: "Boleta / factura",
  DOCUMENTOS_CORREGIDOS: "Documentos corregidos",
  CAJA_SOLICITUD: "Tesorería · solicitud de emisión",
  CAJA_FINALIZADA: "Tesorería · documento finalizado",
  CAJA_DEVUELTA: "Tesorería · corrección requerida",
  CAJA_ANULADA: "Tesorería · solicitud anulada",
  APOYO_RECOJO: "Apoyo para recojo",
} as const;

export type MailSampleKey = keyof typeof mailSampleOptions;

export const mailSampleSelectionSchema = z.strictObject({
  template: z.enum(Object.keys(mailSampleOptions) as [MailSampleKey, ...MailSampleKey[]]),
  variant: z.enum(["universidad", "instituto", "mixto"]),
  delivery: z.enum(["delivery", "recojo_campus"]),
  billing: z.enum(["boleta", "factura"]).default("boleta"),
});

export const mailSampleSendSchema = mailSampleSelectionSchema.extend({
  destination: z.string().trim().toLowerCase().pipe(z.email("Ingresa un destinatario válido.").max(254)),
  provider: z.enum(["gmail", "endpoint"]),
});

export type MailSampleSelection = z.infer<typeof mailSampleSelectionSchema>;
export type MailSamplePreview = { subject: string; html: string; attachmentNames: string[] };
export type MailSamplePreviewResult = { success: true; preview: MailSamplePreview } | { success: false; message: string };
