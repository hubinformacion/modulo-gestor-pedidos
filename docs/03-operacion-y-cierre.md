# 03 · Instalación, operación y cierre

[← Seguridad](02-seguridad.md) · [Siguiente: Guía de uso →](04-guia-de-uso.md)

Responsable técnico: Fredy Paolo Romero Espinoza. Requiere Node.js 24, pnpm 11.3.0, PostgreSQL Neon, Vercel, Google OAuth/Drive/Gmail y acceso al bloque WordPress. Datos de contacto y acuerdos en [00](00-inicio.md).

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

## Variables y Google

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

Si Drive y Gmail fallan con HTTP 400 y `reason: invalid_grant`, Google rechazó el token propietario: puede haber vencido o sido revocado. Revisar primero el estado de publicación/las políticas institucionales, volver a autorizar con el mismo cliente OAuth y los tres scopes, actualizar `GOOGLE_REFRESH_TOKEN` en Vercel (Production) y localmente, y desplegar de nuevo. No imprimir tokens ni respuestas OAuth completas. La corrección permite eventos nuevos; los correos fallidos no se reenvían automáticamente.

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


## Seed: configuración recuperable

Fuente: [seed-data.ts](../src/db/seed-data.ts) y maestro en [access-policy.ts](../src/lib/access-policy.ts). Incorpora `distribucionfe@continental.edu.pe`, cuatro cuentas PEN confirmadas (BCP/BBVA por unidad), ocho campus con dirección/ubicación/coordenadas y la política de cuotas. Sin catálogo ficticio, usuarios OAuth, pedidos ni correos.

Campus: Arequipa, Ayacucho, Cusco, Huancayo - Instituto (Real), Huancayo - Universidad (San Carlos), Ica, Lima - Los Olivos y Lima - Miraflores. Direcciones/coordenadas y cuentas/CCI exactos permanecen en la fuente única del seed; no duplicarlos en manuales que puedan quedar desactualizados. Los titulares legales están confirmados.

`pnpm db:seed` incorpora faltantes y conserva conflictos; no sobrescribe lo editado. Cambiar nombre de campus o número de cuenta puede hacer que el original parezca faltante: revisar fuente antes de repetir. Cambios UI no se copian al seed; actualizarlo solo con datos confirmados para futuras instalaciones. El seed no es un respaldo ni recupera numeración, historial o archivos. No reinstalar/reiniciar una BD para resolver un error de esquema.

Revisar guías definitivas `src/assets/pdfs/guia_pago_{universidad,instituto,mixta}.pdf`; Universidad/Mixto se aceptaron temporalmente iguales. Buzones/equipo y catálogo real se configuran por interfaz, sin inventarlos en el seed.

## Cuotas, recursos y tareas automáticas

Seguridad permite al maestro ajustar: 3 pedidos/correo/15 min, 10/correo/día Perú, 20/IP/15 min, 200 globales/día y 3 pendientes impagos/correo. Son valores iniciales, no constantes de despliegue. Cambios auditados y seed conserva personalizados. Intervalos fijos, cuotas compartidas, no se restituyen por cancelación; intento ya creado no consume otra cuota. Una red de campus puede compartir IP; fuera de Vercel/sin IP válida se usa un grupo conservador. HMAC usa BETTER_AUTH_SECRET; rotarlo cambia claves de correo/IP, no la cuota global ni pendientes de negocio.

Sin polling periódico ni recuperación de correo. El único cron diario es de ACL Drive. Mantener CRON_SECRET privado y monitorizar consumo/errores. Las cuotas acotan pedidos aceptados, no todo HTTP: revisar Firewall del proyecto Vercel Hobby y controles disponibles del plan, sin desafíos que rompan iframe/OAuth. No se afirma que se haya configurado esa consola ni que exista techo de gasto garantizado.

## Respaldo manual semanal a Drive

| Acuerdo | Significado |
| --- | --- |
| Conservación de negocio | Indefinida; no borra pedidos/documentos/historial automáticamente |
| RPO objetivo: 7 días | Pérdida tolerada desde la última copia válida; depende de cumplir el respaldo semanal |
| RTO objetivo: 4 horas | Tiempo objetivo de recuperación; falta demostrarlo con un ensayo medido |

**Sí puede guardarse en Drive:** usar carpeta privada separada de comprobantes, sin permisos heredados al equipo de atención. Cifrar antes de subir y guardar clave en un mecanismo institucional separado. No subir el dump sin cifrar ni guardar la clave junto al archivo.

