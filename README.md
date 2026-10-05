# Fondo Editorial Continental

La fase 1 implementa Google OAuth y administración de correos autorizados en Neon. Pedidos, inventario, Drive/Gmail y WordPress se incorporan en las fases siguientes.

## Inicio local

Requisitos: Node.js 22 o superior (verificado con Node 24), pnpm 11.3.0, una BD Postgres en Neon y un cliente Google OAuth de tipo aplicación web.

```bash
pnpm install --frozen-lockfile
cp .env.example .env.local
```

Completa las variables de `.env.local` fuera de Git:

| Variable | Valor |
| --- | --- |
| DATABASE_URL | Conexión Postgres de Neon con su configuración SSL; usa una rama de desarrollo. |
| BETTER_AUTH_SECRET | Secreto aleatorio de al menos 32 caracteres; generar con `openssl rand -base64 32`. |
| BETTER_AUTH_URL | `http://localhost:3000` |
| GOOGLE_CLIENT_ID | ID del cliente web de Google. |
| GOOGLE_CLIENT_SECRET | Secreto del mismo cliente web. |

En Google configura el origen `http://localhost:3000` y el URI de redirección exacto `http://localhost:3000/api/auth/callback/google`. Si el consentimiento está en modo de pruebas, añade las cuentas de prueba en Google. Esto es independiente de autorizarlas en nuestra BD.

```bash
pnpm db:migrate
pnpm db:seed
pnpm db:seed
pnpm dev
```

Abre [http://localhost:3000/login](http://localhost:3000/login). El seed repetido conserva un único maestro: `distribucionfe@continental.edu.pe`.

Sin credenciales el proyecto compila y muestra el ingreso temporalmente no disponible. Las rutas y acciones administrativas se deniegan. La aplicación no tiene un bypass de autenticación para pruebas.

## Acceso y arquitectura

- Solo Google OAuth, sin registro abierto ni contraseñas. Una cuenta verificada puede crear usuario/sesión únicamente si está en `authorized_emails`.
- Se valida también la identidad entrante en cada ingreso Google de retorno.
- Todos los autorizados consultan el panel y la lista. Solo el maestro añade o elimina correos, y el maestro no se puede eliminar.
- Se permiten cuentas Google de cualquier dominio. Añadir un correo no crea una cuenta Google ni envía una invitación.
- Se verifican sesión y lista en `proxy.ts`, páginas y cada Server Action, sin caché de autorizaciones entre peticiones.
- La revocación elimina autorización y sesiones en una misma transacción. Reautorizar permite ingresar con una sesión nueva.
- Las sesiones duran siete días. Los Pools de Neon se cierran al terminar cada petición para su uso en funciones serverless.
- Next App Router, TS estricto, Tailwind, shadcn/ui sobre Base UI, `sileo` y `boneyard-js`. Fuentes alojadas con la aplicación.

## Comprobaciones

Las tablas de better-auth fueron **generadas por su CLI**, no escritas a mano. La configuración de generación no requiere credenciales ni conexión externa.

```bash
pnpm db:auth:generate
pnpm db:generate
pnpm check
pnpm exec playwright install chromium
pnpm test:e2e
```

`pnpm check` ejecuta lint, tipos, tests y build. Los tests aplican las migraciones reales sobre PostgreSQL embebido (PGlite), con better-auth, callbacks, hooks y cookies reales. El intercambio externo con Google y el transporte Neon se sustituyen exclusivamente en tests. PGlite es una dependencia de desarrollo.

Playwright arranca el build de producción en el puerto 3100 sin credenciales: comprueba escritorio, móvil y denegación de peticiones. No reemplaza la prueba real de Google/Neon.

Ver [protocolo de aceptación](docs/phase-01-testing.md) y [diseño aprobado](docs/plans/2026-10-05-fase-01-design.md).

## Git y despliegue

Rama actual: `feat/01-auth-y-google`. Nunca hacer commits en `main`; no integrar ni iniciar la fase 2 sin aprobación. El directorio inicialmente no tenía repositorio ni `main`: la primera integración aprobada establecerá `main` desde esta rama.

Para Vercel se usarán pnpm, runtime Node compatible, URL HTTPS estable y callback Google de ese dominio. Aplicar migraciones explícitamente, fuera del build. El despliegue y las pruebas de PDFs/iframe se completarán en sus fases.
