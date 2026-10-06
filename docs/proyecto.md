# Contexto y requisitos del proyecto

## Objetivo y decisiones vigentes

Sistema web de gestión de pedidos del Fondo Editorial Continental, desarrollado con Next.js, desplegado en Vercel y embebido mediante iframe responsivo en WordPress. La aplicación funciona como una herramienta integrada: no tiene landing, logos, slogans ni encabezados o pies corporativos.

La interfaz usa español, Inter, tema claro, fondo blanco y color principal `#6802C1`. Los nombres de sellos, cuentas y correos necesarios para operar son datos del sistema; no se sustituyen por contenido de marca.

Las rutas administrativas requieren Google OAuth y autorización en BD. Se mantiene el acuerdo previo de compra y seguimiento por token públicos; el cambio visual no modifica permisos. El acceso de administración no tiene roles operativos. La excepción vigente es que solo el correo maestro gestiona la lista de autorizados.

Por decisión del usuario se retiró la infraestructura de pruebas automatizadas. No crear, ejecutar ni reinstalar suites/frameworks de pruebas salvo petición explícita posterior. No reinstaurar instrucciones anteriores que las exigían. Una revisión manual y comprobaciones puntuales de compilación, tipos o lint pueden realizarse al terminar los cambios; evitar repeticiones innecesarias.

## Stack obligatorio

Usar exclusivamente pnpm, con `pnpm-lock.yaml`. Nunca npm, yarn o bun.

| Función | Paquetes / servicio |
| --- | --- |
| Aplicación | `next` App Router y Server Actions, `react`, `react-dom`, TypeScript estricto |
| Acceso | `better-auth`, adaptador Drizzle y Google OAuth |
| Base de datos | `drizzle-orm`, `@neondatabase/serverless`, `drizzle-kit`, Postgres en Neon |
| Interfaz | `tailwindcss`, shadcn/ui sobre Base UI; Inter autohospedada |
| Estados de carga | `boneyard-js` (el paquete no es `boneyard`) |
| Notificaciones | `sileo` |
| Google Drive / Gmail | `googleapis`, `google-auth-library` |
| Comprobantes | `filepond`, `react-filepond`, plugins de validación de tipo/tamaño; sin preview |
| Identificadores | `nanoid` para tracking, mínimo 24 caracteres |
| Validación | `zod`, en cliente y en cada Server Action |

Instalar paquetes de fases posteriores cuando corresponda, sin adelantar sus funcionalidades.

## Acceso y gestión de correos

- No hay registro abierto ni acceso por contraseña. La autorización depende de `authorized_emails`, nunca exclusivamente de variables de entorno.
- Seed inicial idempotente: `distribucionfe@continental.edu.pe`.
- Una cuenta Google verificada previamente autorizada puede crear su usuario de better-auth al ingresar por primera vez. Un correo no autorizado no puede crear usuario ni sesión.
- Validar también el correo recibido de Google en ingresos posteriores y consultar la autorización vigente con cada petición protegida.
- Todos los autorizados operan el sistema, gestionan campus y consultan la lista; solo el maestro añade o elimina correos. El maestro no se elimina desde la aplicación.
- Configuración en `/admin`: lista sencilla con alta/baja, sin gestor de usuarios ni de roles. Pedidos e inventario conservan rutas propias.
- Normalizar correos a minúsculas y quitar espacios externos; `added_by` procede de la sesión, nunca del cliente.
- Comprobar sesión válida y tabla en el middleware (`src/proxy.ts` en Next 16), páginas y Server Actions. Una cookie presente no demuestra autorización.
- Revocar un correo y eliminar sus sesiones en una misma transacción. La revocación no depende de cachés; reautorizar exige una sesión nueva.
- Sesiones actuales: siete días. Ante fallos de BD/servicio, denegar acceso y mostrar mensajes recuperables sin exponer secretos.
- Las tablas de better-auth se generan con su CLI; no se escriben a mano.

Esta restricción del maestro reemplaza la regla original que permitía a todos administrar correos; las demás funciones siguen siendo iguales para los autorizados.

## Catálogo, comprador y precios

Dos sellos: Universidad Continental e Instituto Continental, cada uno con cuenta bancaria propia.

El carrito deriva `order_type`:
- `solo_universidad`
- `solo_instituto`
- `mixto`

Comunidad Continental exige sede y correo `@continental.edu.pe`; usa `community_price`. Público general usa `standard_price`. Recalcular al completar el paso del comprador y nuevamente en el servidor al crear el pedido. Nunca confiar en importes, sello ni tipo de pedido enviados por el cliente: recuperarlos del catálogo/BD.

Conservar el precio aplicado en cada `order_item`; los cambios posteriores en inventario no deben alterar pedidos existentes. La aritmética monetaria debe ser exacta.

## Entrega y desglose

| Modalidad | Flete | Datos requeridos |
| --- | --- | --- |
| Recojo campus | S/0 | Campus y dirección de su biblioteca visible |
| Lima / Callao | S/15 | Zona, dirección y datos de entrega |
| Provincia | S/25 | Departamento, ciudad, dirección y datos de entrega |

Departamento/provincia/distrito por ubigeo local en delivery; la zona y tarifa se derivan del distrito, sin selección de precio. Costos solo en resumen. Calle/número y referencia permanecen libres. Quien recibe/recoge es el comprador actual u otra persona con nombres, DNI y teléfono. Facturación opcional: RUC y razón social.

Pedido mixto: dos depósitos independientes. El flete se cobra **solo en la cuenta de Universidad**, únicamente si es delivery. En recojo campus, cero. Mostrar subtotales, flete y total por cuenta, además del total general.

