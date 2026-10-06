<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Contexto del proyecto

Sistema de pedidos del Fondo Editorial Continental: Next.js en Vercel, integrado en WordPress con iframe responsivo. Consultar [docs/proyecto.md](docs/proyecto.md) para requisitos completos, [docs/fases.md](docs/fases.md) para estado/entregas y [docs/desarrollo.md](docs/desarrollo.md) para estructura/configuración.

## Instrucciones vigentes

- Exclusivamente pnpm; conservar su lockfile. TS estricto, Next App Router y Server Actions.
- Nunca hacer commits en `main`. Una rama por fase. Al cerrar, entregar pasos de revisión manual y detenerse hasta aprobación explícita antes de integrar o seguir.
- Código de las seis fases validado por el usuario e integrado en `main`, publicado en GitHub. Ramas de fases integradas eliminadas. El usuario realizará la publicación Vercel/WordPress y luego aportará URLs; cierre operativo de fase 6 pendiente. Wizard `/pedido`, DEMO protegido `/admin/vista-previa`. No afirmar despliegue ni revisión de PDF/Drive/Gmail en Vercel todavía. Consultar docs/fases.md antes de continuar.
- Catálogo oficial pendiente. Seed DEMO opcional (`pnpm db:seed:demo`), inactivo e idempotente; no sustituir datos operativos ni inventar catálogo de producción. Importes BD `numeric(12,2)` como strings; cálculo posterior en céntimos.
- No crear ni ejecutar suites de pruebas automatizadas, ni instalar frameworks de testing, salvo nueva petición explícita. El usuario pidió eliminarlas: no restaurar requisitos anteriores de tests.
- Completar los cambios solicitados antes de validar. Comprobaciones de lint, tipos o build solo puntuales cuando hagan falta, sin repetirlas innecesariamente.
- Mantener código, migraciones y utilidades en `src`. Configuración de herramientas en raíz solo por convención necesaria. No crear `CLAUDE.md`.
- UI sin landing, logos ni contenido corporativo: WordPress proporciona ese contexto.
- Inter por defecto, tema claro fijo, fondo blanco y principal `#6802C1`. Usar frontend-design respetando estas preferencias sobre sus sugerencias genéricas.
- No eliminar nombres de sellos/cuentas/correos que sean datos operativos necesarios.
- No versionar secretos ni añadir bypasses de autenticación. Validar cada Server Action con Zod y comprobar autorización en el servidor.
- Acceso en tabla `authorized_emails`, no solo env. Google OAuth mediante better-auth y Drizzle; tablas auth generadas por CLI, no a mano.
- Maestro: `distribucionfe@continental.edu.pe`. Solo él añade/quita correos y no puede eliminarse desde la aplicación. Todos los demás autorizados tienen iguales funciones operativas y pueden consultar la lista.
- Revocar autorización y sesiones atómicamente. No confiar en UI, presencia de cookies ni caché de permisos.
- Compra/seguimiento conservan el acuerdo de rutas públicas; administración protegida. No cambiar permisos como parte de un ajuste visual.

## Orden de fases

1. `feat/01-auth-y-google`: completada e integrada; acceso y configuración en `/admin/configuracion`.
2. `feat/02-schema-y-seed`: completada e integrada; esquema y seed DEMO en Neon.
3. `feat/03-wizard-frontend`: publicaciones → comprador → entrega → confirmación, Zod y precios/flete dinámicos.
4. `feat/04-pedidos-pagos-drive`: creación transaccional, numeración anual/stock, tracking, FilePond, Drive/Gmail y PDFs.
5. `feat/05-admin-dashboard`: pedidos/filtros, pagos independientes por sello, despacho e inventario CRUD.
6. `feat/06-iframe-wp-polish`: CSP frame-ancestors, altura postMessage, variables completas y revisión manual de embebido/Vercel.

## Invariantes de negocio

