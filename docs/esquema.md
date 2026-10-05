# Esquema de negocio y catálogo

Fuente de verdad: `src/db/schema.ts`. Auth conserva su esquema generado en `src/db/auth-schema.ts`; la migración inicial aplicada no se modifica. Las migraciones nuevas se generan en `src/db/migrations`.

## Decisiones vigentes

- IDs de negocio UUID generados por Postgres; los IDs de better-auth mantienen su formato original.
- Dinero en soles con `numeric(12,2)`, representado como string en Drizzle. Las fases de cálculo deben operar en céntimos enteros, sin sumar floats. Precios aplicados e importes quedan guardados en pedidos/ítems.
- `created_at`/`updated_at` de libros y pedidos son `timestamptz`; Drizzle actualiza `updated_at` al modificar. Una actualización por SQL directo debe actualizar ese campo explícitamente. Comprobantes guardan `uploaded_at`.
- `order_counters`: fila por año, `last_number` no negativo; no se precargan números ni se usa serial global. La creación bloquea esa fila mediante UPSERT transaccional.
- `order_number` único con formato `secuencial-año`; `tracking_token` único (índice creado por la restricción), alfabeto URL seguro y mínimo 24 caracteres. La creación genera nanoid de 32 caracteres.
- Relaciones con pedidos/libros restringen borrado para preservar ítems y comprobantes. Desactivar publicaciones será preferible a borrar libros comprados.
- Índices para catálogo por estado/sello, pedidos por fecha/estado/pagos, ítems por pedido/libro y comprobantes por pedido/sello. Los archivos Drive no pueden duplicarse por ID.

## Valores persistidos

| Concepto | Valores |
| --- | --- |
| Sello | `universidad`, `instituto` |
| Libro | `ACTIVO`, `INACTIVO` |
| Tipo de pedido | `solo_universidad`, `solo_instituto`, `mixto` |
| Comprador | `comunidad_continental`, `publico_general` |
| Entrega | `recojo_campus`, `delivery` |
| Zona de delivery | `lima_callao`, `provincia` |
| Pedido | `PENDIENTE_PAGO`, `EN_PREPARACION`, `DESPACHADO`, `ENTREGADO`, `CANCELADO` |
| Pago por sello | `NO_APLICA`, `PENDIENTE`, `EN_REVISION`, `VERIFICADO`, `RECHAZADO` |

La BD exige stock/precios no negativos, cantidades positivas y `subtotal = unit_price × quantity`. En pedidos exige datos de comprador/entrega, sede y correo institucional para comunidad, departamento/ciudad para provincia, RUC de 11 dígitos junto a razón social y desglose económico consistente.

El flete se guarda como total y por cuenta (`shipping_cost`, `shipping_universidad`, `shipping_instituto`): recojo 0, Lima/Callao 15, provincia 25. En mixtos se asigna exclusivamente a Universidad; en pedidos de un sello se asigna a su cuenta. La dirección de entrega conserva también la dirección de biblioteca al recoger. La revisión de fase 3 añade campus dinámicos y FKs restrictivas, provincia/distrito/ubigeo y tipo/documento/teléfono de quien recibe. La migración inicial de campus incorpora los ocho proporcionados por el usuario una sola vez; `db:seed` no restaura campus eliminados.

Los estados de pago se proporcionan explícitamente al crear: el sello que no corresponde exige `NO_APLICA`. La BD impide preparación, despacho o entrega sin verificación de todos los pagos aplicables. La creación y las cargas de fase 4 aplican el recálculo/derivación desde fuentes del servidor. Las transiciones administrativas pertenecen a fase 5. La consistencia entre filas (totales vs. ítems, sello del libro/comprobante vs. pedido) corresponde a esas transacciones, además de Zod en cada acción.

## Seed

`pnpm db:seed` mantiene únicamente el correo maestro. `pnpm db:seed:demo` añade cuatro libros ficticios definidos/validados con Zod en `src/db/seeds/demo-books.ts`, dos por sello. Una transacción incluye maestro y catálogo; conflictos por correo/código se omiten sin modificar filas existentes.

Los libros usan códigos `DEMO-UC-*`/`DEMO-IC-*`, títulos `[DEMO]`, autor de demostración, precios/stock ficticios y estado inicial `INACTIVO`. No representan publicaciones reales ni se ofrecen en el catálogo público. El catálogo oficial sigue pendiente; mantenerlos inactivos para vista previa; incorporar el catálogo oficial por separado.

## Persistencia de pedidos y pagos

Fase 4 agrega `order_emails` (outbox de confirmación), `payment_uploads` (intenciones recuperables con ID Drive/hash), `payment_receipts.upload_id` único, y snapshots de título/cuentas/consentimiento e idempotencia en pedidos. Migración `0003_stormy_bullseye`. Columnas de snapshots admiten NULL para pedidos anteriores; todas las creaciones nuevas los incluyen.

`bank_accounts` en migración `0004_groovy_starjammers`: banco/titular/cuenta/CCI/estado por sello, moneda PEN. CRUD por autorizados en `/admin`; Universidad inicial inactiva hasta completar titular/CCI. Los datos bancarios son dinámicos y no dependen de variables de entorno.

`payment_guides` guarda versiones inmutables de PDF por SHA-256; `orders.payment_guide_hash` referencia la versión aceptada al crear, compartida entre pedidos sin duplicar bytes. Los PDF del repositorio siguen siendo fuente de nuevas creaciones.

Estado actual: seis migraciones aplicadas en Neon y cuatro cuentas iniciales; Instituto activo, Universidad pendiente. Revisión operativa de fase 4 en [pedidos-pagos.md](pedidos-pagos.md).
