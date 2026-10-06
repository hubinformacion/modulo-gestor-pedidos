<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Proyecto y forma de trabajar

Gestor operativo del Fondo Editorial Continental. Next.js en Vercel, compra/seguimiento embebidos en WordPress. Producción: https://modulo-gestor-pedidos.vercel.app; WordPress: https://fondoeditorial.continental.edu.pe/pedido/. El usuario considera terminado el proyecto y autoriza ajustes menores directamente en main; no crear ramas de fases, planes ni documentación histórica. Cambios de mayor alcance pueden aislarse si hace falta. Conservar el historial y eliminar únicamente ramas ya integradas.

- Exclusivamente pnpm y su lockfile. TypeScript estricto, App Router y Server Actions.
- No crear/ejecutar suites automatizadas ni instalar frameworks de testing salvo nueva solicitud explícita. Completar cambios antes de comprobar; lint/tipos/build puntuales, sin repeticiones innecesarias.
- Código, utilidades, esquema y migraciones bajo src. Configuración raíz solo por convención de herramientas. No crear CLAUDE.md. README contiene instalación/operación; este archivo conserva contexto para agentes.
- No versionar secretos, no imprimir SQL/params/tokens/archivos ni objetos crudos de Google/Drizzle. No fabricar catálogo, cuentas, coordenadas ni pedidos/mensajes de prueba. No modificar datos operativos para comprobar cambios sin que la tarea lo requiera.
- Avisos operativos y recuperación automáticos, sin aprobación humana por mensaje. Nunca reenviar ENVIADO ni pruebas que el usuario haya pedido descartar. No afirmar que algo se comprobó en producción si solo se validó localmente.

## Context7 y Next

Para sintaxis/configuración/debug de librerías, SDK, API, CLI o servicios cloud, usar Context7: resolve-library-id primero, elegir match por nombre/relevancia/reputación y query-docs por concepto, con versión específica cuando corresponda. Preferirlo a web. No es necesario para refactorización, lógica de negocio, revisión ni scripts propios. Leer las guías pertinentes del Next instalado en node_modules/next/dist/docs antes de escribir código Next.

## Estructura y stack

- src/app: rutas/acciones. src/components: interfaz. src/db: esquema, conexión, seed maestro y migraciones. src/lib: acceso, validación y servicios.
- src/iframe: receptor, plantilla, generador y bloque WordPress. src/assets: PDF y SVG/PNG de correo. src/data/ubigeo: geografía nacional.
- Better Auth + Drizzle + Neon, Google OAuth; googleapis/google-auth-library para propietario Drive/Gmail; Base UI/shadcn, Tailwind, FilePond, Sileo, boneyard-js (no boneyard), nanoid y Zod.
- shadcn y sharp son herramientas de desarrollo. Sharp genera recursos locales, no durante envío. No hay simulador ni vista/seed DEMO de desarrollo; conservar filtros de seguridad para publicaciones históricas DEMO-% en BD.

## Rutas, UI e integración

