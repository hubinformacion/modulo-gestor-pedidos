# Configuración de producción

Aplicación: https://modulo-gestor-pedidos.vercel.app

Página WordPress: https://fondoeditorial.continental.edu.pe/pedido/

## Variables en Vercel

Project → Settings → Environment Variables, entorno Production:

```dotenv
BETTER_AUTH_URL=https://modulo-gestor-pedidos.vercel.app
APP_URL=https://modulo-gestor-pedidos.vercel.app
WORDPRESS_ORIGINS=https://fondoeditorial.continental.edu.pe
ENABLE_EXPERIMENTAL_COREPACK=1
```

Las dos primeras son el origen de la aplicación Next, sin /pedido ni /api/auth. WORDPRESS_ORIGINS es el origen padre, sin /pedido/. No sustituir por la URL WordPress ni añadir el padre a trustedOrigins de autenticación: el iframe ejecuta peticiones desde Vercel.

Copiar privadamente el resto de variables de .env.example: DATABASE_URL, BETTER_AUTH_SECRET, GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REFRESH_TOKEN, GOOGLE_OWNER_EMAIL y GOOGLE_DRIVE_FOLDER_ID. No subir .env.local ni poner secretos en WordPress. No cambiar credenciales ni secret de sesión innecesariamente. Mantener .env.local apuntando a localhost para continuar desarrollo.

CRON_SECRET es un secreto aleatorio de al menos 32 caracteres que protege /api/internal/jobs. Puede usarse el valor privado ya configurado en .env.local o generar uno con:

```bash
openssl rand -hex 32
```

Guardar el resultado como CRON_SECRET, sin prefijo Bearer, espacios ni comillas. Vercel añade Authorization: Bearer automáticamente al invocar el cron. El cron diario configurado en vercel.json ejecuta recuperación de avisos y permisos Drive a las 12:00 UTC (07:00 Perú). No necesita abrir la ruta manualmente; sin credencial debe rechazar solicitudes. Cambios/cargas siguen enviando inmediatamente; no se espera al cron para enviar avisos normales. Revisar Settings → Cron Jobs después de desplegar.

Las variables se aplican a un nuevo deployment. Guardar y hacer Redeploy de Production; WORDPRESS_ORIGINS se usa también al construir cabeceras. Preview debe usar su propio dominio/callback/BD si se usa como entorno de revisión; no configurar un comodín de dominios en Google ni en CSP.

## Google Cloud Console

Usar el mismo proyecto y cliente Web application cuyo ID/secret ya está en Vercel. Google Auth Platform → Clients (o APIs & Services → Credentials → OAuth 2.0 Client IDs).

Authorized JavaScript origins:

```text
https://modulo-gestor-pedidos.vercel.app
```

Authorized redirect URIs, exactamente:

```text
https://modulo-gestor-pedidos.vercel.app/api/auth/callback/google
```

Conservar http://localhost:3000 y http://localhost:3000/api/auth/callback/google para desarrollo si aún se usan. WordPress no recibe el callback Google. Si OAuth Playground se usa para el token propietario con credenciales propias, conservar https://developers.google.com/oauthplayground como redirect URI también.

APIs & Services → Library: Google Drive API y Gmail API habilitadas en el proyecto de ese cliente. Login solo solicita openid/email/profile. La cuenta propietaria de Drive/Gmail necesita los tres scopes ya configurados:

```text
https://www.googleapis.com/auth/drive
https://www.googleapis.com/auth/gmail.send
https://www.googleapis.com/auth/gmail.metadata
```

Conservar el refresh token propietario si sigue válido y pertenece al mismo cliente; añadir un dominio/callback no requiere cambiar ese token. Revisar Audience: si el proyecto pertenece al Workspace y solo lo usa la organización, configurar Internal cuando esté disponible. Si se usa External, preparar estado In production y atender los requisitos aplicables de Google; Testing limita los refresh tokens Drive/Gmail a siete días. No habilitar nuevos scopes para el login de gestores.

## WordPress

Pegar [wordpress-pedido.html](../src/iframe/wordpress-pedido.html) completo en un bloque HTML personalizado de la página /pedido/. Incrusta https://modulo-gestor-pedidos.vercel.app/pedido, no la raíz (que dirige a administración).

Incluye iframe responsivo y receptor postMessage. Si el editor elimina scripts, cargar src/iframe/wordpress-embed.js desde el tema/plugin y conservar data-fec-iframe en el iframe. No incrustar /admin: abrir administración/login directamente en Vercel, en otra pestaña.

Tras redeploy, la respuesta /pedido debe contener frame-ancestors 'self' https://fondoeditorial.continental.edu.pe y no X-Frame-Options contradictorio. Revisar altura al cambiar pasos y ancho móvil, mapas/archivos, Google OAuth y el siguiente pedido operativo con PDF y avisos en hilo.

## Estado verificado

El 6 de octubre de 2026 ambos sitios respondieron HTTP 200. /pedido Vercel todavía emitía frame-ancestors 'self', que bloquea el padre WordPress: falta configurar WORDPRESS_ORIGINS y redeploy. No se modificaron variables del panel Vercel ni Google Cloud desde este workspace, que no tiene acceso autenticado a esos paneles. WordPress aún incrustaba gestor-pedidos-jet.vercel.app/formulario con altura fija de 1000px, sin el puente responsivo. Reemplazar ese bloque por el generado para la URL definitiva, sin secretos. /login respondía HTTP 200 pero mostraba configuración temporalmente no disponible; revisar las cinco variables de autenticación obligatorias. /api/internal/jobs sin Authorization devolvió 401: el secreto está configurado y el endpoint está protegido; no se ejecutó el worker.

Fuentes: [Better Auth Google](https://www.better-auth.com/docs/authentication/google), [Google OAuth](https://developers.google.com/identity/protocols/oauth2/web-server), [expiración refresh token](https://developers.google.com/identity/protocols/oauth2), [cron Vercel](https://vercel.com/docs/cron-jobs/manage-cron-jobs), [variables Vercel](https://vercel.com/docs/environment-variables).
