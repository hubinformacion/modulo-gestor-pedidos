# Matriz de requisitos de Seguridad de la Información

## Alcance y criterio de evaluación

Documento para trasladar al formato institucional de Word. Describe la aplicación, los controles revisables en código y las evidencias externas necesarias. No constituye una certificación ni reemplaza la aprobación de Seguridad de la Información. Herramientas y arquitectura están en [arquitectura](arquitectura.md); responsables en [expediente técnico](README.md).

Estados utilizados:

- **Implementado en aplicación:** existe un control identificable en fuente; requiere aceptación funcional del despliegue.
- **Compartido con proveedor:** parte depende de Google Workspace, Neon, Vercel o WordPress; TI debe adjuntar evidencia de consola/política.
- **Pendiente institucional:** falta una decisión o verificación del área competente; no se presenta como cumplido.
- **No aplicable:** la función descrita no existe en esta solución y se explica por qué.

| N.º | Requisito recibido | Estado y evidencia principal |
| --- | --- | --- |
| 1 | Métodos de autenticación | Implementado y compartido: Google OAuth, email verificado, lista cerrada en PostgreSQL; MFA a acreditar en Workspace |
| 2 | Gestión de sesiones | Implementado: expiración, renovación, revocación, comprobación en servidor y ausencia de caché de autorización |
| 3 | Usuarios y contraseñas | Gestión de accesos implementada; contraseñas locales no aplican; política de Google a acreditar |
| 4 | Perfiles y roles | Implementado: rol, unidad, responsable y restricción de cuentas de servicio en acciones y transacciones |
| 5 | Log de usuarios/roles/perfiles | Implementado para las operaciones de acceso de la aplicación desde esta versión; sin reconstrucción histórica |
| 6 | Entrada de datos maliciosos | Implementado en entradas revisadas: Zod, SQL parametrizado, escapes y validación de archivos; no equivale a protección absoluta |
| 7 | Criptografía de almacenamiento | Compartido: cifrado de proveedores; sin cifrado propio por campo; evidencia y aceptación de TI pendientes |
| 8 | Confidencialidad, integridad, disponibilidad | Controles de aplicación y proveedores; recuperación y objetivos de continuidad pendientes de ensayo |
| 9 | Consentimiento de datos personales | Implementado: aceptación obligatoria, política enlazada, versión y fecha persistidas; revisión legal pendiente |
| 10 | Log del tratamiento/mantenimiento de datos personales | Implementado para recepción, consentimiento y correcciones fiscales; no hay auditoría individual de cada lectura |
| 11 | Integraciones | Controles implementados para OAuth, Drive, Gmail y WordPress; accesos y configuración real por acreditar |
| 12 | Auditoría funcional | Implementada en pedidos, Tesorería y administración; catálogo de eventos sujeto a aceptación del owner |

## 1. Métodos de autenticación

El personal inicia sesión con Google OAuth mediante Better Auth. Se solicita identidad (`openid email profile`), se exige email verificado y se consulta `authorized_emails` en PostgreSQL. Estar autenticado en Google no otorga acceso por sí mismo. Se deshabilitan contraseña local y vinculación automática de cuentas. El callback valida la identidad también para usuarios que regresan.

El comprador no requiere cuenta: accede al seguimiento mediante un token aleatorio nanoid de 32 caracteres. Es una credencial por posesión, no un segundo factor ni una prueba de identidad civil. No hay expiración/rotación por interfaz de ese enlace actualmente. No incluirlo en analítica, capturas o tickets.

**Fuente:** `src/lib/auth.ts`, `src/lib/access.ts`, `src/lib/access-policy.ts`, `src/proxy.ts`, creación/seguimiento en `src/lib/orders`.

**Evidencia requerida:** cliente OAuth institucional, dominios/callbacks autorizados, MFA de operadores y propietarios en Workspace; prueba de cuenta autorizada/no autorizada. La aplicación no puede imponer ni acreditar por sí sola el MFA de Google.

