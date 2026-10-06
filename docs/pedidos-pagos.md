# Pedidos, seguimiento y comprobantes — fase 4

Fase 4 aprobada e integrada localmente en `main`. Contrato técnico vigente; completar cuentas/Google/catálogo operativo y revisión real en Vercel sigue pendiente. La administración de pedidos e inventario se implementa en fase 5, según [admin-dashboard.md](admin-dashboard.md).

## Creación

`/pedido` envía una Server Action con identificador UUID de intento, carrito y datos del comprador/entrega/consentimiento. Zod valida cliente y servidor. El servidor recupera libros activos no DEMO y campus activos; bloquea libros por ID en orden y campus para lectura. Recalcula precios por comprador y ubigeo desde sus fuentes. No acepta importes enviados por el navegador.

Stock, contador anual, pedido, ítems y correo pendiente se escriben en una transacción. El año corresponde a `America/Lima`, obtenido de Postgres. UPSERT del contador adquiere el lock de la fila del año; un aborto no consume el número ni stock. Todos los libros se validan antes de crear; cualquier falta aborta todo. Estado inicial `PENDIENTE_PAGO`; sello requerido `PENDIENTE`, otro `NO_APLICA`.

UUID de intento único con hash del borrador y lock evita pedidos duplicados ante reintento. Si la respuesta falla, reintentar sin editar. Un intento ya usado con datos distintos se rechaza. La clave permanece en memoria durante la página: recargar elimina esa protección del navegador; conservar primero la respuesta/enlace cuando esté disponible. Se guardan título de publicación, precios, dirección, datos bancarios, PDF y consentimiento/versionado como snapshots. `payment_guides` guarda cada versión de PDF una sola vez por SHA-256: cambiar guías/cuentas no altera instrucciones de pedidos existentes.

Registro real deshabilitado mientras falten cuentas, URL, credenciales o guías. `/admin` lista los faltantes sin revelar secretos. DEMO sigue siendo una vista previa sin escrituras. No activar libros DEMO ni inventar catálogo operativo para probar.

## Seguimiento y cargas

`/seguimiento/[tracking_token]` es público mediante token nanoid de 32 caracteres. El enlace es una credencial: compartirlo permite consultar datos y cargar comprobantes. No indexar, cachear ni enviar por referrer; headers privados/no-store. No usar tokens en logs. Guía descargable en `/seguimiento/[tracking_token]/guia`, tipo determinado por BD.

Una zona FilePond por sello aplicable (dos para mixtos), hasta ocho archivos por zona y 3 MiB por archivo (bajo los límites de Next/Vercel). PDF/JPG/PNG; plugins de tipo, tamaño y preview. Sello asociado automáticamente por la zona, sin selector. Adjuntar inicia la carga a Drive; guardar el archivo solicita revisión automáticamente, sin confirmar. Uploads seriales, acción validada con Zod, firma real del archivo y SHA-256. Nombre saneado. Máximo treinta intentos persistidos por pedido; reintentar no consume otro intento. La carga no se valida por extensión solamente.

El intento de carga guarda UUID, hash, sello e ID de Drive reservado. Drive usa ese mismo ID y un reintento; si el archivo existe, finaliza permisos/link y registra el comprobante. Si falla Drive o BD, el archivo del cliente permanece seleccionado y el intento recuperable; retirar/re-añadir crea otro intento. No persiste los bytes en el navegador después de recargar.

El pedido se bloquea al reservar y confirmar la carga. Solo `PENDIENTE_PAGO` con pago `PENDIENTE`/`RECHAZADO`/`EN_REVISION` admite nuevas cargas. Guardar el archivo pasa directamente ese sello a `EN_REVISION`; el otro conserva su estado, incluido `VERIFICADO`. La carga no aprueba pagos ni cambia a preparación; esas operaciones corresponden al dashboard administrativo. Rechazo permite re-subir ese sello; se conserva el historial. Retirar un archivo de FilePond no borra comprobantes ya registrados. Drive y BD no forman una transacción distribuida: las intenciones conservan el ID para reconciliar una carga incompleta, incluso un archivo que quedó en Drive mientras el estado del pedido cambió.

## Google y correo

