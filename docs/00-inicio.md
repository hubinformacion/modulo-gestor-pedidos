# 00 · Empieza aquí

**Versión 1.0.0 del módulo de pedidos del Fondo Editorial Continental.** Compra y seguimiento dentro de WordPress; operación del Fondo Editorial y Tesorería Recaudación directamente en Vercel. Estos documentos se pueden trasladar al formato Word institucional.

## Orden de lectura

| Orden | Documento | Para qué sirve |
| --- | --- | --- |
| 01 | [Arquitectura y datos](01-arquitectura.md) | Entender la solución, tecnologías, módulos y datos |
| 02 | [Seguridad y accesos](02-seguridad.md) | Revisar los 12 requisitos de Seguridad de la Información y sus evidencias |
| 03 | [Instalación, operación y cierre](03-operacion-y-cierre.md) | Instalar, mantener, respaldar y cerrar la aceptación con TI |
| 04 | [Guía de uso y flujo](04-guia-de-uso.md) | Demostrar el proceso y trabajar según cada rol |

Para presentar a TI: 01 → 02 → operación en 03. Para capacitar al personal: 04. La documentación describe el código y los procedimientos vigentes; no requiere presentaciones, diagramas ni generadores adicionales.

## Responsables y acuerdos

| Función | Responsable | Contacto |
| --- | --- | --- |
| Funcional | Jullisa del Pilar Falla Aguirre · Coordinadora de Fondo Editorial | jfalla@continental.edu.pe |
| Técnica | Fredy Paolo Romero Espinoza · Asistente de Plataformas de Hub de Información y Fondo Editorial | fromeror@continental.edu.pe |

Se conserva la información de negocio indefinidamente, sin borrado automático. Respaldo manual semanal, RPO objetivo siete días y RTO objetivo cuatro horas; este último requiere una restauración medida. La designación de responsables no otorga permisos automáticamente.

## Estado de cierre

- El módulo comprende compra embebida en WordPress, seguimiento, gestión de pedidos, catálogo simple, promociones/cupones, Tesorería, reportes y configuración.
- La reorganización modular y las correcciones de identidad OAuth y revocación Drive están integradas en `main`.
- El responsable del módulo confirma verificadas las pruebas de OAuth, Drive y restauración.
- Lint, tipos y build validan el código. El despliegue se comprueba mediante estado de Vercel y respuesta pública, sin crear pedidos ni enviar correos de prueba.
- La publicación de esta primera versión está autorizada por el responsable. No quedan ramas de trabajo ni borradores de documentación de esta entrega abiertos una vez publicada su etiqueta `v1.0.0`.

## Operación continua

TI mantiene MFA/OAuth, IAM y rol SQL restringido, permisos efectivos de Drive, cifrado, región, conectividad y respaldos. El área funcional mantiene catálogo real, guías de pago, campus, cuentas, accesos y consentimiento. No se incorporan secretos, datos reales de compradores ni copias operativas al repositorio.

La migración a Azure/Microsoft y los módulos de producción editorial, inventario por tiraje/campus, consignaciones y ferias quedan fuera de la versión 1.0.0. Sus productos, reglas y alcance se definirán en el siguiente trabajo de diseño.