## 2. Gestión de sesiones

La sesión dura siete días y se renueva con un intervalo de un día. Solo el proxy renueva y reenvía cookies; páginas/acciones leen la sesión sin renovarla. La caché de sesión por cookie está desactivada y se verifica sesión vigente, email verificado y permiso en BD. Las mutaciones sensibles repiten la comprobación dentro de la transacción.

La revocación cierra sesiones y libera atenciones abiertas atómicamente. Un error temporal de BD produce indisponibilidad y no un falso cierre de sesión. Se reintenta una lectura temporal acotada; nunca una mutación ambigua. Las cookies de producción son las seguras que Better Auth emite bajo HTTPS; TI debe verificar atributos efectivos `HttpOnly`, `Secure` y `SameSite` en el navegador, sin copiar el valor de cookie.

**Evidencia requerida:** expiración/renovación, logout, revocación con sesión abierta y acceso directo a acción/ruta. No afirmar que la sesión es corta o que hay timeout por inactividad: siete días es la vigencia configurada y no existe un bloqueo adicional por inactividad del operador.

## 3. Gestión de usuarios y contraseñas

Solo el maestro `distribucionfe@continental.edu.pe` administra accesos personales y buzones por interfaz. No hay autorregistro público ni formulario de recuperación/cambio de contraseña local. Las identidades OAuth se materializan en las tablas de Better Auth tras autorizar su correo; la tabla de autorizados es la autoridad del acceso, no la existencia de la identidad.

**Complejidad de contraseñas locales: no aplica.** Las contraseñas y recuperación de las cuentas institucionales son responsabilidad de Google Workspace. TI debe adjuntar su política de contraseña/MFA, altas/bajas y recuperación. Los secretos de aplicación, SQL y tokens propietarios no son contraseñas de usuario: se custodian en variables privadas y requieren rotación/procedimiento institucional.

## 4. Gestión de perfiles y roles

| Cuenta | Consulta | Atención operativa | Administración de accesos |
| --- | --- | --- | --- |
| Maestro Fondo Editorial | Pedidos/reportes/configuración | No toma/libera pedidos, valida/rechaza pagos, anula, despacha, entrega, carga evidencia, subsana/devuelve documentos ni añade notas | Sí, conserva las facultades de configuración necesarias |
| Gestor personal | Datos operativos de Fondo Editorial | Solo su pedido asignado para decisiones; notas internas con identidad personal | Consulta; no modifica accesos |
| Operador personal de Tesorería | Solicitudes de las unidades autorizadas | Asignación/reasignación, notas del equipo y atención de su solicitud según estado/versión | No |
| Buzón de servicio de Tesorería | Solicitudes, documentos e historial de sus unidades | No asigna, libera, observa, añade notas, carga/retira PDF ni finaliza | No |
| Comprador con token | Su seguimiento y documentos finalizados | Carga/cancelación permitida por reglas del pedido | No |

Los controles se ejecutan en servidor aunque se fabrique una petición. `assertOrderOperator` separa al maestro del gestor personal; `assertTreasuryOperator` impide actuar al buzón. Rol, unidad y sesión se comprueban nuevamente en la transacción; no se acepta la identidad del actor desde un formulario. El maestro conserva facultades de configuración/inventario; «solo consulta» se refiere a la atención operativa de casos.

**Fuente:** `src/lib/transaction-access.ts`, `src/lib/access-policy.ts`, `src/lib/caja`, `src/lib/treasury`, acciones administrativas. **Validación:** casos por rol/unidad y petición directa denegada, en entorno aislado.

## 5. Log de gestión de usuarios, roles y perfiles