1. En equipo institucional, usar directorio privado fuera de Git/sin sincronización automática. Obtener conexión Neon **directa, pooling desactivado**, con rol de respaldo aprobado y cliente PostgreSQL compatible.
2. Proteger credenciales en archivos de servicio/contraseña del cliente; no pegarlas en historial ni logs. Exportar con `pg_dump --format=custom`; no ejecuta reset/seed ni modifica esquema.
3. Verificar salida correcta y listado con `pg_restore --list`. Esto valida formato, no sustituye restaurar realmente.
4. Cifrar con la herramienta aprobada por TI (por ejemplo, formato AES-256 con nombres cifrados); comprimir sin cifrado no basta. No pasar la clave como argumento visible.
5. Registrar fecha/proyecto/versión, tamaño, hash del archivo cifrado y resultado; subir a la carpeta exclusiva de custodios. Verificar carga y permisos, sin enlace público.
6. Conservar acta y proteger temporales según política institucional. No hay purga automática de versiones ni se asume que eliminar un SSD equivale a borrado seguro. Supervisar capacidad de Drive y escalar si se omite una semana.

Neon Free tiene ventana instantánea de hasta seis horas, sujeta al plan, y un snapshot manual; no sustituye copia semanal ni archivo ilimitado de versiones. Calendarios automáticos requieren plan compatible. Ver [Neon backup](https://neon.com/docs/manage/backup-pg-dump), [ventana histórica](https://neon.com/docs/postgres/backup-restore/history-window) y [snapshots](https://neon.com/docs/guides/backup-restore); confirmar condiciones en consola.

Automatizar requiere ejecutor con pg_dump, cifrado, credencial SQL y subida Drive; las APIs/keys actuales solo resuelven parte del proceso. Preferir un job institucional separado, identidad mínima sin Gmail operativo, límites de tiempo/tamaño y aviso de fallo. **Automatización no implementada**: primero validar copia/restauración. No se han creado carpetas ni subido dumps durante la revisión.

## Restauración medida y cierre de pendientes

Restaurar en base vacía aislada compatible, sin envíos, cron ni cargas; nunca sobre producción para comprobar que funciona. Verificar integridad, versión, relaciones y referencias a archivos; PostgreSQL no respalda bytes Drive ni mensajes Gmail. Reaplicar revocaciones y revisar ACL antes de abrir tráfico: una copia puede reactivar autorizaciones antiguas. No ejecutar reconciliación de un ensayo contra la carpeta operativa.

| Pendiente | Qué necesitamos / resultado esperado | Responsable |
| --- | --- | --- |
| Validación funcional de rama | Maestro y buzones solo consultan; personal atiende únicamente rol/unidad/asignación; acciones directas denegadas y auditoría persistente | Funcional + técnico |
| Cuotas e idempotencia | En ambiente aislado: mismo intento no duplica; límite/concurrencia no deja stock/pedido parcial. No usar pedidos/correos operativos para simularlo | Técnico |
| Permiso Drive ambiguo | Adaptador local o Google aislado autorizado: intención previa, respuesta perdida, revocación y conservación de manuales/owners/writers/heredados | Técnico + propietario Google |
| Evidencia de proveedor | MFA/OAuth, privilegios SQL/IAM, cifrado/región, ACL, firewall y logs redactados | TI |
| Copia y restauración | Destino/cifrado/clave/custodios definidos; copia válida; medir desde descarga/descifrado hasta verificación, objetivo ≤4 horas | Técnico; conformidad funcional |
| Instalación y despliegue | En entorno aislado autorizado: instalación vacía, segunda compatible, rechazo incompatible; verificar OAuth/adjuntos/hilos y WordPress móvil | Técnico + funcional |
| Aceptación institucional | Finalidad/consentimiento, receptor tercero, conservación y catálogo de eventos; aprobación de merge/publicación | Funcional + Seguridad/TI |

Registrar versión/ambiente, fecha, ejecutor, resultado y evidencia anonimizada. No adjuntar secretos, cookies, dumps, PDFs reales ni tokens. Lint/tipos/build ya realizados no acreditan los casos de esta tabla. No se añaden suites, datos DEMO ni ensayos automáticos contra producción.

## Incidentes y mantenimiento

| Caso | Actuación |
| --- | --- |
| BD/OAuth temporalmente no disponible | Revisar código seguro/consola; no repetir mutaciones ambiguas ni borrar sesiones por indisponibilidad |
| Gmail falla | Cambio de negocio permanece; auditar y coordinar comunicación externa. No hay cola ni reenvío histórico |
| Drive/carga falla | Conservar archivo e intento; reintentar sin duplicar. ACL pendiente: confirmar retiro real, no confundirlo con logout |
| Secreto o enlace expuesto | Restringir/rotar en proveedor y registrar incidente; seguimiento no tiene rotación por UI, escalar al técnico |
| Esquema incompatible | Detener nueva instalación/versión y revisar actualización; nunca borrar BD para resolverlo |

Privilegios: rol runtime sin propiedad/DDL; auditorías append-only solo SELECT/INSERT y sin privilegios heredados de cambio/borrado. No reconstruir registros antiguos. Revisar dependencias/advisories con compatibilidad, sin actualizaciones masivas automáticas.

Mejoras de mantenimiento identificadas: unificar Boleta/Factura efectiva tras subsanación entre detalle/bandeja; comparar versión de formularios campus/cuentas para evitar sobrescritura obsoleta; separar más el DTO público de metadatos de correo. No se presentan como vulnerabilidades demostradas ni se ocultan por simplificar documentación.
