# Gestor de pedidos · Fondo Editorial Continental

Catálogo y pedidos de publicaciones de Universidad Continental e Instituto Continental, con pagos por sello, seguimiento del comprador y atención del equipo. La aplicación se aloja en Vercel y se integra en WordPress mediante un iframe responsivo.

**[Solicitar publicaciones](https://fondoeditorial.continental.edu.pe/pedido/)** · **[Administración](https://modulo-gestor-pedidos.vercel.app/admin/pedidos)**

## Funcionalidades

- Compra en cuatro pasos con precios por tipo de comprador, ubigeo nacional y recojo en bibliotecas.
- Stock y numeración anual transaccionales; importes y datos de compra conservados como snapshots.
- Pagos independientes por sello y carga automática de comprobantes en Drive.
- Gestores autoasignados, revisión de pagos, distribución, despacho, entrega y notas internas.
- Inventario editable en tabla; configuración de autorizados, campus, ubicaciones y cuentas.
- Correos de avance en un mismo hilo, guías PDF y recuperación automática de avisos.
- Seguimiento dentro de WordPress, altura adaptable, ilustraciones estáticas y tema claro.

## Tecnología

Next.js App Router y Server Actions, React, TypeScript estricto, pnpm, Tailwind CSS y Base UI. Better Auth con Google OAuth y adaptador Drizzle; PostgreSQL en Neon. FilePond, Sileo, Boneyard y las APIs de Google Drive/Gmail completan el flujo.

## Desarrollo local

Node.js 22 o superior —24 recomendado— y pnpm 11.3.0.

```bash
pnpm install --frozen-lockfile
cp .env.example .env.local
```

Completa las variables privadas de `.env.local`. Para desarrollo, utiliza `http://localhost:3000` en `APP_URL` y `BETTER_AUTH_URL`, y registra en Google el callback `http://localhost:3000/api/auth/callback/google`.

```bash
pnpm db:migrate
pnpm db:seed
pnpm dev
```

El seed solo asegura el correo maestro y es idempotente. Libros, precios, stock, campus y cuentas se administran por interfaz; no se crean datos ficticios.

| Ruta | Uso |
| --- | --- |
| `/pedido` | Catálogo y creación del pedido |
| `/seguimiento/[token]` | Seguimiento público mediante enlace privado |
| `/admin` | Redirige a Pedidos |
| `/admin/pedidos` | Bandeja y atención de pedidos |
| `/admin/inventario` | Publicaciones, stock y precios |
| `/admin/configuracion` | Correos, campus, cuentas e integraciones |

El alias `/admin/configuración` también abre configuración. Administración requiere sesión Google y correo vigente en `authorized_emails`. Solo `distribucionfe@continental.edu.pe` gestiona autorizados; los demás comparten funciones operativas. Cada pedido tiene un gestor responsable de sus cambios de estado.

## Producción en Vercel

Importa `main`, utiliza Node.js 24 y configura las variables de `.env.example` en **Production**. Vercel instala y construye exclusivamente con pnpm mediante `vercel.json`.

| Variable | Valor de producción |
| --- | --- |
| `BETTER_AUTH_URL` | `https://modulo-gestor-pedidos.vercel.app` |
| `APP_URL` | `https://modulo-gestor-pedidos.vercel.app` |
| `WORDPRESS_ORIGINS` | `https://fondoeditorial.continental.edu.pe` |
| `WORDPRESS_ORDER_URL` | `https://fondoeditorial.continental.edu.pe/pedido/` |
| `ENABLE_EXPERIMENTAL_COREPACK` | `1` |

Configura también `DATABASE_URL`, `BETTER_AUTH_SECRET`, las credenciales de Google, el correo/carpeta propietario y `CRON_SECRET`. No publiques `.env.local` ni pongas secretos en WordPress. Guarda las variables y vuelve a desplegar para aplicar cambios; la CSP se construye con los orígenes configurados.

`CRON_SECRET` protege `/api/internal/jobs`. Usa una cadena aleatoria de al menos 32 caracteres, sin prefijo `Bearer`; Vercel añade ese encabezado automáticamente. El cron diario está programado a las 12:00 UTC, 07:00 de Perú, para recuperar avisos y sincronizar permisos de Drive. Las operaciones normales envían correos inmediatamente, sin esperar al cron ni requerir aprobación manual.

Las migraciones se aplican explícitamente contra la BD destino, **fuera del build**. Conserva todo `src/db/migrations`, incluidos sus snapshots y journal. No regeneres ni edites migraciones ya aplicadas.

## Google OAuth, Drive y Gmail

Utiliza un cliente OAuth de tipo **Web application**. Registra:

- Origen autorizado: `https://modulo-gestor-pedidos.vercel.app`.
- Callback: `https://modulo-gestor-pedidos.vercel.app/api/auth/callback/google`.

Conserva los callbacks de localhost y OAuth Playground si aún se usan. Habilita **Google Drive API** y **Gmail API** en el proyecto del cliente. El login de gestores solo solicita identidad; la cuenta propietaria usa un refresh token independiente con estos scopes:

```text
https://www.googleapis.com/auth/drive
https://www.googleapis.com/auth/gmail.send
https://www.googleapis.com/auth/gmail.metadata
```

Revisa Audience: Internal cuando corresponda a la organización, o Production para uso externo. Los tokens de Drive/Gmail emitidos en External/Testing expiran a los siete días. Guarda tokens y secretos únicamente en variables privadas.

Comprobantes y evidencia fotográfica permanecen privados en Drive; la carpeta comparte lectores nominados según autorizados. El comprador recibe confirmaciones, sin enlaces a esos archivos. Gmail metadata permite conservar las referencias reales del hilo.

## WordPress

Pega el contenido completo de [wordpress-pedido.html](src/iframe/wordpress-pedido.html) en un bloque HTML de la página de pedidos. El bloque usa el ancho de su contenedor, ajusta la altura y abre los enlaces de seguimiento `#seguimiento/TOKEN` dentro del iframe.

Para regenerarlo:

```bash
pnpm iframe:snippet --url https://modulo-gestor-pedidos.vercel.app/pedido --output src/iframe/wordpress-pedido.html
```

Si WordPress elimina scripts, carga [wordpress-embed.js](src/iframe/wordpress-embed.js) desde el tema o plugin y conserva el atributo `data-fec-iframe`. Reemplaza también el receptor al actualizar su protocolo. Configura `WORDPRESS_ORIGINS` sin rutas ni comodines; no añadas un `X-Frame-Options` contradictorio.

Administración se opera en una pestaña propia de Vercel para evitar restricciones de cookies de terceros. `APP_URL` y `BETTER_AUTH_URL` siempre identifican la aplicación Next, no WordPress. El token de seguimiento es una credencial: evita recopilar el fragmento de URL en analítica.

## Mantenimiento

```bash
pnpm lint
pnpm typecheck
pnpm build
pnpm start
```

Ante cambios de esquema, genera una migración con `pnpm db:generate` y aplícala con `pnpm db:migrate`. Las tablas de Better Auth se generan mediante `pnpm db:auth:generate`, no se editan a mano.

Las guías viven en `src/assets/pdfs`, fuera de `public`:

- `guia_pago_universidad.pdf`
- `guia_pago_instituto.pdf`
- `guia_pago_mixta.pdf`

Mantén su contenido alineado con las cuentas vigentes y los dos depósitos de un pedido mixto. Los pedidos anteriores conservan su guía y datos de pago originales. Las ilustraciones de correo son SVG/PNG transparentes; modifica [generate.ts](src/assets/email/generate.ts) y regenera con `pnpm email:assets`.

No hay consultas periódicas del navegador: las pantallas actualizan tras operaciones, al volver a la pestaña o mediante el icono de actualizar. Un fallo temporal de BD no cierra la sesión; la cola conserva los avisos para recuperación. Revisa consumo de Neon, logs Vercel y vencimiento/revocación del token propietario ante incidentes.

[AGENTS.md](AGENTS.md) conserva el contexto técnico y las reglas de trabajo para próximas sesiones.
