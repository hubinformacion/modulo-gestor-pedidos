# Gestor de pedidos · Fondo Editorial Continental

Aplicación para comprar publicaciones, validar depósitos, coordinar distribución y gestionar boletas/facturas con Tesorería Recaudación. Compra y seguimiento se integran en WordPress; los equipos internos usan la aplicación directamente.

**[Solicitar publicaciones](https://fondoeditorial.continental.edu.pe/pedido/)** · **[Fondo Editorial](https://modulo-gestor-pedidos.vercel.app/admin/pedidos)** · **[Tesorería Recaudación](https://modulo-gestor-pedidos.vercel.app/tesoreria-recaudacion)**

## Documentación

Empieza por [00 · Inicio](docs/00-inicio.md). La documentación está resumida en cinco archivos numerados: arquitectura, seguridad, operación/cierre y guía de uso. El [diagrama completo](docs/diagramas/01-arquitectura.png) está listo para Word, con [fuente SVG](docs/diagramas/01-arquitectura.svg) y leyenda. [AGENTS.md](AGENTS.md) conserva el contexto para futuras sesiones.

## Funciones principales

- Compra en cuatro pasos, precios comunidad/externos y descuentos por título; promociones y un cupón por compra sin acumulación. Cupones para todo el catálogo o títulos seleccionados.
- Stock y numeración anual transaccionales; creación idempotente y snapshots de compra.
- Pagos por unidad; mixtos con dos depósitos, carga automática y revisión independiente.
- Atención asignada, distribución, despacho/entrega, evidencia opcional y cancelación permitida según estado.
- Tesorería por una/ambas unidades: observaciones, subsanación, notas privadas, PDF como borrador y finalización; en mixtos un correo al comprador con ambos PDF.
- Inventario en tabla, configuración de campus/horarios/cuentas/accesos, tarifas de delivery, personal de apoyo para recojo, reportes e historial. Integraciones con comprobación manual de Google.
- Correos inmediatos en hilos separados por audiencia, sin cola ni reenvío posterior de fallos.

## Stack

Next.js App Router/Server Actions, React, TypeScript estricto, Tailwind y Base UI/shadcn. Better Auth/Google OAuth, Drizzle/PostgreSQL en Neon, Drive/Gmail, FilePond, Sileo, boneyard-js y Recharts. Versiones exactas en `package.json` y `pnpm-lock.yaml`.

## Instalación inicial

Requiere Node.js 24, pnpm 11.3.0 y una BD Neon destinada a la aplicación.

```bash
pnpm install --frozen-lockfile
cp .env.example .env.local
```

Completar las variables privadas y ejecutar:

```bash
pnpm db:setup
pnpm build
pnpm start
```

Para desarrollo local usar `pnpm dev`. `db:setup` instala un único esquema inicial sobre una BD vacía y ejecuta el seed en la misma transacción. En una BD compatible conserva la estructura/datos y siembra solo faltantes; ante diferencias aborta. No modifica automáticamente esquemas existentes ni llama a Google. Requiere permisos de instalación; el runtime debe usar un rol SQL restringido distinto. `DATABASE_SETUP_URL` permite una credencial temporal de instalación que no se debe desplegar al runtime.

Se conservan `schema.ts`, las tablas Better Auth generadas por CLI y un solo `src/db/schema.sql`. No hay historial de migraciones/snapshots de desarrollo ni comandos de borrado. **Un cambio de esquema con datos operativos requiere una actualización explícita y un respaldo**, fuera del build.

Para actualizar una instalación anterior con el flujo de apoyo para recojo, seguir el [procedimiento operativo](docs/03-operacion-y-cierre.md) y aplicar una sola vez `src/db/updates/20261020-pickup-support.sql` antes de desplegar. No ejecutar `db:setup` como migrador.

Las instalaciones anteriores a las tarifas editables requieren además `src/db/updates/20261021-delivery-rates.sql` antes de desplegar esa versión. Conserva los importes históricos.

## Datos iniciales

`pnpm db:seed` incorpora el maestro `distribucionfe@continental.edu.pe`, cuatro cuentas receptoras confirmadas y ocho campus con dirección, ubicación interna y coordenadas. Omite conflictos y conserva registros existentes; no crea libros, pedidos, identidades OAuth ni mensajes.

La fuente es [seed-data.ts](src/db/seed-data.ts). Los cambios por interfaz no se sincronizan automáticamente con ese archivo. Ver [datos iniciales](docs/03-operacion-y-cierre.md) para mantener configuración recuperable en nuevas instalaciones; un seed no reemplaza el respaldo operativo.

## Configuración y despliegue

Vercel instala/construye con pnpm; no ejecuta instalación de BD durante el build.

| Variable | Producción |
| --- | --- |
| `APP_URL`, `BETTER_AUTH_URL` | `https://modulo-gestor-pedidos.vercel.app` |
| `WORDPRESS_ORIGINS` | `https://fondoeditorial.continental.edu.pe` |
| `WORDPRESS_ORDER_URL` | `https://fondoeditorial.continental.edu.pe/pedido/` |
| `ENABLE_EXPERIMENTAL_COREPACK` | `1` |

Configurar además conexión SQL, secreto Better Auth y credenciales Google/cron según `.env.example`. No versionar valores privados ni ponerlos en WordPress.

Google: cliente Web, callback `<BETTER_AUTH_URL>/api/auth/callback/google`, Drive API y Gmail API habilitadas. Login usa identidad; token propietario independiente con scopes `drive`, `gmail.send` y `gmail.metadata`. Instrucciones de custodia/producción en [operación](docs/03-operacion-y-cierre.md).

`CRON_SECRET` mínimo 32 protege el cron diario de las 12:00 UTC, dedicado **solo a permisos privados de Drive**. No envía mensajes pendientes ni consulta Gmail para actualizar pantallas. No hay polling periódico del navegador.

Speed Insights está integrado con `@vercel/speed-insights` en el layout principal. Tras desplegar, revisar la pestaña **Speed Insights** del proyecto en Vercel y habilitar la opción incluida en el plan si aún no está activa; no contratar Plus automáticamente. Las métricas omiten parámetros, fragmentos y valores de tokens/IDs de las rutas. No consultan Neon ni añaden tareas programadas. Web Analytics (`@vercel/analytics`) registra visitas con el mismo filtro de privacidad; habilitarlo en **Analytics → Enable** del proyecto tras desplegar. No se envían eventos personalizados ni datos de formularios.

## WordPress y rutas

Copiar el bloque completo [wordpress-pedido.html](src/iframe/wordpress-pedido.html). Valida origen/source, ajusta altura y desplaza etapas con espacio para el header móvil. Tras cambiar el receptor, regenerar y reemplazar el bloque real:

```bash
pnpm iframe:snippet --url https://modulo-gestor-pedidos.vercel.app/pedido --output src/iframe/wordpress-pedido.html
```

Administración se abre en una pestaña propia, con sesión Google y autorización vigente en BD.

| Ruta | Finalidad |
| --- | --- |
| `/pedido` | Compra pública |
| `/seguimiento/[token]` | Seguimiento por enlace privado |
| `/admin` | Redirige a Pedidos |
| `/admin/pedidos`, `/admin/pedidos/[id]` | Bandeja y atención |
| `/admin/reporte`, `/admin/inventario` | Indicadores y catálogo |
| `/admin/promociones`, `/admin/cupones` | Descuentos |
| `/admin/configuracion` | Accesos, campus, cuentas e integraciones |
| `/tesoreria-recaudacion`, `/tesoreria-recaudacion/[id]` | Solicitudes y emisión |
| `/tesoreria-recaudacion/reporte` | Indicadores del área |
| `/admin/guia`, `/tesoreria-recaudacion/guia` | Guías interactivas |

## Mantenimiento y seguridad

```bash
pnpm lint
pnpm typecheck
pnpm build
```

`pnpm db:schema:export` regenera **solo el SQL inicial** desde Drizzle; revisar su diff, no usarlo como actualización de una BD con datos. `pnpm db:auth:generate` mantiene las tablas Better Auth por CLI. Los PDF de pago y PNG de correo bajo `src/assets` son recursos de producción; no eliminarlos como archivos temporales.

El [documento de seguridad](docs/02-seguridad.md) distingue controles implementados, riesgos pendientes de validación y evidencias de Neon/Vercel/Workspace que TI debe acreditar. La revisión de código no certifica backups, cifrado efectivo, WAF o permisos reales. Consultar antes de operar con datos sensibles; no probar mediante pedidos/envíos ficticios en producción.

Los límites de creación se administran en **Configuración → Seguridad**, exclusivamente por el correo maestro, con historial de cambios. Son compartidos en BD y no requieren redeploy. El seed conserva la configuración personalizada. Responsables, conservación indefinida y respaldo manual semanal (RPO objetivo siete días, RTO objetivo cuatro horas) están en [el expediente técnico](docs/00-inicio.md).
