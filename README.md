# Gestor de pedidos · Fondo Editorial Continental

**Versión 1.0.0.** Aplicación para comprar publicaciones, validar depósitos, coordinar distribución y entregar boletas y facturas. Compra y seguimiento se integran en WordPress. Fondo Editorial atiende en el Gestor y coordina la emisión con Tesorería por correo.

**[Solicitar publicaciones](https://fondoeditorial.continental.edu.pe/pedido/)** · **[Fondo Editorial](https://gestoreditorial.continental.edu.pe/admin/pedidos)**

## Documentación

Este README reúne instalación, despliegue y operación. Las guías de trabajo se consultan desde la Guía de uso de Fondo Editorial. [AGENTS.md](AGENTS.md) conserva las convenciones técnicas.

## Funciones principales

- Compra en cuatro pasos, precios comunidad/externos y descuentos por título; promociones y un cupón por compra sin acumulación. Cupones para todo el catálogo o títulos seleccionados.
- Stock y numeración anual transaccionales; creación idempotente y snapshots de compra.
- Pagos por unidad; mixtos con dos depósitos, carga automática y revisión independiente.
- Atención asignada, distribución, despacho/entrega, evidencia opcional y cancelación permitida según estado.
- Aviso a Tesorería por sello al verificar el pago. Fondo Editorial registra el PDF y el XML recibidos por correo. Los documentos de un pedido mixto se envían juntos al comprador.
- Inventario en tabla, configuración de campus/horarios/cuentas/accesos, tarifas de delivery, personal de apoyo para recojo, reportes e historial. Integraciones con comprobación manual de Google.
- Correos inmediatos en hilos separados por audiencia, sin cola ni reenvío posterior de fallos.

## Stack

Next.js App Router/Server Actions, React, TypeScript estricto, Tailwind y Base UI/shadcn. Better Auth/Google OAuth, Drizzle/PostgreSQL en Neon, Drive/Gmail, FilePond, Sileo, boneyard-js y Recharts. Versiones exactas en `package.json` y `pnpm-lock.yaml`.

## Instalación inicial

Requiere Node.js 24.22.1 o posterior de la rama 24, pnpm 11.3.0 y una BD Neon destinada a la aplicación. Las versiones compatibles se declaran en `engines` y `packageManager` de `package.json`; no se utiliza `.node-version`.

```bash
pnpm install --frozen-lockfile
cp .env.example .env.local
```

Completar las variables privadas y ejecutar:

```bash
pnpm db:setup
pnpm build
pnpm start
```

Para desarrollo local usar `pnpm dev`. `db:setup` instala un único esquema inicial sobre una BD vacía y ejecuta el seed en la misma transacción. En una BD compatible conserva la estructura/datos y siembra solo faltantes; ante diferencias aborta. No modifica automáticamente esquemas existentes ni llama a Google. Requiere permisos de instalación; el runtime debe usar un rol SQL restringido distinto. `DATABASE_SETUP_URL` permite una credencial temporal de instalación que no se debe desplegar al runtime.

Se conservan `schema.ts`, las tablas Better Auth generadas por CLI y un solo `src/db/schema.sql`. No hay historial de migraciones/snapshots de desarrollo ni comandos de borrado. **Un cambio de esquema con datos operativos requiere una actualización explícita y un respaldo**, fuera del build.

Para actualizar una instalación anterior con el flujo de apoyo para recojo, hacer un respaldo y aplicar una sola vez `src/db/updates/20261020-pickup-support.sql` antes de desplegar. No ejecutar `db:setup` como migrador.

Las instalaciones anteriores a las tarifas editables requieren además `src/db/updates/20261021-delivery-rates.sql` antes de desplegar esa versión. Conserva los importes históricos.

## Datos iniciales

`pnpm db:seed` incorpora el maestro `distribucionfe@continental.edu.pe`, cuatro cuentas receptoras confirmadas y ocho campus con dirección, ubicación interna y coordenadas. Omite conflictos y conserva registros existentes; no crea libros, pedidos, identidades OAuth ni mensajes.

La fuente es [seed-data.ts](src/db/seed-data.ts). Los cambios por interfaz no se sincronizan automáticamente con ese archivo. Mantener el respaldo operativo para recuperar la configuración vigente.

## Configuración y despliegue

Vercel instala/construye con pnpm; no ejecuta instalación de BD durante el build.

Vercel selecciona la rama 24 desde `engines.node` y administra sus versiones menores/parches; no permite fijar un parche concreto del runtime. Tras actualizaciones de seguridad, comprobar la versión de Node en los registros del despliegue (`node --version` en el comando de build) y la disponibilidad del runtime corregido en Vercel. La versión local no acredita la versión que está ejecutándose en producción. [Referencia de Vercel](https://vercel.com/docs/functions/runtimes/node-js/node-js-versions).

| Variable | Producción |
| --- | --- |
| `APP_URL` | `https://gestoreditorial.continental.edu.pe` |
| `WORDPRESS_ORIGINS` | `https://fondoeditorial.continental.edu.pe` |
| `WORDPRESS_ORDER_URL` | Opcional: solo para sobreescribir la página WordPress; producción ya usa `https://fondoeditorial.continental.edu.pe/pedido/` por defecto |
| `ENABLE_EXPERIMENTAL_COREPACK` | `1` en el build de Vercel para respetar `packageManager: pnpm@11.3.0`; sin uso en runtime |

Configurar además conexión SQL, secreto Better Auth y credenciales Google/cron según `.env.example`. No versionar valores privados ni ponerlos en WordPress.

Google: cliente Web, callback `<APP_URL>/api/auth/callback/google`, Drive API y Gmail API habilitadas. Login usa identidad; token propietario independiente con scopes `drive`, `gmail.send` y `gmail.metadata`. Guardar las credenciales en el entorno privado y bajo custodia institucional.

Correos operativos: `MAIL_PROVIDER=gmail` (predeterminado si se omite) conserva Gmail y sus conversaciones. Cuando TI habilite el remitente, `MAIL_PROVIDER=endpoint` activa el servicio institucional con mensajes independientes y asuntos `Pedido #… · Acción`; no hay fallback automático entre proveedores. Google sigue a cargo del login y de Drive. La prueba exitosa del endpoint fue declarada por el responsable; no acredita que el remitente definitivo esté habilitado.

**Actualización de una instalación existente:** antes de desplegar esta versión, respaldar la BD y aplicar explícitamente `src/db/updates/20261110-mail-endpoint.sql`. Añade columnas nullable de proveedor/ID a la auditoría, conservando metadatos históricos de Gmail; no borra ni reenvía registros. Este SQL no se ejecuta desde build ni `db:setup`. Incluso con Gmail activo, el código requiere estas columnas. La base inicial `schema.sql` ya las incluye para instalaciones vacías.

Endpoint: configurar `MAIL_ENDPOINT_URL`, `MAIL_ENDPOINT_TOKEN`, `MAIL_ENDPOINT_FROM`, `MAIL_ENDPOINT_FROM_NAME`, `MAIL_ENDPOINT_SYSTEM` y `MAIL_ENDPOINT_BUSINESS_UNIT` con los valores autorizados por TI. El ejemplo apunta a `apis-dev`: confirmar la URL de producción antes de activarlo. `MAIL_ENDPOINT_TOKEN` contiene solo el valor de `Ocp-Apim-Subscription-Key`, sin `Bearer`. En `.env.local` pueden envolverse valores con espacios en comillas; en el panel de Vercel se ingresan sin comillas envolventes. Para el proveedor endpoint, el logo usa la URL HTTPS pública `/isotipo-blanco.png` del `APP_URL`; Gmail conserva CID. El remitente debe recibir respuestas, en particular del apoyo de recojo, porque el contrato no expone `Reply-To`.

Avisos: comprobantes recibidos se dirigen exclusivamente a gestores FE vigentes al envío y habilitados antes del evento (excluye al comprador aunque su correo sea gestor), con enlace administrativo. Mixtos conservan un aviso conjunto por ciclo y una aprobación al validar ambos pagos. Los demás correos conservan sus copias vigentes. En Pagos se muestra el resultado de cada aviso a Tesorería. Distribución empieza al verificar todos los pagos, incluso si falta el buzón o falla un aviso. En ese caso revisa el buzón institucional y gestiona el envío manual.

**Configuración → Correos** (solo maestro) permite previsualizar y enviar individualmente los 12 avisos numerados del flujo con información ficticia. Incluye la solicitud de emisión a Tesorería por sello, boleta o factura y voucher de ejemplo, sin crear pedidos ni consultar archivos de Drive. Reutiliza los renderizadores operativos; las guías y los adjuntos de ejemplo (PDF y XML, según el aviso) son documentos ficticios sin valor. Los enlaces del ejemplo están desactivados. El envío requiere destinatario explícito, marca `[PRUEBA]` y no añade CC/CCO. Puede elegirse Gmail o el endpoint por prueba sin cambiar el proveedor operativo. No hay envío masivo ni envío al abrir la pestaña.

**Configuración → Integraciones** reúne el diagnóstico de aplicación, Google y WordPress. La prueba de correo se ejecuta en **Configuración → Correos**. El endpoint recibe `retry: 1` y la aplicación realiza un solo intento. HTTP satisfactorio e `isSuccess: true` significan aceptación. Ante timeout o resultado ambiguo, revisar el buzón con TI antes de repetir. Los avisos operativos salen después del commit para el evento recién creado.

`CRON_SECRET` mínimo 32 protege el cron diario de las 12:00 UTC, dedicado **solo a permisos de gestores en Drive**. No envía mensajes pendientes ni consulta Gmail para actualizar pantallas. No hay polling periódico del navegador.

Speed Insights está integrado con `@vercel/speed-insights` en el layout principal. Tras desplegar, revisar la pestaña **Speed Insights** del proyecto en Vercel y habilitar la opción incluida en el plan si aún no está activa; no contratar Plus automáticamente. Las métricas omiten parámetros, fragmentos y valores de tokens/IDs de las rutas. No consultan Neon ni añaden tareas programadas. Web Analytics (`@vercel/analytics`) registra visitas con el mismo filtro de privacidad; habilitarlo en **Analytics → Enable** del proyecto tras desplegar. No se envían eventos personalizados ni datos de formularios.

## WordPress y rutas

Copiar el bloque completo [wordpress-pedido.html](src/integrations/wordpress/wordpress-pedido.html). Valida origen/source, ajusta altura y desplaza etapas con espacio para el header móvil. Tras cambiar el receptor, regenerar y reemplazar el bloque real:

```bash
pnpm iframe:snippet --url https://gestoreditorial.continental.edu.pe/pedido --output src/integrations/wordpress/wordpress-pedido.html
```

Administración se abre en una pestaña propia, con sesión Google y autorización vigente en BD.

| Ruta | Finalidad |
| --- | --- |
| `/pedido` | Compra pública |
| `/seguimiento/[token]` | Seguimiento por enlace privado |
| `/admin` | Redirige a Pedidos |
| `/admin/pedidos`, `/admin/pedidos/[id]` | Bandeja y atención |
| `/admin/reporte`, `/admin/inventario` | Indicadores y catálogo |
| `/admin/promociones`, `/admin/cupones` | Descuentos |
| `/admin/configuracion` | Redirige a Accesos. El menú Configuración enlaza a Seguridad, Pagos, Entregas, Correos e Integraciones. |
| `/admin/guia` | Guía de atención de Fondo Editorial |

## Mantenimiento y seguridad

```bash
pnpm lint
pnpm typecheck
pnpm build
```

`pnpm db:schema:export` regenera **solo el SQL inicial** desde Drizzle; revisar su diff, no usarlo como actualización de una BD con datos. `pnpm db:auth:generate` mantiene las tablas Better Auth por CLI. Las guías de pago viven en `src/resources/payment-guides/`, el ubigeo en `src/resources/ubigeo/` y los logos en `public/`. Son recursos de producción. Reemplazar las guías con los nombres `guia_pago_universidad.pdf`, `guia_pago_instituto.pdf` y `guia_pago_mixta.pdf`, PDF válidos de hasta 3 MiB.

Los límites de creación se administran en **Configuración → Seguridad** desde la cuenta maestra. Son compartidos en BD y surten efecto sin redespliegue. El seed conserva los límites personalizados. El rol SQL de ejecución debe tener permisos mínimos y acceso de solo lectura e inserción a las tablas de auditoría.

### Respaldo y recuperación

- Conservar los pedidos y documentos de negocio sin purgas automáticas. Cualquier reinicio requiere autorización explícita y reconciliación de permisos de Drive.
- Hacer una copia manual semanal con `pg_dump --format=custom` por conexión directa de Neon. Verificar el archivo con `pg_restore --list`, cifrarlo y conservarlo en almacenamiento privado separado de los comprobantes, con la clave bajo custodia separada.
- Restaurar solo en una base aislada, con correos y cron desactivados. Comprobar integridad, referencias a Drive y permisos antes de reabrir tráfico. La copia de PostgreSQL guarda referencias a Drive y metadatos de Gmail. Los archivos y mensajes requieren su propia estrategia de respaldo.
- Objetivos operativos de recuperación: RPO de siete días y RTO de cuatro horas. Registrar fecha y duración de los ejercicios. El responsable confirmó la verificación de OAuth, Drive y restauración. La duración de la recuperación sigue por acreditar.

## Lanzamiento a producción

Para actualizar una instalación con el antiguo portal de Tesorería, verifica previamente que incorpora [la actualización de PDF/XML](src/db/updates/20261125-treasury-xml.sql). El corte se ejecuta fuera del build y requiere un respaldo de la base.

1. Con el despliegue anterior todavía activo, aplicar [la revocación de accesos](src/db/updates/20261127-revoke-treasury-access.sql). Retira las autorizaciones y sesiones del rol anterior e impide reactivarlas durante el corte. OAuth e identidades de gestores se conservan.
2. Dejar que el cron anterior concilie los permisos de archivos, en lotes de hasta 25 por ejecución. Comprobar que `drive_file_reader_grants` esté vacío. Si quedan intentos sin identificador, revisar su resolución con el propietario de Drive y TI antes de cerrar el corte. Conservar las referencias ante fallos o resultados ambiguos. Una lista vacía por archivo no prueba que un alta pendiente haya fallado. Retirar solo lectores directos gestionados.
3. Durante la ventana de corte, pausar las escrituras y ejecuciones del despliegue anterior. Aplicar una vez [la actualización de emisión editorial](src/db/updates/20261127-editorial-issuance.sql). La transacción se detiene si quedan accesos o permisos por conciliar. Conserva pedidos, archivos y lotes de emisión, y retira las tablas de atención de Tesorería. Otorgar al rol de ejecución permisos de lectura, inserción y actualización en `treasury_payment_notices`.
4. Desplegar la versión nueva y comprobar que el antiguo portal devuelve 404 y que las cuentas revocadas quedan fuera de administración. Revisar en **Configuración → Correos → Buzones de Tesorería** los destinatarios de Universidad e Instituto. Confirmar que Fondo Editorial atiende las respuestas en el Gmail institucional configurado mediante `GOOGLE_OWNER_EMAIL`. El aviso de validación usa Gmail incluso cuando el proveedor general es el endpoint.
5. Al recibir la boleta o factura, cargar el PDF y el XML originales en **Pedidos → Pagos** y confirmar los archivos del sello. Los borradores son privados. El PDF y el XML confirmados son descargables desde Seguimiento, y el aviso al comprador reúne los sellos requeridos. La confirmación documental puede realizarse después de entregar el pedido.

Las instalaciones nuevas usan `schema.sql` desde `db:setup` y omiten estos SQL incrementales. Validar el flujo de correo con los buzones autorizados fuera de producción.
