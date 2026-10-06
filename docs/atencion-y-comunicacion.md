# Atención de pedidos y comunicación

Contrato vigente que sustituye la confirmación manual de comprobantes y la atención sin responsable. Implementado dentro de `feat/06-iframe-wp-polish`, pendiente de revisión y aprobación de esa rama.

## Usuarios y responsabilidad

Se mantienen Google OAuth y authorized_emails; no registro libre ni roles nuevos. Todos los autorizados consultan pedidos, toman pedidos disponibles y trabajan los que tienen asignados. Solo el maestro administra la lista de correos.

- Atender: autoasignación atómica con lock del pedido y comprobación vigente de sesión/correo. Dos gestores no pueden tomar simultáneamente el mismo pedido.
- Registrar pagos/despacho/entrega: requiere ser el gestor asignado, comprobar versión y estado. Tomar la atención primero. Ningún actor/id de gestor enviado desde cliente es confiable; la identidad procede de la sesión.
- Liberar: solo el gestor actual libera un pedido abierto. Otro autorizado podrá tomarlo después. Pedidos cerrados conservan su responsable e historial.
- Revocar un correo: revoca sesiones y libera sus pedidos abiertos en la misma transacción. Conserva responsable de pedidos cerrados y nombres de los actores del historial; no deja pedidos abiertos bloqueados por un gestor sin acceso.
- orders guarda gestor/nombre/fecha; order_activity registra toma, liberación, comprobantes, revisiones y entregas con actor y detalle. «Mis pedidos» incluye los propios y cerrados; El historial conserva la participación de los gestores, sin una bandeja adicional.

## Interfaz administrativa

Filtro desplegable de bandeja: Todos / Por asignar / Mis pedidos, junto a Estado. Búsqueda por número/comprador/correo y filtro por estado; paginación de veinte. Tabla: pedido, comprador, gestor, modalidad, estado, importe, acción. Los pagos Universidad/Instituto están únicamente en el detalle.

Atención guiada en cuatro etapas navegables: Atención → Pagos → Distribución → Entrega. La etapa actual se selecciona desde BD; verificar todos los pagos lleva a distribución, despachar a entrega. Se puede consultar cualquier etapa sin saltarse reglas de estado. Contexto lateral del comprador/publicaciones/importe; historial de quién hizo cada operación.

Rechazar exige un motivo de 5–500 caracteres, visible en seguimiento y correo. Rechazo/re-subida conserva el otro sello. Despachar delivery requiere courier; guía/enlace HTTPS opcionales. Recojo marca listo en biblioteca sin courier. Entrega solo tras despacho. Cada transición crea evento de correo e historial junto con el estado, antes de llamar a Google. No se añade cancelación/reposición de stock sin política definida.

## Experiencia del comprador

Seguimiento con progreso Pedido → Pago → Distribución → Envío/Recojo → Entrega, mensaje de qué ocurre/qué hacer, comprobantes por sello, envío y cronología. Courier/guía/enlace y fechas se muestran cuando estén registrados. Enviado/listo/entregado tienen textos distintos para domicilio y biblioteca.

Una zona FilePond por sello aplicable. Adjuntar guarda en Drive, registra el recibo y pasa ese pago a EN_REVISION en una transacción. No hay botón de confirmar ni paso adicional del comprador. Confirmación visual: comprobante adjunto, estado de revisión y aviso por correo al concluirla, sin identidad del gestor. Se admiten varios archivos en el lote seleccionado antes de completar la carga; al finalizar se oculta FilePond, y se actualiza el último recibo y la versión del pedido para impedir decisiones desde un archivo/vista anteriores. No se duplica el correo de recepción por cada archivo adicional del mismo ciclo de revisión.

Refresco al volver a la ventana/pestaña (máximo uno por minuto), sin polling periódico, solo mientras sea visible y sin formularios/cargas en edición. Pausa durante carga/revisión/despacho para no borrar borradores. Termina al cerrar el pedido. Sin botones de copiar enlace, actualizar estado o confirmar archivos.

## Correos y threads

Diagnóstico real: los Message-ID calculados no coincidían con las cabeceras que Gmail almacenó; uno de los threadId guardados también difería. El token anterior no podía leer metadata. El propietario autorizó gmail.metadata y actualizó .env.local; se verificaron/repararon dos conversaciones existentes mediante lectura de cabeceras, sin reenviar mails.

