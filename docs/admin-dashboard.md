# Administración de pedidos e inventario — fase 5

Fase 5 aprobada e integrada localmente en main; ampliaciones vigentes en la rama de fase 6. Contrato operativo vigente; la revisión real Google/PDF continúa en la fase 6.

## Interfaz y datos

Inter, blanco, acento `#6802C1`, Instituto `#e4000b`, sin logos ni landing. Navegación a Pedidos, Inventario, Configuración y Vista previa. Configuración organizada en pestañas Base UI: correos autorizados, campus/bibliotecas, cuentas bancarias e integraciones. Navegación por teclado y paneles conservados al cambiar pestaña, sin perder formularios abiertos; los permisos se mantienen. Datos operativos desde BD; no inventar catálogo ni pedidos para rellenar estados vacíos. Componentes servidor para lecturas, cliente solo para filtros locales y formularios interactivos. Skeleton administrativo existente y toasts Sileo; mensajes de error visibles junto al formulario.

`/admin/pedidos`: select de bandeja Todos/Por asignar/Mis pedidos junto a Estado, búsqueda por número/comprador/correo/gestor, filtro por estado y veinte pedidos por página. Tabla con gestor, modalidad y estado general; los pagos por sello se consultan en el detalle. Orden por creación/ID y filtros en URL.

`/admin/pedidos/[id]`: ítems/precios snapshot, comprador/facturación, entrega/persona alternativa, importes por sello y todos los comprobantes ordenados del más reciente al anterior. Enlaces directos a Drive en otra pestaña, con lectores de la carpeta sincronizados según authorized_emails. No se usa un visor local. Acceso al tracking del comprador, que es privado mediante token. No mostrar tokens en tabla ni usarlos en logs.

## Atención, pagos, entrega y correos

Contrato vigente en [atencion-y-comunicacion.md](atencion-y-comunicacion.md). Tabla sin columnas de sello; bandejas por gestor y detalle guiado Atención/Pagos/Distribución/Entrega. Cualquier autorizado puede tomar disponibles; solo el asignado cambia pagos/estado. Historial por actor y liberación automática al revocar el acceso. Comprobantes directamente en revisión sin confirmar; rechazo con motivo y correo. Courier/guía/URL/fechas al despachar; aviso de envío/listo y entrega. Thread de Gmail con cabeceras reales y envío serializado; metadata propietario requerida.

## Inventario

`/admin/inventario`: tabla a todo el ancho con búsqueda por título/autor/código y filtros locales por sello/estado. Edición inline de una fila con guardar/cancelar; filtros y otras filas se bloquean durante la edición para no ocultar el borrador. Añadir desde una fila nueva al inicio de la tabla, con guardar/cancelar y placeholders; no requiere modal. Los botones Editar/Guardar tienen claves distintas y tipo explícito para evitar que el cambio de estado reutilice un botón que termine enviando el formulario. Los éxitos se muestran únicamente como toast; los errores permanecen visibles. Crear/editar código único, título, autor, sello, precios público/comunidad, stock entero no negativo y estado. Alta inactiva por defecto; una publicación activa con stock aparece en compra, excepto códigos DEMO, excluidos del catálogo operativo.

Zod valida cliente y cada acción; precios decimales hasta dos posiciones, rango compatible con `numeric(12,2)`, cálculos monetarios en céntimos. No convertir importes a floats para persistencia. Edición/borrado bloquean la publicación y comparan versión con la vista abierta. Si una compra descontó stock entretanto, se rechaza toda la edición y se pide recargar; evita reponer accidentalmente stock desde una vista obsoleta. El stock ingresado es el disponible, no un delta ni el stock físico previo a pedidos.

No borrar publicaciones con ítems de pedidos ni cambiar su sello; sí desactivar. FK y consulta transaccional conservan historial; snapshots de títulos/precios no cambian. Borrar una publicación no usada abre un AlertDialog Base UI breve con su título, cancelar/eliminar y foco contenido; no inserta preguntas ni botones adicionales en la celda. Migraciones 0006–0007 para recibos/avisos/gestores; contrato de atención vigente sin confirmación del comprador. Sin nuevas dependencias.

## Revisión manual

Inventario: crear/editar/cancelar edición, rechazar códigos duplicados y stock negativo, proteger publicaciones con pedidos, conservar precios snapshot y detectar edición de stock desde una vista antigua. Atención y comunicación: seguir [atencion-y-comunicacion.md](atencion-y-comunicacion.md) con usuarios reales autorizados y entorno de revisión. No registrar catálogo ficticio ni activar DEMO para compras.

## Comprobaciones realizadas

Lint, tipos y build de producción correctos en la entrega inicial; incluye las tres rutas administrativas nuevas. Ajustes de tabla, altas inline, borrado y pestañas: comprobación puntual de lint y tipos. Ajuste de seguimiento/correos: migración 0006 aplicada en Neon y build correcto; revisión real de correo/Drive pendiente. No se ejecutaron suites automatizadas, ni se alteró stock operativo, ni se crearon pedidos o enviaron correos para validar la fase. La revisión funcional requiere sesión Google y datos de revisión configurados. Remoto Git conectado; proyecto Vercel no vinculado en el entorno. Merges locales solamente.

## Revisión vigente

Usar los pasos de [atencion-y-comunicacion.md](atencion-y-comunicacion.md). Configuración de Drive/Gmail/PDF en [pedidos-pagos.md](pedidos-pagos.md); interfaz de compra DEMO sigue sin crear pedidos. Autoasignación y transiciones se validan con sesiones reales autorizadas, sin datos ficticios ni suites automatizadas.

Historial de atención en el sidebar derecho, bajo comprador/publicaciones; conserva identidad del actor para auditoría interna. La identidad del gestor no aparece en seguimiento/correos del comprador y tomar un pedido no genera aviso por email.

Gestión compacta y notas internas (NOTA_INTERNA append-only, actor/fecha en order_activity). Panel debajo del wizard, visible a autorizados; consultas públicas con allowlist excluyen comentarios. No cambia pedido/estado ni genera correo. Contrato y revisión en [atencion-y-comunicacion.md](atencion-y-comunicacion.md).

Campus permite ubicación interna (pabellón/piso) separada de dirección; visible en compra, seguimiento y correo listo. En cierre de recojo, foto JPG/PNG opcional hasta 3 MiB; link Drive privado en detalle tras entrega. No mezclar evidencias con recibos de pagos ni exponerlas al comprador.
