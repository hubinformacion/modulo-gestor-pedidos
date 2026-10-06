# Desarrollo, estructura y configuración

## Estructura

```text
src/
  app/                    Rutas, layouts y Server Actions (App Router)
  components/             Componentes de las pantallas
    admin/                Pedidos, revisión, despacho e inventario
    ui/                   Primitivas shadcn/ui sobre Base UI
  db/
    schema.ts             Esquema propio y exportación del esquema auth
    auth-schema.ts        Tablas de better-auth generadas por CLI
    auth-schema.config.ts Configuración exclusiva de generación auth
    drizzle.config.ts     Configuración de Drizzle Kit
    migrations/           SQL e historial de migraciones
    migrate.ts            Ejecutor transaccional HTTP de Neon
    seed.ts               Entrada CLI para seed idempotente
    seeds/                Catálogo ficticio de demostración (opcional)
    index.ts              Conexión Neon para peticiones server-side
  data/ubigeo/            Snapshot nacional para geografía y tarifa de delivery
  lib/                    Autenticación, acceso, validaciones e integraciones
    orders/               Catálogo servidor, validaciones, geografía y cálculo
    campuses/             Lectura/CRUD seguro y validación de campus
    admin/                Lecturas autorizadas y validaciones administrativas
  iframe/                 Bloque WordPress, receptor y simulador local
  proxy.ts                Middleware/proxy de rutas administrativas
docs/                     Contexto, requisitos, fases y decisiones
```

PDFs en `src/assets/pdfs` e integración Google en `src/lib/google.ts`. No mantener carpetas `drizzle`, `scripts` o pruebas en raíz.

En la raíz permanecen `package.json`, lockfile/configuración pnpm, `tsconfig.json`, configuraciones Next/PostCSS/ESLint, `components.json` de shadcn, `.env.example`, `.gitignore`, README y AGENTS. Estas ubicaciones permiten el descubrimiento normal de las herramientas. No existe `CLAUDE.md`.

Las rutas `schema` y `out` de Drizzle son relativas al directorio desde el que se ejecutan los comandos: usar los scripts pnpm desde la raíz.

## Inicio local

Node.js 22 o superior (entorno de trabajo: Node 24), pnpm 11.3.0. No usar otros gestores.

```bash
pnpm install --frozen-lockfile
cp .env.example .env.local
```

Configurar fuera de Git:

| Variable | Uso |
| --- | --- |
| DATABASE_URL | Conexión Postgres Neon, preferiblemente rama de desarrollo |
| BETTER_AUTH_SECRET | Secreto aleatorio de mínimo 32 caracteres |
| BETTER_AUTH_URL | http://localhost:3000 en desarrollo |
| GOOGLE_CLIENT_ID | Cliente OAuth web Google |
| GOOGLE_CLIENT_SECRET | Secreto del mismo cliente |

Generar un secreto local con `openssl rand -base64 32`; no pegarlo en documentación o commits.

En Google registrar origen `http://localhost:3000` y callback exacto `http://localhost:3000/api/auth/callback/google`. Si el consentimiento está en modo de pruebas, añadir las cuentas en Google; sigue siendo necesario autorizarlas en nuestra BD.

```bash
pnpm db:migrate
pnpm db:seed
pnpm dev
```

Abrir `http://localhost:3000`: dirige a configuración en `/admin` o al ingreso, sin landing. Compra pública en `/pedido`; revisión con DEMO en `/admin/vista-previa`, protegida y sin escritura de pedidos. Datos del comprador en memoria durante el recorrido y persistidos solo al confirmar un pedido real.

Sin configuración válida, el ingreso queda temporalmente no disponible y se deniega acceso protegido.

## Comandos de BD

