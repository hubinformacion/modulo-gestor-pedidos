# Gestor de pedidos · Fondo Editorial Continental

Catálogo y pedidos de publicaciones de Universidad Continental e Instituto Continental, con pagos por sello, seguimiento del comprador y atención del equipo. La aplicación se aloja en Vercel y se integra en WordPress mediante un iframe responsivo.

**[Solicitar publicaciones](https://fondoeditorial.continental.edu.pe/pedido/)** · **[Administración](https://modulo-gestor-pedidos.vercel.app/admin/pedidos)**

## Funcionalidades

- Compra en cuatro pasos con precios por tipo de comprador, ubigeo nacional y recojo en bibliotecas.
- Cancelación previa al pago verificado y anulación del gestor antes del despacho, con restitución de stock e historial.
- Stock y numeración anual transaccionales; importes y datos de compra conservados como snapshots.
- Promociones por temporada y cupones con límites de uso, sin acumulación de descuentos.
- Pagos independientes por sello y carga automática de comprobantes en Drive.
- Caja por sello: solicitudes de boleta/factura, PDF como borrador, finalización y correcciones.
- Gestores autoasignados, revisión de pagos, distribución, despacho, entrega y notas internas.
- Inventario editable en tabla; configuración de autorizados, campus, ubicaciones y cuentas.
- Correos de avance en un mismo hilo, guías PDF y recuperación automática de avisos.
- Seguimiento por Pago/Distribución/Entrega, consultable después del cierre, con descarga de boletas/facturas.
- Evidencia opcional de entrega o recojo mediante FilePond.
- Seguimiento dentro de WordPress, altura adaptable, ilustraciones estáticas y tema claro.

## Tecnología

Next.js App Router y Server Actions, React, TypeScript estricto, pnpm, Tailwind CSS y Base UI. Better Auth con Google OAuth y adaptador Drizzle; PostgreSQL en Neon. FilePond, Sileo, `boneyard-js` y las APIs de Google Drive/Gmail completan el flujo.

## Desarrollo local

Node.js 22 o superior —24 recomendado— y pnpm 11.3.0.

```bash
pnpm install --frozen-lockfile
cp .env.example .env.local
```

Completa las variables privadas de `.env.local`. Para desarrollo, utiliza `http://localhost:3000` en `APP_URL` y `BETTER_AUTH_URL`, y registra en Google el callback `http://localhost:3000/api/auth/callback/google`.

```bash
pnpm db:migrate
pnpm db:seed
pnpm dev
```

El seed solo asegura el correo maestro y es idempotente. Libros, precios, stock, campus y cuentas se administran por interfaz; no se crean datos ficticios.

| Ruta | Uso |
| --- | --- |
| `/pedido` | Catálogo y creación del pedido |
| `/seguimiento/[token]` | Seguimiento público mediante enlace privado |
| `/admin` | Redirige a Pedidos |
| `/admin/pedidos` | Bandeja y atención de pedidos |
| `/admin/dashboard` | Indicadores de pedidos, importes, atención y stock |
| `/admin/inventario` | Publicaciones, stock y precios |
| `/admin/promociones` | Campañas, fechas, públicos y títulos |
| `/admin/cupones` | Códigos, vigencia y límites de uso |
| `/caja` | Bandeja exclusiva de caja, por sello |
| `/caja/[id]` | Emisión y finalización de boleta/factura |
| `/admin/configuracion` | Correos, campus, cuentas e integraciones |

El alias `/admin/configuración` también abre configuración. Administración requiere sesión Google y correo vigente en `authorized_emails`. Solo `distribucionfe@continental.edu.pe` gestiona autorizados; los demás gestores comparten funciones operativas. Los responsables de caja tienen acceso exclusivo a su sello en `/caja`, configurado desde la pestaña Responsables de caja. El ingreso Google redirige según el acceso autorizado. Cada pedido tiene un gestor responsable de sus cambios de estado.

## Producción en Vercel

Importa `main`, utiliza Node.js 24 y configura las variables de `.env.example` en **Production**. Vercel instala y construye exclusivamente con pnpm mediante `vercel.json`.

| Variable | Valor de producción |
| --- | --- |
| `BETTER_AUTH_URL` | `https://modulo-gestor-pedidos.vercel.app` |
| `APP_URL` | `https://modulo-gestor-pedidos.vercel.app` |
| `WORDPRESS_ORIGINS` | `https://fondoeditorial.continental.edu.pe` |
| `WORDPRESS_ORDER_URL` | `https://fondoeditorial.continental.edu.pe/pedido/` |
| `ENABLE_EXPERIMENTAL_COREPACK` | `1` |

Configura también `DATABASE_URL`, `BETTER_AUTH_SECRET`, las credenciales de Google, el correo/carpeta propietario y `CRON_SECRET`. No publiques `.env.local` ni pongas secretos en WordPress. Guarda las variables y vuelve a desplegar para aplicar cambios; la CSP se construye con los orígenes configurados.

`CRON_SECRET` protege `/api/internal/jobs`. Usa una cadena aleatoria de al menos 32 caracteres, sin prefijo `Bearer`; Vercel añade ese encabezado automáticamente. El cron diario está programado a las 12:00 UTC, 07:00 de Perú, para recuperar avisos y sincronizar permisos de Drive. Las operaciones normales envían correos inmediatamente, sin esperar al cron ni requerir aprobación manual.

Las migraciones se aplican explícitamente contra la BD destino, **fuera del build**. Conserva todo `src/db/migrations`, incluidos sus snapshots y journal. No regeneres ni edites migraciones ya aplicadas.

## Google OAuth, Drive y Gmail

Utiliza un cliente OAuth de tipo **Web application**. Registra:

- Origen autorizado: `https://modulo-gestor-pedidos.vercel.app`.
- Callback: `https://modulo-gestor-pedidos.vercel.app/api/auth/callback/google`.

Conserva los callbacks de localhost y OAuth Playground si aún se usan. Habilita **Google Drive API** y **Gmail API** en el proyecto del cliente. El login de gestores solo solicita identidad; la cuenta propietaria usa un refresh token independiente con estos scopes:

```text
https://www.googleapis.com/auth/drive
https://www.googleapis.com/auth/gmail.send
https://www.googleapis.com/auth/gmail.metadata
```

Revisa Audience: Internal cuando corresponda a la organización, o Production para uso externo. Los tokens de Drive/Gmail emitidos en External/Testing expiran a los siete días. Guarda tokens y secretos únicamente en variables privadas.

Comprobantes y evidencia fotográfica permanecen privados en Drive; la carpeta comparte lectores nominados según autorizados. El comprador recibe confirmaciones, sin enlaces a esos archivos. Gmail metadata permite conservar las referencias reales del hilo.

## WordPress

Pega el contenido completo de [wordpress-pedido.html](src/iframe/wordpress-pedido.html) en un bloque HTML de la página de pedidos. Al continuar un wizard, el bloque desplaza la página al inicio de la etapa con espacio para el header (`--fec-scroll-offset`: 128 px mobile / 112 px desktop). El bloque añade 80 px de espacio superior en móviles para el header de WordPress (configurable con `--fec-mobile-top-space`), usa el ancho de su contenedor y ajusta la altura y abre los enlaces de seguimiento `#seguimiento/TOKEN` dentro del iframe.

Para regenerarlo:

```bash
pnpm iframe:snippet --url https://modulo-gestor-pedidos.vercel.app/pedido --output src/iframe/wordpress-pedido.html
```

Si WordPress elimina scripts, carga [wordpress-embed.js](src/iframe/wordpress-embed.js) desde el tema o plugin y conserva el atributo `data-fec-iframe`. Reemplaza también el receptor al actualizar su protocolo. Configura `WORDPRESS_ORIGINS` sin rutas ni comodines; no añadas un `X-Frame-Options` contradictorio.

Administración se opera en una pestaña propia de Vercel para evitar restricciones de cookies de terceros. `APP_URL` y `BETTER_AUTH_URL` siempre identifican la aplicación Next, no WordPress. El token de seguimiento es una credencial: evita recopilar el fragmento de URL en analítica.

## Mantenimiento

```bash
pnpm lint
pnpm typecheck
pnpm build
pnpm start
```

Ante cambios de esquema, genera una migración con `pnpm db:generate` y aplícala con `pnpm db:migrate`. Las tablas de Better Auth se generan mediante `pnpm db:auth:generate`, no se editan a mano.

Las guías viven en `src/assets/pdfs`, fuera de `public`:

- `guia_pago_universidad.pdf`
- `guia_pago_instituto.pdf`
- `guia_pago_mixta.pdf`

Mantén su contenido alineado con las cuentas vigentes y los dos depósitos de un pedido mixto. Los pedidos anteriores conservan su guía y datos de pago originales. Las ilustraciones de correo son SVG/PNG transparentes; modifica [generate.ts](src/assets/email/generate.ts) y regenera con `pnpm email:assets`.

No hay consultas periódicas del navegador: las pantallas actualizan tras operaciones, al volver a la pestaña o mediante el icono de actualizar. Un fallo temporal de BD no cierra la sesión; la cola conserva los avisos para recuperación. Revisa consumo de Neon, logs Vercel y vencimiento/revocación del token propietario ante incidentes.

[AGENTS.md](AGENTS.md) conserva el contexto técnico y las reglas de trabajo para próximas sesiones.

## Emisión por caja

Configura los correos Google de cada sello desde **Configuración → Responsables de caja**, usando el maestro. Cada pago verificado genera automáticamente una solicitud para su sello; no espera al otro ni bloquea distribución o entrega. Las solicitudes sin responsable configurado se conservan pendientes. Caja consulta solo su bandeja, datos de emisión, códigos de publicaciones y comprobantes verificados por Fondo Editorial. Los enlaces abren Drive con permisos individuales de lectura; no recibe acceso a la carpeta completa.

Caja adjunta un PDF de hasta 3 MB, consulta su vista previa o retira el borrador y pulsa **Finalizar solicitud**. Esto confirma el archivo y avisa al gestor en el hilo interno del pedido/sello. El nombre original del PDF se conserva en Drive, correos y descargas. El comprador recibe el PDF en su hilo existente; en pedidos mixtos recibe **un solo correo con ambos PDF**, cuando las dos solicitudes estén finalizadas. El gestor asignado puede devolver un documento con un motivo y caja lo corrige en una nueva revisión. El historial muestra únicamente documentos anteriores cuando hay correcciones, sin repetir el PDF actual ni los intentos de carga. El correo de corrección reúne los documentos vigentes. En el gestor, la emisión se consulta en el paso Pagos; el comprador descarga los documentos desde ese mismo paso en su seguimiento.

La funcionalidad requiere las migraciones 0012 y 0013. Para validar cambios futuros, utiliza una BD separada de producción. Los pedidos anteriores no generan solicitudes ni correos retroactivos por aplicar la migración.

El comprador puede cancelar mientras ningún pago esté verificado, con motivo opcional. El gestor asignado puede anular antes del despacho, con motivo obligatorio. Se restituye el stock una única vez y se conserva el pedido, su numeración, pagos y documentos. Las solicitudes de caja se cierran y se envían avisos en los hilos existentes. La devolución de depósitos y la corrección de documentos emitidos se coordinan manualmente; la plataforma no ejecuta transferencias. Esta operación requiere la migración 0013.


## Promociones por temporada

En `/admin/promociones`, los gestores registran campañas activas/inactivas, porcentajes separados para comunidad y público general y las publicaciones participantes (o todo el catálogo). Las fechas y horas se ingresan en horario de Perú. Usa 0 si un público no participa; los descuentos adicionales admiten porcentajes enteros del 1 al 99. La mayor promoción vigente por título se aplica automáticamente al precio correspondiente; el envío conserva su costo.

El comprador revisa precios actualizados en confirmación; la creación vuelve a calcularlos en servidor y detiene el envío si cambió el resumen aceptado. Los pedidos guardan descuentos y precios aplicados, incluso al editar o desactivar campañas. Las campañas con pedidos asociados no se eliminan. Migración 0014 requerida.


## Cupones

En `/admin/cupones`, los gestores crean o generan un código, porcentaje de 1–99%, público destinatario, vigencia opcional y cantidad máxima de usos o ilimitados. El comprador lo aplica en confirmación. No se combinan promociones y cupones: se comparan ambas alternativas completas y se conserva el mayor ahorro. En empate se conservan las promociones; no se consume el cupón. El envío mantiene su importe.

Un cupón aplicado consume un uso en la misma transacción de creación/stock/pedido. Reintentos no duplican usos; dos compradores simultáneos no pueden superar el límite. Al cancelar o anular sin pagos verificados se libera el uso una sola vez. Con un pago verificado se conserva consumido. Código/porcentaje/precios quedan guardados en el pedido; el contador no se edita manualmente y los cupones con historial no se eliminan ni se renombra su código. Migración 0015 requerida.

Promociones y cupones están integrados. Las migraciones conservan datos existentes y no crean campañas/códigos de ejemplo.

## Puesta en operación

1. Ingresa con el correo maestro en Administración y registra gestores y responsables de caja.
2. Carga las publicaciones reales en Inventario con precios y stock; revisa campus, ubicaciones y cuentas bancarias en Configuración.
3. Verifica el contenido de las tres guías PDF y su correspondencia con las cuentas vigentes. Configuración → Integraciones comprueba presencia/formato de configuración; no confirma que el token Google siga autorizado.
4. Pega el bloque HTML completo del iframe en WordPress y revisa ancho/altura en móvil y escritorio. La aplicación desplegada no actualiza automáticamente el bloque de WordPress.

El reinicio autorizado conserva configuración y migraciones, pero exige volver a registrar catálogo y accesos. Los archivos de Drive y correos ya enviados no se borran al reiniciar la BD. No repitas un reinicio sobre datos operativos.

## Diagnóstico y continuidad

- **Acceso:** comprobar autorización/rol en Configuración. Un 503 indica fallo temporal del servicio; no eliminar cookies ni cambiar permisos como solución.
- **Archivos:** revisar credenciales del propietario, carpeta Drive y permisos. El usuario conserva la selección ante errores; reintentar el mismo archivo evita duplicados.
- **Correos:** revisar errores `order.mail`, `caja.mail` y `jobs` en Vercel y autorización del token propietario. La cola reintenta automáticamente; no reenviar manualmente registros ENVIADO.
- **Precios:** actualizar el resumen si cambió una campaña o cupón; el stock y los usos se confirman únicamente al crear el pedido.
- **Dependencias:** ejecutar `pnpm audit --prod` al actualizar el stack. `pnpm-workspace.yaml` contiene un override puntual para el esbuild transitivo del loader de Drizzle; conservarlo hasta que la dependencia de origen incorpore una versión corregida.

Conserva migraciones, snapshots, journal, guías y la atribución de los datos de ubigeo. Mantén desarrollo/validación en una BD separada y acuerda respaldos/restauración de la BD y conservación de archivos Drive antes de operar con datos reales. Las comprobaciones locales de código no sustituyen la validación real de Google OAuth, Drive/Gmail y el bloque WordPress.

## Dashboard y seguimiento del equipo

Todos los gestores pueden consultar `/admin/dashboard`, organizado en **Pedidos e importes**, **Atención** e **Inventario**. Las pestañas conservan los filtros y pueden compartirse mediante su URL; Inventario solo muestra el filtro de sello. En el menú, Pedidos aparece antes de Dashboard. El período se refiere a la **fecha de registro del pedido**, con mes actual por defecto y rangos de hasta 366 días en horario de Perú. Los estados mostrados son los actuales de esos pedidos. Filtra por sello y responsable; el stock actual ignora fechas/gestor y los pendientes actuales ignoran fechas, con etiquetas explícitas.

El importe solicitado excluye cancelados; el importe verificado suma únicamente los pagos aprobados por sello, incluso si el otro sello de un pedido mixto sigue pendiente. Los importes incluyen el envío correspondiente y los descuentos aplicados. No son un reporte de conciliación bancaria ni de devoluciones. Los tiempos muestran la mediana y su muestra, en horas/días calendario, incluyendo esperas del comprador. Primera asignación se obtiene del historial, despacho/entrega desde el registro y emisión desde la solicitud a caja.

Gráficas shadcn/ui con Recharts y tablas complementarias muestran evolución y títulos más solicitados; tarjetas resumen estados, stock bajo/agotado y atención por responsable. El botón de actualizar consulta nuevamente, sin refresco periódico. Sin pedidos, aparecen valores cero o «Sin datos», nunca datos de ejemplo.

Los correos al comprador y a caja incluyen CC a los gestores vigentes cuyo acceso sea anterior al evento. Un alta o reincorporación solo recibe eventos posteriores; no se reenvían conversaciones históricas. La recuperación técnica de avisos fallidos sigue automática, pero no incorpora gestores recién añadidos a esos avisos anteriores. No se requiere autorización manual para enviar avisos y los mensajes ENVIADO nunca se reenvían por un cambio de acceso.


## Varios responsables de caja

El maestro añade o revoca correos individuales por sello en Configuración → Responsables de caja. Cada cuenta utiliza Google y pertenece a un único sello. Todas las personas del mismo sello pueden consultar su bandeja; filtra por Todas, Por asignar o Mis solicitudes.

En el detalle, pulsa **Tomar atención** antes de cargar el PDF. Solo la persona asignada puede cargar, retirar o finalizar el documento; el resto consulta datos, vista previa e historial. **Liberar solicitud** permite el relevo conservando el borrador. Revocar un acceso cierra sus sesiones y libera sus solicitudes abiertas; los registros cerrados conservan su responsable. Una devolución a caja abre un nuevo ciclo disponible para el equipo.

El correo interno de cada evento se envía una sola vez a los responsables elegibles de ese sello, con los gestores en CC. Altas/reincorporaciones no reciben eventos históricos y no generan reenvíos; la recuperación técnica de fallos continúa automática. Universidad e Instituto mantienen bandejas e hilos separados. La funcionalidad requiere la migración 0016, aplicada fuera del build sin reiniciar datos.
