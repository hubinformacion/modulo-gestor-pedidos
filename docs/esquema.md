# Esquema de negocio y catálogo

Fuente de verdad: `src/db/schema.ts`. Auth conserva su esquema generado en `src/db/auth-schema.ts`; la migración inicial aplicada no se modifica. Las migraciones nuevas se generan en `src/db/migrations`.

## Decisiones de fase 2

- IDs de negocio UUID generados por Postgres; los IDs de better-auth mantienen su formato original.
- Dinero en soles con `numeric(12,2)`, representado como string en Drizzle. Las fases de cálculo deben operar en céntimos enteros, sin sumar floats. Precios aplicados e importes quedan guardados en pedidos/ítems.
- `created_at`/`updated_at` de libros y pedidos son `timestamptz`; Drizzle actualiza `updated_at` al modificar. Una actualización por SQL directo debe actualizar ese campo explícitamente. Comprobantes guardan `uploaded_at`.
- `order_counters`: fila por año, `last_number` no negativo; no se precargan números ni se usa serial global. La fase 4 bloqueará esa fila dentro de la transacción de creación.
- `order_number` único con formato `secuencial-año`; `tracking_token` único (índice creado por la restricción), alfabeto URL seguro y mínimo 24 caracteres. La generación con nanoid pertenece a fase 4.
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

El flete se guarda como total y por cuenta (`shipping_cost`, `shipping_universidad`, `shipping_instituto`): recojo 0, Lima/Callao 15, provincia 25. En mixtos se asigna exclusivamente a Universidad; en pedidos de un sello se asigna a su cuenta. La dirección de entrega conserva también la dirección de biblioteca al recoger.

Los estados de pago se proporcionan explícitamente al crear: el sello que no corresponde exige `NO_APLICA`. La BD impide preparación, despacho o entrega sin verificación de todos los pagos aplicables. Las transiciones operativas y el recálculo/derivación desde los ítems se implementarán en las fases 4 y 5; el esquema por sí solo no crea pedidos ni descuenta stock. La consistencia entre filas (totales vs. ítems, sello del libro/comprobante vs. pedido) corresponde a esas transacciones, además de Zod en cada acción.

## Seed

`pnpm db:seed` mantiene únicamente el correo maestro. `pnpm db:seed:demo` añade cuatro libros ficticios definidos/validados con Zod en `src/db/seeds/demo-books.ts`, dos por sello. Una transacción incluye maestro y catálogo; conflictos por correo/código se omiten sin modificar filas existentes.

Los libros usan códigos `DEMO-UC-*`/`DEMO-IC-*`, títulos `[DEMO]`, autor de demostración, precios/stock ficticios y estado inicial `INACTIVO`. No representan publicaciones reales ni se ofrecen en el catálogo público. El catálogo oficial sigue pendiente; sustituirlos o activarlos conscientemente para desarrollo cuando corresponda.

## Estado de entrega

El 2026-10-05 se aplicaron la migración de negocio y el seed DEMO en Neon; una consulta confirmó diez tablas, dos migraciones y los cuatro libros inactivos con sus precios/stock. Lint y tipos correctos. Fase 2 pendiente de aprobación del usuario para integrar y seguir.

## Revisión manual al cerrar

1. Abrir Neon → SQL Editor y ejecutar:

   ```sql
   SELECT inventory_code, title, publisher_imprint, standard_price,
          community_price, stock, status
   FROM books ORDER BY inventory_code;

   SELECT table_name FROM information_schema.tables
   WHERE table_schema = 'public' ORDER BY table_name;

   SELECT conrelid::regclass AS tabla, conname, pg_get_constraintdef(oid)
   FROM pg_constraint
   WHERE connamespace = 'public'::regnamespace
   ORDER BY tabla, conname;
   ```

2. Confirmar las cinco tablas nuevas (`books`, `order_counters`, `orders`, `order_items`, `payment_receipts`) y las cinco tablas de acceso existentes; cuatro DEMO inactivos, ambos sellos y precios estándar/comunidad distintos.
3. Repetir `pnpm db:seed:demo`: debe informar cero libros añadidos y conservar stock/precios/estado. `pnpm db:migrate` no debe reaplicar SQL existente.
4. Abrir `/admin`: confirmar configuración y gestión de correos sin redirección a `/admin/correos`. No hay todavía pantalla de inventario (fase 5).

No se requieren suites de pruebas automatizadas.