Scopes propietarios: drive, gmail.send y gmail.metadata. Este último permite consultar cabeceras, sin leer el cuerpo de otros mensajes. No añadirlo a los scopes de login de gestores. Replicar el refresh token nuevo en Vercel al desplegar.

- Una fila order_emails por pedido: API id del correo inicial, threadId real, Message-ID RFC real, asunto real, última referencia/cadena y estado de verificación. Nunca construir respuestas a partir de un identificador supuesto.
- Tras aceptación de Gmail, guardar primero el API id/status ENVIADO. Consultar metadata después; un fallo de metadata no vuelve a enviar el correo ya aceptado.
- Respuestas: threadId explícito, Subject idéntico al inicial, In-Reply-To al último Message-ID real y References con referencias reales y plegado RFC. Si no se pueden verificar cabeceras, las actualizaciones quedan pendientes.
- Un lease por pedido serializa correo inicial y avisos. Evita emisiones simultáneas con referencias inconsistentes. Google no bloquea transacciones de pedidos/stock.
- Avisos compactos para recepción de comprobante, verificación/rechazo, envío/listo para recojo y entrega. Asignación/liberación solo se audita en administración, sin aviso al comprador. Confirmación inicial incluye guía PDF y botón tras los importes; no repetir el PDF ni toda la compra en cada actualización.
- Comprador como destinatario, maestro en copia estable; gestor vigente y autorizado en Bcc cuando sea distinto. Cuerpos con datos escapados y motivo/transportista/guía de la transición, no un estado posterior que haya cambiado mientras el correo esperaba.
- Envío inmediato mediante after tras cada transición. Sin controles/card de comunicación ni avisos en seguimiento. Reintento automático de pendientes mediante /api/internal/jobs, protegido por CRON_SECRET (mínimo 32 caracteres). Cron diario en vercel.json a las 12:00 UTC, como recuperación; no sustituye el envío inmediato. Espera de un minuto entre fallos; lease de cinco minutos, hasta veinte avisos por pasada. El worker reactiva registros ERROR con cinco fallos tras una hora; nunca reactiva ENVIADO. Selecciona hasta veinte pedidos por ejecución, con presupuesto temporal. Replicar CRON_SECRET privado de .env.local en Vercel Production; cron funciona solo tras despliegue.
- Gmail puede duplicar un correo si lo aceptó y la respuesta/registro se perdió; los IDs/eventos estables y el lease reducen ese riesgo, pero send no garantiza idempotencia. Emails ya enviados a hilos separados no se mueven ni reenvían: los siguientes se vinculan a la conversación inicial verificada.

## Migración y revisión

0007_vengeful_silk_fever aplicada en Neon: asignación, motivos de rechazo, guía/enlace/fechas, historial, metadata canónica/lease y payload de avisos. Pedidos previos reciben su evento de creación. Comprobantes ya cargados pendientes del viejo botón pasan a revisión con aviso pendiente; los rechazados no se reenvían si no hay un recibo nuevo. Sin envío de correo durante la migración o la reparación de cabeceras.

Pasos manuales:

1. Dos autorizados abren un pedido sin asignar; tomar en ambos: solo uno consigue la atención. El otro consulta, sin controles de decisión. Liberar y tomar con otro; ver historial y ambas bandejas de participación. Revocar un gestor de revisión y verificar liberación de sus pedidos abiertos.
2. Adjuntar PDF/JPG/PNG en seguimiento; queda en revisión sin confirmar. Seleccionar varios archivos del mismo sello antes de terminar: todos registrados, una sola recepción por ciclo. Mixto conserva el otro pago. Ver únicamente acuse de revisión, sin nombre del gestor.
3. Gestor verifica un sello y rechaza el otro con motivo. El comprador ve el motivo, sube el nuevo y entra a revisión directamente. Verificar ambos permite distribución.
4. Registrar salida con courier/guía/enlace; comprador ve por dónde va y recibe correo. Recojo avisa disponible en biblioteca. Registrar entrega y revisar nombre/fecha/historial.
5. En Gmail, comprobar un thread por pedido: inicial, recepción de comprobantes, pagos, envío y entrega. Sin correo de asignación. Revisar el hilo en comprador, maestro y gestor; comparar threadId/referencias reales si hubiera un problema. En Gmail la vista de conversación del usuario debe estar activada para visualizar agrupación.
6. Interrumpir Google en un entorno de revisión: los estados/archivos permanecen guardados; avisos pendientes. Restaurar y comprobar la recuperación automática en el cron configurado; no reenviar los ya enviados. Revisar móvil, tabs con teclado y preservación de formularios al refresco.

