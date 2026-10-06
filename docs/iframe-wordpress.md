# Embebido, WordPress y Vercel — fase 6

Fases 1–5 aprobadas e integradas localmente. Rama `feat/06-iframe-wp-polish`. Código implementado; pendiente de aprobación y configuración/revisión en el dominio real. No publicar ni afirmar que el adjunto funciona en Vercel sin revisar ese despliegue.

## Contrato de embebido

`WORDPRESS_ORIGINS` contiene los orígenes exactos de WordPress separados por comas. Solo HTTPS; HTTP permitido para localhost/127.0.0.1/IPv6 loopback en la simulación. Sin rutas, consultas, credenciales ni comodines. Máximo veinte, deduplicados y validados con Zod. Valor vacío admite únicamente mismo origen. Incluir www y sin www por separado solo si ambos se usan realmente. Reiniciar Next o volver a desplegar tras cambiar esta variable: las cabeceras se generan durante el build.

CSP HTTP en todas las rutas: `frame-ancestors 'self' <orígenes permitidos>`, `frame-src` para mismo origen y mapas Google, `object-src 'none'`, `base-uri 'self'`. No se emite X-Frame-Options. Mantiene no-store/no-referrer del seguimiento y autorización por sesión+BD en administración. El iframe no habilita permisos ni modifica CORS/trustedOrigins de autenticación; las Server Actions siguen ejecutándose con el origen del sistema.

`IframeHeightBridge` observa `#app-content` con ResizeObserver. Mide el contenido, sin usar la altura del viewport para permitir que el iframe también se reduzca. Coalesce cambios con requestAnimationFrame; vuelve a medir al cargar fuentes/cambiar ancho. No transmite URL, token, comprador, archivos ni estado del pedido: únicamente altura y versión del protocolo.

Protocolo:

- Padre → hijo: `{type: "fec:iframe:init", version: 1}`. El hijo valida con Zod, origen permitido y `event.source === window.parent`.
- Hijo → padre: `{type: "fec:iframe:height", version: 1, height: entero}`. Rango 128–100000 px. targetOrigin exacto, nunca `*`.
- Padre valida `event.origin`, `event.source === iframe.contentWindow`, tipo/versión/rango. Aplica la altura a ese iframe. Ignora mensajes ajenos. Permite varios iframes independientes.
- El padre inicializa al cargar y reintenta hasta diez segundos para cubrir hidratación lenta; el primer mensaje de altura detiene los reintentos. El handshake funciona incluso con referrerpolicy=no-referrer.

Código/plantilla WordPress en `src/iframe`; configuración/protocolo en `src/lib/iframe`; puente React en `src/components/iframe`.

## Simulación local

Dos terminales, dos puertos:

```bash
WORDPRESS_ORIGINS=http://localhost:3001 pnpm dev
pnpm iframe:preview
```

Abrir `http://localhost:3001`. Simula WordPress, incrusta `http://localhost:3000/pedido` y muestra la altura recibida. Anchos escritorio/tableta/móvil; el iframe usa no-referrer. Puede apuntar a otra aplicación:

```bash
pnpm iframe:preview --url http://localhost:3100/pedido --port 3001
```

El origen del simulador debe estar autorizado en el Next al que apunta. El simulador es una utilidad local de revisión, sin ruta pública adicional ni bypass de auth. No crea datos DEMO/pedidos automáticamente ni constituye una suite de pruebas.

Revisión manual:

1. Abrir el simulador y comprobar «Altura recibida». Cambiar ancho: sin recorte de contenido ni scrollbar vertical interior duplicado. Tablas conservan scroll horizontal cuando lo necesiten.
2. Recorrer los cuatro pasos, abrir/cerrar mapas y generar errores de validación. La altura aumenta/reduce sin ciclos ni saltos continuos. Cargar archivos de revisión en seguimiento y observar FilePond/preview/errores.
3. Comprobar no-referrer: el handshake sigue funcionando. Revisar Console/Network: CSP permite el padre y Google Maps. No se añade X-Frame-Options contradictorio.
4. Intentar incrustar desde un puerto/origen fuera de WORDPRESS_ORIGINS: el navegador bloquea el iframe. Mensajes desde ventanas/orígenes distintos no deben cambiar la altura.
5. Abrir `/login` dentro del iframe y pulsar Google: abre una pestaña para completar el acceso. En esa pestaña, solo correos autorizados; revocación mantiene sus controles. Administración se opera directamente en `/admin`, evitando las restricciones de cookies de terceros.

## Bloque para WordPress

Después de confirmar el dominio HTTPS definitivo:

```bash
pnpm iframe:snippet --url https://DOMINIO_DEL_SISTEMA/pedido --output /tmp/pedido-wordpress.html
```

