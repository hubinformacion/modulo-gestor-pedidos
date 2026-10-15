# Seguridad y resguardo de información

## Resultado y alcance de la revisión

Revisión de código guiada por [Cloudflare security-audit-skill](https://github.com/cloudflare/security-audit-skill/tree/main/skills/security-audit), con reconocimiento, búsqueda por límites de confianza, crítica de cobertura y verificación independiente de candidatos. Se revisó la base `67a0bd0` y se añadió revisión del instalador propuesto. El inventario exacto y las limitaciones de cobertura se conservan en el expediente de auditoría externo al repositorio; este documento mantiene la conclusión y el tratamiento recomendado.

**La revisión inicial no demostró vulnerabilidades mediante ejecución y retuvo dos riesgos sustentados en fuente.** Ambos tienen ahora correcciones de código en esta propuesta. La validación del despliegue, proveedores y recuperación sigue pendiente; esto no equivale a certificación ni pentest. No se ejecutaron ataques, correos ni cambios de permisos contra Google operativo.

| Riesgo revisado | Tratamiento implementado | Evidencia todavía necesaria |
| --- | --- | --- |
| Creación anónima sin cuota agregada visible | Admisión dentro de la transacción, cuotas compartidas por correo/IP/global y pendientes, conservación de idempotencia. Configuración dinámica exclusiva del maestro y auditoría de cambios. | Validación funcional controlada del despliegue; inspección de firewall Hobby y consumo. No protege por sí solo de todo tráfico HTTP. |
| Permiso de carpeta creado antes de registrar intención durable | Intención comprometida antes de Google, ID nullable, recuperación por carpeta/email incluso tras revocación; no adopta permisos manuales preexistentes y relee rol/herencia antes de retirar. | Validación controlada de pérdida de respuesta y revocación; inventario del propietario de permisos heredados/manuales y registros anteriores a la corrección. |

Estado: **tratamiento en código, sin afirmar verificación completa en producción**. El expediente inicial externo conserva sus conclusiones originales; no se ha convertido una hipótesis en un incidente demostrado. No eliminar permisos manuales desconocidos como parte de una revisión.

## Controles implementados en fuente

| Control | Implementación | Límite |
| --- | --- | --- |
| Identidad Google y acceso cerrado | Better Auth, email verificado, lista autorizada en BD y vinculación de cuentas desactivada | MFA y seguridad de la identidad dependen de Google Workspace |
| Autorización por recurso | Proxy, páginas, acciones y transacciones vuelven a comprobar sesión/rol/unidad/asignación | Aplicación usa un rol de servicio SQL; no hay RLS que aísle gestores como usuarios PostgreSQL |
| Revocación de aplicación | Elimina sesiones y libera atención abierta en transacción | Retiro de permisos Google tiene consistencia separada y puede fallar |
| Admisión pública | Cuotas transaccionales compartidas, claves HMAC de IP/correo, edición maestra auditada | Acota pedidos aceptados, no todo consumo HTTP; firewall efectivo por acreditar |
| Protección de transiciones | Locks, versión, responsable y estados permitidos; stock/cupones una vez | No acredita comportamiento concurrente sin validación de ejecución |
| Entradas y SQL | Zod, campos permitidos y consultas Drizzle parametrizadas | Validación sintáctica no demuestra identidad del comprador ni legitimidad de un depósito |
| Archivos | MIME, firma inicial, hash, tamaño máximo, pertenencia y ciclo de documento | No hay antivirus/CDR ni garantía de contenido PDF inocuo |
| Privacidad Drive | Sin permisos públicos creados por la aplicación; gestores nominados y Tesorería por archivo/unidad | Revisar permisos externos, heredados, enlace compartido y copias descargadas |
| Seguimiento | Token aleatorio nanoid32, no-index/no-store/no-referrer y descargas finalizadas por pedido | El enlace es una credencial; no expira ni se rota desde interfaz actualmente |
| Minimización | DTOs/proyecciones cliente, actividad pública allowlist, gráficas agregadas | Campos operativos sin enmascaramiento general; ver [datos y accesos](datos-y-accesos.md) |
| Logs seguros propios | Códigos/etapas acotados, sin objetos crudos Google/SQL/MIME | Infraestructura, proxies, navegador y analítica requieren configuración adicional |
| Navegación embebida | Handshake, origin/source exactos, mensajes validados, CSP de orígenes | WordPress y sus scripts son un límite de confianza externo; CSP no es una política completa de scripts |
| Cron | Bearer mínimo 32 y comparación constante, diario, solo ACL | Programación/secretos efectivos no se acreditan desde `vercel.json` |
| Correo | HTML escapado, direcciones/cabeceras validadas, hilos separados y sin reenvío histórico | Gmail conserva copias fuera de BD; aceptación de API no prueba lectura/entrega final |

Better Auth y Server Actions aportan defensas de sesión/origen/CSRF que deben mantenerse en su configuración compatible. No desactivar sus controles para facilitar iframes. Los módulos internos deben permanecer en una pestaña propia.

## Cifrado y secretos

- Credenciales solo en variables privadas, sin prefijo `NEXT_PUBLIC_`; `.env.local`, `.vercel` y PEM ignorados.
- Token propietario de Drive/Gmail separado de la sesión del operador. Sus scopes permiten acciones de alcance amplio en la cuenta propietaria: limitar acceso a secretos y a esa cuenta.
- PostgreSQL guarda campos personales y tokens de identidad sin un mecanismo propio de cifrado de campo configurado. La contraseña del rol SQL da acceso a la información que sus privilegios permitan; no compartirla con usuarios de negocio.
- El driver comunica por HTTPS/WSS con Neon. TI debe acreditar la configuración efectiva de conexión, roles, cifrado, región y proveedores; la validación de una URL no es una política de seguridad. Referencia: [conexión segura de Neon](https://neon.com/docs/connect/connect-securely).
- Separar credencial de instalación (`DATABASE_SETUP_URL`) de la usada por el runtime (`DATABASE_URL`) y de los entornos de revisión. No desplegar credenciales DDL de instalación al runtime.
- Una máscara en pantalla no cifra la BD ni elimina copias en correos, respaldos o navegador. Si TI requiere ocultar DNI/teléfono por defecto, diseñar DTO y revelado autorizado del lado servidor; no enviar primero el dato completo y ocultarlo con CSS.

## Evidencia que TI debe obtener

No compartir valores secretos para completar esta revisión. Bastan evidencia redactada, nombres de controles, responsables y fecha.

| Área | Evidencia requerida |
| --- | --- |
| Gobierno | Responsables designados y conservación indefinida documentados; validar finalidad, proveedores, respuesta al titular e incidentes |
| Neon | Proyecto/rama productiva y región, rol runtime y privilegios efectivos, quién administra, MFA, conexión segura, ventana de restauración del plan y evidencia de restauración aislada |
| Vercel | Miembros/roles/MFA, ramas/entornos separados, secretos solo donde corresponda, protección de previews, WAF y límites de abuso/coste, retención/redacción de logs |
| Google Workspace | Custodia/MFA/recuperación de cuenta propietaria, consentimiento OAuth, scopes, acceso de buzones, carpeta/archivo sin enlace público y política organizacional de compartición |
| WordPress | Personas/plugins que pueden modificar scripts, origen permitido, analítica sin tokens y revisión del bloque realmente publicado |
| Copias y recuperación | RPO/RTO aprobados; respaldo cifrado fuera de Git; coherencia PostgreSQL/Drive/Gmail y accesos tras restauración |
| Datos en UI | Campos que cada rol necesita; decisión institucional sobre enmascaramiento/revelado y qué acciones auditar |

## Mejoras preventivas recomendadas

1. Validar en entorno controlado los tratamientos de la tabla inicial y documentar protecciones efectivas de Vercel y permisos de Google.
2. Proteger cambios de campus/cuentas contra formularios obsoletos y registrar actor/cambio de configuración financiera.
3. Separar consulta pública de seguimiento de metadatos internos de correo para reducir una futura serialización accidental; hoy las props públicas revisadas se proyectan explícitamente.
4. Validar institucionalmente la conservación indefinida aprobada operativamente y definir política de enlace privado (expiración/rotación/revocación si corresponde), y considerar inspección de PDFs según exigencia de TI.
5. Evaluar una CSP de scripts y una política de frame más restrictiva para rutas internas/login. No desplegar directivas que rompan Next, Maps o WordPress sin validación de compatibilidad.
6. Revisar advisories al actualizar dependencias y verificar correcciones con compatibilidad. No introducir versiones inexistentes ni overrides globales como una “solución” documental.

El expediente de seguridad debe mantenerse con evidencias reales. Marcar un control como pendiente es preferible a presentarlo como implementado sin comprobación.
