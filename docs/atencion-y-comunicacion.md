# Atención de pedidos y comunicación

Contrato vigente que sustituye la confirmación manual de comprobantes y la atención sin responsable. Implementado dentro de `feat/06-iframe-wp-polish`, pendiente de revisión y aprobación de esa rama.

## Usuarios y responsabilidad

Se mantienen Google OAuth y authorized_emails; no registro libre ni roles nuevos. Todos los autorizados consultan pedidos, toman pedidos disponibles y trabajan los que tienen asignados. Solo el maestro administra la lista de correos.

- Atender: autoasignación atómica con lock del pedido y comprobación vigente de sesión/correo. Dos gestores no pueden tomar simultáneamente el mismo pedido.
- Registrar pagos/despacho/entrega: requiere ser el gestor asignado, comprobar versión y estado. Tomar la atención primero. Ningún actor/id de gestor enviado desde cliente es confiable; la identidad procede de la sesión.
- Liberar: solo el gestor actual libera un pedido abierto. Otro autorizado podrá tomarlo después. Pedidos cerrados conservan su responsable e historial.
- Revocar un correo: revoca sesiones y libera sus pedidos abiertos en la misma transacción. Conserva responsable de pedidos cerrados y nombres de los actores del historial; no deja pedidos abiertos bloqueados por un gestor sin acceso.
- orders guarda gestor/nombre/fecha; order_activity registra toma, liberación, comprobantes, revisiones y entregas con actor y detalle. «Mis pedidos» incluye los propios y cerrados; «He participado» consulta el historial aunque hayan cambiado de gestor.

## Interfaz administrativa

Bandejas Todos / Por asignar / Mis pedidos / He participado. Búsqueda por número/comprador/correo y filtro por estado; paginación de veinte. Tabla: pedido, comprador, gestor, modalidad, estado, importe, acción. Los pagos Universidad/Instituto están únicamente en el detalle.

Atención guiada en cuatro etapas navegables: Atención → Pagos → Preparación → Entrega. La etapa actual se selecciona desde BD; verificar todos los pagos lleva a preparación, despachar a entrega. Se puede consultar cualquier etapa sin saltarse reglas de estado. Contexto lateral del comprador/publicaciones/importe; historial de quién hizo cada operación.

Rechazar exige un motivo de 5–500 caracteres, visible en seguimiento y correo. Rechazo/re-subida conserva el otro sello. Despachar delivery requiere courier; guía/enlace HTTPS opcionales. Recojo marca listo en biblioteca sin courier. Entrega solo tras despacho. Cada transición crea evento de correo e historial junto con el estado, antes de llamar a Google. No se añade cancelación/reposición de stock sin política definida.

## Experiencia del comprador

Seguimiento con progreso Pedido → Pago → Preparación → Envío/Recojo → Entrega, mensaje de qué ocurre/qué hacer, comprobantes por sello, envío y cronología. Courier/guía/enlace y fechas se muestran cuando estén registrados. Enviado/listo/entregado tienen textos distintos para domicilio y biblioteca.

Una zona FilePond por sello aplicable. Adjuntar guarda en Drive, registra el recibo y pasa ese pago a EN_REVISION en una transacción. No hay botón de confirmar ni paso adicional del comprador. Confirmación visual: comprobante adjunto, estado de revisión y aviso por correo al concluirla, sin identidad del gestor. Se admiten varios archivos en el lote seleccionado antes de completar la carga; al finalizar se oculta FilePond, y se actualiza el último recibo y la versión del pedido para impedir decisiones desde un archivo/vista anteriores. No se duplica el correo de recepción por cada archivo adicional del mismo ciclo de revisión.

Refresco cada 35 segundos y al volver a la pestaña, solo mientras sea visible y sin formularios/cargas en edición. Pausa durante carga/revisión/despacho para no borrar borradores. Termina al cerrar el pedido. Sin botones de copiar enlace, actualizar estado o confirmar archivos.

## Correos y threads

Diagnóstico real: los Message-ID calculados no coincidían con las cabeceras que Gmail almacenó; uno de los threadId guardados también difería. El token anterior no podía leer metadata. El propietario autorizó gmail.metadata y actualizó .env.local; se verificaron/repararon dos conversaciones existentes mediante lectura de cabeceras, sin reenviar mails.

