# Validación y continuidad para la aceptación de TI

## Orden para cerrar las verificaciones pendientes

1. Preparar un ambiente aislado de aceptación: rama/proyecto Neon separado y variables propias. No copiar datos personales ni permisos reales para simular fallos. Mantener Gmail deshabilitado o dirigido únicamente a destinatarios de aceptación expresamente autorizados.
2. Revisar los 12 puntos de [Seguridad de la Información](requisitos-seguridad-ti.md), registrar responsable, resultado, fecha y evidencia redactada. No marcar todos como conformes solo por revisar el código.
3. Comprobar las cuotas de creación y la recuperación de permisos con recursos aislados. No provocar timeouts ni revocaciones en la carpeta operativa.
4. Realizar una primera copia cifrada y restaurarla en una base vacía aislada. Medir tiempos y verificar permisos antes de concluir que el RTO de cuatro horas es viable.
5. Adjuntar evidencias de proveedor y aprobación funcional/legal a la documentación Word. Registrar los controles pendientes o compensatorios.

Este procedimiento es manual; no añade un framework de pruebas, datos DEMO al seed ni tareas periódicas a la aplicación. Los casos con pedidos/correos de aceptación requieren un ambiente y destinatarios autorizados; no se ejecutan automáticamente como parte de una revisión de fuente.

## Matriz de aceptación funcional y de seguridad

| Caso | Resultado esperado | Evidencia segura |
| --- | --- | --- |
| Cuenta Google no autorizada | No accede a administración ni Tesorería | Resultado de acceso, sin cookie/token |
| Maestro | Consulta pedidos y documentos; no aparecen controles de atención, notas ni cargas | Captura redactada y denegación de acción directa |
| Buzón de Tesorería | Consulta solo sus unidades; no asigna/libera/observa/carga/finaliza ni añade notas | Resultado con cuenta de aceptación |
| Operador personal | Atiende únicamente unidades y solicitudes permitidas; otro rol/unidad se deniega | Casos de acceso permitido/denegado |
| Revocación durante sesión | Sesión deja de autorizar; atenciones abiertas se liberan y hay auditoría | Evento de revocación y respuesta posterior |
| Alta/cambio/baja de acceso | Operación y evento auditado confirman juntos; permanece el historial tras baja | Registro administrativo anonimizado |
| Consentimiento ausente | No crea pedido, stock ni correo | Resultado de acción en ambiente aislado |
| Doble envío con mismo intento | Recupera el pedido existente sin otro stock, cuota o correo | Conteos del ambiente de aceptación |
| Superación de cuotas | Rechaza de forma consistente entre instancias; no deja pedido parcial | Conteos/errores sin PII; cambiar límites solo en el ambiente aislado |
| Cambio de límites | Solo maestro, con versión vigente; conserva cambios y autor | Registro `order_admission_changes` |
| Corrección fiscal | Conserva compra original y corrección fechada con responsable y campos afectados | Historial de subsanación anonimizado |
| Archivo inválido/ajeno | Rechaza por firma/tamaño/pertenencia; no ofrece archivos de otra unidad | Resultado seguro, sin contenido documental |
| Correo operativo | Se intenta únicamente en evento nuevo; no reenvía al consultar ni por cron | Auditoría y destinatarios de aceptación autorizados |
| Permiso Drive ambiguo | La intención existe antes del API; al revocar se recupera y retira solo el lector gestionado | Validación acotada con adaptador local controlado o entorno Google aislado autorizado |
| Permiso manual/owner/writer/heredado | No lo adopta ni retira como permiso gestionado | Inventario redactado del recurso de aceptación |
| Iframe | Origen/source exactos, altura correcta móvil, sin tokens/PII en postMessage | Inspección del bloque publicado y navegador |
| Respaldo/restauración | Copia íntegra y cifrada; restauración aislada sin envíos ni permisos reactivados | Acta con duración, integridad y accesos |

La inspección del firewall y las ACL reales la realiza el propietario/TI desde sus consolas. Los resultados locales no acreditan automáticamente el despliegue ni la configuración de Google. No ejecutar acciones manuales de restauración sobre producción para comprobar que funcionan.

## Respaldo semanal en Google Drive privado

**Sí es posible guardar el respaldo en Drive.** Debe usarse una carpeta separada de los comprobantes operativos, fuera de un padre ampliamente compartido, con acceso solo para custodios aprobados. No sincronizarla con el mismo mecanismo que concede lectura a todos los gestores. La cuenta maestra puede custodiarla, pero TI debe verificar acceso efectivo, MFA, recuperación y capacidad de almacenamiento.

La copia PostgreSQL contiene datos personales, autorizaciones y posiblemente tokens OAuth. Por eso se cifra **antes** de subirla: el cifrado habitual del proveedor no sustituye este control de una copia exportada. La clave de cifrado/recuperación se guarda en un gestor institucional de secretos o mecanismo aprobado separado, no junto al archivo ni en el repositorio. No compartirla por el hilo del pedido.