Sin suites automatizadas ni pedidos/usuarios ficticios. La revisión visual de las nuevas pantallas y el envío de transiciones reales se completa con sesiones/datos de revisión autorizados.

Comprobaciones realizadas: migración 0007 aplicada en Neon; lectura de cabeceras reales y reparación de dos conversaciones sin enviar mensajes; lint, tipos y build correctos. No se crearon usuarios/pedidos de prueba ni se asignaron/revisaron/despacharon pedidos operativos para validar. La revisión de interfaz y transiciones con correo real queda en los pasos manuales anteriores.

## Comprobantes y correo simplificado

FilePond sin créditos, preview ni nombre de archivo visible; al completarse todo el lote oculta la zona de carga, sin borrar Drive ni el registro. EN_REVISION conserva solo el acuse; RECHAZADO habilita nuevamente la carga de ese sello. La confirmación y estado EN_REVISION permanecen; no mostrar un archivo descargable al comprador. El gestor conserva nombre/fecha y enlace directo drive_view_url.

Carpeta Drive dedicada a comprobantes: lectores nominados según authorized_emails, sin permisos públicos ni invitaciones por email. Sincronización al cambiar autorizados y en cron; no se ejecuta al abrir cada detalle. Revocación de sesión inmediata; retirada de permiso Drive gestionado automática, eventualmente recuperada por cron si falla Google. drive_reader_grants registra únicamente permisos de lectores gestionados. Propietarios/editores preexistentes y permisos por grupos/dominio se administran en Google; no se retiran automáticamente. Revisar que la carpeta no tenga acceso organizacional externo a este mecanismo. Restricciones Workspace de compartir siguen aplicándose.

La carga no depende de sincronizar ACL: el archivo hereda permisos de carpeta y se registra aunque Google esté temporalmente indisponible para compartir. Migración 0008 aplicada en Neon; sincronización real de lectores completada, sin enviar correos.

Correo inicial: recepción, botón de seguimiento/pago, sello(s) e importe(s), advertencia de depósitos independientes si mixto y guía PDF adjunta. Sin listado de compra/datos de entrega/cuentas bancarias. Cada actualización lleva fecha/título/botón distintos, enlace con aviso por evento y contenido breve; conserva asunto y referencias reales. Gmail puede contraer texto repetido por decisión del cliente, sin configuración remitente que lo desactive universalmente.

Revisión adicional: cargar un archivo y verificar confirmación sin nombre ni marca FilePond; abrirlo como gestor en Drive con la cuenta autorizada. Comprobar ausencia de cards/controles de avisos en ambas pantallas. En un pedido nuevo, revisar sello/importes y PDF del correo inicial; cambiar un estado y comprobar el botón al inicio y mismo hilo. Para fallos, usar entorno de revisión y recuperación cron sin operar pedidos reales únicamente para comprobar implementación.

Comprobaciones del ajuste: lint, tipos y build de producción correctos; migración 0008 aplicada y lectores Drive sincronizados con la cuenta propietaria; ruta cron sin credenciales devuelve 401. No se ejecutó el worker de envíos contra pedidos operativos ni se enviaron mensajes de prueba.

## Cierre y privacidad del seguimiento

Sin nombre/identidad del gestor en el seguimiento, acuses ni cuerpos de correo; eventos de asignación/liberación se filtran en la consulta pública, manteniendo el historial administrativo. El gestor autorizado continúa recibiendo Bcc operativo, sin aparecer en el contenido para el comprador. Migración 0009 elimina exclusivamente ASIGNADO no ENVIADO; los avisos ya aceptados por Gmail no se alteran.

Entrega completada presenta ilustración SVG propia de libros, mensaje de cierre y fecha registrada. SVG estático, sin movimiento. Card de entrega unifica dirección, destinatario, courier/guía/enlace y fechas; recojo conserva instrucciones de documento hasta la entrega. Historial en sidebar derecho del seguimiento y administración; móvil mantiene el flujo de columna. Al entregar permanece la card de pagos con sus importes y confirmación, sin cargas.

