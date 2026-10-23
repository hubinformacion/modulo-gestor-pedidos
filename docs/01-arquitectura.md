# 01 · Arquitectura y datos

[← Inicio](00-inicio.md) · [Siguiente: Seguridad →](02-seguridad.md)

## Solución y alcance

**Versión 1.0.0: monolito modular con arquitectura en capas.** Una aplicación Next.js desplegada en Vercel, PostgreSQL en Neon y servicios Google. WordPress embebe solo compra y seguimiento; Fondo Editorial y Tesorería usan la aplicación directamente con Google OAuth. El sistema coordina ventas y documentos: no procesa tarjetas, transfiere dinero ni emite por sí mismo documentos tributarios.

## Organización del código

| Ubicación | Responsabilidad |
| --- | --- |
| `src/app` | Rutas, páginas y Server Actions; entradas y coordinación de la interfaz |
| `src/components` | Interfaz agrupada por función y componentes compartidos |
| `src/modules` | Negocio: orders, catalog, discounts, treasury, access, settings y reporting |
| `src/modules/*/domain` | Reglas, validaciones, errores y contratos independientes de Next, BD e integraciones |
| `src/modules/*/application` | Casos de uso y coordinación de transacciones e integraciones |
| `src/modules/*/data` | Consultas y persistencia; no depende de aplicación ni de Next |
| `src/integrations` | Adaptadores técnicos de autenticación, Google, correo y WordPress |
| `src/db` | Conexión, esquemas, SQL inicial, seed, instalador y actualizaciones incrementales |
| `src/shared` | Configuración, diagnóstico seguro y funciones auxiliares puras; sin dependencias de negocio |
| `src/resources` | Ubigeo y guías operativas de pago, no expuestos como archivos públicos |
| `public` | Isotipo SVG de interfaz/favicon y PNG institucional de correo |

ESLint comprueba los límites de capas. Los módulos no importan páginas ni componentes; dominio no depende de persistencia o proveedores. Las reglas y textos de avisos están en los módulos; MIME, logo y transporte son técnicos. Esto no implica Clean Architecture completa ni aislamiento total entre módulos: pedidos todavía consulta catálogo y actualiza su stock dentro de la transacción de compra.

## Tecnologías y conexión

Next.js App Router y Server Actions, React, TypeScript estricto, Tailwind, Base UI/shadcn, FilePond, Sileo, boneyard-js y Recharts. Better Auth y Google OAuth para identidad; Drizzle y el driver Neon para PostgreSQL; googleapis/google-auth-library para Drive y Gmail. Versiones exactas en `package.json` y `pnpm-lock.yaml`. No hay herramientas Python, generadores de iconos ni dependencia directa de Sharp.

| Acceso | Transporte | Uso |
| --- | --- | --- |
| `withReadDatabase` | HTTPS con Neon y Drizzle HTTP | Consultas independientes; interfaz restringida a SELECT |
| `withDatabase` | WebSocket seguro con PoolClient propio por petición | Autenticación y transacciones interactivas |

Las transacciones conservan el mismo cliente; se libera y cierra el pool al terminar, incluso ante fallos. Estos WebSockets conectan servidor y BD, no sincronizan navegadores. Las mutaciones no se repiten ante respuestas ambiguas. La conexión actual es específica de Neon: migrar a otro servicio exige adaptar `src/db`, no solo cambiar una URL. El transporte no acredita por sí mismo VPN, red privada ni políticas efectivas de proveedor.

## Componentes e integraciones

| Componente | Función y límite |
| --- | --- |
| WordPress | Origen y ventana exactos, handshake y mensajes acotados de presentación; sin PII ni sesiones internas por postMessage |
| Autenticación | Google verificado, allowlist vigente y sesión BD; rol/unidad revalidados en cada operación sensible |
| Drive | Archivos privados y permisos nominados; IDs, hashes e intentos durables guardados en BD |
| Gmail | Avisos inmediatos del evento nuevo, hilos por audiencia, sin cola ni reenvíos históricos |
| Cron | Diario a las 12:00 UTC, solo reconciliación de permisos Drive |
| Respaldo | Procedimiento institucional separado del build y del cron de la aplicación |

Los logos están en `public/isotipo.svg` y `public/isotipo-blanco.png`. El segundo es la única imagen CID de los correos, con logo a la izquierda y Fondo Editorial a la derecha. Las guías se leen desde settings/data y se distribuyen desde `src/resources/payment-guides/`; ubigeo conserva su procedencia/licencia en `src/resources/ubigeo/`.

