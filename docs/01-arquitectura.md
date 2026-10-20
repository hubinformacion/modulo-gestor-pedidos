# 01 · Arquitectura y diagramas

[← Inicio](00-inicio.md) · [Siguiente: Seguridad →](02-seguridad.md)

## Solución completa

**Monolito modular Next.js en Vercel**, con PostgreSQL en Neon y servicios Google. WordPress embebe únicamente compra/seguimiento; el personal opera en una pestaña propia con Google OAuth. La plataforma coordina ventas y documentos; no procesa tarjetas, transfiere dinero ni emite directamente documentos tributarios.

![Arquitectura completa del sistema](diagramas/01-arquitectura.png)

Para Word: [PNG de alta resolución](diagramas/01-arquitectura.png). Para modificar o ampliar sin perder calidad: [SVG fuente](diagramas/01-arquitectura.svg). El dibujo representa componentes y relaciones, no una certificación de las consolas ni un orden temporal de ejecución.

## Leyenda común

| Símbolo o término | Cómo leerlo |
| --- | --- |
| Tarjeta/rectángulo | Componente, servicio o punto de acceso; el texto identifica su función |
| Cilindro | Base de datos persistente |
| Contorno punteado con título | Límite de proveedor/ejecución; no significa que exista una red privada o VPC |
| Flecha continua A → B | A utiliza/invoca B; por claridad no se dibuja cada respuesta |
| Flecha punteada | Despliegue fuera del flujo de negocio; no representa polling ni una cola |
| Bloque morado/lila | Componente central del sistema; el color no concede un permiso ni indica un error |
| Franja de respaldo | Procedimiento manual separado, no una tarea automática desplegada |
| Estado en el diagrama de 04 | Situación de un pedido; una flecha muestra una transición permitida, con su condición escrita |
| Punto inicial/final en 04 | Inicio o cierre del proceso; no es una tabla ni la eliminación del registro |

No confundir **arquitectura** (qué componentes existen y cómo se conectan) con **flujo** (en qué orden se atiende un pedido). Los identificadores internos `caja` y `EN_PREPARACION` se presentan como Tesorería Recaudación y Distribución.

## Herramientas de programación

| Capa | Herramientas | Responsabilidad |
| --- | --- | --- |
| Aplicación | Node.js 24, pnpm 11, TypeScript estricto, Next.js 16, React 19 | App Router, renderizado de servidor, Server Actions y rutas de archivos |
| Interfaz | Tailwind, Base UI/shadcn, Inter, FilePond, Sileo, boneyard-js, Recharts | Interacción, cargas, notificaciones, skeletons e indicadores |
| Validación/acceso | Zod, Better Auth, Google OAuth, nanoid | Validación de entradas, sesiones y enlaces privados; permisos propios en BD |
| Datos | Drizzle ORM, PostgreSQL Neon, @neondatabase/serverless | Consultas parametrizadas, esquema, constraints y transacciones |
| Google | googleapis, google-auth-library | OAuth propietario separado para Drive/Gmail |
| Entrega/calidad | Git/GitHub, Vercel, ESLint, TypeScript/Next build | Versionado, despliegue y comprobación estática |

Versiones exactas: `package.json` y `pnpm-lock.yaml`. No hay framework de suites automatizadas por decisión del proyecto. El editor del desarrollador no es una dependencia. Herramientas locales de recursos, como Sharp, no ejecutan generación de imágenes durante un envío de correo.

## Componentes y límites

| Componente | Función y límite de confianza |
| --- | --- |
| Comprador/WordPress | Iframe de compra y seguimiento; token privado por pedido, sin login Google del comprador |
| Módulos internos | Gestores y Tesorería entran directamente a Vercel. Maestro y buzones consultan casos; cuentas personales atienden |
| Acceso y servicios Next.js | Autorización por sesión/rol/unidad/asignación; validación, reglas y efectos desde servidor |
| Neon | HTTP para lecturas; Pool WebSocket por petición para auth/transacciones. No son WebSockets de sincronización de pantallas |
| Drive | Comprobantes, PDF y evidencia privados; permisos nominados por carpeta o archivo según rol |
| Gmail | Avisos nuevos en hilo del comprador y uno interno por solicitud/unidad y aviso separado al apoyo para recojo; sin cola ni recuperación histórica |
| Cron diario | Ruta protegida a las 12:00 UTC, exclusivamente reconciliación de permisos Drive; no envía correos ni hace backups |
| Respaldo | Exportación manual cifrada, fuera de Vercel, a carpeta Drive separada y privada; automatización no implementada |

WordPress usa handshake, `origin/source` exactos y ajuste de altura/scroll. No intercambia PII por postMessage ni comparte la sesión interna. No se relajan cookies/CORS para incrustar administración.

## Datos principales

| Grupo | Tablas y contenido |
| --- | --- |
| Identidad | Tablas Better Auth y `authorized_emails`; la autorización es independiente de que exista identidad OAuth |
| Configuración | `campuses`, `bank_accounts`, `treasury_mailboxes`, `pickup_contacts`, `order_admission_policy` |
| Compra | `books`, `orders`, `order_items`, contador anual, guías y descuentos/cupones |
| Archivos | Intentos durables de carga, recibos, evidencia y PDF de venta; IDs/hash en BD, bytes en Drive |
| Tesorería | Solicitudes, responsable, observaciones/correcciones, notas, documentos y lotes de PDF |
| Auditoría | Actividades de pedido/Tesorería, `management_audit`, `pickup_notifications`, cambios de cuotas y resultado/metadatos de correo |
| Permisos técnicos | Grants Drive y contadores HMAC de admisión, sin IP/correo en claro en estos contadores |

PostgreSQL conserva nombres/precios/cuentas/destino/guía/consentimiento como snapshots. Los importes usan `numeric(12,2)` y cálculo en céntimos. El teléfono, DNI/dirección y tokens OAuth no tienen cifrado propio por campo; el alcance de protección se explica en 02.

## Consistencia y operación

- Stock, cuotas, numeración anual, partidas y recepción se confirman juntos; un fallo revierte la compra completa. UUID/hash de intento evita duplicar un pedido ya creado.
- Locks ordenados, versión y responsable protegen transiciones; no se reintentan mutaciones ambiguas. Cuotas y pendientes se comparten entre instancias.
- Google queda fuera de locks de pedido/stock. ID de carga/intención ACL durable permite tratar respuestas perdidas sin hacer público el archivo.
- BD y Google no comparten transacción distribuida. Fallos se registran; no se promete exactamente una entrega ante timeout ambiguo de Gmail.
- Sin polling periódico: actualización por acciones, retorno a pestaña limitado y botón manual; pausa durante cargas/borradores.

## Estructura de código

`src/app`: rutas/acciones; `src/components`: UI; `src/lib`: reglas/acceso/integraciones; `src/db`: esquema, SQL inicial, instalador y seed; `src/iframe`: integración WordPress; `src/assets`: PDF e imágenes usadas. Los módulos `server-only` no se importan desde clientes. No hay carpetas de configuración vacías necesarias.