`management_audit` conserva UUID, fecha, ID/email/nombre/rol del actor, operación, recurso, referencia y metadatos explícitos. Registra altas, cambios y revocaciones de accesos de gestores y Tesorería, cambios de unidades y conversión a buzón de servicio, además del cambio del buzón de cada unidad. Los snapshots de permisos anteriores/nuevos permanecen aunque se revoque el acceso o desaparezca la identidad OAuth.

La escritura comparte transacción con el cambio: un fallo de auditoría impide confirmar la operación administrativa. Duplicados o acciones sin cambio no fabrican otro evento. Los eventos previos a incorporar esta auditoría no se inventan ni reconstruyen. El seed inicial es configuración versionada y no simula una acción de una persona.

El maestro consulta los últimos 30 eventos en Configuración → Seguridad → Registro de administración. El historial completo queda en BD; no se ofrece edición/borrado desde la aplicación. No se envían snapshots de auditoría a compradores ni Tesorería. Los cambios del perfil/contraseña administrados directamente en Google deben revisarse en la auditoría de Workspace; esta tabla no reemplaza esos registros externos ni es un log completo de intentos de login.

**Control pendiente de infraestructura:** rol SQL runtime sin propiedad de tablas ni permisos `UPDATE`, `DELETE` o `TRUNCATE` sobre las tablas de auditoría append-only; acceso de lectura limitado a custodios. No describir los registros como inalterables frente al propietario de la BD. No se ha implementado un almacén WORM ni firma/cadena criptográfica del log.

## 6. Manejo de entrada de datos maliciosos

- Zod valida longitudes, formatos, estados y campos de las Server Actions; la validación del navegador no sustituye la del servidor.
- Drizzle parametriza los valores SQL; precios, stock, descuentos y numeración se recalculan desde BD y bajo transacción.
- React escapa texto y los correos escapan HTML. No introducir HTML de usuario como marcado confiable.
- Las cargas limitan tamaño a 3 MiB, tipos permitidos, firma y hash, y verifican pertenencia/unidad/ciclo. El nombre del archivo se conserva de forma segura y no se usa para construir rutas arbitrarias del servidor.
- URLs, orígenes, tokens y cabeceras se validan; el iframe comprueba `origin` y `source` y usa un destino exacto. No habilitar comodines para resolver errores.
- Las cuotas de admisión son transaccionales; las claves de IP/correo usan HMAC. No constituyen un WAF ni garantizan gasto cero.

**Límites:** no hay antivirus/CDR de PDF, no se ha ejecutado un pentest completo, ni se afirma inmunidad frente a toda inyección o XSS. TI debe evaluar archivos maliciosos y WordPress/plugins según su política. Fuente principal: validaciones de `src/lib`, `src/lib/payments/inspect.ts`, servicios de correo y `src/iframe`.

## 7. Criptografía de almacenamiento

