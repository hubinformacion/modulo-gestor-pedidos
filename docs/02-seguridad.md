# 02 · Seguridad y accesos

[← Arquitectura](01-arquitectura.md) · [Siguiente: Operación →](03-operacion-y-cierre.md)

## Cómo interpretar el cumplimiento

**Implementado** identifica un control de aplicación revisable en fuente; **compartido** requiere evidencia del proveedor; **pendiente** exige decisión/validación de TI; **no aplica** corresponde a funciones inexistentes. Ningún estado documental sustituye la aceptación funcional del despliegue, un pentest ni una certificación.

## Los 12 requisitos de Seguridad de la Información

| N.º | Requisito | Control y evidencia de código | Qué debe validar TI |
| --- | --- | --- | --- |
| 1 | Autenticación | Google OAuth + Better Auth, email verificado y lista cerrada en BD; sin vinculación automática. `src/lib/auth.ts`, `access.ts` | MFA/cliente/callback institucionales. Comprador usa nanoid32 por posesión, sin identidad civil verificada ni expiración/rotación por UI |
| 2 | Sesiones | Siete días, renovación cada día solo por proxy, autorización BD sin caché de cookie, revocación y comprobación transaccional. `transaction-access.ts`, `src/proxy.ts` | Logout/revocación/expiración y cookies efectivas Secure/HttpOnly/SameSite. No hay timeout adicional por inactividad |
| 3 | Usuarios/contraseñas | Solo maestro administra autorizados; contraseña local deshabilitada. Complejidad local **no aplica** | Política Workspace de contraseña, recuperación y MFA; custodia/rotación de secretos técnicos |
| 4 | Perfiles/roles | Rol, unidad, sesión, asignación y versión comprobados en servidor; `assertOrderOperator` y `assertTreasuryOperator` | Casos permitidos y denegados por rol/unidad, incluidas acciones directas; ver matriz inferior |
| 5 | Log de usuarios/roles | `management_audit`: altas/cambios/revocaciones, unidades y buzones, actor/fecha y antes/después, en la misma transacción | Lectura de evidencia y privilegios SQL append-only. No hay backfill; cambios de identidad/contraseña en Google se auditan en Workspace |
| 6 | Entradas maliciosas | Zod servidor, SQL parametrizado, escape React/HTML de correo, validación de URL/origen, tamaño/firma/hash/pertenencia de archivos. `src/lib/payments/inspect.ts`, validaciones de `src/lib` | Casos inválidos y revisión de WordPress/plugins. No hay antivirus/CDR de PDF ni garantía de inmunidad total |
| 7 | Criptografía | Cifrado en tránsito/reposo de proveedores; secretos privados y HMAC de cuotas. **Sin cifrado propio por campo** | Región, IAM/custodia y cifrado efectivos; aceptar o exigir KMS/cifrado adicional de PII/tokens. Cifrar dumps antes de subir |
| 8 | Protección CIA | Confidencialidad: permisos y DTOs mínimos. Integridad: transacciones/snapshots/hash/auditoría. Disponibilidad: errores/límites y procedimiento de respaldo | RPO 7 días/RTO 4 h como objetivos, no garantías; restauración medida, privilegios y monitorización. Planes gratuitos no aportan un SLA contratado por el proyecto |
| 9 | Consentimiento | Casilla obligatoria con política enlazada, validada servidor; `consentAcceptedAt` y `consentVersion` persistidos | Aprobar texto/finalidad, datos del tercero receptor, conservación y derechos del titular; la casilla no prueba cumplimiento legal completo |
| 10 | Log de datos personales | Originales de compra conservados; correcciones en `treasury_observations`, actividad y auditoría de campos/actor/solicitud | Alcance de mantenimiento cubierto; no existe log individual de cada lectura/descarga. Definir si se exige y con qué volumen/retención |
| 11 | Integraciones | OAuth propietario separado, ACL privadas Drive, MIME escapado, hilos por audiencia, iframe con origin/source exactos | Scopes, cuenta propietaria, accesos manuales/heredados, buzones y scripts del padre; sin evidencia no se presume configuración correcta |
| 12 | Auditoría funcional | Historial de pedidos/Tesorería, administración, cuotas y resultados de correo; sin UI de borrado | Owner aprueba catálogo de eventos; custodios/roles SQL y recuperación. No es WORM ni inalterable frente al propietario de BD |

