# Instalación y operación técnica

## Requisitos y responsables

Node.js 24 y pnpm 11.3.0; PostgreSQL en Neon; proyecto Vercel; cliente Google OAuth Web; cuenta propietaria con Drive/Gmail y carpeta privada; acceso al bloque HTML de WordPress. Responsables designados: Fredy Paolo Romero Espinoza (técnico, fromeror@continental.edu.pe) y Jullisa del Pilar Falla Aguirre (funcional, jfalla@continental.edu.pe). El maestro de aplicación no sustituye la administración de Neon/Vercel/Workspace.

## Primera instalación

```bash
pnpm install --frozen-lockfile
cp .env.example .env.local
pnpm db:setup
pnpm build
```

Completar las variables **antes** de ejecutar `db:setup`. El comando no corre en el build ni al arrancar una función. No acepta opciones de borrado, no llama a Google ni envía correos.

El instalador usa `DATABASE_SETUP_URL` si está definido y, en otro caso, `DATABASE_URL`. La primera es una conexión opcional de administración exclusiva para instalar; no desplegarla como credencial del runtime. Para operación, TI debe provisionar un rol restringido con acceso a las tablas/secuencia necesarias, sin administración de roles ni DDL. Que exista esta variable no implica que esos privilegios ya hayan sido separados en Neon.

El esquema inicial está en `src/db/schema.sql`, generado desde `schema.ts` y las tablas de Better Auth generadas por CLI. No se conservan migraciones, snapshots ni journal de la etapa de desarrollo. El instalador crea una referencia en un esquema de nombre interno, compara las definiciones canónicas que devuelve el mismo servidor y revierte esa referencia. Examina tablas, columnas, tipos/defaults/identidad/collation, constraints, índices, enums, parámetros de secuencias, RLS, políticas y triggers; rechaza rutinas y tipos propios inesperados del esquema de aplicación. No compara datos ni el valor actual de numeradores/secuencias.

Si la BD está vacía instala y siembra en una transacción. Si la estructura coincide conserva todo y solo incorpora configuración faltante. Si no coincide aborta: **no altera automáticamente una BD existente**. Requiere permisos temporales para crear el esquema de referencia, incluso al verificar una instalación compatible. Un error de permisos no debe resolverse elevando los privilegios del rol usado por el runtime.

En la BD actual no es necesario reinstalar ni restablecer nada. El seed ya incorporó campus, cuentas y maestro; `pnpm db:seed` se conserva para incorporar faltantes. Los registros históricos de Drizzle que pudieran quedar en una BD anterior no son consultados ni eliminados por el instalador.

## Configuración de producción

| Variable | Uso y manejo |
| --- | --- |
| `DATABASE_URL` | Conexión del runtime, privada; separar rama/rol de revisión |
| `DATABASE_SETUP_URL` | Opcional, solo terminal administrativa de instalación; no Vercel runtime |
| `BETTER_AUTH_SECRET` | Aleatorio, mínimo 32 caracteres; rotación controlada |
| `APP_URL`, `BETTER_AUTH_URL` | Origen estable Vercel: `https://modulo-gestor-pedidos.vercel.app` |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | Cliente OAuth Web privado |
| `GOOGLE_REFRESH_TOKEN` | Token propietario independiente del login |
| `GOOGLE_OWNER_EMAIL`, `GOOGLE_DRIVE_FOLDER_ID` | Identidad propietaria y carpeta privada |
| `WORDPRESS_ORIGINS` | `https://fondoeditorial.continental.edu.pe`, sin ruta ni comodines |
| `WORDPRESS_ORDER_URL` | `https://fondoeditorial.continental.edu.pe/pedido/` |
| `CRON_SECRET` | Secreto aleatorio mínimo 32; protege reconciliación ACL |
| `ENABLE_EXPERIMENTAL_COREPACK` | `1` en Vercel para pnpm declarado |

Habilitar Drive API y Gmail API. Callback OAuth exacto: `https://modulo-gestor-pedidos.vercel.app/api/auth/callback/google`. Login solicita solo `openid email profile`; token propietario requiere `drive`, `gmail.send`, `gmail.metadata`. Mantener el consentimiento y la cuenta propietaria bajo gobierno institucional; un token External/Testing puede expirar a los siete días. No distribuir el refresh token a gestores.

Después del despliegue: ingresar como maestro, comprobar cuentas/guías/campus, registrar accesos y buzones, cargar catálogo real. La presencia de variables no acredita que Google acepte el token ni que los archivos sean correctos.

## WordPress

Copiar el bloque completo `src/iframe/wordpress-pedido.html`; no basta con cambiar un `src` aislado. Usar el origen aprobado y permitir scripts mediante el mecanismo admitido del sitio. Regenerar el bloque con `pnpm iframe:snippet` cuando cambie su protocolo/configuración, y reemplazarlo en WordPress. La aplicación no modifica WordPress automáticamente.

Administración abre `/admin/pedidos` directamente en Vercel; Tesorería abre `/tesoreria-recaudacion`. No incrustar módulos internos ni relajar cookies/auth para ello.