- Sellos Universidad e Instituto Continental con cuentas propias. Tipo derivado del carrito: `solo_universidad`, `solo_instituto`, `mixto`.
- Mixto: dos depósitos; flete solo en Universidad si delivery. Recojo S/0, Lima/Callao S/15, provincia S/25 con departamento/ciudad. Recojo muestra biblioteca del campus.
- Comunidad: sede y correo `@continental.edu.pe`, precio comunidad; público: precio estándar. Recalcular en comprador y creación server-side; nunca confiar en precios del cliente.
- Pagos por sello independientes; sello no aplicable empieza en `NO_APLICA`. `EN_PREPARACION` solo con todos los pagos requeridos verificados. Rechazo/re-subida conserva el otro sello.
- Una zona FilePond por sello aplicable (dos en mixtos), carga automática sin selector; validación tipo/tamaño, sin vista previa. Cargar pasa directamente ese pago a EN_REVISION y avisa por correo, sin confirmar.
- Validación de stock y pedido/items en una transacción; falta de stock aborta todo.
- Número `secuencial-año`, contador por año con lock transaccional, sin serial global. Tracking nanoid >=24, único/indexado.
- Comprobantes privados, enlaces directos Drive solo en administración. Sin visor/proxy local. Sincronizar lectores nominados de la carpeta con authorized_emails, registrar ACL en drive_reader_grants y retirar permisos gestionados al revocar. No mostrar archivos/nombres al comprador tras la carga. No imprimir objetos de error Google/Drizzle ni credenciales/payload en logs.
- Drive/Gmail: cuenta propietaria con refresh token; try/catch y un reintento sin perder la carga. MIME HTML + PDF según tipo; PDFs en `src/assets/pdfs`, fuera de public. Revisar adjunto en Vercel.
- Campus dinámicos en BD (`campuses`), CRUD en `/admin/configuracion` por cualquier autorizado; solo el maestro gestiona correos. Ocho iniciales sembrados una vez por migración. Inactivos fuera del wizard; pedidos asociados impiden borrado. Coordenadas/URL de mapa editables por interfaz. No inventar coordenadas.
- Ubigeo local nacional en `src/data/ubigeo`: departamento/provincia/distrito, zona derivada de provincia `1501`/`0701` para Lima/Callao. Costos solo en resumen. Precio único aplicado, sin portada/comparación de tarifas; sellos en badges sin prefijo.
- Quien recibe/recoge: comprador actual u otra persona (nombres, DNI, teléfono), con validación Zod y derivación server-side en fase 4.
- No X-Frame-Options contradictorio con CSP del iframe.

## Estructura principal

`src/app`: rutas/acciones; `src/components`: interfaz; `src/db`: conexión, esquemas, configuración CLI, seed y `migrations`; `src/lib`: acceso/integraciones; `src/proxy.ts`: protección administrativa; `docs`: contexto persistente.

## Context7

Usar Context7 para documentación vigente de librerías, frameworks, SDKs, APIs, CLIs y servicios cloud, incluso los conocidos. Resolver primero el ID con `resolve-library-id` salvo ID exacto dado por el usuario; elegir el mejor match por nombre/relevancia/reputación y consultar `query-docs` por concepto. Preferirlo a búsqueda web. No es necesario para refactorización, scripts propios, lógica de negocio, revisión de código ni conceptos generales.

## Contrato de fase 4

- Creación real solo con cuentas activas de ambos sellos en BD, Google propietario, APP_URL y tres PDF. `/admin/configuracion` gestiona cuentas; las cuentas operativas se completan/activan desde BD por interfaz, sin inventar datos. PDF se selecciona por nombre/tipo; usuario acepta temporalmente Universidad/Mixto idénticos y los reemplazará.
- UUID de intento único, hash y locks: reintento no duplica pedido/stock. Snapshot de título/cuentas/consentimiento. Numeración por año de Lima desde BD.
- Tracking nanoid 32, privado por token; no referrer/no-store. FilePond 3 MiB por archivo, zona por sello aplicable y asociación fija, carga automática a Drive y revisión inmediata, sin confirmación del comprador. Intentos persistidos con ID Drive reservado; no quitar archivo si hay error.
- Correo en outbox persistente con after inmediato y reintento automático protegido por CRON_SECRET; fallo no borra pedido. Avisos de comprobantes, asignación, pagos, envío y entrega en el mismo hilo; comprador, copia al maestro y Bcc al gestor vigente autorizado. Gmail metadata propietario obligatorio para obtener Message-ID/Subject/threadId reales. Sin pruebas automatizadas. Validación real Google/PDF en Vercel pendiente de configuración. [Detalle vigente](docs/pedidos-pagos.md).