La confirmación debe usar la plantilla y guía PDF del tipo de pedido: solo Universidad, solo Instituto o mixto (`guia_pago_mixta.pdf`).

## Comprobantes y aprobación de pago

- Una zona FilePond por sello aplicable admite varios archivos; mixto muestra dos. El sello es fijo por zona, sin desplegable. Adjuntar sube automáticamente a Drive; guardar pasa directamente ese pago a EN_REVISION y envía aviso en el hilo del pedido, sin confirmación adicional.
- Validar tipo/tamaño en cliente y servidor; sin vista previa. Ocultar la carga al terminar el lote, conservar el acuse y habilitarla nuevamente solo si se rechaza el comprobante.
- Guardar comprobantes en Google Drive y sus identificadores/links en `payment_receipts`.
- Aprobar de forma independiente `payment_status_universidad` y `payment_status_instituto`.
- El sello que no aplica se crea con `NO_APLICA`.
- Pasar a `EN_PREPARACION` solo cuando todos los pagos requeridos por el tipo de pedido están verificados.
- Si se rechaza un pago, permitir volver a cargar únicamente el comprobante del sello rechazado, conservando el pago del otro.
- El seguimiento usa `/seguimiento/[tracking_token]`, con tokens únicos de nanoid de al menos 24 caracteres.

## Stock y numeración

Validar stock y crear el pedido/items en una misma transacción. Si falta stock, abortar todo: no dejar pedido parcial ni modificaciones de stock.

Numeración `secuencial-año`, por ejemplo `19-2026`, reiniciada cada año. Usar `order_counters` con una fila por año y lock transaccional; no un serial global. Mantener consistencia con la zona horaria del negocio (`America/Lima`).

## Esquema de negocio esperado

Fuente: `src/db/schema.ts`. Las tablas de better-auth permanecen separadas en `src/db/auth-schema.ts` y se exportan desde el esquema.

| Tabla | Campos y restricciones |
| --- | --- |
| campuses | id, nombre único normalizado, dirección biblioteca, latitud/longitud opcionales, URL Google Maps embebido, estado activo/inactivo y timestamps; CRUD por autorizados, borrado restringido si hay pedidos |
| books | id, inventory_code único, title, author, publisher_imprint, standard_price, community_price, stock, status, timestamps |
| order_counters | year PK, last_number |
| orders | id, order_number único, tracking_token único/indexado, order_type; comprador (tipo, sede si aplica, nombre, correo, teléfono, documento); entrega (tipo, campus/zona, departamento/ciudad si aplica, dirección, referencia, receptor); subtotales, envío, totales por sello y general; facturación opcional (RUC, razón social); order_status, payment_status_universidad, payment_status_instituto, courier, timestamps |
| order_items | id, order_id, book_id, publisher_imprint, unit_price aplicado al comprar, quantity, subtotal |
| payment_receipts | id, order_id, sello, drive_file_id, drive_view_url, file_name, uploaded_at |
| authorized_emails | email PK, added_by, created_at |
| better-auth | user, session, account, verification; generadas por CLI |

Fases 1–4 aprobadas e integradas localmente en `main`. Creación/pagos/seguimiento implementados; aprobación/despacho e inventario CRUD implementados en la rama de fase 5, pendiente de revisión. Configuración y validación real de Google/PDF/Vercel siguen pendientes.

## Integración Google prevista

Implementar en `src/lib/google.ts`:
- `OAuth2Client` con `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REFRESH_TOKEN` de la cuenta propietaria.
- `uploadFileToDrive`: carpeta `GOOGLE_DRIVE_FOLDER_ID`, permiso de lectura y link.
- `sendOrderConfirmationEmail`: MIME multipart con HTML y adjunto codificado; mensaje para Gmail en base64url.
- Tres plantillas y PDF correspondiente al sello/tipo de pedido.
- Guardar PDFs fuera de `public`, en `src/assets/pdfs`; asegurar su empaquetado en funciones serverless.
- Envolver Drive/Gmail con try/catch y **un reintento**, conservando la carga del cliente ante fallos.
- Revisar manualmente el adjunto en Vercel, no únicamente localmente.

La autorización Google del administrador usa únicamente identidad; no sustituye el refresh token de Drive/Gmail de la cuenta propietaria.

## WordPress / Vercel previstos

- iframe responsivo con `postMessage` de altura.
- CSP `frame-ancestors` con los dominios WordPress permitidos; sin `X-Frame-Options` contradictorio.
- Configurar URL/callback OAuth HTTPS estable en Vercel.
- Completar `.env.example` con todas las variables al finalizar las integraciones.
- Revisión manual de un embebido que simule WordPress y del adjunto en funciones Vercel.
- La interfaz no duplica marcas, logos ni contenido corporativo que ya existe en WordPress.

## Información externa aún necesaria

Acceso a Vercel; dominios reales de Vercel/WordPress; cuentas bancarias por sello; catálogo y precios/stock iniciales; coordenadas/URLs precisas de bibliotecas, editables en `/admin`, si la búsqueda por dirección no coincide; PDFs de pago aprobados y credenciales Drive/Gmail. Google OAuth y Neon ya configurados; ocho campus/direcciones proporcionados por el usuario se migran a la tabla `campuses`. No inventar datos para producción ni escribir secretos en documentación, commits o mensajes.

Flujo actualizado: autoasignación, operación por gestor responsable, historial, envío/guía/entrega, comprobantes automáticos y Gmail threads reales en [atencion-y-comunicacion.md](atencion-y-comunicacion.md).