No revalidar pantallas desde cada archivo de una Server Action: puede desmontar la carga al actualizar EN_REVISION tras el primer archivo. Refresco cliente al terminar el lote y solo si no hay cargas/selecciones de otro sello; archivos fallidos permanecen seleccionados, sin refresco automático que los borre. El servidor conserva validación tipo/tamaño, idempotencia y posibilidad de finalizar el lote en revisión.

Revisión manual del ajuste: seleccionar varias imágenes/PDF, comprobar ausencia de preview y que todos terminan antes de desaparecer la carga. Mixto: cargar en ambos sellos simultáneamente; ningún refresco interrumpe el otro. Fallo parcial: reintentar el archivo retenido. Recargar EN_REVISION: solo acuse; rechazar un sello: vuelve solo esa carga. Tomar atención: sin correo de asignación, identidad únicamente en admin. Pedido ENTREGADO: cierre SVG y datos de entrega, sin depósitos; revisar móvil e ilustración estática. Correo inicial nuevo: importes antes del botón.

Comprobaciones de este ajuste: migración 0009 aplicada, plugin de preview retirado mediante pnpm, lint/tipos/build correctos. No se cambiaron estados de pedidos operativos ni se enviaron correos de prueba; revisión visual y carga múltiple quedan en los pasos manuales descritos.

## Gestión compacta, notas y estados en correo

Wizard con barra horizontal compacta y navegación de consulta. Atención resume responsable/pagos; pagos mixtos se disponen en dos columnas, el comprobante reciente se destaca y los anteriores se pliegan. Distribución muestra cantidades/destino lado a lado y formulario de salida compacto. Entrega reúne destinatario, transporte y fechas. Las restricciones de asignación/pago/versión continúan verificándose en servidor.

Notas internas disponibles bajo el wizard, sin depender de la etapa. Cada autorizado puede añadir notas de 3–2000 caracteres, incluidos pedidos cerrados. Se guarda NOTA_INTERNA en order_activity con actor/fecha; no permite edición/borrado ni altera pedido/stock/versiones. No necesita migración: usa la tabla existente con event_type libre. La consulta pública usa allowlist de eventos operativos; notas/identidad del actor no llegan al comprador ni generan correos. La administración consulta las últimas cincuenta notas separadas del historial operativo. Texto escapado por React; no renderizar HTML del comentario.

Correos con ocho ilustraciones de estado: solicitud, revisión, verificación, rechazo, distribución, envío, biblioteca y entrega. Fuentes SVG propias estáticas en src/assets/email, PNG generados con pnpm email:assets (sharp dev). Sin animación en correo/web. Clientes que bloquean imágenes conservan texto y CTA. No depender de SVG inline ni de animaciones CSS para Gmail. CID único por evento; multipart/related para alternativa HTML/texto más imagen PNG, multipart/mixed externo para la guía PDF. Tracing de Vercel incluye ambos assets; no requiere imágenes externas ni publica datos personales.

