# Fases y estado del trabajo

## Estado vigente

Fases 1–4 aprobadas e integradas localmente en `main`. Rama vigente: `feat/05-admin-dashboard`, implementada y pendiente de revisión. Configuración en `/admin`, pedidos en `/admin/pedidos`, inventario en `/admin/inventario`, compra pública en `/pedido` y DEMO protegido en `/admin/vista-previa`. Las revisiones reales de Drive/Gmail/PDF/Vercel de fase 4 siguen pendientes de configuración.

## Regla de entrega

Nunca hacer commits en `main`. Trabajar en una rama por fase. Al cerrar cada fase, describir lo implementado y los pasos de revisión manual, detenerse y esperar aprobación explícita antes de integrar o seguir.

## Completadas

- **1. Auth y Google:** pnpm/Next/UI, Neon/Drizzle, tablas better-auth generadas, autorizados, seed, Google OAuth y protección de páginas/acciones. Solo el maestro gestiona correos; la revocación elimina sesiones atómicamente. Aprobada por el usuario; sin pruebas automatizadas.

- **2. Esquema y seed:** diez tablas, importes exactos/restricciones, migración en Neon y cuatro DEMO inactivos. Lint y tipos correctos. Aprobada e integrada; catálogo oficial pendiente. [Contrato de esquema](esquema.md).

- **3. Wizard:** aprobada por el usuario. Cuatro pasos, catálogo compacto, precios dinámicos, ubigeo, campus administrables, persona alternativa, resumen en tarjetas y consentimiento único. Migración de campus aplicada; lint/tipos/build correctos. Contrato de interfaz en [wizard.md](wizard.md).

- **4. Pedidos, pagos y Google:** aprobada para integrar y continuar por el usuario. Creación transaccional, contador anual, snapshots, tracking, cargas recuperables y outbox. Migraciones 0003–0005 aplicadas; cuatro cuentas sembradas. Lint/tipos/build correctos. Integrada localmente; configuración y revisión real Google/PDF/Vercel pendientes según [pedidos-pagos.md](pedidos-pagos.md).

## Fase vigente

## 5. feat/05-admin-dashboard

**Estado:** implementada en su rama; pendiente de revisión manual y aprobación antes de integrar. Sin migraciones ni nuevas dependencias. Lint, tipos y build de producción correctos.

**Entrega:** pedidos con búsqueda, filtros, paginación y detalle; comprobantes Drive, aprobación/rechazo independiente por sello; preparación condicionada, despacho con courier y entrega. Inventario en tabla con edición y alta inline, confirmación breve de borrado, precios/stock/estado, protección del historial y control de concurrencia. Configuración en `/admin` separada en pestañas de correos, campus, cuentas e integraciones.

**Revisión manual:** [admin-dashboard.md](admin-dashboard.md) contiene los pasos concretos, restricciones y requisitos de configuración. No se crearon pedidos ficticios ni se enviaron correos para esta entrega.

## Fases pendientes

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