## Publicación y cambios posteriores

- Vercel construye con pnpm y no modifica la BD.
- `db:setup` es para instalación/verificación compatible, **no para aplicar cambios de estructura en una BD operativa**.
- Si una versión futura cambia el esquema, TI debe preparar una actualización incremental revisada, respaldada y aplicada fuera del build. La retirada del historial de desarrollo no elimina esa necesidad operativa.
- `pnpm db:schema:export` regenera el SQL inicial offline. Revisar el diff completo y la correspondencia con las tablas de Better Auth; nunca usarlo como un script de actualización ni ejecutar el SQL manualmente sobre datos existentes.
- Cambios visuales no requieren reinstalar ni volver a sembrar la BD.

## Respaldo y recuperación

No hay backup propio programado en el código ni se añade un cron de respaldo.

| Decisión | Alcance |
| --- | --- |
| Conservación de negocio | Indefinida, sin eliminación automática de pedidos/documentos/historial |
| Frecuencia | Copia manual semanal, a cargo del responsable técnico |
| RPO objetivo | Siete días: una incidencia puede perder hasta los cambios posteriores a la última copia válida |
| RTO objetivo | Hasta cuatro horas desde el inicio de recuperación; pendiente de demostrar mediante una restauración medida |

El plan Free de Neon ofrece una ventana de restauración instantánea de hasta seis horas, sujeta al límite de historial del plan: **no sustituye una copia semanal**. Los respaldos automáticos por calendario requieren plan de pago. El plan Free admite un snapshot manual; no permite asumir un archivo ilimitado de snapshots semanales. Comprobar las condiciones vigentes en la consola antes de definir el medio de copia.

### Procedimiento manual semanal

1. El responsable técnico registra fecha, proyecto/rama, versión de aplicación y resultado del respaldo, sin credenciales ni datos personales.
2. Exporta PostgreSQL con `pg_dump` en formato custom, usando cliente compatible con la versión del servidor y conexión directa segura. Las credenciales se suministran mediante un archivo de servicio/credenciales protegido; no se copian al historial de terminal, README ni tickets. `pg_dump` obtiene una copia consistente sin vaciar tablas.
3. Cifra el archivo y lo guarda en almacenamiento institucional privado aprobado, separado de Git, del equipo público y de la carpeta de comprobantes. Restringe los permisos a custodios autorizados y conserva registro de integridad. Puede usarse Google Drive en una carpeta privada separada de comprobantes, sin permisos heredados al equipo de atención. La clave de cifrado debe custodiarse por separado. La ubicación institucional y el mecanismo de cifrado deben quedar registrados en el expediente privado de TI.
4. Si se utiliza el snapshot manual de Neon como complemento, comprueba su fecha y disponibilidad. No borrar una copia anterior automáticamente ni asumir una retención/versionado que el plan Free no ofrece.
5. Registra tamaño, integridad y éxito; ante fallo, realiza la copia manualmente y avisa al responsable funcional si se supera el RPO. No programa reintentos ni añade procesos al runtime.

La retención de negocio indefinida no exige almacenar una copia completa diaria para siempre. La antigüedad y cantidad de versiones de respaldo debe aprobarse por separado; no hay purga automática de copias en este proyecto.

### Recuperación

Restaurar primero en una rama/base aislada, con envíos, cron y cargas deshabilitados. Comprobar integridad, versión del esquema, cuentas/campus y referencias documentales. PostgreSQL **no contiene los archivos físicos de Drive ni los mensajes de Gmail**: conservar y proteger esos servicios por separado. Reaplicar revocaciones vigentes y reconciliar permisos antes de abrir tráfico; un respaldo antiguo puede reintroducir autorizaciones retiradas. Medir la duración y registrar evidencia para evaluar el RTO. El seed restaura configuración inicial, no pedidos ni archivos.

