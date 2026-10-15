# Expediente técnico y guías de operación

Documentación mantenida junto al código para la evaluación de TI y el uso del sistema. Describe la implementación; los controles del proveedor que requieren evidencia se identifican expresamente. No contiene secretos, datos de compradores ni enlaces de seguimiento reales.

| Documento | Audiencia y contenido |
| --- | --- |
| [Arquitectura](arquitectura.md) | TI: componentes, tecnologías, límites de confianza, flujos y decisiones |
| [Datos y accesos](datos-y-accesos.md) | TI/seguridad: información tratada, modelo, permisos, almacenamiento y minimización |
| [Requisitos de Seguridad de la Información](requisitos-seguridad-ti.md) | TI: matriz de los 12 requisitos, controles, límites y evidencias para Word |
| [Validación y continuidad](validacion-y-continuidad.md) | TI/operación: aceptación por rol, copia cifrada en Drive y restauración medida |
| [Seguridad](seguridad.md) | TI/seguridad: controles implementados, límites de revisión, riesgos y evidencias pendientes |
| [Operación e instalación](operacion.md) | Operadores técnicos: instalación, configuración, respaldo, recuperación e incidentes |
| [Calidad y mantenimiento](calidad-y-mantenimiento.md) | TI/desarrollo: limpieza y mejoras de consistencia |
| [Datos iniciales](datos-iniciales.md) | Responsable funcional: contenido y mantenimiento del seed, datos pendientes |
| [Casos de uso](casos-de-uso.md) | Responsables de proceso: actores, condiciones y resultados |
| [Guías de uso](guias-de-uso.md) | Comprador, gestor, Tesorería Recaudación y maestro |

## Lectura para presentar a TI

1. Contexto y diagramas de arquitectura.
2. Clasificación de datos y matriz de autorización.
3. Controles de seguridad y verificaciones que requieren acceso a las consolas.
4. Instalación y plan de continuidad.
5. Demostración de los casos de uso con información autorizada, evitando datos personales en capturas.

El responsable técnico debe actualizar los documentos al cambiar rutas, autorización, estructura o proveedores. Las guías interactivas existentes en `/admin/guia` y `/tesoreria-recaudacion/guia` complementan estos manuales.

## Responsables designados

| Función | Responsable | Contacto institucional |
| --- | --- | --- |
| Funcional | Jullisa del Pilar Falla Aguirre, Coordinadora de Fondo Editorial | jfalla@continental.edu.pe |
| Técnica | Fredy Paolo Romero Espinoza, Asistente de Plataformas de Hub de Información y Fondo Editorial | fromeror@continental.edu.pe |

La responsable funcional valida procedimientos y tratamiento de información; el responsable técnico coordina configuración, accesos de infraestructura, respaldos e incidentes. Esta designación documental no concede acceso a la aplicación ni a los proveedores.

Política operativa indicada: conservación indefinida de información de negocio, copia manual semanal, RPO objetivo de siete días y RTO objetivo de cuatro horas. Véanse los límites y el procedimiento en [operación](operacion.md); el cumplimiento del RTO requiere una restauración medida.
