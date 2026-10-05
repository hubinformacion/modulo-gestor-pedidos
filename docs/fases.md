# Fases y estado del trabajo

## Estado vigente

Fases 1–3 aprobadas e integradas localmente en `main`. Rama vigente: `feat/04-pedidos-pagos-drive`. Configuración en `/admin`, compra pública en `/pedido` y DEMO protegido en `/admin/vista-previa`. Fase 4 implementada, pendiente de configuración y revisión operativa; no integrar ni avanzar a fase 5 sin aprobación.

## Regla de entrega

Nunca hacer commits en `main`. Trabajar en una rama por fase. Al cerrar cada fase, describir lo implementado y los pasos de revisión manual, detenerse y esperar aprobación explícita antes de integrar o seguir.

## Completadas

- **1. Auth y Google:** pnpm/Next/UI, Neon/Drizzle, tablas better-auth generadas, autorizados, seed, Google OAuth y protección de páginas/acciones. Solo el maestro gestiona correos; la revocación elimina sesiones atómicamente. Aprobada por el usuario; sin pruebas automatizadas.

- **2. Esquema y seed:** diez tablas, importes exactos/restricciones, migración en Neon y cuatro DEMO inactivos. Lint y tipos correctos. Aprobada e integrada; catálogo oficial pendiente. [Contrato de esquema](esquema.md).

- **3. Wizard:** aprobada por el usuario. Cuatro pasos, catálogo compacto, precios dinámicos, ubigeo, campus administrables, persona alternativa, resumen en tarjetas y consentimiento único. Migración de campus aplicada; lint/tipos/build correctos. Contrato de interfaz en [wizard.md](wizard.md).

## Fase vigente

## 4. feat/04-pedidos-pagos-drive

**Estado:** código implementado. Migraciones 0003–0005 aplicadas en Neon; cuatro cuentas sembradas. Lint, tipos y build correctos. Tracing incluye los tres PDF. Drive/Gmail, pedidos reales y adjunto en Vercel pendientes: faltan credenciales y catálogo operativo.

**Entrega:** Server Action de creación, recálculo de precios server-side, stock y numeración por año en transacción; seguimiento por token; FilePond multiarchivo por sello; Drive, correo y PDFs.

**Revisión manual:** crear cada tipo de pedido, abortar por stock insuficiente, revisar consecutivos por año y totales por cuenta, cargar/reintentar comprobantes por sello y confirmar recepción del correo con su PDF. Revisar manualmente el adjunto en Vercel.

**Datos necesarios:** completar/activar Universidad en el CRUD de cuentas, refresh token/propietario y carpeta Drive, reemplazar PDF mixto cuando el responsable lo tenga listo, y proyecto Vercel. Estado detallado y revisión en [pedidos-pagos.md](pedidos-pagos.md).

## Fases pendientes

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
