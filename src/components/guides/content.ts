export type GuideStep = { title: string; short: string; description: string; checklist: string[]; result: string; exception: string; href: string; link: string; optional?: boolean; branchLabel?: string };
export type RoleGuide = { title: string; intro: string; steps: GuideStep[]; faq: { question: string; answer: string }[]; reminders: string[] };
export const managerGuide: RoleGuide = {
  title: "Atención de pedidos",
  intro: "Desde la primera revisión hasta la entrega. Selecciona una etapa para consultar sus acciones y condiciones. La atención requiere una cuenta personal; la cuenta maestra solo consulta los pedidos.",
  steps: [
    { title: "Tomar atención", short: "Asignar responsable", description: "Abre un pedido desde la bandeja y toma su atención para registrar decisiones y cambios de estado.", checklist: ["Revisa comprador, modalidad de entrega y publicaciones.", "Toma la atención antes de verificar pagos o registrar el despacho.", "Si cambias de responsable, conserva el motivo en el historial."], result: "El pedido tiene un gestor responsable y los cambios quedan registrados.", exception: "Los demás gestores pueden consultar. Las decisiones operativas las registra el responsable asignado.", href: "/admin/pedidos", link: "Abrir pedidos" },
    { title: "Revisar pagos", short: "Verificar depósitos", description: "En Pagos, consulta los comprobantes y verifica que cada depósito corresponda al importe requerido.", checklist: ["Abre los comprobantes desde su enlace privado de Drive.", "Aprueba o rechaza cada sello por separado; un rechazo requiere motivo.", "En un pedido mixto verifica los dos pagos; el envío se incluye en Universidad."], result: "Cuando todos los pagos requeridos están verificados, el pedido pasa a Distribución.", exception: "Si rechazas un pago, el comprador puede volver a cargar únicamente los comprobantes de ese sello.", href: "/admin/pedidos", link: "Consultar bandeja" },
    { title: "Coordinar emisión", short: "Boleta o factura", description: "Cada pago verificado crea su solicitud de emisión en Tesorería Recaudación. Consulta el avance en Pagos.", checklist: ["Revisa observaciones y coordina las correcciones con el comprador.", "Responde la observación y actualiza los datos fiscales de emisión cuando corresponda.", "Si una emisión finalizada necesita corrección, devuélvelo indicando el motivo."], result: "El comprador recibe los PDF vigentes; en un mixto, un correo reúne ambos documentos cuando están finalizados.", exception: "La emisión corre en paralelo: no necesitas esperar la boleta o factura para distribuir o entregar las publicaciones.", href: "/admin/pedidos", link: "Revisar atención", optional: true },
    { title: "Distribuir", short: "Preparar y despachar", description: "Con los pagos verificados, revisa las publicaciones y el destino antes de registrar la salida.", checklist: ["Comprueba cantidades y dirección o biblioteca de recojo.", "En delivery registra el courier y la guía o enlace de seguimiento si están disponibles.", "En recojo registra que el pedido está listo en la biblioteca."], result: "El comprador recibe la actualización con el courier o la ubicación de recojo.", exception: "Antes del despacho, el responsable puede anular el pedido con un motivo. Las devoluciones de dinero se coordinan por separado.", href: "/admin/pedidos", link: "Abrir atención" },
    { title: "Confirmar entrega", short: "Cerrar la atención", description: "Registra la entrega cuando el comprador haya recibido o recogido sus publicaciones.", checklist: ["Verifica que el pedido esté despachado o listo para recoger.", "Si tienes una foto de constancia, adjúntala; es opcional en ambas modalidades.", "Confirma la entrega para registrar la fecha y notificar al comprador."], result: "El pedido queda entregado con su trazabilidad disponible.", exception: "No confirmes la entrega al despachar: son momentos distintos del proceso.", href: "/admin/pedidos", link: "Consultar pedidos" },
  ],
  faq: [
    { question: "¿Qué hago con una observación de Tesorería Recaudación?", answer: "El gestor de Fondo Editorial coordina y resuelve. En Pagos puedes responder, corregir los datos de emisión y adjuntar sustento. Los importes y pagos originales del pedido se conservan." },
    { question: "¿Las notas internas se envían al comprador?", answer: "No. Las notas de Fondo Editorial son privadas para sus gestores. Las notas internas de Tesorería Recaudación pertenecen a su propio equipo y no aparecen aquí." },
    { question: "¿Tengo que enviar cada correo manualmente?", answer: "No. Los cambios operativos generan sus avisos en el momento. Si un envío falla, el sistema lo informa; no repitas un cambio de estado para intentar generar otro correo." },
    { question: "¿Cómo veo información reciente?", answer: "Usa el botón de actualizar de la pantalla. No hay refresco periódico. Guarda los borradores y termina las cargas antes de actualizar." },
    { question: "¿Dónde gestiono catálogo y descuentos?", answer: "Inventario permite añadir y editar publicaciones por fila. Promociones programa descuentos por temporada y Cupones administra códigos. No se combinan: el pedido conserva la alternativa de mayor ahorro." },
  ],
  reminders: ["Las acciones sensibles requieren la atención asignada.", "Emisión y logística tienen tiempos independientes.", "Los documentos y el historial permanecen disponibles al cerrar el pedido."],
};
export const treasuryGuide = {
  stages: [
    {
      title: "Tomar atención",
      treasury: "Abre la solicitud de tu unidad y pulsa Tomar atención. Si la atiende otra persona, registra el motivo del relevo.",
      editorial: "Verifica el pago. Esa validación abre una solicitud de emisión por cada sello.",
      handoff: "to-treasury" as const,
    },
    {
      title: "Revisar la solicitud",
      treasury: "Compara el importe con el comprobante y verifica los datos de facturación. Si detectas un error, registra una observación y espera la respuesta antes de emitir.",
      editorial: "Si recibe una observación, coordina la corrección y responde desde Pagos, en el detalle del pedido. Con la respuesta, Tesorería vuelve a revisar los datos.",
      handoff: "round-trip" as const,
    },
    {
      title: "Emitir y finalizar",
      treasury: "Adjunta el PDF y el XML originales, de hasta 3 MB cada uno. Revisa la vista previa del PDF, confirma que las observaciones estén resueltas y pulsa Finalizar solicitud.",
      editorial: "Consulta el comprobante emitido desde la pestaña Pagos del pedido.",
    },
  ],
  returned: {
    title: "Si devuelven la emisión",
    treasury: "Lee el motivo, vuelve a tomar atención y regresa al paso 3 con el PDF y el XML corregidos. Los archivos anteriores quedan en el historial.",
    editorial: "Devuelve la emisión desde Pagos e indica el motivo de la corrección.",
    handoff: "to-treasury" as const,
  },
  faq: [
    { question: "¿Quién recibe los correos de Tesorería Recaudación?", answer: "Los avisos se dirigen al buzón de servicio de la unidad con copia a Fondo Editorial. Las cuentas personales de Tesorería pueden atender desde la plataforma." },
    { question: "¿Qué pasa si otra persona continúa la solicitud?", answer: "Puedes liberar la atención o tomar la solicitud de otra persona indicando el motivo. El borrador se conserva para el relevo y el cambio queda registrado en el historial." },
    { question: "¿Quién puede ver mis notas internas?", answer: "Solo las personas de Tesorería Recaudación autorizadas para la unidad de la solicitud. Fondo Editorial y el comprador no acceden a estas notas. Para pedir una corrección a Fondo Editorial usa Observaciones." },
    { question: "¿Puedo emitir después de la entrega?", answer: "Sí. La emisión tiene su propio flujo y puede completarse después de entregar las publicaciones. Una solicitud anulada no admite continuar la emisión." },
    { question: "¿Cómo actualizo la pantalla?", answer: "Usa el botón de actualizar cuando no tengas una carga o edición en curso. No hay refresco periódico de la bandeja." },
  ],
  reminders: ["Atiende desde una cuenta personal, no desde el buzón de servicio.", "Las notas internas y las observaciones cumplen funciones distintas.", "Adjuntar prepara el borrador. Finalizar confirma la emisión y genera los avisos."],
};
