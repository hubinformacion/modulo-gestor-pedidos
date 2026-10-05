# Administración de pedidos e inventario — fase 5

Rama `feat/05-admin-dashboard`. Fases 1–4 aprobadas e integradas localmente. Código de fase 5 implementado, pendiente de revisión manual y aprobación para integrar. No avanzar a fase 6 antes de aprobar.

## Interfaz y datos

Inter, blanco, acento `#6802C1`, Instituto `#e4000b`, sin logos ni landing. Navegación a Pedidos, Inventario, Configuración y Vista previa. Configuración organizada en pestañas Base UI: correos autorizados, campus/bibliotecas, cuentas bancarias e integraciones. Navegación por teclado y paneles conservados al cambiar pestaña, sin perder formularios abiertos; los permisos se mantienen. Datos operativos desde BD; no inventar catálogo ni pedidos para rellenar estados vacíos. Componentes servidor para lecturas, cliente solo para filtros locales y formularios interactivos. Skeleton administrativo existente y toasts Sileo; mensajes de error visibles junto al formulario.

`/admin/pedidos`: búsqueda por número/nombre/correo, filtros de estado, pago y sello, 20 pedidos por página. Los filtros se conservan en URL; el filtro de pago coincide con cualquiera de los sellos y el de sello incluye mixtos. Orden descendente por creación/ID. Tabla con importe, estados independientes y acceso a detalle UUID.

`/admin/pedidos/[id]`: ítems/precios snapshot, comprador/facturación, entrega/persona alternativa, importes por sello y todos los comprobantes ordenados del más reciente al anterior. Enlaces Drive abren otra pestaña; no se descargan ni se procesan archivos en el dashboard. Acceso al tracking del comprador, que es privado mediante token. No mostrar tokens en tabla ni usarlos en logs.

## Pagos y entrega

Revisión solo para pedido `PENDIENTE_PAGO` con pago `EN_REVISION` y comprobante existente del sello. Confirmación explícita en interfaz antes de aprobar/rechazar. Servidor Zod, autorización de sesión/correo dentro de cada acción y bloqueo compartido de autorización dentro de transacción. Lock del pedido, control de versión y referencia al comprobante más reciente impiden decidir desde una vista antigua.

Aprobar/rechazar conserva el otro pago. `NO_APLICA` nunca es editable. `EN_PREPARACION` solo cuando todos los sellos requeridos están verificados; un rechazo conserva `PENDIENTE_PAGO`. El tracking permite re-subir ese sello y conserva el otro. La re-subida pasa a `EN_REVISION` y mantiene comprobantes anteriores. En esta fase no se añaden motivos de rechazo ni correos nuevos: el comprador consulta el estado desde su seguimiento.

Despacho únicamente de preparación, con todos los pagos verificados. Courier obligatorio para delivery. Recojo no exige courier; el estado `DESPACHADO` significa listo en biblioteca. `ENTREGADO` únicamente desde despacho. No se incorpora cancelación: su política de devolución/reposición de stock no fue definida en este alcance. Las restricciones BD existentes también impiden preparación/despacho/entrega con pagos incompletos.

## Inventario

`/admin/inventario`: tabla a todo el ancho con búsqueda por título/autor/código y filtros locales por sello/estado. Edición inline de una fila con guardar/cancelar; filtros y otras filas se bloquean durante la edición para no ocultar el borrador. Añadir desde una fila nueva al inicio de la tabla, con guardar/cancelar y placeholders; no requiere modal. Los botones Editar/Guardar tienen claves distintas y tipo explícito para evitar que el cambio de estado reutilice un botón que termine enviando el formulario. Los éxitos se muestran únicamente como toast; los errores permanecen visibles. Crear/editar código único, título, autor, sello, precios público/comunidad, stock entero no negativo y estado. Alta inactiva por defecto; una publicación activa con stock aparece en compra, excepto códigos DEMO, excluidos del catálogo operativo.

Zod valida cliente y cada acción; precios decimales hasta dos posiciones, rango compatible con `numeric(12,2)`, cálculos monetarios en céntimos. No convertir importes a floats para persistencia. Edición/borrado bloquean la publicación y comparan versión con la vista abierta. Si una compra descontó stock entretanto, se rechaza toda la edición y se pide recargar; evita reponer accidentalmente stock desde una vista obsoleta. El stock ingresado es el disponible, no un delta ni el stock físico previo a pedidos.

