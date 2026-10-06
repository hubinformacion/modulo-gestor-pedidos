# Fases y estado del proyecto

El usuario validó los cambios y autorizó la integración. El código de las seis fases está integrado en `main` y publicado en [GitHub](https://github.com/hubinformacion/modulo-gestor-pedidos). Las ramas de fases ya integradas se eliminan; el historial se conserva.

| Fase | Entrega | Estado del código |
| --- | --- | --- |
| 1 | Google OAuth, acceso por BD y configuración | Aprobado e integrado |
| 2 | Esquema de negocio y seed | Aprobado e integrado |
| 3 | Wizard público, campus, ubigeo y consentimiento | Aprobado e integrado |
| 4 | Pedido/stock/numeración transaccionales, Drive/Gmail y seguimiento | Aprobado e integrado |
| 5 | Gestores, pagos, despacho, inventario y configuración | Aprobado e integrado |
| 6 | Iframe/CSP, Vercel, pulido de atención y comunicaciones | Aprobado e integrado; cierre operativo pendiente |

## Pendiente de publicación

El usuario publicará primero en Vercel y WordPress y después proporcionará las URLs. No se ha verificado ni realizado un despliegue Vercel desde este workspace. La configuración local sigue apuntando a localhost y no tiene proyecto Vercel vinculado.

1. Importar `main` en Vercel y configurar las variables de `.env.example` con los dominios reales y credenciales privadas.
2. Registrar callback Google, configurar `WORDPRESS_ORIGINS` y activar el cron con `CRON_SECRET`. Ejecutar migraciones explícitamente en la BD destino si es diferente; la BD local ya tiene hasta 0011.
3. Generar el bloque WordPress para la URL real `/pedido` e incrustarlo. Revisar altura, móvil/escritorio, mapas y cabeceras.
4. Revisar en el despliegue real acceso, carga de comprobantes/evidencia y correos con PDF/hilo. No afirmar validación Vercel por un build local.

Guía: [iframe-wordpress.md](iframe-wordpress.md). Contrato funcional: [atencion-y-comunicacion.md](atencion-y-comunicacion.md). Consumo: [consumo-neon.md](consumo-neon.md).

## Reglas que permanecen

Solo pnpm, sin suites automatizadas salvo solicitud expresa. Inter, tema claro, fondo blanco y `#6802C1`. Código/migraciones/utilidades bajo `src`, sin landing/logos/CLAUDE.md. Nunca hacer commits directos en `main`: cambios posteriores en rama de trabajo, con revisión antes de integrar. No subir secretos ni inventar catálogo, dominios, campus o coordenadas.