- /pedido: publicaciones → comprador → entrega → confirmación; encabezado funcional sin landing/logos. /seguimiento/[token]: público mediante nanoid32, no-index/no-referrer/no-store.
- /admin redirige a /admin/pedidos. /admin/pedidos/[id] atiende; /admin/inventario edita en tabla; /admin/configuracion tiene pestañas de correos/campus/cuentas/integraciones. /admin/configuración es alias.
- Inter por defecto, tema claro fijo, blanco y principal #6802C1; sello Instituto #e4000b. Usar frontend-design para cambios visuales respetando estos criterios. Mantener nombres operativos de sellos/cuentas/correos.
- Catálogo sin portada/SKU/comparación de tarifas, badges de sello y un precio aplicado. Costos solo en resumen. Consentimiento único con política enlazada y texto aceptado; botón Enviar pedido. Historial y avances con altura máxima/scroll accesible.
- Distribución es el término visible; EN_PREPARACION sigue siendo el estado interno. Gestión guiada Atención/Pagos/Distribución/Entrega; filtros desplegables de bandeja y Estado. Inventario alta/edición inline, eliminación con diálogo.
- Iframe ocupa el contenedor WordPress completo. Bridge con ResizeObserver, orígenes por valor estables y ready→init→height; verificar origin/source, usar targetOrigin exacto, nunca enviar tokens/PII por postMessage. Overflow del documento hijo se desactiva solo tras handshake válido; scroll interno de historial permanece.
- CSP frame-ancestors usa WORDPRESS_ORIGINS, HTTPS salvo loopback, sin rutas/comodines. Sin X-Frame-Options contradictorio. No relajar auth/CORS/cookies para incrustar administración; usar pestaña propia de Vercel.
- Correos enlazan a WordPress /pedido/#seguimiento/TOKEN; receptor acepta solo nanoid32 y abre ruta del origen fijo del iframe. Sin ?aviso. WORDPRESS_ORDER_URL sobreescribe página en otros entornos; el dominio confirmado tiene default. APP_URL/BETTER_AUTH_URL siguen Vercel. Navegación directa de seguimiento con Sec-Fetch-Dest=document puede redirigir al padre; iframe/RSC no.
- Al cambiar receptor/protocolo, regenerar wordpress-pedido.html y recordar reemplazar el bloque WordPress. No afirmar que el bloque del sitio fue actualizado sin acceso/verificación.

## Autorización y sesiones

- Sin registro abierto. authorized_emails en BD es autoridad. Solo maestro distribucionfe@continental.edu.pe añade/quita; no se elimina desde UI. Los autorizados de rol gestor comparten funciones operativas y consultan la lista. Caja es un rol separado y limitado a un único sello.
- Proxy/páginas/acciones validan sesión vigente, email verificado y autorización BD; una cookie o UI no concede permiso. Zod en cliente y cada acción. Acciones sensibles comprueban autorización nuevamente dentro de la transacción.
- Revocación elimina sesiones y libera pedidos abiertos atómicamente; cerrados mantienen responsable e historial. Permisos Drive gestionados se retiran automáticamente con recuperación si falla Google.
- Sesión siete días, updateAge un día; solo proxy renueva y reenvía Set-Cookie. RSC/actions leen sin refresh. Error temporal devuelve 503/reintento, no falso logout ni borrado de cookies. Mantener denegación en expiración/revocación.
- Solo gestor asignado revisa pagos, despacha y confirma entrega. Autoasignación/versión/estado con lock evitan carreras. Identidad del actor viene de sesión, no cliente. No exponer nombre de gestor ni asignación/liberación al comprador; no enviar correo ASIGNADO.

## Invariantes de negocio y BD

- Sellos Universidad/Instituto con cuentas PEN propias. order_type deriva del carrito: solo_universidad/solo_instituto/mixto. Mixto exige dos depósitos; flete en Universidad solamente. Sello no aplicable empieza NO_APLICA.
- Comunidad exige campus y correo @continental.edu.pe, community_price; general standard_price. Recalcular desde catálogo servidor, nunca aceptar importes cliente. numeric(12,2) como strings; cálculos en céntimos.
- Recojo S/0 y biblioteca visible; Lima/Callao S/15, provincia S/25. Ubigeo deriva zona de provincias 1501/0701; departamento/provincia/distrito. Courier aproximado desde despacho: Lima/Callao tres días hábiles, provincia cinco.
- Receptor comprador u otra persona con nombre/DNI/teléfono, validación/derivación servidor.
- Creación, stock, items/outbox en una transacción; stock insuficiente aborta todo. Número secuencial-año, año Lima, contador por año bloqueado (sin serial global). UUID de intento/hash evitan duplicar pedido/stock.
- Pagos independientes. Solo EN_REVISION con comprobante reciente puede verificarse/rechazarse; motivo obligatorio de rechazo. Todos los requeridos VERIFICADO permiten EN_PREPARACION. Re-subida conserva el otro sello. Despacho desde distribución, courier obligatorio en delivery; recojo significa listo en biblioteca. Entrega solo tras despacho. No añadir cancelación/reposición sin política definida.
- Snapshots de título/precio, cuentas/guía/consentimiento/dirección y ubicación. Campus dinámicos (library_location opcional, coordenadas/mapa), inactivos fuera de compra; referencias de pedidos impiden borrado. Pedidos legacy sin ubicación interna pueden usar campus vigente antes de fijar snapshot.
- Notas internas append-only en order_activity NOTA_INTERNA, 3–2000 caracteres, autor/fecha; cualquier autorizado puede añadir incluso a cerrados. No altera estado/versión ni envía correo. Consulta pública de actividad usa allowlist explícita y excluye notas.
- No eliminar/editar migraciones aplicadas, snapshots ni journal; generar cambios nuevos y migrar fuera del build. Tablas Better Auth solo por CLI, no a mano. Seed solo maestro idempotente, sin libros ficticios. No borrar BD como limpieza de repositorio.

