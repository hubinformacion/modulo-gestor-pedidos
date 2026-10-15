# Instalación y operación técnica

## Requisitos y responsables

Node.js 24 y pnpm 11.3.0; PostgreSQL en Neon; proyecto Vercel; cliente Google OAuth Web; cuenta propietaria con Drive/Gmail y carpeta privada; acceso al bloque HTML de WordPress. Nombrar un responsable técnico de infraestructura y uno funcional del Fondo Editorial. El maestro de aplicación no sustituye la administración de Neon/Vercel/Workspace.

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

No hay backup propio programado en el código. TI debe aprobar y documentar:

1. RPO: cuánta información se tolera perder; RTO: cuánto puede durar la recuperación.
2. Ventana real de recuperación histórica del plan Neon, región, custodios y protección de la cuenta. No asumir una retención fija por estar en una capa gratuita.
3. Respaldo lógico adicional si lo requiere la política institucional, cifrado, ubicación separada, control de acceso y caducidad. Nunca almacenar dumps en Git o carpetas públicas.
4. Conservación de Drive y Gmail: restaurar PostgreSQL no restaura automáticamente archivos ni mensajes.
5. Prueba de restauración en rama/entorno aislado sin permitir envíos o cargas operativas; verificar integridad y permisos antes de reconectar.
6. Accesos vigentes: una restauración puede reactivar usuarios o referencias revocadas. Reaplicar decisiones de acceso y reconciliar ACL antes de abrir tráfico.

Referencias del proveedor: [conexión segura Neon](https://neon.com/docs/connect/connect-securely), [ventana histórica](https://neon.com/docs/postgres/backup-restore/history-window). Los valores efectivos del proyecto deben obtenerse de la consola y registrarse en el expediente privado de TI.

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
