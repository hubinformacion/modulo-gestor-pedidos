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
- Fase vigente: `feat/03-wizard-frontend`, implementada y pendiente de aprobación; lint, tipos y build correctos. Fases 1 y 2 aprobadas e integradas localmente en `main`. Wizard en `/pedido`; DEMO protegido en `/admin/vista-previa`. No integrar fase 3 ni iniciar fase 4 sin nueva aprobación.
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
- Una zona FilePond, múltiples comprobantes asociables a sello; validación tipo/tamaño y preview.
- Validación de stock y pedido/items en una transacción; falta de stock aborta todo.
- Número `secuencial-año`, contador por año con lock transaccional, sin serial global. Tracking nanoid >=24, único/indexado.
- Drive/Gmail: cuenta propietaria con refresh token; try/catch y un reintento sin perder la carga. MIME HTML + PDF según tipo; PDFs en `src/assets/pdfs`, fuera de public. Revisar adjunto en Vercel.
- Campus/direcciones reales en `src/config/fulfillment.ts`; recojo siempre en biblioteca. Mapas embebidos por dirección con `coordinates` o `googleMapsEmbedUrl` opcionales para precisión. No inventar coordenadas.
- No X-Frame-Options contradictorio con CSP del iframe.

## Estructura principal

`src/app`: rutas/acciones; `src/components`: interfaz; `src/db`: conexión, esquemas, configuración CLI, seed y `migrations`; `src/lib`: acceso/integraciones; `src/proxy.ts`: protección administrativa; `docs`: contexto persistente.

## Context7

Usar Context7 para documentación vigente de librerías, frameworks, SDKs, APIs, CLIs y servicios cloud, incluso los conocidos. Resolver primero el ID con `resolve-library-id` salvo ID exacto dado por el usuario; elegir el mejor match por nombre/relevancia/reputación y consultar `query-docs` por concepto. Preferirlo a búsqueda web. No es necesario para refactorización, scripts propios, lógica de negocio, revisión de código ni conceptos generales.
