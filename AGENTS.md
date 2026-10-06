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
- Fases 1–5 aprobadas e integradas localmente en `main`. Fase vigente: `feat/06-iframe-wp-polish`, implementada, pendiente de revisión/producción. Wizard en `/pedido`; DEMO protegido en `/admin/vista-previa`. No integrar fase 6 sin aprobación al cierre. Revisiones reales Google/PDF/Vercel de fase 4 siguen pendientes de configuración.
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

1. `feat/01-auth-y-google`: completada e integrada; acceso y configuración en `/admin`.
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
- Una zona FilePond por sello aplicable (dos en mixtos), carga automática sin selector; validación tipo/tamaño y preview. Cargar pasa directamente ese pago a EN_REVISION y avisa por correo, sin confirmar.
- Validación de stock y pedido/items en una transacción; falta de stock aborta todo.
- Número `secuencial-año`, contador por año con lock transaccional, sin serial global. Tracking nanoid >=24, único/indexado.
- Comprobantes: si Google prohíbe compartir públicamente, conservar privados y registrar; lectura desde /admin/comprobantes/[id] con sesión+correo en BD. No imprimir objetos de error Google/Drizzle ni credenciales/payload en logs.
- Drive/Gmail: cuenta propietaria con refresh token; try/catch y un reintento sin perder la carga. MIME HTML + PDF según tipo; PDFs en `src/assets/pdfs`, fuera de public. Revisar adjunto en Vercel.
- Campus dinámicos en BD (`campuses`), CRUD en `/admin` por cualquier autorizado; solo el maestro gestiona correos. Ocho iniciales sembrados una vez por migración. Inactivos fuera del wizard; pedidos asociados impiden borrado. Coordenadas/URL de mapa editables por interfaz. No inventar coordenadas.
- Ubigeo local nacional en `src/data/ubigeo`: departamento/provincia/distrito, zona derivada de provincia `1501`/`0701` para Lima/Callao. Costos solo en resumen. Precio único aplicado, sin portada/comparación de tarifas; sellos en badges sin prefijo.
- Quien recibe/recoge: comprador actual u otra persona (nombres, DNI, teléfono), con validación Zod y derivación server-side en fase 4.
- No X-Frame-Options contradictorio con CSP del iframe.

## Estructura principal

`src/app`: rutas/acciones; `src/components`: interfaz; `src/db`: conexión, esquemas, configuración CLI, seed y `migrations`; `src/lib`: acceso/integraciones; `src/proxy.ts`: protección administrativa; `docs`: contexto persistente.

## Context7

Usar Context7 para documentación vigente de librerías, frameworks, SDKs, APIs, CLIs y servicios cloud, incluso los conocidos. Resolver primero el ID con `resolve-library-id` salvo ID exacto dado por el usuario; elegir el mejor match por nombre/relevancia/reputación y consultar `query-docs` por concepto. Preferirlo a búsqueda web. No es necesario para refactorización, scripts propios, lógica de negocio, revisión de código ni conceptos generales.

## Contrato de fase 4

- Creación real solo con cuentas activas de ambos sellos en BD, Google propietario, APP_URL y tres PDF. `/admin` gestiona cuentas; las cuentas operativas se completan/activan desde BD por interfaz, sin inventar datos. PDF se selecciona por nombre/tipo; usuario acepta temporalmente Universidad/Mixto idénticos y los reemplazará.
- UUID de intento único, hash y locks: reintento no duplica pedido/stock. Snapshot de título/cuentas/consentimiento. Numeración por año de Lima desde BD.
- Tracking nanoid 32, privado por token; no referrer/no-store. FilePond 3 MiB por archivo, zona por sello aplicable y asociación fija, carga automática a Drive y revisión inmediata, sin confirmación del comprador. Intentos persistidos con ID Drive reservado; no quitar archivo si hay error.
- Correo en outbox persistente con after/reintento desde seguimiento; fallo no borra pedido. Avisos de comprobantes, asignación, pagos, envío y entrega en el mismo hilo; comprador, copia al maestro y Bcc al gestor vigente autorizado. Gmail metadata propietario obligatorio para obtener Message-ID/Subject/threadId reales. Sin pruebas automatizadas. Validación real Google/PDF en Vercel pendiente de configuración. [Detalle vigente](docs/pedidos-pagos.md).

## Contrato de fase 5

- Pedidos en `/admin/pedidos`, detalle por UUID; inventario en `/admin/inventario` como tabla con edición y alta inline; borrado con diálogo breve de confirmación; configuración en `/admin` con pestañas de correos, campus, cuentas e integraciones. Cualquier autorizado consulta/toma pedidos disponibles; solo el asignado registra pagos/estados. Todos operan inventario.
- Aprobar/rechazar solo pagos `EN_REVISION` de pedidos `PENDIENTE_PAGO`, con comprobante más reciente del sello. Lock del pedido y control de versión evitan revisión obsoleta; conservar el otro sello. Preparación solo con todos los requeridos verificados.
- Autoasignación con lock e historial por actor; revocación libera pedidos abiertos. Bandejas Mis pedidos/Por asignar/He participado.
- Despacho desde preparación, courier obligatorio para delivery; guía/URL HTTPS opcionales, fecha y aviso al comprador; recojo usa despacho como listo en biblioteca. Entrega solo desde despacho. No añadir cancelación/reposición de stock sin definir ese flujo.
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