## Contrato de fase 5

- Pedidos en `/admin/pedidos`, detalle por UUID; inventario en `/admin/inventario` como tabla con edición y alta inline; borrado con diálogo breve de confirmación; configuración en `/admin/configuracion` con pestañas de correos, campus, cuentas e integraciones. Cualquier autorizado consulta/toma pedidos disponibles; solo el asignado registra pagos/estados. Todos operan inventario.
- Aprobar/rechazar solo pagos `EN_REVISION` de pedidos `PENDIENTE_PAGO`, con comprobante más reciente del sello. Lock del pedido y control de versión evitan revisión obsoleta; conservar el otro sello. Distribución solo con todos los requeridos verificados.
- Autoasignación con lock e historial por actor; revocación libera pedidos abiertos. Bandejas Todos/Mis pedidos/Por asignar.
- Despacho desde distribución, courier obligatorio para delivery; guía/URL HTTPS opcionales, fecha y aviso al comprador; recojo usa despacho como listo en biblioteca. Entrega solo desde despacho. No añadir cancelación/reposición de stock sin definir ese flujo.
- Stock absoluto editable con lock y versión; una compra concurrente obliga a recargar. Precios/títulos de pedidos conservan snapshots. No eliminar publicaciones con pedidos ni cambiarles sello; permitir desactivar. DEMO sigue fuera de compra real.
- Migración 0006 de fase 5: recibo sometido por sello, threadId/Message-ID del correo y outbox de avisos. Contrato y revisión manual en [docs/admin-dashboard.md](docs/admin-dashboard.md).

## Contrato de fase 6

- WORDPRESS_ORIGINS: orígenes exactos validados con Zod, HTTPS salvo loopback local, sin comodines/rutas. CSP frame-ancestors y postMessage usan la misma lista; vacío solo mismo origen. No emitir X-Frame-Options.
- Puente de altura mide #app-content con ResizeObserver/rAF y protocolo versionado. Comprueba origen/source en ambos extremos; targetOrigin exacto. No comunicar datos personales, URLs ni tokens al padre.
- Bloque/simulador en src/iframe; pnpm iframe:preview y pnpm iframe:snippet. Utilidades de revisión, no suites automatizadas ni rutas bypass.
- Incrustar /pedido. Google OAuth administrativo en pestaña independiente; conservar cookies/permisos. Vercel con pnpm/Corepack, variables de .env.example, PDFs tracing y migraciones fuera del build.
- Dominios/proyecto Vercel/WordPress definitivos pendientes de aportar. No inferirlos ni publicar con datos de ejemplo. Contrato/entrega: [docs/iframe-wordpress.md](docs/iframe-wordpress.md).

## Flujo vigente de atención y comunicación

Ver [docs/atencion-y-comunicacion.md](docs/atencion-y-comunicacion.md): sustituye confirmación manual y atención sin responsable. Migración 0007 aplicada en Neon. Cada estado/gestor queda auditado; correo serializado por pedido con cabeceras reales verificadas (gmail.metadata), sin reenviar correos aceptados por fallos de metadata. Dos conversaciones existentes reparadas sin envío.

- Lecturas de pantalla paralelas por Neon HTTP (`withReadDatabase`); Pool para auth/tx. Nunca reintentar callbacks de mutación. No propagar ErrorEvent ni error de driver con SQL/params como causa hacia RSC; normalizar y registrar solo códigos seguros.

- Sin cards de avisos/comunicación ni reintento manual. Cambios de estado/verificación disparan correos automáticamente; cron diario Vercel como recuperación de pendientes, con CRON_SECRET obligatorio. Los avisos operativos y sus reintentos son automáticos, sin aprobación adicional.
- Email inicial compacto: sello/importes aplicables y guía PDF; sin repetir compra/dirección/cuentas. Botón del correo inicial después de los importes; actualizaciones con CTA específico al inicio, enlace distinto por evento y asunto/referencias estables para threading. Gmail controla el colapso de contenido: no prometer eliminarlo completamente.