## Flujo y consistencia

Crear pedido valida datos, recalcula precios/descuentos, bloquea libros/cupón y confirma cuotas, stock, numeración, partidas, snapshots y registro de aviso en una transacción. El UUID/hash recupera el mismo intento sin duplicar compra. Tras el commit se intenta el correo nuevo durante esa solicitud; un fallo de envío no revierte el pedido ni crea una entrega diferida.

Pagos y emisión de Tesorería son independientes de la logística. Las transiciones comprueban rol, responsable, estado y versión. Los archivos se cargan fuera de locks de pedido/stock con ID durable y validación de firma/hash/tamaño. Un volcado SQL no incluye bytes Drive ni mensajes Gmail. El filesystem del despliegue no almacena cargas operativas persistentes.

No hay transacción distribuida entre BD y Google ni garantía de entrega exactamente una vez ante timeout ambiguo. Sin polling periódico: mutaciones, retorno limitado a pestaña y botón manual actualizan; las cargas/borradores pausan refrescos.

## Leyenda común

I: identidad y acceso; C: configuración; O: pedidos/pagos; T: Tesorería; A: historial/auditoría; S: control técnico. Estas claves describen controles de aplicación y no acreditan RLS, privilegios SQL ni configuración efectiva de proveedores.

## Base de datos: tablas, información y protección

El inventario corresponde al SQL inicial de `src/db/schema.sql`, generado desde los esquemas TypeScript y Better Auth. No consulta ni contiene registros operativos.

### Relaciones principales

Las tablas operativas enlazan pedidos, partidas, pagos, documentos, usuarios y configuración mediante las claves y validaciones del esquema. Las FK preservan relaciones; las asociaciones guardadas como JSON se validan en aplicación. Las relaciones no dibujadas siguen existiendo en el esquema.



`caja_requests.draft_document_id` y `finalized_document_id` también referencian `sale_documents.id`; estos vínculos son parte del esquema y se validan durante el flujo de emisión. `sale_document_batches.document_ids` y `coupons.book_ids` son listas JSON, no claves foráneas: los servicios validan sus referencias.


`authorized_emails.email` se compara con `user.email` desde servidor; no existe una FK entre ambas. `verification` es independiente y no tiene FK a `user`. El esquema estándar incluye `account.password`, pero el login por contraseña local está deshabilitado.

### Cómo se protege la información

| Clave | Alcance del control |
| --- | --- |
| I · Identidad | Solo servidor: sesión vigente, Google verificado y lista autorizada. No publicar tokens ni registros de sesión. El rol SQL autorizado puede leerlos; no hay cifrado propio por campo declarado. |
| C · Configuración | Gestores autorizados mantienen configuración según función; maestro administra accesos/buzones. La compra recibe solo catálogo, tarifas, campus y cuentas necesarios; no el correo del apoyo. |
| O · Pedido | Comprador: token privado y respuesta mínima de su pedido. Gestor personal asignado: decisiones operativas. Stock/numeración/importes protegidos por validación, transacción, locks y versión. |
| T · Tesorería | Sesión y unidades vigentes en servidor; asignación para operar. Notas privadas del equipo. Comprador descarga únicamente PDF finalizado vigente; nunca borradores, evidencia o notas. |
| A · Auditoría | Historial interno y visibilidad por área; proyección pública con allowlist. Sin edición/borrado por UI. Avisos son auditoría, no cola. Append-only a nivel SQL requiere privilegios configurados por TI; no es WORM. |
| S · Control técnico | Gestión desde servidor; cuotas editables por maestro. HMAC no es cifrado ni anonimización absoluta. ACL Drive privadas y revocaciones reconciliables; preservar owners/writers y permisos heredados. |

La separación por rol/unidad/pedido se comprueba en consultas, acciones y transacciones del servidor; **no se presenta como RLS por tabla**. El navegador no recibe credenciales de BD. Restricciones/FK conservan relaciones, pero no sustituyen autorización.

**Límites y responsabilidades de TI:** no hay cifrado propio por campo para datos personales/tokens ni log de cada lectura/descarga. El cifrado en tránsito/reposo, rol SQL mínimo, privilegios append-only, MFA/IAM y ACL efectivas requieren evidencia del proveedor. Hash/HMAC no cifran un DNI o un PDF. El propietario de BD puede alterar registros; el historial no es WORM. Backups manuales deben cifrarse antes de subir y requieren ensayo de restauración.

