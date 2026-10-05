<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Reglas del proyecto

- Usar exclusivamente pnpm y mantener su lockfile.
- Nunca hacer commits en `main`. Una rama por fase; entregar pruebas y esperar aprobación explícita antes de integrar o seguir.
- Fase actual: `feat/01-auth-y-google`. Negocio y pedidos se implementan en fases posteriores.
- Google OAuth con better-auth y Drizzle; generar sus tablas mediante CLI, no a mano.
- `authorized_emails` controla el acceso. Solo `distribucionfe@continental.edu.pe` añade o quita correos; los demás autorizados consultan la lista. El maestro no se elimina en la aplicación.
- Autenticar y autorizar cada Server Action en el servidor; validar entradas con Zod. No confiar en controles de UI ni en la existencia de cookies.
- No versionar secretos ni añadir bypasses de autenticación para pruebas.
- Las futuras rutas de compra y seguimiento serán públicas; administración protegida.

## Context7

Consultar Context7 para documentación vigente de librerías, frameworks, SDKs, APIs, CLIs y servicios cloud. Resolver primero el ID con `resolve-library-id`, salvo ID exacto dado por el usuario; luego usar `query-docs` por concepto. Preferirlo a búsqueda web. No se requiere para refactorización, scripts propios, lógica de negocio, revisión de código ni conceptos generales.