`src/lib/google.ts`: OAuth2Client propietario con client ID/secret/refresh token. Activar Drive API y Gmail API. Obtener refresh token con consentimiento offline de la cuenta dueña usando scopes `https://www.googleapis.com/auth/drive` y `https://www.googleapis.com/auth/gmail.send` y `https://www.googleapis.com/auth/gmail.metadata` para operar con una carpeta existente configurada por ID. Como alternativa de menor alcance, `drive.file` requiere que la carpeta se haya seleccionado/creado con la aplicación. `GOOGLE_DRIVE_FOLDER_ID` es el ID, no el enlace completo. Si Workspace impide permisos públicos (`publishOutNotPermitted`, `domainPolicy`, `cannotShareAcrossDomains`), se conserva el archivo privado y se registra igualmente. El dashboard lo abre en `/admin/comprobantes/[id]`, con sesión y correo autorizados verificados en BD; el servidor lee Drive con las credenciales del propietario. No exige cambiar políticas de Google ni conceder permisos a correos individuales. No modificar scopes del login de administradores. El flujo de propietario usa `access_type: offline` y `prompt: consent`; referencia: [Google Auth Library](https://github.com/googleapis/google-auth-library-nodejs#generating-an-authentication-url). Guardar el refresh token directamente en `.env.local`/Vercel, sin pegarlo en chats ni versionarlo.

Gmail arma MIME multipart/mixed con multipart/alternative (texto/HTML) y el PDF base64; el mensaje completo se envía base64url. Tres plantillas según sello/mixto. Datos del comprador y bancos escapados. Cuenta/correo/importe por sello y seguimiento. Adjuntos en `src/assets/pdfs`, incluidos mediante tracing de Next.

`order_emails` es un outbox duradero creado junto al pedido. `after` intenta el envío tras responder; el dashboard permite reintentar avisos pendientes, con lease serial por pedido de cinco minutos, espera de un minuto entre fallos y hasta cinco intentos antes de una nueva ronda administrativa. Fallos no borran ni duplican el pedido. Gmail conserva los Message-ID reales verificados con metadata, pero un timeout tras aceptación puede provocar un correo duplicado: Gmail no garantiza idempotencia. No hay worker/cron automático; pendientes necesitan ejecución inicial/reintento desde el dashboard.

## Configuración y datos aportados

El usuario proporcionó BCP/BBVA de ambos sellos, sembrados en `bank_accounts` y editables desde `/admin`. Instituto: titular Corporación APEC SAC. Pendientes: titular Universidad y su CCI BCP de 20 dígitos (el informado tiene 19). No inventar ni activar ese conjunto hasta confirmación.

`.env.local`/Vercel: `GOOGLE_REFRESH_TOKEN`, `GOOGLE_OWNER_EMAIL`, `GOOGLE_DRIVE_FOLDER_ID`, `APP_URL` (HTTPS en producción), cuentas bancarias desde `/admin`. Se mantienen los client ID/secret existentes. CRUD bancario por cualquier autorizado: sello, banco, titular, cuenta, CCI, moneda PEN y estado. CCI admite guiones al pegar y se normaliza; para activar exige 20 dígitos y titular. Universidad inicial inactiva por datos pendientes, Instituto activo. Al menos una cuenta activa de Universidad debe completarse desde el CRUD; BCP puede permanecer inactiva hasta corregir su CCI. Debe existir al menos una cuenta activa por sello para habilitar pedidos. Las alternativas se guardan como snapshot en cada pedido; eliminar/editar no modifica pedidos anteriores. Nunca versionar secretos.

PDF: `guia_pago_universidad.pdf`, `guia_pago_instituto.pdf`, `guia_pago_mixta.pdf`. PDF aportados por el responsable ya incluidos; Universidad y Mixto son idénticos y requieren reemplazo/confirmación. El usuario autorizó utilizar las guías por nombre aunque su contenido sea idéntico temporalmente; las reemplazará posteriormente. Ver [instrucciones de assets](../src/assets/pdfs/README.md).

## Revisión manual al configurar

1. En `/admin`, editar/crear/activar/desactivar/eliminar una cuenta. Completar titular y CCI Universidad, y activar al menos una cuenta de ese sello. Verificar validación de CCI, duplicados y acceso de otros autorizados. Comprobar todos los elementos configurados. Recorrer `/admin/vista-previa`: sigue sin crear pedidos. Cargar catálogo real autorizado por responsable; usar `/admin/inventario` para el catálogo operativo.
2. Crear pedidos Universidad, Instituto y mixto en una rama Neon de revisión con libros reales de revisión aprobados. Ver número anual, enlace, snapshots, precios público/comunidad, recojo S/0, Lima/Callao S/15 y otras provincias S/25. Mixto: dos depósitos y envío solo Universidad.
3. Mantener un carrito abierto y reducir stock desde BD; enviar: no debe quedar pedido/ítems ni reducir otros libros. Dos clientes concurrentes con última unidad: solo uno confirma. Reintento de la misma solicitud: mismo pedido, sin segunda reducción. Revisar filas del contador, no alterar el reloj de producción.
4. Cargar PDF/JPG/PNG con sellos distintos. Rechazar tipos/tamaños inválidos. Interrumpir conexión/reintentar sin retirar: un ID Drive y un comprobante por intento. Comprobar carga automática en Drive y revisión inmediata del sello, sin confirmación adicional. Revisar aprobación/rechazo desde `/admin/pedidos` según el contrato del dashboard.
5. Forzar fallo Google en el entorno de revisión: el pedido persiste, el archivo permanece y el correo puede reintentarse. Restaurar credenciales; comprobar permisos/link en Drive y destinatario/adjunto correcto por tipo.
6. Desplegar rama en Vercel con configuración real aprobada; crear pedido de revisión y abrir el adjunto recibido. Descargar PDF desde seguimiento y contrastar cuentas/importes. Confirmar que el tracing incluye los PDF. Falta proyecto/credenciales Vercel para realizar esta revisión desde el entorno actual.

Sin suites de pruebas automatizadas. Registrar solo comprobaciones realmente realizadas al entregar.

## Comprobaciones realizadas

Lint, tipos y build de producción correctos tras el CRUD bancario y snapshots PDF. Migraciones 0003–0005 aplicadas: historial Neon con seis migraciones; cuatro cuentas (dos Instituto activas, dos Universidad inactivas), cero pedidos. Tracing de `/pedido` y descarga incluye los tres PDF. No se crearon pedidos, enviaron correos ni subieron comprobantes reales durante la implementación. No hay remoto Git ni proyecto Vercel configurado; integraciones de fases 3 y 4 realizadas localmente.

## Atención y threads vigentes

[atencion-y-comunicacion.md](atencion-y-comunicacion.md) contiene el contrato actual. La migración 0007 sustituye la confirmación manual: cargar registra recibo/revisión/historial/aviso juntos. Autoasignación y operación por gestor con historial, correo de envío/entrega y cabeceras reales de Gmail. Lease serial por pedido, asunto y referencias canónicos, avisos compactos. gmail.metadata en credenciales propietarias; no modificar los scopes de login. Los avisos se reintentan desde dashboard, no desde botones del comprador.

## Incidencia de carga resuelta

Drive aceptaba los archivos pero rechazaba permissions.create con HTTP 400/reason `publishOutNotPermitted`. El reintento original ocultaba el motivo y la acción no registraba el comprobante. Ahora las restricciones de compartir público tienen fallback privado, los demás errores mantienen un reintento y conservan causa/etapa. Los logs imprimen únicamente códigos, estado HTTP y motivo; nunca objetos Google/Drizzle, SQL/payload, credenciales, IDs, tokens o nombres de archivos.

El visor administrativo verifica sesión/correo nuevamente dentro de la lectura transaccional y transmite PDF/JPG/PNG desde Drive con cabeceras private/no-store, no-referrer y nosniff. El link directo de Drive queda como dato operativo, pero la UI enlaza al visor protegido para que todos los autorizados puedan leer sin permisos públicos en Drive.

`recoverReceiptUpload` permite reconciliar una intención interna con el archivo existente, verifica tamaño/SHA-256 y reutiliza el ID reservado. Cuatro intentos afectados se recuperaron, sin nuevas subidas, cambio de pago, pedido/stock ni correos. El flujo vigente solicita revisión al guardar el archivo.

Comprobaciones de esta corrección: lectura real de Drive y recuperación de cuatro recibos con tamaño/hash coincidentes; lint, tipos y build correctos. No se crearon archivos nuevos ni se enviaron correos durante la recuperación. La apertura visual del visor con sesión válida queda para revisión del gestor.