**CIA:** confidencialidad, integridad y disponibilidad. **PII:** datos personales identificables. **MFA:** segundo factor. **ACL:** lista de permisos. **KMS:** gestor de claves. La leyenda visual está en [01](01-arquitectura.md#leyenda-común).

## Matriz de permisos

| Cuenta | Consulta | Atención de casos | Configuración |
| --- | --- | --- | --- |
| Comprador con token | Su pedido y PDF finalizado vigente | Carga/cancelación permitida por estado; token es una credencial | No |
| Gestor personal | Pedidos y documentos operativos | Solo asignado decide pagos/logística/subsanación/anulación; notas personales del área | Catálogo/descuentos/campus/cuentas; no administra accesos |
| Maestro | Igual consulta de Fondo Editorial | No asigna/libera, valida/rechaza, anula, despacha/entrega, añade notas ni carga/subsana/devuelve documentos | Conserva accesos, configuración e inventario |
| Operador de Tesorería | Solo solicitudes/documentos de sus unidades | Asignación con motivo cuando aplica; PDF/observaciones/finalización solo del asignado; notas del equipo | No |
| Buzón de Tesorería | Solo consulta de sus unidades | Ninguna asignación, nota, observación, carga, retirada ni finalización | No |

Ocultar controles no es autorización: sesión/rol/unidad se revalidan en consultas, acciones y transacciones. Revocar elimina sesiones y libera atenciones abiertas; cerradas conservan responsable/historial. Notas de Tesorería nunca son visibles en Fondo Editorial/comprador. No incrustar módulos internos ni relajar auth/CORS/cookies.

## Datos, confidencialidad y cifrado

El [modelo de datos e inventario de tablas](01-arquitectura.md#base-de-datos-tablas-información-y-protección) relaciona cada tabla con la información que conserva y los controles aplicables. Sus diagramas distinguen claves foráneas, asociaciones lógicas y listas JSON; no presentan la separación por rol/unidad como RLS ni acreditan privilegios SQL efectivos.

| Datos | Dónde viven y quién los necesita |
| --- | --- |
| Nombre, correo, teléfono, DNI; datos fiscales | PostgreSQL y contenido necesario de correo/PDF; Fondo Editorial y Tesorería autorizada para emisión |
| Dirección/receptor/foto opcional de entrega | Snapshot PostgreSQL y archivos Drive; logística de Fondo Editorial, sin foto pública |
| Importes, depósitos, PDF de venta | PostgreSQL/metadatos y archivos Drive privados; comprador solo PDF finalizado de su pedido |
| Identidad, notas e historial del personal | Better Auth/BD y actividades; separación por área/unidad |
| Token de seguimiento | BD y enlace al titular; no logs/capturas/analítica pública |
| Credenciales de servicios | Variables privadas; Better Auth también conserva tokens de identidad en BD; nunca cliente ni Git |

Neon publica AES-256 en reposo y TLS 1.2+; Google cifra normalmente Drive en reposo/tránsito: [Neon](https://neon.com/security), [Google](https://support.google.com/drive/answer/10519333). Esto no es cifrado de campo propio ni evita lectura por un rol SQL autorizado. Hash/HMAC verifica o seudonimiza; no cifra un PDF o DNI. No hay máscara general de teléfonos/DNI: si TI exige ocultar/revelar, debe hacerse en el DTO servidor, no solo CSS.

Retención de negocio indefinida por decisión operativa, sin purga automática. Legal/TI deben aceptar finalidad, conservación, derechos y excepciones. Backups, Gmail y Drive tienen copias independientes: borrar una fila no las elimina; restaurar puede reintroducir accesos revocados.

## Qué se audita

| Operación | Registro y alcance |
| --- | --- |
| Recepción/consentimiento, asignación/liberación, pagos, despacho/entrega y cancelación | `orders`, `order_activity`; fecha, estado y actor personal cuando corresponde |
| Cargas, revisiones, observaciones, subsanación y emisión/devolución | Intentos/documentos, `treasury_activity`, `treasury_observations`; originales y correcciones conservados |
| Accesos, roles/unidades/servicio y buzones | `management_audit`; actor y permisos anteriores/nuevos, persisten tras baja |
| Cuentas/campus, catálogo/stock/precios y promociones/cupones | `management_audit`; recurso, operación y campos de negocio explícitos |
| Correcciones fiscales | Observación con valores; auditoría con ID estable de actor y campos afectados, sin duplicar PII en logs de plataforma |
| Límites de admisión | `order_admission_changes`; maestro, valores anteriores/nuevos y fecha |
| Correo | `order_emails`, `order_notifications`, `caja_notifications`, `pickup_notifications`; resultado/API/hilo, nunca cola ni reenvío histórico |

Solo maestro ve los últimos 30 registros administrativos en Seguridad; historial entero en BD, sin edición/borrado por UI y sin reconstrucción de eventos antiguos. TI debe restringir runtime a SELECT/INSERT en tablas append-only, sin propiedad ni privilegios heredados de modificación. La auditoría no sustituye logs de Workspace ni registra cada visualización o copia local.

## Riesgos tratados y límites de la revisión

Revisión de fuente guiada por [Cloudflare security-audit-skill](https://github.com/cloudflare/security-audit-skill/tree/main/skills/security-audit). El expediente detallado está fuera del repositorio; no se ejecutaron ataques ni se acreditaron vulnerabilidades en producción.

| Riesgo revisado | Tratamiento en código | Validación pendiente |
| --- | --- | --- |
| Creación anónima sin cuota agregada | Cuotas transaccionales compartidas y editables por maestro, idempotencia preservada | Concurrencia en ambiente aislado, cabecera IP Vercel/firewall y consumo real. No protege de todo tráfico HTTP |
| Permiso Drive sin intención durable previa | Registro antes de API, recuperación por email/carpeta aun tras revocación y lectura de rol/herencia antes de retirar | Pérdida de respuesta en entorno controlado e inventario real por propietario; registros previos pueden tener procedencia indistinguible |

Carpeta operativa exclusiva. No adoptar/retirar permisos manuales preexistentes; el técnico supervisa a quién se añade. No modificar manualmente el mismo principal mientras la aplicación lo gestiona: Google no ofrece un borrado condicional de ese permiso. Preservar owners/writers/organizadores/heredados. La recuperación ACL técnica no es una cola de correo.

## Evidencias para TI

Registrar ambiente, versión, fecha, responsable y resultado. Adjuntar configuración redactada de MFA/OAuth, IAM/SQL/cifrado/región, ACL y firewall; ejemplo anonimizado de auditoría; acta de respaldo/restauración; aceptación funcional/legal de consentimiento/retención/eventos. Revisar accesos/retención/redacción de logs Vercel/WordPress: pueden contener rutas con tokens aunque los logs propios sean seguros.

No adjuntar `.env.local`, cookies, dumps, tokens, PDFs de compradores ni parámetros SQL. Advisory de dependencias se revisa al actualizarlas; esta revisión de fuente y lint/build no equivalen a un escaneo actualizado del registro ni a pruebas completas OAuth/Gmail/Drive/WordPress.


Personal de apoyo para recojo: contactos sin autorización de ingreso ni permisos Drive. Solo reciben por correo el nombre/documento/teléfono de quien recoge, publicaciones, lugar y horario del pedido asignado, con copia a gestores FE. No reciben el enlace privado del comprador ni documentos de otros pedidos. El comprador consulta el nombre de apoyo; su correo permanece interno. Cambios del listado se auditan. Los correos nuevos de Tesorería incluyen también CC de gestores FE, excluyendo al comprador y operadores adicionales de Tesorería.