Scopes propietarios: drive, gmail.send y gmail.metadata. Este último permite consultar cabeceras, sin leer el cuerpo de otros mensajes. No añadirlo a los scopes de login de gestores. Replicar el refresh token nuevo en Vercel al desplegar.

- Una fila order_emails por pedido: API id del correo inicial, threadId real, Message-ID RFC real, asunto real, última referencia/cadena y estado de verificación. Nunca construir respuestas a partir de un identificador supuesto.
- Tras aceptación de Gmail, guardar primero el API id/status ENVIADO. Consultar metadata después; un fallo de metadata no vuelve a enviar el correo ya aceptado.
- Respuestas: threadId explícito, Subject idéntico al inicial, In-Reply-To al último Message-ID real y References con referencias reales y plegado RFC. Si no se pueden verificar cabeceras, las actualizaciones quedan pendientes.
- Un lease por pedido serializa correo inicial y avisos. Evita emisiones simultáneas con referencias inconsistentes. Google no bloquea transacciones de pedidos/stock.
- Avisos compactos para recepción de comprobante, verificación/rechazo, envío/listo para recojo y entrega. Asignación/liberación solo se audita en administración, sin aviso al comprador. Confirmación inicial incluye guía PDF y botón tras los importes; no repetir el PDF ni toda la compra en cada actualización.
- Comprador como destinatario, maestro en copia estable; gestor vigente y autorizado en Bcc cuando sea distinto. Cuerpos con datos escapados y motivo/transportista/guía de la transición, no un estado posterior que haya cambiado mientras el correo esperaba.
- Envío inmediato mediante after tras cada transición. Sin controles/card de comunicación ni avisos en seguimiento. Reintento automático de pendientes mediante /api/internal/jobs, protegido por CRON_SECRET (mínimo 32 caracteres). Cron diario en vercel.json a las 12:00 UTC, como recuperación; no sustituye el envío inmediato. Espera de un minuto entre fallos; lease de cinco minutos, hasta tres avisos por pasada. El worker reactiva registros ERROR con cinco fallos tras una hora; nunca reactiva ENVIADO. Selecciona hasta veinte pedidos por ejecución, con presupuesto temporal. Replicar CRON_SECRET privado de .env.local en Vercel Production; cron funciona solo tras despliegue.
- Gmail puede duplicar un correo si lo aceptó y la respuesta/registro se perdió; los IDs/eventos estables y el lease reducen ese riesgo, pero send no garantiza idempotencia. Emails ya enviados a hilos separados no se mueven ni reenvían: los siguientes se vinculan a la conversación inicial verificada.

## Migración y revisión

0007_vengeful_silk_fever aplicada en Neon: asignación, motivos de rechazo, guía/enlace/fechas, historial, metadata canónica/lease y payload de avisos. Pedidos previos reciben su evento de creación. Comprobantes ya cargados pendientes del viejo botón pasan a revisión con aviso pendiente; los rechazados no se reenvían si no hay un recibo nuevo. Sin envío de correo durante la migración o la reparación de cabeceras.

Pasos manuales:

1. Dos autorizados abren un pedido sin asignar; tomar en ambos: solo uno consigue la atención. El otro consulta, sin controles de decisión. Liberar y tomar con otro; ver historial y ambas bandejas de participación. Revocar un gestor de revisión y verificar liberación de sus pedidos abiertos.
2. Adjuntar PDF/JPG/PNG en seguimiento; queda en revisión sin confirmar. Seleccionar varios archivos del mismo sello antes de terminar: todos registrados, una sola recepción por ciclo. Mixto conserva el otro pago. Ver únicamente acuse de revisión, sin nombre del gestor.
3. Gestor verifica un sello y rechaza el otro con motivo. El comprador ve el motivo, sube el nuevo y entra a revisión directamente. Verificar ambos permite preparación.
4. Registrar salida con courier/guía/enlace; comprador ve por dónde va y recibe correo. Recojo avisa disponible en biblioteca. Registrar entrega y revisar nombre/fecha/historial.
5. En Gmail, comprobar un thread por pedido: inicial, recepción de comprobantes, pagos, envío y entrega. Sin correo de asignación. Revisar el hilo en comprador, maestro y gestor; comparar threadId/referencias reales si hubiera un problema. En Gmail la vista de conversación del usuario debe estar activada para visualizar agrupación.
6. Interrumpir Google en un entorno de revisión: los estados/archivos permanecen guardados; avisos pendientes. Restaurar y comprobar la recuperación automática en el cron configurado; no reenviar los ya enviados. Revisar móvil, tabs con teclado y preservación de formularios al refresco.

