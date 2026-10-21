# 00 · Empieza aquí

Sistema de pedidos del Fondo Editorial Continental. Compra y seguimiento dentro de WordPress; operación del Fondo Editorial y Tesorería Recaudación directamente en Vercel. Estos documentos se pueden trasladar al formato Word institucional.

## Orden de lectura

| Orden | Documento | Para qué sirve |
| --- | --- | --- |
| 01 | [Arquitectura y diagramas](01-arquitectura.md) | Entender la solución, tecnologías, datos y leyenda de diagramas |
| 02 | [Seguridad y accesos](02-seguridad.md) | Revisar los 12 requisitos de Seguridad de la Información y sus evidencias |
| 03 | [Instalación, operación y cierre](03-operacion-y-cierre.md) | Instalar, mantener, respaldar y cerrar la aceptación con TI |
| 04 | [Guía de uso y flujo](04-guia-de-uso.md) | Demostrar el proceso y trabajar según cada rol |

Para presentar a TI: 01 → 02 → lista de cierre de 03. Para capacitar al personal: 04. La arquitectura está también en [PNG para Word](diagramas/01-arquitectura.png) y [SVG editable](diagramas/01-arquitectura.svg).

La [presentación editable](presentacion/gestor-pedidos-presentacion.pptx) incluye la arquitectura simple, el diagrama ampliado existente y las vistas de base de datos/protección. También están la [vista HTML con notas](presentacion/gestor-pedidos-vista-previa.html) y el [PDF](presentacion/gestor-pedidos-presentacion.pdf). El [mapa de base de datos](diagramas/02-base-datos.html) reúne cuatro diagramas y el inventario de las 40 tablas, sin información operativa.

## Responsables y acuerdos

| Función | Responsable | Contacto |
| --- | --- | --- |
| Funcional | Jullisa del Pilar Falla Aguirre · Coordinadora de Fondo Editorial | jfalla@continental.edu.pe |
| Técnica | Fredy Paolo Romero Espinoza · Asistente de Plataformas de Hub de Información y Fondo Editorial | fromeror@continental.edu.pe |

Se conserva la información de negocio indefinidamente, sin borrado automático. Respaldo manual semanal, RPO objetivo siete días y RTO objetivo cuatro horas; este último requiere una restauración medida. La designación de responsables no otorga permisos automáticamente.

## Qué falta para cerrar

1. **Validación de esta rama:** maestro y buzones solo consultan; cuentas personales atienden; cambios administrativos dejan auditoría. Registrar resultado y ambiente.
2. **Evidencia de TI:** MFA/OAuth e IAM de proveedores, rol SQL restringido, permisos efectivos de Drive, cifrado/región y firewall. Se pueden entregar capturas redactadas o un acta; nunca claves.
3. **Primera copia y restauración:** confirmar carpeta privada de respaldos, herramienta/custodia de cifrado y restauración aislada dentro del RTO objetivo.
4. **Conformidad funcional/legal:** guías de pago definitivas, finalidad/consentimiento, datos de terceros receptores, conservación y eventos que deben auditarse.
5. **Aprobación final:** después de las evidencias, aprobar merge y publicación. La documentación y el build no certifican por sí solos cumplimiento ni producción.

El código incorpora los tratamientos de cuotas de pedidos y permisos durables de Drive. Su validación controlada de concurrencia/pérdida de respuesta y la configuración real de proveedores siguen pendientes. El detalle y responsables de cada evidencia están en 02 y 03.

No hace falta enviar credenciales, repetir seeds, borrar información ni compartir datos reales de compradores para cerrar este expediente.