Neon publica cifrado AES-256 en reposo y TLS 1.2+ en tránsito. Google cifra normalmente Drive en tránsito y reposo. Son controles de los proveedores, no una implementación propia de cifrado de campo. Referencias: [seguridad de Neon](https://neon.com/security), [cifrado en Drive](https://support.google.com/drive/answer/10519333).

La aplicación no cifra individualmente DNI, teléfono, direcciones ni todos los tokens OAuth almacenados por Better Auth. Un operador autorizado o un rol SQL con lectura suficiente puede ver esos campos. HMAC de cuotas y hash de archivos no cifran el contenido original. Los secretos propietarios residen en variables privadas y no se entregan al cliente.

**TI debe acreditar/aceptar:** proveedor/región/proyecto, custodia de claves, IAM/MFA, privilegios SQL, acceso a secretos y necesidad de cifrado adicional de determinados campos o tokens. Si exige cifrado de campo con clave institucional/KMS, se necesita una implementación específica y un procedimiento de rotación/restauración; no se presenta como ya disponible. Las copias descargadas se cifran antes de subirlas a la carpeta privada de respaldo, con clave custodiada por separado.

## 8. Protección de datos: confidencialidad, integridad y disponibilidad

**Confidencialidad:** permisos por rol/recurso/unidad, archivos privados, token de seguimiento, respuestas sensibles no-store/no-referrer, datos mínimos en clientes/reportes, notas privadas separadas por área, TLS y cifrado de proveedor. No existe enmascaramiento general ni expiración de seguimiento; decidir si TI los exige. Una máscara CSS no protege datos ya enviados al navegador.

**Integridad:** constraints/FK, snapshots, validación de importes servidor, stock/cuotas/numeración transaccionales, versión y responsable en cambios, revisiones inmutables de documentos, firma/hash de archivos, registro de operaciones y límites de admisión. No hay transacción distribuida BD/Google; el diseño conserva intentos durables y audita fallos de correo sin reenviarlos.

**Disponibilidad:** límites de conexión/consulta, manejo de errores, ausencia de polling periódico y actualización manual. Neon/Vercel gratuitos no aportan una garantía de SLA contratada por este proyecto. Respaldo manual semanal con RPO objetivo siete días y RTO objetivo cuatro horas; ambos dependen del procedimiento y el RTO debe medirse. Conservar todos los datos no asegura que puedan recuperarse.

**Evidencia:** [validación y continuidad](validacion-y-continuidad.md), copia cifrada íntegra, restauración aislada medida, monitorización/alertas y responsables designados. La conservación indefinida comunicada operativamente requiere revisión institucional sobre finalidad y obligaciones legales.

## 9. Consentimiento para tratamiento de datos personales

Antes de enviar el pedido se exige la casilla: «He leído y acepto la Política de Confidencialidad y Protección de Datos Personales, y autorizo a la Universidad Continental al tratamiento de mis datos». La política está enlazada. La creación valida aceptación en servidor y guarda `consentAcceptedAt` y `consentVersion`; no basta ocultar/deshabilitar el botón.

Los cambios del borrador/precios relevantes requieren nueva revisión/aceptación según el flujo. La versión del consentimiento debe cambiar cuando cambie su texto/política de referencia, conservando versiones previas en los pedidos existentes.

**Pendiente legal/institucional:** aprobar finalidad, base legal, información del titular, tratamiento de datos de un receptor distinto del comprador, conservación indefinida y procedimiento de derechos del titular. Una casilla no demuestra por sí sola cumplimiento legal integral.

## 10. Log del tratamiento/mantenimiento de datos personales

El pedido conserva los datos originales, la fecha y la versión de consentimiento. Las correcciones fiscales se registran en `treasury_observations` con originales conservados en el pedido, corrección, respuesta, fecha y responsable; `treasury_activity` mantiene el evento y `management_audit` añade el ID estable del actor, solicitud/observación y nombres de campos corregidos. El detalle usa la corrección vigente sin sobrescribir la compra original. Revocaciones y cambios de permisos quedan en el registro de administración.

Los archivos conservan autor, fecha, hash e historial según su ciclo. No hay una interfaz de edición genérica de los datos originales del comprador ni un borrado automático de datos de negocio. Cualquier futura corrección/eliminación debe incorporar trazabilidad y autorización; una actuación SQL manual debe quedar en el procedimiento privado de TI.

**Alcance explícito:** no se registra cada consulta visual, copia local del operador o descarga como evento de lectura individual. Si TI exige ese nivel, debe definir eventos, acceso, volumen y retención antes de ampliarlo; no registrar DNI, teléfonos, tokens o documentos completos en logs de infraestructura.

## 11. Integraciones con otros sistemas

| Integración | Confidencialidad/integridad | Verificación externa |
| --- | --- | --- |
| Google OAuth | Identidad verificada, callback/origen confiable, login con scopes de identidad | Cliente institucional, MFA, políticas de cuenta |
| Neon | Consultas parametrizadas/transaccionales y transporte seguro | Región, cifrado, rol SQL restringido y respaldo |
| Drive | Carpeta privada, permisos nominados por recurso, intención durable antes de conceder, revisión de rol/herencia antes de retirar; no adopta accesos manuales preexistentes | ACL real de carpeta/archivos, custodia de propietario y supervisión de accesos manuales |
| Gmail | Token propietario separado, MIME escapado, hilos por audiencia, aviso inmediato solo del evento nuevo | Buzones, scopes, custodia y retención de correo |
| WordPress | Orígenes exactos, handshake, comprobación de source y mensajes sin PII; administración fuera del iframe | Plugins/scripts del padre y bloque realmente publicado |
| Drive de respaldos | Copia previamente cifrada en carpeta separada con ACL de custodios | Carpeta/clave/custodios y ensayo de restauración; automatización aún no implementada |

No mostrar credenciales en capturas ni entregarlas como evidencia. Una carpeta privada dentro de una carpeta ampliamente compartida puede heredar accesos: comprobar permisos efectivos. Las llamadas Google no se usan como prueba de seguridad contra datos operativos.

## 12. Logs de auditoría funcionales

| Evento | Registro | Actor/fecha y alcance |
| --- | --- | --- |
| Recepción y consentimiento | `orders`, `order_activity` | Comprador por datos declarados/token y fecha de recepción; no implica identidad civil verificada |
| Asignar/liberar, verificar/rechazar pago, despachar, entregar y anular | `order_activity` | Operador personal, estado y fecha; reglas de asignación/versión |
| Cargas y evidencias | Tablas de intentos/documentos y actividades | ID, hash, autor y fecha, revisiones conservadas |
| Asignación, observación, subsanación y emisión/devolución | `treasury_activity`, `treasury_observations`, `sale_documents` | Historial por solicitud/unidad y operadores personales |
| Altas/cambios/revocaciones de acceso y buzones | `management_audit` | Actor, objeto, antes/después de permisos, fecha |
| Campus, cuentas bancarias, catálogo/stock/precios, promociones/cupones | `management_audit` | Operación, recurso, cambios explícitos y actor; eliminación no borra el evento |
| Límites de admisión | `order_admission_changes` | Maestro, valores anteriores/nuevos y fecha |
| Correcciones de datos de emisión | Observaciones + `management_audit` | Valores de corrección en registro restringido y campos afectados en auditoría |
| Resultado de correo | `order_emails`, `order_notifications`, `caja_notifications` | Resultado/API/hilo del evento; nunca una cola ni reenvío histórico |

Los registros administrativos no son visibles en el seguimiento público ni al equipo de Tesorería. Sus notas e historial propios conservan la separación por unidad. Se conserva información de negocio indefinidamente, sin reconstruir eventos antiguos ni generar eventos ficticios.

**Aceptación del owner:** Jullisa del Pilar Falla Aguirre valida que el catálogo de eventos cubra las operaciones relevantes y aprueba cualquier ampliación. Fredy Paolo Romero Espinoza acredita custodia, consulta, privilegios y recuperación. La aprobación debe adjuntarse al expediente institucional; este documento no la presume.

## Evidencias para adjuntar al documento Word

1. Versión/commit y ambiente efectivamente revisados, fecha y responsables.
2. Matriz de pruebas manuales por rol y resultados, sin datos personales ni cookies en capturas.
3. Configuración redactada de MFA/OAuth, ACL Drive, IAM/roles SQL, cifrado/region y firewall.
4. Ejemplo anonimizado de registro de acceso/operación y evidencia de persistencia tras revocación, en entorno aislado.
5. Acta de copia/restauración con tiempos, integridad y reconciliación de accesos.
6. Aprobaciones de finalidad/retención/consentimiento, catálogo de eventos y controles compensatorios pendientes.

No adjuntar `.env.local`, dumps, tokens, URLs de seguimiento, PDFs reales ni parámetros SQL. Una tabla documental y un build exitoso no reemplazan estas evidencias.
