# Consultas y capa gratuita Neon

Revisión: 6 de octubre de 2026. Fuentes: [actualización oficial del 2 de octubre](https://neon.com/blog/neon-free-plan-1-gb-per-project), [scale-to-zero](https://neon.com/docs/introduction/scale-to-zero), [driver](https://neon.com/docs/serverless/serverless-driver).

Free: 100 CU-horas de cómputo por proyecto/mes y 1 GB de almacenamiento por proyecto. Algunas páginas anteriores aún indican 0.5 GB; la actualización oficial elevó el límite automáticamente. El cómputo se suspende tras cinco minutos inactivo. No se cobra por cada SELECT ni por el número de pedidos.

Arquitectura local revisada: navegador sin WebSocket push. Lecturas Drizzle Neon HTTP; auth y transacciones interactivas usan Pool WebSocket por petición, cerrado en finally. El anterior setInterval de 35 segundos refrescaba páginas y podía impedir la suspensión, aunque solo estuviera abierto un seguimiento sin actividad.

Se retiró el polling periódico. Revalidaciones/refresh tras acciones propias y focus/visibility al regresar, máximo uno/minuto y pausado en edición/cargas. Una pestaña quieta no mantiene la base despierta; cambios de otros usuarios se ven al volver/navegar/recargar. No cachear ni relajar autorización por ahorrar recursos. Drive reconcilia ACL al cambiar autorizados y en cron, sin hacerlo en cada render administrativo. Cargas/revisiones parciales de mixtos no ejecutan el worker de correo si no crean evento.

Con unos cien pedidos/mes y sesiones cortas, se espera que Free sea suficiente, como estimación sin métricas de la cuenta. Más que contar pedidos, controlar tiempo activo y tamaño CU: 0.25 CU activo 24 horas durante 30 días consumiría 180 CU-horas, por encima de 100. Cerrar conexiones de servidor y quitar consultas de fondo permite scale-to-zero. Credenciales, cron, tráfico externo y otros usos de la misma rama también influyen.

Revisar el panel Usage del proyecto: CU-hours, almacenamiento y transferencia del período. No se ha accedido a métricas reales ni se ha alterado el compute del proyecto. Comprobantes se guardan en Drive, no como archivos binarios en Neon; guías PDF snapshot pequeñas en BD sí ocupan almacenamiento. Revisar consumo tras la primera semana operativa antes de decidir si necesita un plan de pago.