**Dónde están los archivos:** recibos, PDF de venta, subsanaciones y evidencia guardan metadatos/IDs/hash en PostgreSQL y bytes en Drive privado. La excepción es `payment_guides`: conserva el PDF histórico en `content_base64`. Gmail conserva mensajes aparte. Un dump de BD no incluye los bytes de Drive ni las conversaciones de Gmail.

### Inventario completo por tabla

Los campos siguientes son representativos; la cantidad es el total de columnas del SQL inicial, no el número de registros. La clave de protección remite a la matriz anterior. El inventario no incluye valores ni datos de personas.

#### Identidad y acceso · 5 tablas

| Tabla | Información guardada | Campos de referencia | Protección |
| --- | --- | --- | --- |
| `user` (7 columnas) | Identidad Google del personal: nombre, correo verificado e imagen. | `id`, `name`, `email`, `email_verified` | I |
| `session` (8 columnas) | Sesión, token, vencimiento y metadatos de conexión del personal. | `id`, `user_id`, `token`, `expires_at` | I |
| `account` (13 columnas) | Vinculación OAuth y tokens de identidad; contraseña local deshabilitada. | `user_id`, `provider_id`, `access_token`, `refresh_token` | I |
| `verification` (6 columnas) | Registros de verificación del esquema de Better Auth; no habilita registro abierto. | `identifier`, `value`, `expires_at` | I |
| `authorized_emails` (7 columnas) | Lista de acceso, rol, unidades y condición de buzón de servicio. | `email`, `role`, `publisher_imprints`, `treasury_service` | I |

#### Configuración · 5 tablas

| Tabla | Información guardada | Campos de referencia | Protección |
| --- | --- | --- | --- |
| `campuses` (11 columnas) | Bibliotecas: dirección, ubicación, horario, coordenadas y estado. | `id`, `name`, `library_address`, `pickup_hours` | C |
| `pickup_contacts` (6 columnas) | Contactos de apoyo para recojo; no son usuarios autorizados. | `id`, `name`, `email`, `status` | C |
| `bank_accounts` (10 columnas) | Cuentas receptoras por sello: titular, banco, número y CCI. | `publisher_imprint`, `holder`, `account`, `cci` | C |
| `treasury_mailboxes` (4 columnas) | Buzón institucional de avisos de Tesorería por unidad. | `publisher_imprint`, `email` | C |
| `delivery_rates` (5 columnas) | Tarifa vigente por zona; los pedidos guardan su costo histórico. | `zone`, `price`, `status` | C |

#### Catálogo y descuentos · 5 tablas

| Tabla | Información guardada | Campos de referencia | Protección |
| --- | --- | --- | --- |
| `books` (11 columnas) | Títulos reales, código, autor, sello, precios, stock y estado. | `id`, `title`, `inventory_code`, `stock` | C / O |
| `promotions` (10 columnas) | Campañas, porcentajes por público, alcance y vigencia. | `id`, `name`, `community_percent`, `starts_at` | C / O |
| `promotion_books` (2 columnas) | Relación entre una campaña y los títulos incluidos. | `promotion_id`, `book_id` | C / O |
| `coupons` (13 columnas) | Código, porcentaje, público, títulos, vigencia y límites de uso. | `id`, `code`, `book_ids`, `used_count` | C / O |
| `coupon_redemptions` (4 columnas) | Uso de cupón por pedido y fecha de liberación, si corresponde. | `order_id`, `coupon_id`, `released_at` | C / O |

#### Pedidos, pagos y entrega · 7 tablas

| Tabla | Información guardada | Campos de referencia | Protección |
| --- | --- | --- | --- |
| `orders` (72 columnas) | Comprador/receptor, facturación, destino, importes, estados, responsable, consentimiento y snapshots. | `id`, `order_number`, `customer_document`, `tracking_token`, `order_status` | O |
| `order_items` (13 columnas) | Partidas: título/código/precio histórico, cantidad, descuento e importe. | `order_id`, `book_id`, `book_title`, `unit_price`, `quantity` | O |
| `order_counters` (2 columnas) | Último número por año para numeración transaccional. | `year`, `last_number` | O |
| `payment_guides` (3 columnas) | Guía de pago histórica deduplicada: hash y PDF codificado en base64 dentro de PostgreSQL. | `hash`, `content_base64` | O |
| `payment_uploads` (9 columnas) | Intento durable de carga: hash, ID Drive reservado, formato y tamaño. | `id`, `order_id`, `content_hash`, `drive_file_id` | O |
| `payment_receipts` (8 columnas) | Comprobante recibido por pedido/sello, vinculado al intento y archivo Drive. | `order_id`, `publisher_imprint`, `upload_id`, `drive_file_id` | O |
| `pickup_evidence` (13 columnas) | Metadatos y autor de evidencia opcional de entrega/recojo; imagen privada en Drive. | `order_id`, `actor_user_id`, `drive_file_id`, `content_hash` | O |

