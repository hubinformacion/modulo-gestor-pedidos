# Expediente técnico y guías de operación

Documentación mantenida junto al código para la evaluación de TI y el uso del sistema. Describe la implementación; los controles del proveedor que requieren evidencia se identifican expresamente. No contiene secretos, datos de compradores ni enlaces de seguimiento reales.

| Documento | Audiencia y contenido |
| --- | --- |
| [Arquitectura](arquitectura.md) | TI: componentes, tecnologías, límites de confianza, flujos y decisiones |
| [Datos y accesos](datos-y-accesos.md) | TI/seguridad: información tratada, modelo, permisos, almacenamiento y minimización |
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
