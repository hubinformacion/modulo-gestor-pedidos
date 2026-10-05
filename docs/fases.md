# Fases y estado del trabajo

## Estado vigente

Rama activa: `feat/01-auth-y-google`. El repositorio comenzó vacío y aún no tiene `main`. El código de acceso está implementado y ajustado a Inter, blanco, tema claro y `#6802C1`, sin landing ni marcas.

La fase 1 incluye esquema generado por better-auth, autorización en BD, seed idempotente, login Google, proxy, Server Actions y pantalla de correos. Las migraciones y utilidades viven en `src/db`.

Las variables requeridas ya están configuradas en `.env.local`; esto solo confirma su presencia/formato, no la validez externa de las credenciales. La conexión, migración, seed e ingreso contra **Neon y Google reales** siguen pendientes de revisión manual. La fase 1 no se ha integrado ni autorizado para pasar a fase 2. El usuario pidió retirar las pruebas automatizadas: esa infraestructura ya no forma parte del proyecto.

## Regla de entrega

Nunca hacer commits en `main`. Trabajar en una rama por fase, en este orden. Al cerrar cada fase, describir lo implementado y los pasos de revisión manual, detenerse y esperar aprobación explícita antes de integrar o seguir. No interpretar una petición de ajustes como aprobación de merge.

Como `main` no existe todavía, la primera integración aprobada la establecerá a partir de la rama de fase. No crearla ni integrarla anticipadamente. No publicar ni configurar servicios externos sin el alcance/autorización correspondiente.

## 1. feat/01-auth-y-google

**Entrega:** Next App Router, pnpm, TS estricto, Tailwind/UI, Neon/Drizzle mínimo, `authorized_emails` y tablas better-auth por CLI, seed del maestro, Google OAuth, middleware/proxy y pantalla simple de correos.

**Permisos:** todos consultan; solo el maestro añade/quita. Sesión y autorización vigentes también dentro de cada Server Action. Revocación atómica y maestro protegido.

**Revisión manual:** ingresar como maestro, rechazar un Google no autorizado, añadir otro correo, comprobar que puede consultar pero no gestionar, revocarlo y comprobar pérdida de acceso. Repetir seed sin duplicados.

**Pendiente externo:** revisar conexión Neon, migración/seed y cliente Google con callback local, usando la configuración privada existente.

## 2. feat/02-schema-y-seed

**Entrega:** esquema completo de negocio descrito en [proyecto.md](proyecto.md), migraciones y seed de libros de ambos sellos.

**Revisión manual:** revisar tablas/restricciones e inventario de ambos sellos; confirmar precios estándar/comunidad y repetición de seed sin duplicar datos.

**Datos necesarios:** catálogo/precios/stock iniciales; marcar cualquier dato de demostración como tal.

## 3. feat/03-wizard-frontend

**Entrega:** wizard de cuatro pasos: publicaciones, comprador, entrega, confirmación. Validación Zod y cálculo dinámico de precios/envío.

**Revisión manual:** probar ambos sellos y carrito mixto; comunidad con sede/correo institucional; público general; recojo, Lima/Callao y provincia; verificar desglose y obligatoriedad de departamento/ciudad.

**Datos necesarios:** sedes, campus, direcciones de bibliotecas y cuentas bancarias para mostrar instrucciones correctas.

## 4. feat/04-pedidos-pagos-drive

**Entrega:** Server Action de creación, recálculo de precios server-side, stock y numeración por año en transacción; seguimiento por token; FilePond multiarchivo por sello; Drive, correo y PDFs.

**Revisión manual:** crear cada tipo de pedido, abortar por stock insuficiente, revisar consecutivos por año y totales por cuenta, cargar/reintentar comprobantes por sello y confirmar recepción del correo con su PDF. Revisar manualmente el adjunto en Vercel.

**Datos necesarios:** credenciales y refresh token de cuenta propietaria, carpeta Drive y PDFs definitivos.

## 5. feat/05-admin-dashboard

**Entrega:** `/admin/pedidos` con tabla/filtros, aprobación independiente por sello y despacho; `/admin/inventario` con CRUD de stock/precios. La entrada administrativa abrirá pedidos cuando este módulo exista.

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