#### Tesorería y documentos · 7 tablas

| Tabla | Información guardada | Campos de referencia | Protección |
| --- | --- | --- | --- |
| `caja_requests` (23 columnas) | Solicitud por pedido/sello: estado, ciclo, responsable, borrador, PDF final e hilo interno. | `id`, `order_id`, `publisher_imprint`, `finalized_document_id` | T |
| `sale_documents` (11 columnas) | Revisiones de PDF de venta por solicitud/ciclo, autor, hash y archivo privado. | `id`, `request_id`, `cycle`, `content_hash`, `drive_file_id` | T |
| `sale_document_batches` (6 columnas) | Lote inmutable de documentos vigentes remitidos al comprador. | `id`, `order_id`, `document_ids`, `correction` | T |
| `treasury_observations` (9 columnas) | Observación a Fondo Editorial, corrección solicitada, respuesta y resolución. | `request_id`, `content`, `correction`, `response` | T |
| `treasury_supporting_files` (11 columnas) | Adjuntos privados de subsanación: Drive, hash, tamaño y autor. | `request_id`, `drive_file_id`, `content_hash`, `actor_id` | T |
| `treasury_notes` (6 columnas) | Notas internas del equipo de Tesorería de la unidad, con autor y fecha. | `request_id`, `actor_id`, `content` | T |
| `treasury_activity` (7 columnas) | Historial de eventos de la solicitud y su actor. | `request_id`, `actor_id`, `event`, `detail` | T |

#### Historial y avisos · 6 tablas

| Tabla | Información guardada | Campos de referencia | Protección |
| --- | --- | --- | --- |
| `order_activity` (7 columnas) | Avances y notas internas de Fondo Editorial; salida pública mediante allowlist. | `order_id`, `actor_user_id`, `event_type`, `detail` | A |
| `order_emails` (15 columnas) | Auditoría del correo inicial y referencias/lease del hilo del comprador. | `order_id`, `status`, `gmail_thread_id`, `attempts` | A |
| `order_notifications` (12 columnas) | Evento nuevo, payload, resultado y referencias del aviso al comprador. | `order_id`, `event_type`, `payload`, `status` | A |
| `caja_notifications` (12 columnas) | Auditoría de avisos internos por solicitud/ciclo de Tesorería. | `request_id`, `cycle`, `event_type`, `status` | A |
| `pickup_notifications` (11 columnas) | Destinatario de apoyo y resultado del aviso de recojo. | `order_id`, `contact_id`, `contact_email`, `status` | A |
| `management_audit` (10 columnas) | Cambios de administración, actor, recurso y detalle de campos. | `actor_email`, `event`, `resource`, `details` | A |

#### Permisos y cuotas · 5 tablas

| Tabla | Información guardada | Campos de referencia | Protección |
| --- | --- | --- | --- |
| `drive_reader_grants` (4 columnas) | Seguimiento de permisos nominados y retiros pendientes de carpeta Drive. | `folder_id`, `email`, `permission_id` | S |
| `drive_file_reader_grants` (6 columnas) | Permisos nominados por archivo y solicitud de Tesorería, incluso intentos pendientes. | `drive_file_id`, `email`, `request_id`, `permission_id` | S |
| `order_admission_policy` (9 columnas) | Límites configurables de admisión de pedidos y autor de cambio. | `email_day`, `global_day`, `pending_email`, `updated_by` | S |
| `order_admission_counters` (3 columnas) | Contadores compartidos por ventana, con claves HMAC para correo/IP. | `key`, `window_start`, `count` | S |
| `order_admission_changes` (5 columnas) | Historial de cambios de límites: actor y valores anteriores/nuevos. | `actor_email`, `previous`, `next` | S |

Los controles se detallan y sus límites se mantienen en [Seguridad y accesos](02-seguridad.md). El esquema operativo solo cambia mediante actualización incremental explícita y respaldada, fuera del build.

## Evolución posterior

La plataforma editorial completa y Azure/Microsoft se estudiarán después del cierre de esta versión. No se implementan módulos vacíos ni adaptadores de proveedores todavía no elegidos. Cualquier transición preservará historial, importes, archivos, hashes, permisos y datos operativos mediante cambios incrementales respaldados.