Sin suites automatizadas ni pedidos/usuarios ficticios. La revisión visual de las nuevas pantallas y el envío de transiciones reales se completa con sesiones/datos de revisión autorizados.

Comprobaciones realizadas: migración 0007 aplicada en Neon; lectura de cabeceras reales y reparación de dos conversaciones sin enviar mensajes; lint, tipos y build correctos. No se crearon usuarios/pedidos de prueba ni se asignaron/revisaron/despacharon pedidos operativos para validar. La revisión de interfaz y transiciones con correo real queda en los pasos manuales anteriores.

## Comprobantes y correo simplificado

FilePond sin créditos, preview ni nombre de archivo visible; al completarse todo el lote oculta la zona de carga, sin borrar Drive ni el registro. EN_REVISION conserva solo el acuse; RECHAZADO habilita nuevamente la carga de ese sello. La confirmación y estado EN_REVISION permanecen; no mostrar un archivo descargable al comprador. El gestor conserva nombre/fecha y enlace directo drive_view_url.

Carpeta Drive dedicada a comprobantes: lectores nominados según authorized_emails, sin permisos públicos ni invitaciones por email. Sincronización al cambiar autorizados, consultar detalle administrativo y en cron. Revocación de sesión inmediata; retirada de permiso Drive gestionado automática, eventualmente recuperada por cron si falla Google. drive_reader_grants registra únicamente permisos de lectores gestionados. Propietarios/editores preexistentes y permisos por grupos/dominio se administran en Google; no se retiran automáticamente. Revisar que la carpeta no tenga acceso organizacional externo a este mecanismo. Restricciones Workspace de compartir siguen aplicándose.

La carga no depende de sincronizar ACL: el archivo hereda permisos de carpeta y se registra aunque Google esté temporalmente indisponible para compartir. Migración 0008 aplicada en Neon; sincronización real de lectores completada, sin enviar correos.

Correo inicial: recepción, botón de seguimiento/pago, sello(s) e importe(s), advertencia de depósitos independientes si mixto y guía PDF adjunta. Sin listado de compra/datos de entrega/cuentas bancarias. Cada actualización lleva fecha/título/botón distintos, enlace con aviso por evento y contenido breve; conserva asunto y referencias reales. Gmail puede contraer texto repetido por decisión del cliente, sin configuración remitente que lo desactive universalmente.

Revisión adicional: cargar un archivo y verificar confirmación sin nombre ni marca FilePond; abrirlo como gestor en Drive con la cuenta autorizada. Comprobar ausencia de cards/controles de avisos en ambas pantallas. En un pedido nuevo, revisar sello/importes y PDF del correo inicial; cambiar un estado y comprobar el botón al inicio y mismo hilo. Para fallos, usar entorno de revisión y recuperación cron sin operar pedidos reales únicamente para comprobar implementación.

Comprobaciones del ajuste: lint, tipos y build de producción correctos; migración 0008 aplicada y lectores Drive sincronizados con la cuenta propietaria; ruta cron sin credenciales devuelve 401. No se ejecutó el worker de envíos contra pedidos operativos ni se enviaron mensajes de prueba.

## Cierre y privacidad del seguimiento

Sin nombre/identidad del gestor en el seguimiento, acuses ni cuerpos de correo; eventos de asignación/liberación se filtran en la consulta pública, manteniendo el historial administrativo. El gestor autorizado continúa recibiendo Bcc operativo, sin aparecer en el contenido para el comprador. Migración 0009 elimina exclusivamente ASIGNADO no ENVIADO; los avisos ya aceptados por Gmail no se alteran.

Entrega completada presenta ilustración SVG propia de libros, mensaje de cierre y fecha registrada. Movimiento CSS suave durante doce segundos, desactivado con prefers-reduced-motion. Card de entrega unifica dirección, destinatario, courier/guía/enlace y fechas; recojo conserva instrucciones de documento hasta la entrega. Historial en sidebar derecho del seguimiento y administración; móvil mantiene el flujo de columna. Al entregar permanece la card de pagos con sus importes y confirmación, sin cargas.

