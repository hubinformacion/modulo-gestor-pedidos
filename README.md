# Gestor de pedidos

Aplicación para el Fondo Editorial Continental, integrada en WordPress mediante iframe. Interfaz funcional sin landing ni marca duplicada: Inter, tema claro, fondo blanco y `#6802C1`.

Fase actual: `feat/03-wizard-frontend`. Fases 1 y 2 integradas localmente en `main`. Wizard público en `/pedido`; vista previa DEMO protegida en `/admin/vista-previa`, sin activar libros ficticios ni registrar pedidos. Pendiente de aprobación al cerrar.

## Inicio local

Node.js 22 o superior y pnpm 11.3.0. Exclusivamente pnpm.

```bash
pnpm install --frozen-lockfile
cp .env.example .env.local
```

Completa `DATABASE_URL`, `BETTER_AUTH_SECRET` (mínimo 32 caracteres), `BETTER_AUTH_URL=http://localhost:3000`, `GOOGLE_CLIENT_ID` y `GOOGLE_CLIENT_SECRET`.

En Google registra el origen `http://localhost:3000` y callback exacto `http://localhost:3000/api/auth/callback/google`. Si usa consentimiento de pruebas, habilita las cuentas también en Google.

```bash
pnpm db:migrate
pnpm db:seed
pnpm dev
```

Abrir `http://localhost:3000` para administración. El catálogo público está en `/pedido`; para recorrer los cuatro pasos con los DEMO inactivos, abrir **Vista previa del pedido** en administración. Sin configuración válida el acceso se deniega y se muestra un mensaje recuperable.

## Acceso y estructura

Todos los autorizados consultan el panel; solo `distribucionfe@continental.edu.pe` añade/quita correos. El maestro está protegido y revocar un correo cierra sus sesiones en la misma transacción.

Código, configuración de BD, migraciones y seed viven en `src`. Tablas better-auth generadas por CLI, no a mano:

```bash
pnpm db:auth:generate
pnpm db:generate
```

El proyecto no incluye ni exige suites de pruebas automatizadas, por decisión del usuario. Las comprobaciones puntuales disponibles son `pnpm lint`, `pnpm typecheck` y `pnpm build`; realizar primero todos los cambios solicitados.

## Contexto persistente

- [Documentación del proyecto](docs/README.md)
- [Requisitos y reglas de negocio](docs/proyecto.md)
- [Fases y estado actual](docs/fases.md)
- [Estructura, configuración y flujo de desarrollo](docs/desarrollo.md)

Al cerrar una fase: entregar pasos de revisión manual y esperar aprobación antes de integrar o continuar. Nunca hacer commits en `main`.
