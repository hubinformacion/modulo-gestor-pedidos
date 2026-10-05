# Fases y estado del trabajo

## Estado vigente

Fase 1 completada y aprobada el 2026-10-05. Migración y seed aplicados en Neon; el usuario confirmó ingreso del maestro y rechazo de un correo no autorizado. Configuración centralizada en `/admin`. Integrada en `main`. Rama vigente: `feat/02-schema-y-seed`; no integrar ni avanzar a fase 3 sin nueva aprobación.

## Regla de entrega

Nunca hacer commits en `main`. Trabajar en una rama por fase. Al cerrar cada fase, describir lo implementado y los pasos de revisión manual, detenerse y esperar aprobación explícita antes de integrar o seguir.

## Completadas

- **1. Auth y Google:** pnpm/Next/UI, Neon/Drizzle, tablas better-auth generadas, autorizados, seed, Google OAuth y protección de páginas/acciones. Solo el maestro gestiona correos; la revocación elimina sesiones atómicamente. Aprobada por el usuario; sin pruebas automatizadas.

## Fase vigente

## 2. feat/02-schema-y-seed — implementada, pendiente de aprobación

**Entrega:** esquema completo de negocio descrito en [proyecto.md](proyecto.md), migraciones y seed de libros de ambos sellos.

**Comprobado el 2026-10-05:** lint y tipos correctos. Migración `0001_public_havok` aplicada en Neon; diez tablas y dos migraciones registradas. Cuatro libros DEMO inactivos sembrados y consultados, con precios/stock por sello. No se ejecutaron suites de pruebas. No hay todavía interfaz de inventario ni creación de pedidos.

**Revisión manual:** revisar tablas/restricciones e inventario de ambos sellos; confirmar precios estándar/comunidad y repetición de seed sin duplicar datos.

**Catálogo:** oficial pendiente. Seed opcional `pnpm db:seed:demo`: cuatro libros ficticios (dos por sello), prefijo `DEMO-`/`[DEMO]`, inicialmente inactivos. No sobrescribe precios, stock ni estado al repetirlo. Detalles en [esquema.md](esquema.md).

## Fases pendientes

## 3. feat/03-wizard-frontend

**Entrega:** wizard de cuatro pasos: publicaciones, comprador, entrega, confirmación. Validación Zod y cálculo dinámico de precios/envío.

**Revisión manual:** probar ambos sellos y carrito mixto; comunidad con sede/correo institucional; público general; recojo, Lima/Callao y provincia; verificar desglose y obligatoriedad de departamento/ciudad.

**Datos necesarios:** sedes, campus, direcciones de bibliotecas y cuentas bancarias para mostrar instrucciones correctas.

## 4. feat/04-pedidos-pagos-drive

**Entrega:** Server Action de creación, recálculo de precios server-side, stock y numeración por año en transacción; seguimiento por token; FilePond multiarchivo por sello; Drive, correo y PDFs.

**Revisión manual:** crear cada tipo de pedido, abortar por stock insuficiente, revisar consecutivos por año y totales por cuenta, cargar/reintentar comprobantes por sello y confirmar recepción del correo con su PDF. Revisar manualmente el adjunto en Vercel.

**Datos necesarios:** credenciales y refresh token de cuenta propietaria, carpeta Drive y PDFs definitivos.

## 5. feat/05-admin-dashboard

**Entrega:** `/admin/pedidos` con tabla/filtros, aprobación independiente por sello y despacho; `/admin/inventario` con CRUD de stock/precios. Configuración permanece en `/admin`; navegación hacia pedidos e inventario sin desplazarla.

**Revisión manual:** aprobaciones de ambos sellos y `NO_APLICA`; ningún mixto pasa a preparación con un pago pendiente/rechazado; rechazo/re-subida de un sello conserva el otro; actualizar inventario y despachar.

## 6. feat/06-iframe-wp-polish

**Entrega:** CSP frame-ancestors sin cabeceras contradictorias, comunicación de altura, `.env.example` completo, despliegue y ajustes finales del embebido.

**Revisión manual:** incrustar simulando WordPress en móvil/escritorio, comprobar altura/comunicación y acceso, revisar cabeceras y confirmar el adjunto PDF en Vercel.

**Datos necesarios:** dominios definitivos, proyecto Vercel y página WordPress de destino.

## Cambios de criterio que deben persistir

- Solo el maestro gestiona autorizados; reemplaza la regla original de gestión por cualquier autorizado.
- Sin infraestructura ni ejecución de pruebas automatizadas salvo nueva solicitud explícita.
- Código/utilidades/migraciones bajo `src`; configuración de herramientas en raíz solo cuando la convención lo necesita.
- Sin landing, contenido promocional, logos ni referencias corporativas en la interfaz.
- Inter por defecto, tema claro, blanco y `#6802C1`.