Pegar el contenido generado en un bloque HTML personalizado, con un usuario que pueda conservar scripts. Incluye iframe accesible con ancho 100%, altura inicial de respaldo, referrerpolicy=no-referrer, fullscreen para mapas y receptor postMessage inline. No modificar los nombres/versiones del protocolo. Si WordPress elimina el script, cargar `src/iframe/wordpress-embed.js` desde el tema hijo/plugin de integración y conservar el marcado del iframe con `data-fec-iframe`. No pegar claves ni secretos en WordPress.

Incrustar `/pedido`, no `/` (que lleva a administración). El seguimiento sigue dentro del mismo iframe al confirmar una compra. Google OAuth administrativo se completa en una pestaña independiente; no cambiar SameSite ni añadir bypasses para solventar restricciones de cookies entre dominios. No aplicar un sandbox restrictivo que impida scripts, formularios, descargas o mapas sin revisar esos permisos.

Si WordPress tiene su propia CSP, su `frame-src` debe permitir el dominio del sistema; `frame-ancestors` se controla desde la aplicación. Comprobar todas las políticas del navegador y del proveedor, especialmente protección de despliegues preview, que puede impedir que el iframe cargue la aplicación.

## Despliegue en Vercel

Remoto Git actual: `hubinformacion/modulo-gestor-pedidos`. No hay proyecto Vercel vinculado/CLI disponible en el entorno al preparar esta fase. Pendientes: proyecto/cuenta de despliegue, dominio estable y dominio(s)/página WordPress. No inferirlos desde el enlace de política de privacidad ni dominios de ejemplo.

1. Importar el repositorio en Vercel, framework Next.js, raíz del proyecto y Node compatible con engines (>=22). `vercel.json` fuerza instalación `pnpm install --frozen-lockfile` y build `pnpm build`.
2. Configurar `ENABLE_EXPERIMENTAL_COREPACK=1` en el panel antes del primer despliegue: usa el pnpm exacto de packageManager. Variables completas en `.env.example`; no subir `.env.local`. Configurar Production y Preview por separado, con ramas Neon/credenciales de revisión cuando corresponda.
3. Usar el dominio HTTPS estable para APP_URL y BETTER_AUTH_URL. Registrar en Google el callback exacto `<BETTER_AUTH_URL>/api/auth/callback/google`. Conservar login identity scopes y refresh token propietario separado para Drive/Gmail.
4. Configurar WORDPRESS_ORIGINS con los dominios reales. Revisar cuentas/campus/catálogo desde `/admin` y los tres PDF correctos. Migraciones y seed se ejecutan explícitamente contra la BD destino, fuera del build. La migración 0006 ya aplicada al Neon local no implica que esté aplicada en otra rama.
5. Desplegar tras configurar. Nunca trasladar tokens de bypass de Vercel al bloque de WordPress. El dominio de compra debe ser accesible sin la protección de plataforma destinada a previews; auth de `/admin` permanece en la app.
6. Abrir el dominio desplegado directamente y desde WordPress. Recorrer pedido/seguimiento, validar acceso administrativo fuera del iframe y revisar cabeceras. Ejemplo de comprobación de cabeceras: `curl -I https://DOMINIO_DEL_SISTEMA/pedido`.
7. Crear un pedido de revisión en ese despliegue y comprobar el correo con su PDF, descarga de guía, archivo/permiso en Drive, confirmación de comprobantes y avisos en el mismo hilo. La presencia de PDF en el tracing local no verifica el adjunto real en Vercel.

Referencia técnica: [cabeceras de Next.js](https://nextjs.org/docs/app/api-reference/config/next-config-js/headers) y [configuración de proyectos Vercel](https://vercel.com/docs/project-configuration). Los permisos de WordPress dependen del editor/tema y del sitio concreto.

## Estado de revisión

Lint, tipos y build de producción correctos. Simulador servido en localhost:3001 apuntando a la app local en localhost:3100/pedido; ambas respuestas HTTP correctas. /pedido emite frame-ancestors con localhost:3001 y no emite X-Frame-Options; /admin sin sesión redirige a /login; seguimiento conserva no-referrer y private/no-store. El generador produjo el bloque HTML y el tracing de /pedido y descarga incluye los tres nombres de PDF.

No hubo revisión visual desde un navegador automatizado ni solicitudes reales a Gmail/Drive; quedan pendientes la altura/renderizado en navegador, WordPress real y Drive/Gmail/PDF en Vercel. El build local usa APP_URL de desarrollo: para compras reales usar pnpm dev con la configuración local correspondiente, o el despliegue HTTPS configurado. No se añaden ni ejecutan suites de pruebas automatizadas.