No borrar publicaciones con ítems de pedidos ni cambiar su sello; sí desactivar. FK y consulta transaccional conservan historial; snapshots de títulos/precios no cambian. Borrar una publicación no usada abre un AlertDialog Base UI breve con su título, cancelar/eliminar y foco contenido; no inserta preguntas ni botones adicionales en la celda. Sin migraciones ni dependencias nuevas.

## Revisión manual

1. Ingresar con correo autorizado; abrir Pedidos e Inventario. Confirmar navegación y denegación tras revocar el correo. La configuración de correos sigue limitada al maestro; pedidos/inventario están disponibles para cualquier autorizado.
2. En una rama Neon de revisión, pulsar «Añadir publicación» y completar la nueva fila para crear una publicación de cada sello con catálogo aprobado, precios distintos y stock. Verificar campos obligatorios, stock negativo/decimal y código duplicado. Editar inline, guardar/cancelar y desactivar/reactivar. Borrar una publicación sin pedidos; cancelar primero la confirmación para revisar ambos caminos. No activar DEMO esperando una compra real.
3. Completar cuentas/Google/PDF y crear pedidos público/comunidad de Universidad, Instituto y mixto desde `/pedido`. Buscar por número, comprador y correo; combinar filtros; revisar total, fechas de Lima y estados `NO_APLICA`. La paginación aparece al superar veinte pedidos, sin generar pedidos adicionales solo para verla.
4. Subir comprobantes de ambos sellos de un mixto. Revisar enlaces Drive, sello, importe y último archivo. Aprobar Universidad: conserva Instituto en revisión y pedido pendiente. Rechazar Instituto: conserva Universidad verificada. Re-subir solo Instituto desde tracking y aprobar; ahora queda en preparación.
5. Abrir el detalle en dos pestañas. Aprobar en una; decidir desde la otra: debe rechazar la vista antigua. Subir un nuevo comprobante mientras está abierto el detalle: exige revisar el más reciente. No puede editarse `NO_APLICA` ni despacharse con pagos pendientes.
6. En preparación, delivery exige courier; registrar despacho y luego entrega. Recojo ofrece marcar listo para biblioteca y luego entregado, sin courier. Consultar tracking después de cada operación.
7. Editar inventario tras una compra: muestra stock descontado. Con edición abierta en una pestaña, comprar en otra y guardar stock desde la antigua: debe rechazar y pedir actualizar. Pedidos existentes mantienen sus precios/títulos. Borrar publicación usada o cambiar su sello: bloqueado; desactivar: permitido.
8. Revisar móvil: tabla con scroll horizontal, fila nueva inline y confirmación de borrado adaptable, controles/etiquetas visibles y foco de teclado. Cambiar pestañas de configuración y volver a un formulario abierto: conserva sus datos. Revisar flechas y Enter/Espacio en pestañas, Escape y retorno de foco al cerrar la confirmación de borrado. Revisar correo/PDF en Vercel cuando estén disponibles las credenciales; sigue pendiente de fase 4.

## Comprobaciones realizadas

Lint, tipos y build de producción correctos en la entrega inicial; incluye las tres rutas administrativas nuevas. Ajustes posteriores de tabla, altas inline, borrado y pestañas: comprobación puntual de lint y tipos. No se ejecutaron suites automatizadas, ni se alteró stock operativo, ni se crearon pedidos o enviaron correos para validar la fase. La revisión funcional requiere sesión Google y datos de revisión configurados. No hay remoto Git/proyecto Vercel configurado en la entrega anterior; merges locales solamente.

## Cómo validar Drive y Gmail

La integración ya forma parte del pedido real; `/admin/vista-previa` no crea pedidos ni ejecuta Drive/Gmail. En `/admin` → Integraciones revisar cuentas activas de ambos sellos, credenciales del propietario, APP_URL y tres PDF. Las variables completas solo comprueban presencia/configuración, no acceso real a Google.

Tras configurar o actualizar `.env.local`, reiniciar `pnpm dev`. Añadir una publicación operativa con stock en Inventario y abrir `/pedido`. Enviar pedido con correo propio de revisión: crea número/token, descuenta stock e intenta enviar la confirmación con guía PDF. Desde el seguimiento adjuntar PDF/JPG/PNG hasta 3 MB, elegir el sello y cargar. Confirmar archivo en Drive, `EN_REVISION` en Pedidos y recepción del email/adjunto. Un correo fallido puede reintentarse desde seguimiento después del intervalo indicado. Validar Universidad, Instituto y mixto; comprobar el adjunto también en Vercel al desplegar. Estas operaciones escriben pedidos/stock y envían correo, por lo que usar rama Neon de revisión y destinatario propio.
