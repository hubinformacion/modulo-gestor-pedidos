# Guías de pago definitivas

Colocar los PDF aprobados por el responsable:

- `guia_pago_universidad.pdf`
- `guia_pago_instituto.pdf`
- `guia_pago_mixta.pdf`

Archivos aportados por el responsable. Las guías Universidad/Mixto recibidas son idénticas: pendiente reemplazar/confirmar la mixta. No se inventan cuentas ni contenido bancario. La guía mixta debe indicar dos depósitos independientes y asignar el flete exclusivamente a Universidad. Las cuentas deben coincidir con las cuentas activas configuradas en `/admin` (PEN).

Los archivos permanecen fuera de `public`. `outputFileTracingIncludes` los incorpora a las funciones Next/Vercel. El descargable exige el token del pedido; Gmail adjunta el PDF según `order_type`. Cada pedido nuevo guarda la versión inmutable en `payment_guides`, deduplicada por hash, para conservar sus instrucciones si se reemplazan los archivos. El usuario autorizó usar los nombres aunque Universidad/Mixto compartan contenido temporalmente. Máximo 3 MiB y firma PDF válida. La comprobación local no sustituye verificar el adjunto recibido y la descarga en Vercel.