No revalidar pantallas desde cada archivo de una Server Action: puede desmontar la carga al actualizar EN_REVISION tras el primer archivo. Refresco cliente al terminar el lote y solo si no hay cargas/selecciones de otro sello; archivos fallidos permanecen seleccionados, sin refresco automático que los borre. El servidor conserva validación tipo/tamaño, idempotencia y posibilidad de finalizar el lote en revisión.

Revisión manual del ajuste: seleccionar varias imágenes/PDF, comprobar ausencia de preview y que todos terminan antes de desaparecer la carga. Mixto: cargar en ambos sellos simultáneamente; ningún refresco interrumpe el otro. Fallo parcial: reintentar el archivo retenido. Recargar EN_REVISION: solo acuse; rechazar un sello: vuelve solo esa carga. Tomar atención: sin correo de asignación, identidad únicamente en admin. Pedido ENTREGADO: cierre SVG y datos de entrega, sin depósitos; revisar móvil y movimiento reducido. Correo inicial nuevo: importes antes del botón.

Comprobaciones de este ajuste: migración 0009 aplicada, plugin de preview retirado mediante pnpm, lint/tipos/build correctos. No se cambiaron estados de pedidos operativos ni se enviaron correos de prueba; revisión visual y carga múltiple quedan en los pasos manuales descritos.

## Gestión compacta, notas y estados en correo

Wizard con barra horizontal compacta y navegación de consulta. Atención resume responsable/pagos; pagos mixtos se disponen en dos columnas, el comprobante reciente se destaca y los anteriores se pliegan. Preparación muestra cantidades/destino lado a lado y formulario de salida compacto. Entrega reúne destinatario, transporte y fechas. Las restricciones de asignación/pago/versión continúan verificándose en servidor.

Notas internas disponibles bajo el wizard, sin depender de la etapa. Cada autorizado puede añadir notas de 3–2000 caracteres, incluidos pedidos cerrados. Se guarda NOTA_INTERNA en order_activity con actor/fecha; no permite edición/borrado ni altera pedido/stock/versiones. No necesita migración: usa la tabla existente con event_type libre. La consulta pública usa allowlist de eventos operativos; notas/identidad del actor no llegan al comprador ni generan correos. La administración consulta las últimas cincuenta notas separadas del historial operativo. Texto escapado por React; no renderizar HTML del comentario.

Correos con ocho ilustraciones de estado: solicitud, revisión, verificación, rechazo, preparación, envío, biblioteca y entrega. Fuentes SVG propias en src/assets/email, GIF de movimiento breve generados con pnpm email:assets (sharp dev). Animación GIF con dos repeticiones; primer frame presenta el símbolo completo y el texto del estado permanece fuera de la imagen. Clientes que bloquean imágenes o muestran solo el primer frame conservan contenido/CTA. No depender de SVG inline ni de animaciones CSS para Gmail. CID único por evento; multipart/related para alternativa HTML/texto más imagen, multipart/mixed externo para la guía PDF. Tracing de Vercel incluye ambos assets; no requiere imágenes externas ni publica datos personales.

Compatibilidad consultada: [SVG embebido](https://www.caniemail.com/features/html-svg/), [GIF](https://www.caniemail.com/features/image-gif/) y [estructura MIME Gmail](https://developers.google.com/workspace/gmail/reactions/examples). Revisar GIF y adjunto en el despliegue real, sin afirmar validación de recepción antes de enviarlo.

Revisión manual: abrir seguimiento ENTREGADO y comprobar card de pago/acuse; revisar cuatro etapas en escritorio/móvil; añadir una nota y verificar autor/fecha tras recargar, que no se vea en tracking y que no llegue correo. Otro autorizado puede consultar/añadir notas; un no autorizado no accede. Revisar un próximo correo real por estado: ilustración, primer frame legible, botón operativo, hilo y PDF inicial. No alterar pedidos reales ni enviar avisos exclusivamente para validar implementación sin autorización.

Comprobaciones del ajuste: lint, tipos y build correctos; GIF generado con dimensiones/frames/loop válidos y assets incluidos en tracing de rutas de envío. Sin migración adicional, usuarios/pedidos/notas ficticias ni envío real de correo para validar. Revisión visual, escritura de notas y recepción GIF/PDF en Gmail/Vercel pendientes de revisión manual.