Compatibilidad consultada: [SVG embebido](https://www.caniemail.com/features/html-svg/), [PNG](https://www.caniemail.com/features/image-png/) y [estructura MIME Gmail](https://developers.google.com/workspace/gmail/reactions/examples). Revisar PNG y adjunto en el despliegue real, sin afirmar validación de recepción antes de enviarlo.

Revisión manual: abrir seguimiento ENTREGADO y comprobar card de pago/acuse; revisar cuatro etapas en escritorio/móvil; añadir una nota y verificar autor/fecha tras recargar, que no se vea en tracking y que no llegue correo. Otro autorizado puede consultar/añadir notas; un no autorizado no accede. Revisar un próximo correo real por estado: ilustración estática, botón centrado operativo, hilo y PDF inicial. Los avisos operativos se envían automáticamente; no generar correos/pedidos ficticios para validar.

Comprobaciones del ajuste: lint, tipos y build correctos; PNG estáticos generados y assets incluidos en tracing de rutas de envío. Sin migración adicional, usuarios/pedidos/notas ficticias ni envío real de correo para validar. Revisión visual, escritura de notas y recepción PNG/PDF en Gmail/Vercel pendientes de revisión manual.

## Avisos agrupados y consultas reducidas

Mixto: primer sello cargado se registra/revisa sin correo; al llegar ambos comprobantes se crea un acuse por pedido, payload.scope=pedido. Un pago ya verificado cuenta como recibido en re-subidas del otro. Archivos adicionales del mismo ciclo EN_REVISION no duplican avisos. La transacción bloquea el pedido y decide desde BD, por lo que cargas simultáneas no generan dos acuses. Primera aprobación se registra sin correo; última aprobación emite una confirmación y pasa a EN_PREPARACION. Rechazar sigue avisando el motivo inmediatamente por sello. Sellos únicos conservan un acuse y una aprobación. No se agrupan ni eliminan decisiones/historial por sello.

Migración 0010 elimina pendientes parciales antiguos y consolida pendientes mixtos de recepción/aprobación; no altera ENVIADO ni manda correos durante migración. Los ya enviados no se pueden retirar. `after` de carga/revisión se programa solo si se creó un aviso, reduciendo consultas innecesarias; cron mantiene recuperación de pendientes.

Botones de correo centrados, PNG inline derivados de SVG estáticos. El movimiento de las ilustraciones y del SVG de cierre se eliminó; no enviar GIF animados. Card de pagos con cabecera/icono y borde coherente con entrega, permanece visible con confirmación al entregar.

Refresco sin setInterval: solo volver a pestaña/ventana, máximo uno/minuto, mientras visible y sin edición/cargas; las acciones propias siguen actualizando inmediatamente. Una ventana abandonada no consulta periódicamente ni mantiene Neon activo. Cambios de otro usuario se ven al volver/navegar/recargar, sin push realtime. Autorización siempre actual en servidor, sin cachear permisos. Pool Neon es WebSocket transitorio por petición para auth/tx, cerrado al terminar; las lecturas de pantalla son HTTP. Reconciliación de permisos Drive en cambios de autorizados y cron, sin consultas/Google extra al renderizar cada detalle.

Revisión manual: mixto, adjuntar un sello: sin aviso; adjuntar el otro: un acuse. Aprobar el primero: sin correo; aprobar ambos: una confirmación. Rechazar/re-subir conserva el otro pago y avisa el motivo. Único: un acuse y una aprobación. Revisar card de pagos e imágenes estáticas/botones centrados del próximo correo. Cambiar de ventana tras un minuto: datos actualizados; dejarla quieta: sin solicitudes cada 35s. Bandeja sin He participado.

Comprobaciones finales del cambio: migración 0010 aplicada en Neon; lint, tipos y build correctos. Sin correo real ni cambios de revisión/stock/pedidos para comprobar implementación. Revisión de agrupación en operaciones autorizadas y recepción PNG/PDF en Vercel pendientes.

Actualización manual: icono en las tres cabeceras de pedidos; title/aria-label y aviso accesible mientras actualiza. Usa router.refresh, conserva scroll y los estados de cliente que no cambian, con controles bloqueados durante la petición. Se deshabilita si hay carga, decisiones de pago, datos de despacho o nota en edición; comprobar de nuevo DOM al pulsar para cubrir cambios aún no observados. El observador DOM no consulta Neon. Cerrados permiten actualización manual, sin auto-focus refresh. Revisión: pulsar icono en seguimiento/bandeja/detalle, sin recarga completa; escribir una nota o iniciar archivo y comprobar bloqueo hasta finalizar o limpiar; verificar scroll/filtros.

Comprobación del botón: lint y tipos correctos. Revisión visual/manual pendiente en seguimiento, bandeja y detalle; no se crearon datos ni se enviaron correos.

## Ubicación de biblioteca y evidencia de recojo

Campus incluye ubicación interna opcional (library_location, 200 caracteres) además de la dirección postal. CRUD valida en cliente/servidor, sin valores de pabellón inventados. Selección y confirmación de entrega muestran biblioteca/dirección/ubicación. Nuevos pedidos guardan delivery_library_location y delivery_map_url como snapshot; legacy sin snapshot usa campus vigente, sin modificar la dirección histórica. Al registrar salida/listo para recojo se fija esa ubicación en pedido y payload de aviso.

Correo de envío/listo para recojo incluye dirección, ubicación interna si aplica y enlace Google Maps. No insertar iframe/script en email; Maps URLs no requiere API key. Coordenadas del campus se prefieren si están configuradas; búsqueda por dirección si no. Ver [Google Maps URLs](https://developers.google.com/maps/documentation/urls/get-started). No integrar Maps Static API ni activar facturación para un mapa de correo.

Recojo en la etapa Entrega: imagen opcional JPG/PNG, máximo 3 MiB, solo gestor asignado en DESPACHADO. No solicita foto al marcar listo ni en delivery a domicilio. Tabla pickup_evidence separada de comprobantes financieros, con actor/fechas y estado de intención/carga/confirmación. UUID persistido y hash de contenido reutilizan ID Drive reservado en reintentos; validación de firma MIME, tipo y tamaño. Límite de cinco intenciones por pedido. Google fuera de las transacciones de negocio; antes y después se verifica autorización/gestor/versión/estado.

La foto se carga automáticamente a Drive al seleccionarla, antes del cierre. Fallo de subida/BD conserva intención e imagen seleccionada, no marca entrega ni genera su aviso. Es posible retirar la foto y confirmar sin evidencia. El cierre registra confirmed_at, estado/fecha, historial y outbox en una transacción. Archivo privado con permisos de carpeta, link directo en detalle administrativo; no aparece ni se adjunta al correo del comprador. Conflictos concurrentes pueden dejar intención pendiente recuperable con el mismo ID, no un archivo nuevo; no eliminar evidencia automáticamente.

Migración 0011 agrega campos de ubicación y pickup_evidence. No se rellenaron pabellones, no se cambiaron estados ni se subieron fotos reales para validar. Bandeja se filtra con select junto a Estado; conserva URL, búsqueda/paginación y elimina consulta de contadores de tabs.

Revisión manual: editar un campus y añadir “Pabellón F, segundo piso”; comprobar selección/confirmación, detalle/seguimiento y próximo aviso listo para recojo con link Maps. Cambiar coordenadas cuando se requiera precisión. Usar select de bandeja con Estado y buscar. Confirmar un recojo autorizado sin imagen y otro con JPG/PNG válido; foto visible únicamente al gestor en Drive. Tipo/tamaño inválido bloquea, fallo de carga permite reintentar sin duplicar; otro gestor/no autorizado no puede cerrar/adjuntar. Verificar que confirmar con imagen no genera dos avisos de entrega.

Comprobaciones del ajuste: migración 0011 aplicada en Neon; lint, tipos y build correctos. Sin pabellones inventados, fotos/usuarios/pedidos ficticios, ni envío real de correos para validar. Quedan las revisiones visuales y de cierre/Drive/correo descritas arriba, con operaciones autorizadas.

## Corrección de cola, sesión y evidencia

Diagnóstico real: pedido 8-2026 (solo Universidad), inicial ENVIADO y cabeceras verificadas; recibo/aprobación/despacho/entrega PENDIENTE, cero intentos y lease vencido. No falló la condición de sello único: los cuatro eventos estaban creados. Usuario indicó que eran pruebas y pidió no enviarlos; se eliminaron exclusivamente esos avisos no ENVIADO y el lease vencido de ese pedido, sin enviar correo. Los correos operativos son automáticos, incluidos reintentos, y no requieren autorización adicional por mensaje.

El sender drena hasta veinte eventos dentro del presupuesto; libera lease en transacción y comprueba nuevos eventos elegibles antes de retornar. Puede iniciar hasta tres pasadas dentro de sesenta segundos para cubrir la carrera cola vacía→nuevo evento concurrente. Mantiene exclusión y cooldown/intent limits, sin reenviar registros ENVIADO. El cron sigue necesario para recuperar un proceso interrumpido/HMR/reinicio; Next dev no ejecuta el cron Vercel localmente. No se puede deducir de la fila qué interrupción exacta dejó el lease vencido.

Tres sesiones revisadas: todas vigentes, ninguna expirada. Autorización se vuelve a consultar por petición. Se detectó redirección a login por UNAVAILABLE (fallo temporal), que podía parecer logout. Ahora proxy devuelve 503 con reintento, sin borrar cookies; error boundaries permiten recuperar lecturas. Sesión activa se renueva al día mediante proxy y headers Set-Cookie reales, conservando duración de siete días y deshabilitando cookie cache. En RSC/actions la lectura sigue sin refresh y sin cachear autorizados. Revocaciones y sesiones ausentes/vencidas siguen denegadas. No afirmar que esa fue la causa exacta del incidente informado sin sus trazas.

Evidencia de recojo se selecciona con FilePond (un JPG/PNG, 3 MB, tipo/tamaño, sin preview/créditos). onaddfile entrega un File real y UUID, errores bloquean cierre hasta retirar/corregir; process automático por Server Action independiente. Se sube automáticamente al seleccionar, conservando archivo/ID al fallar; el cierre recibe solo el ID de evidencia ya registrada. FilePond se carga con dynamic ssr:false.

UI y correo usan Distribución; EN_PREPARACION permanece interno por compatibilidad. Plazos courier aproximados desde el despacho: Lima/Callao tres días hábiles, provincia cinco; wizard, confirmación, seguimiento y correo de envío, sin asignar plazos a recojo. Historial administrativo y avances públicos con altura máxima, scroll/teclado y overscroll contenido.

Revisión: pedido único operativo recibe inicial, acuse, aprobación, salida y entrega en un hilo; mixto mantiene recepción/aprobación agrupadas. Foto de recojo válida/errónea/reintento sin duplicar. Courier muestra plazo según zona. Historial largo desplaza dentro de la card. Simular indisponibilidad solo en entorno de revisión: reintento sin cerrar sesión; expiración/revocación deniega. No reenviar avisos de pruebas descartados.

Recuperación adicional al consultar seguimiento/detalle: after comprueba la cola de ese pedido y recupera avisos elegibles si el lease venció, sin crear eventos ni reenviar ENVIADO. Solo al visitar/actualizar, sin polling. Cooldown de recuperación y de metadata fallida; cron mantiene la recuperación aunque no se abra el pedido. Funciona también en desarrollo, donde Vercel Cron no se ejecuta. La comprobación va en la página, no en getTrackedOrder (que permanece lectura sin efectos para diagnósticos/mailer).

Comprobaciones del ajuste: lectura real de outbox y sesiones, descarte solicitado de cuatro avisos 8-2026 sin enviar mensajes; lint, tipos y build correctos. Sin correo de prueba, nuevas identidades, pedidos ficticios ni alteración de pagos/entrega. Revisión funcional de FilePond, renovación de cookies, reintento de disponibilidad y próximas transiciones operativas queda en los pasos manuales anteriores.

## Foto automática y botones breves

FilePond procesa un JPG/PNG al seleccionarlo mediante uploadPickupEvidenceAction. Zod valida archivo/metadata; sesión, autorización, gestor, versión, estado e idempotencia se verifican antes de Drive. La subida no modifica estado ni updated_at del pedido, no revalida la ruta a mitad de procesamiento y no envía correo. Error conserva archivo/UUID para reintentar; carga/errores bloquean cerrar hasta terminar o retirar. UI breve: “Foto del recojo (opcional)”, tipos/límite y “Imagen adjunta.” tras éxito.

Evidencias con uploaded_at aparecen inmediatamente al recargar detalle, aunque confirmed_at siga vacío; inicializan el acuse y el evidenceId del cierre. La fotografía queda privada. dispatchOrderAction valida ID, pertenencia al pedido y archivo listo; gestor asignado confirma con la foto existente, conservando actor de subida aunque el gestor haya cambiado. Asociación/confirmed_at, entrega/historial/aviso se confirman en la misma transacción, sin llamadas Google ni bytes de imagen desde ese botón. También es válido cerrar sin foto.

Correo inicial: “Pagar y seguir mi pedido”. Actualizaciones: “Ver seguimiento”. Botones centrados y sin número/estado largo; identificador permanece en asunto y cabecera, enlaces por evento y threading se conservan.

Revisión: adjuntar foto en recojo DESPACHADO sin pulsar entrega; debe existir en Drive y mostrar acuse, mientras el pedido sigue DESPACHADO y no hay correo nuevo. Recargar: foto registrada y acuse siguen disponibles. Confirmar: una entrega/aviso, sin segunda subida. Fallar/reintentar usa el mismo archivo. Revisar el próximo correo inicial/actualización y sus botones breves.

Comprobaciones: lint, tipos y build correctos; sin migración adicional, subida de fotos ficticias ni envío de correo para validar. Revisión funcional de carga automática, recarga/acuse y cierre con evidencia pendiente en navegador mediante operaciones autorizadas.
