# Aceptación de fase 1

## Preparación

1. `git branch --show-current` debe indicar `feat/01-auth-y-google`.
2. Configurar `.env.local` según el README con una BD Neon de desarrollo y cliente Google OAuth web.
3. Registrar en Google el callback exacto `http://localhost:3000/api/auth/callback/google`.
4. Ejecutar `pnpm install --frozen-lockfile`, `pnpm db:migrate` y `pnpm db:seed` dos veces.
5. Consultar en Neon `SELECT email, added_by, created_at FROM authorized_emails;`: un único correo maestro.
6. Ejecutar `pnpm dev` y abrir `http://localhost:3000/login`.

## Google y Neon reales

1. En una ventana privada entrar directamente en `/admin/correos`: redirige al login sin mostrar datos.
2. Ingresar con `distribucionfe@continental.edu.pe`: abre `/admin`. La lista muestra el maestro y un formulario de alta; no permite quitar al maestro.
3. En otra ventana privada intentar entrar con un Google no autorizado: rechaza el ingreso. En Neon no debe existir su usuario ni sesión.
4. Introducir un correo mal formado y luego el maestro con mayúsculas: errores controlados, sin cambios en la lista.
5. Añadir otro correo Google con mayúsculas/espacios externos: queda normalizado y `added_by` es el maestro.
6. Ingresar con ese correo en otro perfil: puede consultar el panel/lista, sin formulario ni botones de alta/eliminación.
7. Mantener su sesión abierta. Como maestro, quitarlo y confirmar: desaparece de la lista y no tiene filas en `session`.
8. En el segundo perfil, recargar `/admin/correos`, visitar `/admin` y volver a ingresar con Google: todas las operaciones deben denegarse.
9. Reautorizar el correo: puede ingresar con una sesión nueva; las anteriores siguen revocadas.
10. Cerrar sesión y recargar una ruta administrativa: vuelve al login.

## Comprobaciones automatizadas

```bash
pnpm check
pnpm exec playwright install chromium
pnpm test:e2e
```

La integración verifica llamadas directas a Server Actions sin sesión y como otro autorizado, protección del maestro, cookies falsificadas, sesiones expiradas, revocación y rollback ante fallo de eliminación. Usa las migraciones reales con PostgreSQL embebido, sin tocar Neon. Los callbacks de better-auth son reales; solo se simula la respuesta externa de Google.

Playwright verifica un build de producción sin credenciales en el puerto 3100: ingreso, escritorio/móvil, ausencia de overflow y errores JavaScript, y denegación de peticiones. Capturas/trazas están en `test-results/`, ignorado por Git.

Para verificar un fallo de conexión real: detener el servidor local, usar temporalmente una URL Postgres local deliberadamente inválida en `.env.local`, reiniciarlo y solicitar `/admin`. Debe denegar acceso y mostrar un mensaje recuperable. Restaurar la configuración; no modificar producción.

## Cierre

Resultados locales (2026-10-05): instalación con lockfile congelado, lint, tipos y build correctos; 23 pruebas de integración/configuración y 6 comprobaciones de navegador correctas. Regeneración del esquema de better-auth correcta y Drizzle sin cambios de esquema pendientes. Credenciales Google/Neon no disponibles: migración, seed e ingreso contra esos servicios reales pendientes.

Revisar los resultados automatizados y completar el ingreso real con Google/Neon. Sin credenciales, esta validación queda pendiente explícitamente. No integrar ni iniciar fase 2 sin aprobación del usuario. Vercel y WordPress no se prueban en esta fase.