## Archivos y Google

- Una zona FilePond por sello (dos mixtos), múltiples PDF/JPG/PNG hasta 3 MiB; validación MIME/firma/tamaño y hash servidor, sin créditos/preview. Carga automática pasa ese sello a EN_REVISION. Al completar lote se oculta carga y queda acuse; vuelve para rechazo. No mostrar archivos/nombres al comprador.
- Intentos durables con ID Drive reservado, reintento reutiliza. Google fuera de locks, try/catch y un reintento. Fallo mantiene selección; no revalidar ruta a mitad del lote ni interrumpir el otro sello. Botón de actualizar bloqueado durante edición/carga.
- Foto opcional de recojo: JPG/PNG hasta 3 MiB, FilePond automático, pickup_evidence separado de pagos. Solo asignado en DESPACHADO sube, sin cambiar estado/versión ni enviar correo. ID/hash/actor/fechas persistidos; una carga lista aparece tras recargar antes de cierre. Confirmar entrega recibe evidenceId, valida pertenencia/lista y asocia en transacción con estado/historial/aviso. Conserva autor original, sin bytes/Google desde cierre. Privada solo administración.
- Carpeta Drive con lectores nominados de authorized_emails de rol gestor, sin permisos públicos. drive_reader_grants conserva revocaciones pendientes; sincronizar al gestionar autorizados y cron, no cada render. Enlaces directos Drive para gestor, sin visor/proxy local.
- Token propietario independiente del login, scopes drive/gmail.send/gmail.metadata. No añadir scopes de propietario a gestores. Credenciales solo env; conservar refresh token del mismo cliente si válido. External/Testing puede caducar a siete días.
- Gmail multipart/related HTML/texto + PNG transparente por CID único; PDF inicial dentro de multipart/mixed. SVG/PNG estáticos, fuente generate.ts; tracing incluye PNG/PDF fuera de public. Botones centrados y breves, número solo en asunto/cabecera.
- Guía según tipo, src/assets/pdfs/guia_pago_{universidad,instituto,mixta}.pdf, max 3 MiB/firma PDF. Pedidos conservan guía deduplicada por hash. Universidad/Mixto se aceptaron temporalmente idénticos por nombre; reemplazo de contenido lo decide responsable, no inventar guías/cuentas.

## Cola y recursos

- order_emails/order_notifications persistentes junto a transiciones. Solo un acuse cuando ambos pagos mixtos tienen recibo en revisión/verificado; una aprobación cuando ambos VERIFICADO. Únicos emiten acuse/aprobación normal; rechazos inmediatos por sello. No duplicar por archivos adicionales del ciclo.
- Guardar ENVIADO/API id antes de metadata; fallar cabeceras no reenvía aceptado. Subject, threadId, Message-ID/In-Reply-To/References reales verificados. No mover/reenviar mails históricos ni garantizar exactamente una entrega ante timeout ambiguo Gmail.
- Lease serial cinco minutos; hasta veinte eventos por pasada, presupuesto sesenta segundos y handoff al liberar, cooldown/límite de intentos. Cron protegido por CRON_SECRET (mínimo 32) recupera pendientes y ACL diariamente 12:00 UTC. También after al consultar seguimiento/detalle si cola elegible/lease vencido, sin nuevos eventos; getter getTrackedOrder sigue lectura sin efectos.
- Sin polling periódico del navegador. Mutaciones, retorno a pestaña limitado a una/minuto y botón manual actualizan; pausa durante borradores/archivos. Cerrados mantienen actualización manual. Driver HTTP para lecturas paralelas, Pool WebSocket por petición para auth/tx, cerrado al terminar. No reintentar callbacks de mutación.
- Normalizar errores de driver antes de RSC: no propagar ErrorEvent ni causas con SQL/payload. Logs solo códigos/etapas seguros. Free Neon depende de CU-horas/tiempo activo; no cachear autorización para ahorrar recursos.