Referencias: [ventana histórica de Neon](https://neon.com/docs/postgres/backup-restore/history-window), [backup y restore](https://neon.com/docs/guides/backup-restore), [exportación con pg_dump](https://neon.com/docs/manage/backup-pg-dump). Los valores efectivos del proyecto se acreditan con la consola; no se ha ejecutado una restauración operativa como parte de la revisión.

## Observabilidad y costes

Sin polling periódico. Las pantallas refrescan tras acciones, al retornar a pestaña con límite o bajo demanda. El cron diario 12:00 UTC solo reconcilia permisos Drive; no recupera correos. Monitorizar errores de BD, ACL, OAuth y entrega de correo con códigos seguros, además de consumo Neon/Vercel/Gmail. Los límites por petición no constituyen un techo global de consumo.

Definir alertas de gasto y protección de abuso de creación pública; no habilitar pruebas, cargas repetitivas ni datos ficticios contra producción para medir límites. Los logs de plataforma deben redactar tokens/rutas sensibles y limitar acceso/retención.

## Incidentes

| Situación | Actuación |
| --- | --- |
| BD no disponible | Revisar códigos y consola; no repetir mutaciones ambiguas automáticamente ni borrar sesiones por error temporal |
| Gmail falla | Cambio de negocio permanece guardado; consultar auditoría. No hay cola ni reenvío histórico automático; coordinar comunicación externa según procedimiento institucional |
| Drive falla | Conservar el archivo seleccionado y reintentar el intento durable; no generar cargas duplicadas para comprobar |
| Revocación ACL pendiente | Aplicación ya deniega sesión revocada; TI debe confirmar retiro efectivo de Drive y revisar grants pendientes/orfandad, preservando owners/writers/heredados |
| Token/credencial expuestos | Restringir acceso, rotar/revocar en el proveedor, actualizar secreto privado y registrar alcance; nunca copiar el secreto al ticket |
| Enlace de seguimiento expuesto | Tratarlo como credencial comprometida; escalar a responsable técnico. No hay rotación/revocación del token por interfaz actualmente |
| Esquema incompatible | Detener instalación/versión nueva, conservar BD y revisar actualización; no restablecer para “resolver” el error |

## Validación de entrega a TI

Pendiente de un entorno aislado autorizado: instalación vacía, segunda instalación compatible sin cambios, rechazo de un esquema diferente, OAuth por rol/revocación, visibilidad de documentos por unidad, hilos y adjuntos reales, bloque WordPress móvil y restauración desde respaldo. Lint/build solo comprueban parte de la entrega. No ejecutar estos flujos con datos operativos como parte de una auditoría estática.

## Límites dinámicos y Vercel Hobby

Configuración → Seguridad muestra los límites de admisión. Solo el maestro puede modificarlos; la acción vuelve a validar sesión/autorización en transacción y registra actor, fecha y valores anteriores/nuevos. Otros gestores pueden consultarlos; Tesorería no accede a esta configuración. El seed incorpora únicamente la política faltante y conserva los valores personalizados.

Valores iniciales: tres pedidos por correo/15 minutos, diez por correo/día, veinte por IP/15 minutos, doscientos por día en total y tres pendientes de pago por correo. Los intervalos de 15 minutos son fijos; el día empieza a medianoche de Perú. La IP solo se toma de la cabecera de confianza de Vercel; fuera de Vercel o sin IP válida se comparte un grupo conservador. Las cuotas se comprueban transaccionalmente en BD, compartidas entre instancias. No se descuentan por cancelar; un reintento idempotente de un pedido creado no consume otra cuota.

Estos límites acotan pedidos aceptados y sus efectos; no evitan que peticiones inválidas consuman ejecución. Para complementar en Vercel Hobby: abrir el proyecto → Firewall, revisar protecciones disponibles del plan, activar las protecciones administradas compatibles y examinar tráfico/eventos; cualquier regla propia debe excluir OAuth/callbacks y probarse con WordPress. No suponer que controles avanzados o límites de gasto están incluidos en Hobby ni configurar desafíos que bloqueen el iframe. La aplicación no ha cambiado la consola del proveedor. Monitorizar uso en Vercel/Neon; los límites de negocio no son una garantía de coste cero.

### Custodia de la carpeta Drive

Carpeta exclusiva del sistema. Los accesos manuales quedan bajo supervisión del responsable técnico; no son adoptados ni retirados automáticamente por el sistema. Registrar a quién se añade, motivo y fecha, y revisar permisos públicos/heredados. Evitar modificar manualmente el mismo usuario/permisión mientras la aplicación lo gestiona: Google no distingue dos concesiones del mismo principal ni ofrece borrado condicional. Los registros previos a esta corrección requieren revisión del propietario porque no es posible reconstruir su procedencia con certeza.

La aplicación guarda la intención antes de pedir el permiso a Google. Una respuesta perdida conserva esa intención y permite recuperarla aun después de revocar el acceso de aplicación. Solo retira lectores directos gestionados, releyendo rol/tipo/herencia antes del borrado; nunca owners/writers/heredados. Esta recuperación técnica de ACL no es una cola de correo.

## Aceptación de TI y auditoría de administración

La [matriz de Seguridad de la Información](requisitos-seguridad-ti.md) cubre los 12 requisitos recibidos y distingue controles de código/proveedor. [Validación y continuidad](validacion-y-continuidad.md) detalla cómo cerrar las verificaciones y realizar copias manuales cifradas a Drive. No se habilitó automatización de respaldo ni se reutilizó la carpeta operativa.

`management_audit` conserva cambios de accesos, unidades/buzones, configuración, inventario/descuentos y metadatos de correcciones, dentro de la misma transacción de negocio. Solo el maestro consulta los últimos 30 eventos desde Seguridad; la totalidad permanece en BD. No existe UI de edición/borrado. TI debe conceder al runtime únicamente SELECT/INSERT sobre auditorías append-only y retirar privilegios de UPDATE/DELETE/TRUNCATE y propiedad del esquema; verificar privilegios heredados, no solo grants directos. Los datos anteriores al registro no se reconstruyen.

La cuenta maestra no puede atender pedidos ni registrar notas/correcciones/documentos; conserva configuración/accesos. Los buzones de Tesorería solo consultan sus solicitudes; la operación requiere una cuenta personal autorizada. No retirar accesos ni eliminar identidades para cambiar esta política.
