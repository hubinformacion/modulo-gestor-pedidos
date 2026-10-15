# Revisión de código y mantenimiento

## Limpieza aplicada

- Instalación inicial única (`src/db/schema.sql` + `db:setup` + seed), en lugar de migraciones/snapshots/journal del desarrollo. El SQL se generó del esquema vigente, incluidas tablas de Better Auth generadas por CLI.
- Retirados el migrador/config de migraciones y el comando/script de borrado de pedidos. La instalación de producción no necesita utilidades de demos ni reinicios.
- Corregida la descripción antigua del cron en `.env.example`: solo permisos Drive, sin reenvío de correos.
- README orientado a instalación/operación; documentación técnica y manuales separados por audiencia. AGENTS conserva reglas para agentes, no historial de fases.
- Se conservan recursos utilizados: PNG/CID y PDF trazados por Vercel, SVG fuente de correo, favicon, catálogo geográfico y receptor WordPress. Ser archivos generados no los hace prescindibles si el runtime los consume.

No se borraron datos para limpiar código. Un archivo ignorado local como `.next` o `node_modules` no debe confundirse con un archivo que se vaya a publicar en Git.

## Mejoras de consistencia pendientes

| Prioridad funcional | Ubicación | Propuesta |
| --- | --- | --- |
| Alta para coherencia de emisión | `src/lib/caja/data.ts` | El detalle aplica correcciones fiscales resueltas, pero la bandeja deriva Boleta/Factura del RUC original. Unificar un snapshot fiscal efectivo para presentación, conservando la compra original. |
| Media para concurrencia administrativa | `src/lib/payments/banks-service.ts`, `src/lib/campuses/service.ts` | Comparar versión del formulario bajo lock para impedir sobrescribir cambios de otro gestor. |
| Implementado en esta versión | Administración/accesos | management_audit conserva actor, fecha, recurso y cambios explícitos en la misma transacción; no se imprimen snapshots en logs. |
| Preventiva | `src/lib/orders/tracking.ts` | Separar DTO público de metadatos internos de correo; conservar proyecciones mínimas de cliente. |

Estas observaciones de calidad no se presentan como vulnerabilidades explotadas. Los riesgos de seguridad y verificaciones pendientes están en [seguridad](seguridad.md).

## Convenciones de mantenimiento

pnpm/lockfile, TypeScript estricto, validación cliente/servidor, servicios privados fuera de componentes cliente, transacciones ordenadas sin reintentar mutaciones, permisos por consulta/recurso y efectos Google fuera de locks de pedidos. Nuevos campos fiscales deben actualizar compra, correcciones, Tesorería, correos y snapshots de forma coherente.

No agregar polling, recuperación de correos, datos DEMO, scripts de reset ni actualización de esquema al build para facilitar desarrollo. Los cambios de estructura sobre datos operativos necesitan una actualización explícita revisada por TI aunque la distribución inicial no conserve migraciones de desarrollo.

La revisión de fuente y las comprobaciones de tipos/lint no sustituyen validación de OAuth, Google, instalación en PostgreSQL, restauración o WordPress. Las instrucciones manuales de validación están en [operación](operacion.md).