- Seguimiento sin identidad del gestor ni eventos de asignación/liberación; mantener identidad/auditoría en administración. No emitir correo ASIGNADO. Migración 0009 retira únicamente avisos de asignación no enviados.
- FilePond sin preview ni plugin de preview, ocultar carga al terminar el lote completo; EN_REVISION muestra solo acuse, reaparece si RECHAZADO. No desmontar otras cargas en mixtos; conservar seleccionados/errores. Refrescar desde cliente tras completar, sin revalidatePath en la acción de subida.
- Entregado: cierre visual con SVG propio estático. Datos de envío/recojo en una sola card. Historial en sidebar derecho tanto en seguimiento como en administración.

- Notas internas: eventos NOTA_INTERNA en order_activity, append-only con autor/fecha desde sesión. Cualquier autorizado puede añadir comentarios, incluso en pedidos cerrados; no modifica estado, stock, versión ni dispara correo. Zod 3–2000 caracteres, autorización vigente en transacción. Consulta pública de actividad con allowlist explícita; jamás incluir notas internas en tracking/correos.
- Wizard de gestión compacto: barra de etapas, revisión en grids, pagos mixtos en dos columnas y comprobante más reciente destacado, despacho junto a datos, notas debajo. Reglas de gestor/estado/versiones siguen vigentes.
- Correos: SVG propios estáticos y PNG derivados en src/assets/email para Gmail, inline CID con multipart/related y PDF en multipart/mixed. pnpm email:assets regenera; sharp solo dev, sin procesamiento al enviar. Tracing Vercel incluye PNG/PDF; botones centrados, sin animaciones.

- Mixtos: un acuse solo cuando ambos sellos tienen comprobante en revisión/verificado; una confirmación de pago solo cuando ambos están verificados. Rechazos siguen siendo inmediatos por sello. Historial/estados por sello independientes. payload.scope=pedido identifica avisos agrupados, sin alterar restricciones de receipt_id/sello. Migración 0010 reconcilia avisos pendientes previos sin tocar ENVIADO ni enviar correo.
- Sin polling de 35s: refresco al retornar a ventana/pestaña, limitado a uno/minuto, solo visible y sin formularios/archivos en edición. Mutaciones propias refrescan al finalizar. No websocket/realtime navegador-servidor; HTTP en lecturas, Pool WebSocket transitorio en auth/tx. No cachear autorización. Sincronización ACL Drive al cambiar autorizados y en cron, no al abrir cada detalle.
- Card de pagos coherente con entrega: borde/cabecera/icono, contenido interior y confirmaciones persistentes en todos los estados. Ilustraciones SVG web y correo sin movimiento.

- Botón de actualización manual (icono estático) en cabecera de seguimiento, bandeja y detalle administrativo. router.refresh sin reload/documento, pending deshabilita clicks y se bloquea con data-order-editing para no perder notas/archivos/decisiones/borradores. Observador DOM local, sin polling/consultas de fondo. Actualización manual también en cerrados, aunque foco automático termina al cerrar.

- Campus: library_location opcional (máx. 200), editable por CRUD, sin inventar pabellones. Visible en selección/confirmación, seguimiento, detalle admin y correo listo para recojo. Pedidos nuevos guardan snapshot de ubicación interna y enlace Maps; legacy usa campus vigente mientras no tenga snapshot. Dirección postal separada del pabellón. Email sin iframe: dirección + ubicación + enlace Maps URLs sin API key.
- Bandeja Todos/Por asignar/Mis pedidos como select junto a Estado, sin botones/tabs ni consulta adicional de contadores de bandeja.
- Recojo: imagen JPG/PNG opcional de hasta 3 MiB al confirmar ENTREGA, únicamente gestor asignado en DESPACHADO. Tabla pickup_evidence con UUID de intento, hash, ID Drive reservado, actor/fechas; reintento reutiliza archivo, Google fuera de lock. Foto privada solo admin, sin consultar/enviar al comprador. Selección fallida permanece y bloquea refresco. La foto se carga automáticamente al seleccionar, sin cerrar ni enviar correo. Cierre transaccional confirma evidencia ya cargada + estado + historial + aviso; sin foto sigue permitido. Migración 0011 aplicada.

