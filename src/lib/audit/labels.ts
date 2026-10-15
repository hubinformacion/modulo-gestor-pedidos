export const managementAuditLabels = {
  ACCESS_CREATED: "Acceso autorizado", ACCESS_CHANGED: "Permisos actualizados", ACCESS_REVOKED: "Acceso revocado",
  MAILBOX_CHANGED: "Buzón de servicio actualizado",
  BANK_CREATED: "Cuenta bancaria creada", BANK_CHANGED: "Cuenta bancaria actualizada", BANK_DELETED: "Cuenta bancaria eliminada",
  CAMPUS_CREATED: "Campus creado", CAMPUS_CHANGED: "Campus actualizado", CAMPUS_DELETED: "Campus eliminado",
  BOOK_CREATED: "Publicación creada", BOOK_CHANGED: "Inventario actualizado", BOOK_DELETED: "Publicación eliminada",
  PROMOTION_SAVED: "Promoción guardada", PROMOTION_DELETED: "Promoción eliminada", COUPON_SAVED: "Cupón guardado", COUPON_DELETED: "Cupón eliminado",
  PERSONAL_DATA_CORRECTED: "Datos de emisión corregidos",
} as const;
export type ManagementAuditEvent = keyof typeof managementAuditLabels;