## Caja: boletas y facturas

- Feature en rama propia antes de validación/merge, sin publicar ni aplicar cambios a datos operativos para simular pedidos. La migración 0012 añade permisos por rol sin convertir gestores existentes ni generar solicitudes históricas. Validar en BD separada: la versión anterior de producción no conoce el rol caja; nunca configurar sus correos en una BD compartida con esa versión.
- authorized_emails.role: gestor/caja, publisher_imprint obligatorio solo para caja; máximo una cuenta por sello. Maestro/propietario Google no pueden usarse como caja. Solo el maestro configura responsables en la pestaña Caja; sustitución/revocación cierra sesiones. No promover automáticamente un gestor existente a caja.
- Login Google mantiene scopes de identidad y callback /acceso decide /admin/pedidos o /caja. Proxy, consultas y acciones comprueban rol/BD; getAuthorizedSession es exclusivo de gestores y getCajaSession exclusivo de caja. Protección transaccional comparte lock de autorización con revocación y verifica sesión vigente. No confiar en sello recibido del cliente.
- /caja: bandeja paginada y filtrada por sello; /caja/[id]: datos de comprador/facturación, solo partidas/importes/comprobantes del sello y PDF de venta. Nunca inventario, notas, wizard logístico ni archivos del otro sello. Caja no recibe ACL de carpeta Drive: endpoint autenticado /caja/[id]/archivos/[fileId] resuelve IDs internos contra solicitud/sello; no IDs Drive arbitrarios ni enlaces públicos. Gestores conservan enlaces Drive directos.
- Verificar pago crea caja_requests y SOLICITUD en caja_notifications en la misma transacción, sin esperar otro sello. Sin responsable configurado conserva pendiente; no bloquea pago, distribución o entrega. No backfill ni emails de pedidos antiguos automáticos.
- PDF exclusivo, máximo 3 MiB, firma/hash servidor y FilePond automático sin preview/créditos. sale_documents guarda intento UUID/ID Drive reservado por solicitud/ciclo/autor/hash; reintento reutiliza, nuevo PDF crea revisión inmutable. Cargar solo actualiza borrador; no envía correo. No revalidar a mitad de carga.
- Finalizar exige caja del sello, PDF listo y borrador/version vigente. Guarda FINALIZADA, actor/fecha, historial interno y aviso a gestor en hilo de caja; idempotente para el mismo documento. PDFs no condicionan estado logístico. Gestor asignado puede devolver incluso tras entrega, con motivo obligatorio; nuevo ciclo limpia borrador y conserva documento anterior/historial.
- Todos los documentos requeridos FINALIZADA generan un lote inmutable sale_document_batches y DOCUMENTOS_VENTA en la cola del comprador. Mixtos: un único correo con los dos PDF, nunca uno por sello; únicos: un PDF. Correcciones producen otro lote con documentos vigentes, cuando todas vuelvan a estar finalizadas. Lotes obsoletos aún pendientes quedan OMITIDO; queries de recuperación excluyen ENVIADO/OMITIDO. Verificar firma/hash del contenido Drive antes de adjuntar.
- Hilos separados: comprador existente y uno interno por pedido/sello (mixto: tres conversaciones concretas). Internos solo caja correspondiente y copia maestro/gestor, nunca comprador ni otro sello. Cada hilo caja tiene lease/referencias/cabeceras Gmail reales, guardando ENVIADO antes de metadata; metadata fallida no reenvía. Actualizaciones de lease/cabeceras conservan updated_at para no invalidar borradores. Recuperación after/visitas/cron con cooldown/límite, sin polling ni botón de enviar correos.