- Usuario ratifica automatización del correo: no pedir autorización por avisos de cargas/estados ni por su recuperación automática. Avisos pendientes no equivalen a aprobación humana. Pedidos de prueba identificados por el usuario no deben reenviarse; se descartaron cuatro avisos no enviados de 8-2026 a petición expresa.
- Mail: lease serial, hasta veinte eventos por pasada/presupuesto 60s; al liberar comprobar cola y continuar si hubo un evento concurrente, sin perder el aviso ni reenviar ENVIADO. Cron recupera interrupciones/restarts; en desarrollo no hay scheduler Vercel activo. No inventar pedidos ni enviar mensajes ficticios para validar.
- Sesión: 7 días con renovación por proxy a partir de updateAge 24h y Set-Cookie reenviada. RSC/actions leen sin refresh y validan BD/autorizados. Fallo temporal devuelve 503/reintento, no redirección login ni borrado de cookies. Vencida/no autorizada conserva denegación. No afirmar causa exacta de cierre anterior sin trazas; tres sesiones revisadas estaban vigentes.
- Evidencia recojo usa FilePond JPG/PNG, tipo/tamaño, sin preview/créditos y process automático mediante Server Action independiente, UUID persistente del archivo; el botón de entrega solo confirma el estado y asocia la evidencia ya guardada. Distribución es el término UI; conservar EN_PREPARACION interno. Courier aproximado desde despacho: Lima/Callao 3 días hábiles, provincia 5; visible en wizard/confirmación/seguimiento/correo de envío. Historial/avances con max-height y scroll accesible.

- Seguimiento/detalle programan recuperación automática del outbox en after al consultarlos, solo si hay pendientes elegibles y lease vencido; cooldown y límites de intento. Sin polling ni creación de correos, sin reenviar ENVIADO ni pruebas descartadas. getTrackedOrder sigue lectura sin efectos. Falla metadata actualiza lastAttemptAt para no repetir consultas Google con cada visita.

- Evidencia opcional de recojo: FilePond sube al seleccionar y muestra solo “Imagen adjunta.” al terminar. Una carga exitosa aparece en admin y persiste al recargar antes de finalizar entrega; no tocar versión/estado ni enviar correo por foto. Cierre recibe evidenceId (Zod), comprueba pedido/imagen lista y gestor actual; conserva autor original si cambió gestor. Sin bytes/Google en dispatchOrderAction. Botones de correo sin número de pedido: “Pagar y seguir mi pedido” y “Ver seguimiento”; asunto/cabecera/referencias conservan identificación.

- Dominios reales confirmados: app https://modulo-gestor-pedidos.vercel.app, WordPress https://fondoeditorial.continental.edu.pe/pedido/. WORDPRESS_ORIGINS solo https://fondoeditorial.continental.edu.pe; APP_URL/BETTER_AUTH_URL origen Vercel. Instrucciones exactas docs/despliegue-produccion.md y bloque src/iframe/wordpress-pedido.html. Ambos HTTP 200; CSP actual self impide iframe hasta configurar/redeploy. Sin credenciales de consola para cambiar env/Google Cloud automáticamente.

- /admin redirige a /admin/pedidos. Configuración en /admin/configuracion, alias /admin/configuración; navegación y revalidaciones apuntan a esa página. Administración se recomienda en ventana propia Vercel; no relajar cookies/permisos para incrustarla en WordPress.
- Correos sin ?aviso. Seguimiento del comprador enlaza a WordPress /pedido/#seguimiento/TOKEN; receptor valida token nanoid32 y abre iframe Vercel /seguimiento/TOKEN, sin URLs arbitrarias. En despliegue confirmado usa esa página por defecto; WORDPRESS_ORDER_URL permite sobreescribir para otros entornos. APP_URL/BETTER_AUTH_URL siguen Vercel. No enviar token mediante postMessage ni fabricar correos/pedidos de prueba.
- Bridge usa dependencia estable de orígenes por valor (RSC refresh no reinicia), mensaje ready→init para reconectar/hidratación lenta y ResizeObserver para alturas. Overflow vertical del documento iframe se desactiva solo tras handshake válido; historial mantiene scroll propio. Public-order-surface ocupa todo el ancho del bloque padre sin max-width/gutters duplicados al incrustar. Reemplazar bloque WP por src/iframe/wordpress-pedido.html actualizado.
- /pedido tiene encabezado funcional sin logos ni landing; títulos del paso h2. Ilustraciones de correo SVG/PNG estáticas con alpha real, sin fondo/placas blancas; recortes por máscara para símbolos superpuestos. Números en asunto/cabecera se conservan para identificar hilo.
