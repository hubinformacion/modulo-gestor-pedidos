# Datos iniciales y conservación de configuración

La fuente versionada es [src/db/seed-data.ts](../src/db/seed-data.ts); el correo maestro se define en [access-policy.ts](../src/lib/access-policy.ts). No incluye contraseñas, refresh tokens, usuarios OAuth ni información de compradores.

## Contenido confirmado

- Maestro: `distribucionfe@continental.edu.pe`, rol gestor con facultad de administrar accesos.
- Cuatro cuentas receptoras en PEN: BCP y BBVA para Universidad; BCP y BBVA para Instituto. Se conservaron los titulares, cuentas, CCI de 20 dígitos y estados de las cuatro cuentas que estaban configuradas y fueron confirmadas para el seed. No se reconstruyó el CCI desde el valor incompleto de una conversación anterior.
- Ocho campus activos, con dirección, ubicación interna y coordenadas facilitadas por el responsable; coordenadas redondeadas a siete decimales para PostgreSQL.

| Campus | Dirección inicial |
| --- | --- |
| Arequipa | La Canseco II / Sector: Valle Chili, José Luis Bustamante y Rivero - Arequipa |
| Ayacucho | Av. Javier Pérez de Cuéllar 725, Ayacucho |
| Cusco | Sector Angostura Km. 10, carretera Cusco - Saylla, San Jerónimo, Cusco |
| Huancayo - Instituto | Calle Real 125, Huancayo - Junín |
| Huancayo - Universidad | Av. San Carlos 1980, Huancayo |
| Ica | Calle C N.° 201 - Parque Industrial, Ica |
| Lima - Los Olivos | Av. Alfredo Mendiola 5210 - Los Olivos |
| Lima - Miraflores | Calle Junín 355, Miraflores - Lima |

## Información que debe completar el responsable

| Dato | Estado y formato solicitado |
| --- | --- |
| Ubicación interna por campus | Completada para los ocho campus con los datos proporcionados; confirmar cambios futuros. |
| Coordenadas exactas | Completadas para los ocho campus; el mapa se genera desde coordenadas, sin depender de resolver un enlace corto. |
| Titulares y cuentas vigentes | Titulares legales confirmados: UNIVERSIDAD CONTINENTAL SOCIEDAD ANÓNIMA CERRADA y CORPORACIÓN APEC SOCIEDAD ANÓNIMA CERRADA. Se conservan bancos, cuentas y CCI vigentes; comunicar cambios futuros. |
| Guías de pago | Revisar y aprobar `guia_pago_universidad.pdf`, `guia_pago_instituto.pdf` y `guia_pago_mixta.pdf`; son recursos aparte del seed. Universidad/Mixto se aceptaron temporalmente iguales por nombre: revisar contenido final. |
| Buzones de servicio de Tesorería | Un correo por unidad. No se inventan ni se incorporan automáticamente. Se configuran por interfaz. |
| Equipo autorizado | Correos personales, rol y una/ambas unidades de Tesorería. Se configura por interfaz; no se crean identidades OAuth por seed. |
| Catálogo real | Código, título, autor, unidad, precios estándar/comunidad, stock y estado; se administra en Inventario. El seed no contiene libros. |

Nunca enviar secretos OAuth, credenciales SQL ni tokens de seguimiento para completar este inventario. Las cuentas bancarias son destinos de depósito; no se requieren claves bancarias.

La configuración inicial también incluye los cinco límites de admisión aprobados: 3/correo/15 min, 10/correo/día, 20/IP/15 min, 200 globales/día y 3 pedidos impagos/correo. Son editables por el maestro en Seguridad; el seed no sobrescribe los valores configurados.

## Comportamiento de instalación y seed

`pnpm db:setup` instala el esquema en una BD vacía y siembra la configuración en la misma transacción. En una BD existente compara su estructura con el esquema inicial usando un esquema de referencia que se revierte; solo si coincide siembra faltantes, sin sobrescribir filas. Ante discrepancias aborta sin actualizar estructura ni datos.

`pnpm db:seed` únicamente incorpora configuración faltante sobre un esquema instalado. Las identidades son correo, nombre normalizado del campus y unidad/banco/cuenta normalizados. Los conflictos conservan IDs, estado, direcciones, mapas y demás valores actuales. Si se renombra una identidad o cambia un número de cuenta, el seed puede considerar la entrada original como faltante: revisar el seed antes de repetirlo en un entorno que cambió su configuración.

Los cambios hechos por interfaz **no actualizan el archivo seed automáticamente**. Para conservarlos en nuevas instalaciones, el responsable debe proporcionar el dato confirmado y aprobar su actualización versionada. Mantener una sola fuente inicial; no poner configuración bancaria en variables de entorno ni copiar registros de pedidos al repositorio.

## Si se necesita reconstruir el entorno

No existe un comando de borrado en la instalación de producción. Un reinicio exige autorización explícita, respaldo, pausa del tráfico y reconciliación de permisos externos antes de eliminar referencias. El seed no recupera pedidos, archivos, usuarios, sesiones, historial, configuración modificada ni numeración: eso requiere respaldos y un procedimiento técnico aprobado.

La reconstrucción de una BD vacía recupera los valores versionados iniciales. Una restauración operativa debe recuperar también cambios de configuración posteriores, preservar documentación tributaria y revisar accesos de Drive. Vaciar Drive no instala ni limpia PostgreSQL, ni invalida permisos de carpeta; son sistemas independientes.

Huancayo - Real se conserva como **Huancayo - Instituto** y Huancayo - San Carlos como **Huancayo - Universidad**, manteniendo las identidades existentes. Las ubicaciones internas están en el seed y son editables por interfaz.
