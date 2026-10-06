# Fases y estado del trabajo

## Estado vigente

Fases 1–5 aprobadas e integradas localmente en `main`. Rama vigente: `feat/06-iframe-wp-polish`. Configuración en `/admin`, pedidos en `/admin/pedidos`, inventario en `/admin/inventario`, compra pública en `/pedido` y DEMO protegido en `/admin/vista-previa`. Google/PDF/Vercel reales siguen pendientes de revisión operativa.

## Regla de entrega

Nunca hacer commits en `main`. Trabajar en una rama por fase. Al cerrar cada fase, describir lo implementado y los pasos de revisión manual, detenerse y esperar aprobación explícita antes de integrar o seguir.

## Completadas

- **1. Auth y Google:** pnpm/Next/UI, Neon/Drizzle, tablas better-auth generadas, autorizados, seed, Google OAuth y protección de páginas/acciones. Solo el maestro gestiona correos; la revocación elimina sesiones atómicamente. Aprobada por el usuario; sin pruebas automatizadas.

- **2. Esquema y seed:** diez tablas, importes exactos/restricciones, migración en Neon y cuatro DEMO inactivos. Lint y tipos correctos. Aprobada e integrada; catálogo oficial pendiente. [Contrato de esquema](esquema.md).

- **3. Wizard:** aprobada por el usuario. Cuatro pasos, catálogo compacto, precios dinámicos, ubigeo, campus administrables, persona alternativa, resumen en tarjetas y consentimiento único. Migración de campus aplicada; lint/tipos/build correctos. Contrato de interfaz en [wizard.md](wizard.md).

- **4. Pedidos, pagos y Google:** aprobada para integrar y continuar por el usuario. Creación transaccional, contador anual, snapshots, tracking, cargas recuperables y outbox. Migraciones 0003–0005 aplicadas; cuatro cuentas sembradas. Lint/tipos/build correctos. Integrada localmente; configuración y revisión real Google/PDF/Vercel pendientes según [pedidos-pagos.md](pedidos-pagos.md).

- **5. Administración y avisos:** aprobada para integrar y continuar. Pedidos/filtros, pagos por sello, despacho/entrega, inventario inline y configuración por pestañas. Comprobantes automáticos por sello, confirmación separada y avisos en hilo. Migración 0006 aplicada en Neon; lint/tipos/build correctos. Integrada localmente. Contrato: [admin-dashboard.md](admin-dashboard.md).

## Fase vigente

## 6. feat/06-iframe-wp-polish

**Estado:** código implementado; lint/tipos/build correctos y cabeceras/bloque/simulador verificados por HTTP local. Pendiente de revisión visual/final y aprobación para integrar. Dominios/proyecto Vercel/página WordPress definitivos pendientes; no considerar el despliegue realizado.

**Entrega:** CSP frame-ancestors sin X-Frame-Options contradictorio, dominios configurables, altura postMessage segura, login externo para iframe, bloque/simulador WordPress bajo src, .env.example completo y configuración Vercel con pnpm.

**Revisión manual:** [iframe-wordpress.md](iframe-wordpress.md), incluyendo móvil/escritorio, altura y mensajes, cabeceras, login y adjunto PDF en Vercel.

**Pendientes externos:** cuenta/proyecto/dominio Vercel, orígenes/página WordPress; revisión de correo/Drive/PDF desde el despliegue real.

## Cambios de criterio que deben persistir

- Solo el maestro gestiona autorizados; reemplaza la regla original de gestión por cualquier autorizado.
- Sin infraestructura ni ejecución de pruebas automatizadas salvo nueva solicitud explícita.
- Código/utilidades/migraciones bajo `src`; configuración de herramientas en raíz solo cuando la convención lo necesita.
- Sin landing, contenido promocional, logos ni referencias corporativas en la interfaz.
- Inter por defecto, tema claro, blanco y `#6802C1`.