| Comando | Propósito |
| --- | --- |
| pnpm db:auth:generate | Generar tablas better-auth con src/db/auth-schema.config.ts |
| pnpm db:generate | Generar SQL con src/db/drizzle.config.ts |
| pnpm db:migrate | Aplicar migraciones versionadas a la BD configurada |
| pnpm db:seed | Sembrar el maestro idempotentemente, sin catálogo ficticio |
| pnpm db:seed:demo | Maestro y cuatro libros DEMO inactivos, sin sobrescribir datos |

La generación auth usa una configuración de esquema sin credenciales ni conexión externa. No editar sus tablas a mano. Preservar el historial en `src/db/migrations`; no regenerar migraciones ya aplicadas para reorganizar carpetas.

`db:migrate` lee el SQL/historial generado por Drizzle Kit y aplica lo pendiente con Neon HTTP en una transacción, incluyendo su registro. Usa lock de migraciones y verifica que otro ejecutor no haya adelantado el historial. Se adoptó este transporte después de que el CLI por WebSocket quedara esperando durante DDL; esa ejecución se revirtió sin cambios parciales. No ejecutar dos herramientas de migración simultáneamente.

El Pool de Neon es propio de cada petición y se cierra al terminar. Los hooks auth comparten el contexto transaccional del adaptador para leer datos consistentes. No sustituir la verificación de BD por controles del navegador.

## Trabajo y revisión

- Consultar [fases.md](fases.md) antes de cambiar de rama, integrar o avanzar.
- No crear/ejecutar suites de pruebas ni instalar frameworks de testing salvo petición explícita del usuario.
- Completar todos los cambios solicitados antes de validar.
- Si hace falta una comprobación técnica puntual, usar `pnpm lint`, `pnpm typecheck` o `pnpm build`; no repetir comprobaciones sin motivo ni imponer una batería automática.
- Al entregar, describir cambios, comprobaciones realmente realizadas y pendientes; proporcionar pasos de revisión manual concretos.
- Google/Neon reales requieren sus credenciales; no afirmar que funcionan en producción sin revisarlos.
- No enviar correos reales, publicar ni alterar servicios externos fuera del alcance autorizado.

## Criterio visual

Inter es la única tipografía por defecto y se hospeda junto a la aplicación. Fondo blanco, tema claro fijo y violeta `#6802C1` como acento en acciones/foco/navegación. No selector de tema ni adaptación oscura por preferencias del sistema.

Usar frontend-design respetando estas preferencias, incluso si la habilidad propone otra tipografía. Espaciado contenido, jerarquía legible y controles funcionales para el iframe. Sin logos, bienvenida promocional, hero, decoración corporativa ni footer institucional. Conservar etiquetas, foco visible, mensajes accesibles y estados de carga/error.

## Despliegue posterior

En Vercel: pnpm, Node compatible, variables de entorno y callback HTTPS del dominio estable. Aplicar migraciones explícitamente, fuera del build. La cuenta propietaria Drive/Gmail requerirá refresh token y carpeta adicionales en fase 4; completar variables de ejemplo en fase 6. Los dominios WordPress/CSP deben provenir de la configuración real, no de valores inventados.

Fase 4: configuración de banco/propietario y revisión en [pedidos-pagos.md](pedidos-pagos.md). FilePond acepta 3 MiB por archivo; Server Actions 4 MiB. PDFs incluidos por tracing; verificar en Vercel.

Fase 5: `/admin/pedidos` y `/admin/inventario`; acciones en `src/app/admin/operations.ts`, lectura/validaciones en `src/lib/admin`, componentes en `src/components/admin`. Migración 0006 agrega control del último comprobante confirmado y outbox de avisos en hilo; ejecutar `pnpm db:migrate`. Revisión: [admin-dashboard.md](admin-dashboard.md).

Fase 6: configuración/protocolo en `src/lib/iframe`, puente en `src/components/iframe`, bloque y simulador en `src/iframe`; `vercel.json` en raíz por convención del proveedor. Variables completas en `.env.example`, incluidas WORDPRESS_ORIGINS y Corepack para Vercel. Revisión y despliegue: [iframe-wordpress.md](iframe-wordpress.md).