### Ejecución manual recomendada inicialmente

1. El responsable técnico usa un equipo institucional protegido y un directorio privado fuera del repositorio, de carpetas públicas y de sincronizaciones automáticas.
2. Obtiene desde Neon la conexión directa de la rama correcta, con pooling desactivado. Usa un cliente PostgreSQL compatible y un rol de respaldo aprobado con permisos suficientes de lectura; no necesita dar credenciales DDL a la aplicación.
3. Configura las credenciales en archivos locales protegidos de servicio/contraseña de PostgreSQL, con permisos solo para el custodio; no pega la URL con contraseña en el historial de terminal.
4. Genera el dump en formato custom (`pg_dump --format=custom`). Es una exportación, no un reset ni una migración. No se cambia el esquema ni se ejecuta el seed.
5. Verifica que el comando terminó correctamente y que `pg_restore --list` puede leer el índice. Esto comprueba el formato, pero **no sustituye restaurar realmente**.
6. Cifra el dump con la herramienta aprobada por TI. Puede usarse un archivo cifrado AES-256 con nombres cifrados si TI adopta ese formato; no basta comprimir en ZIP sin cifrado. Introducir la clave por una interfaz segura, nunca como argumento visible en comandos/logs.
7. Calcula y registra el hash del archivo cifrado, fecha de origen, versión de aplicación y resultado. El hash permite detectar cambios; la autenticidad del registro depende de su custodia separada.
8. Sube el archivo cifrado a la carpeta privada exclusiva de respaldos. No crear enlace público ni conceder acceso al equipo completo de atención. Comprueba tamaño/carga y permisos efectivos.
9. Guarda el acta de ejecución sin secretos y protege las copias locales temporales según la política del equipo institucional. No confiar en que borrar un archivo de un SSD equivale a borrado seguro.
10. Repite semanalmente. Un fallo o una semana omitida puede incumplir el RPO; debe registrarse y escalarse. No se ha programado ningún trabajo automático de respaldo.

Conservar datos de negocio indefinidamente no exige conservar cada dump completo para siempre. Cantidad/antigüedad de versiones y eliminación de temporales deben aprobarse por TI; la aplicación no purga respaldos. Drive tiene cuotas: comprobar capacidad y crecimiento.

Referencia de exportación/restauración: [Neon: backups con pg_dump](https://neon.com/docs/manage/backup-pg-dump). Para usar los comandos anteriores, el responsable técnico debe instalar/configurar el cliente fuera del runtime de Vercel; el navegador y la API de Drive no producen un dump PostgreSQL por sí solos.

### Automatización futura, si TI la aprueba

La automatización necesita un ejecutor con `pg_dump`, acceso SQL de respaldo, cifrado y subida a Drive. No basta disponer de las APIs/keys actuales. Puede ejecutarse semanalmente en infraestructura institucional o un job independiente aprobado; no es una operación de una pantalla ni un cron de correo. Evitar convertir una función web de Vercel Hobby en un proceso largo de backup.

Definir antes: responsable y frecuencia, ejecutor/coste, carpeta de destino, identidad de respaldo con privilegios mínimos, custodia de claves, fallo/timeout y aviso técnico, comprobación de integridad y procedimiento de restauración. Preferir credenciales separadas de las que pueden enviar Gmail operativo. Impedir ejecuciones simultáneas y limitar tiempo/tamaño; nunca reintentar indefinidamente ni borrar copias por una política no aprobada.

**Estado actual:** automatización no implementada ni desplegada; se mantiene la decisión de copia manual semanal. No se han creado carpetas ni subido dumps a Drive durante esta tarea.

## Primera restauración medida

| Actividad | Responsable | Resultado a registrar |
| --- | --- | --- |
| Declarar ensayo y ambiente aislado | Técnico | Hora de inicio, backup elegido y autorización |
| Descargar/verificar/descifrar | Técnico | Integridad, clave disponible, acceso correcto; no registrar la clave |
| Crear destino aislado y restaurar | Técnico | Compatibilidad, duración y errores; sin tocar producción |
| Comprobar estructura/relaciones y muestra autorizada | Técnico + funcional | Datos, snapshots, documentos referenciados y versión |
| Revisar cuentas revocadas y ACL | Técnico | Accesos vigentes, sin ejecutar reconciliación contra la carpeta operativa desde el ensayo |
| Confirmar continuidad del flujo | Funcional | Resultado acordado en ambiente aislado sin correo operativo |
| Cerrar acta | Ambos | Duración total frente al objetivo de cuatro horas y acciones pendientes |

El objetivo de recuperación no está acreditado hasta terminar este ensayo. El dump no incluye bytes de archivos Drive ni mensajes Gmail; comprobar conservación y acceso de esos servicios separadamente. Las imágenes/PDF no se recuperan del seed ni de las tablas que solo conservan sus IDs y hashes.
