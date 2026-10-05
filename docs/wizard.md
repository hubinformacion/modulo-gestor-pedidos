# Wizard de pedido

## Alcance de fase 3

`/pedido` es público y no requiere Google. `/` conserva su entrada administrativa. El wizard tiene cuatro pasos con validación Zod antes de avanzar: publicaciones, comprador, entrega y confirmación. Volver o editar conserva los datos en memoria y exige validar nuevamente antes de avanzar; una recarga inicia otro borrador. No se guarda información personal en localStorage.

La página servidor consulta solo libros activos, excluyendo códigos `DEMO-*`, y campus activos de la BD; no envía configuración privada ni datos auth al cliente. Búsqueda por título/autor/código, filtros por sello, cantidades limitadas al stock mostrado, estados vacío/agotado/error y skeleton `boneyard-js`. La disponibilidad final y los precios volverán a comprobarse en la transacción de fase 4.

La vista previa `/admin/vista-previa` requiere sesión y autorización vigentes, también al leer la BD. Permite recorrer los cuatro libros DEMO inactivos sin activarlos ni modificar stock. Comparte el mismo componente/cálculo/validación y las direcciones reales del wizard público. El botón final solo completa la revisión local, con una aclaración explícita. El registro público de pedidos permanece deshabilitado hasta fase 4.

## Reglas implementadas

- Cada selección conserva solo `bookId` y cantidad. Tipo de pedido y sellos se derivan de los libros; los importes se recalculan desde el catálogo recibido del servidor.
- Importes en céntimos enteros; formateo en soles al mostrar. Público general usa `standard_price`; comunidad usa `community_price` al seleccionar su tipo y exige sede/correo `@continental.edu.pe` para continuar. La interfaz muestra solo el importe aplicado, sin comparar precios ni etiquetar tarifas por comprador. Catálogo sin portada; nombres de sellos en badges.
- Comprador: nombre, correo, teléfono, documento. Factura opcional: exige RUC de 11 dígitos y razón social. Normalización de espacios/correo y descarte de campos que no aplican al validar.
- Recojo S/0, Lima/Callao S/15, provincia S/25. Costos únicamente en el resumen. Delivery exige departamento → provincia → distrito mediante desplegables dependientes, más calle/número. La zona se deriva del distrito: provincias INEI `1501`/`0701` = Lima/Callao; otras = provincia, incluidas otras provincias del departamento Lima. No se acepta una tarifa elegida por el cliente.
- Persona que recoge/recibe: «Yo» obtiene nombre/documento/teléfono del comprador actual; «Otra persona» exige nombres y apellidos, DNI de 8 dígitos y teléfono de 9–15 dígitos. La validación completa vuelve a derivar los datos de «Yo» para evitar valores antiguos o manipulados.
- Desglose por cuenta: publicaciones, flete, total. Mixto exige dos depósitos y asigna todo el flete a Universidad. Pedido de un solo sello asigna el flete a su cuenta. Sin zona elegida, se muestra subtotal y envío por seleccionar.
- Confirmación con datos y controles para editar cada paso; dos aceptaciones obligatorias de privacidad/tratamiento. No crea pedido, número/token, reserva, comprobante ni correo: esas operaciones pertenecen a fase 4.

Validaciones/cálculo compartidos en `src/lib/orders`; interfaz en `src/components/order-wizard`. Las próximas Server Actions deberán usar Zod y recuperar catálogo, precios, stock y campus desde fuentes del servidor: el resultado del navegador no es una orden confiable.

## Campus y mapas

La tabla `campuses` contiene los ocho campus/direcciones suministrados por el usuario; su carga inicial se aplica una vez en la migración `0002_magenta_purifiers`. No se restauran campus eliminados al repetir `db:seed`. El archivo estático `src/config/fulfillment.ts` se retiró.

En `/admin`, **Campus y bibliotecas** permite crear, editar, activar/desactivar y eliminar, con dirección, latitud/longitud opcionales y URL del mapa embebido. Todos los autorizados pueden gestionarlos; solo el maestro gestiona correos. Las acciones validan con Zod, verifican sesión/autorización también en la transacción y revalidan administración/pedido. Nombres únicos sin distinguir mayúsculas. Un campus asociado a pedidos no se elimina (FK restrictiva); se puede desactivar conservando el historial. Los campus inactivos no aparecen en los pasos de comprador/recojo.

Coordenadas en grados decimales (punto decimal), ambas o ninguna, latitud −90/90 y longitud −180/180. La URL HTTPS de Google Maps embebido tiene prioridad sobre coordenadas; estas tienen prioridad sobre dirección. Para el punto preciso, Google Maps → **Compartir / Insertar un mapa**, copiar solo el contenido de `src`, no todo el HTML ni un enlace corto. [Instrucciones de Google](https://support.google.com/maps/answer/7101463?hl=es).

Sin ubicación precisa, el mapa busca por dirección y advierte que debe confirmarse. Mapa accesible/diferido y enlace alternativo [Maps URLs](https://developers.google.com/maps/documentation/urls/get-started). Revisar pines antes de producción; CSP de fase 6 deberá admitir los iframes de Google.

## Ubigeo local

Los tres desplegables usan `src/data/ubigeo/peru.json`: snapshot 2026 de 25 departamentos, 196 provincias y 1893 distritos, transformado del [listado SISCONCODE extraído por Peru-maps](https://github.com/Rodasluis/Peru-maps/blob/main/salida/ubigeos_2026.csv). Origen, checksum y actualización en [README del dataset](../src/data/ubigeo/README.md). No se llama una API al comprar; revisar/actualizar el snapshot cuando cambie la división administrativa. La calle/número permanece libre: elegir un distrito válido no geocodifica ni verifica automáticamente la calle.

Las nuevas columnas de pedidos conservan provincia/distrito/ubigeo y datos de la otra persona. Fase 4 debe recuperar campus activos desde BD, validar ubigeo y derivar zona/nombres e importes en servidor; `delivery_city` mantiene compatibilidad con el esquema inicial como localidad, no sustituye el ubigeo.

## Estado de entrega

Cambios solicitados implementados; fase 3 pendiente de revisión manual y aprobación. Lint, tipos y build de producción completados sin errores. Migración `0002_magenta_purifiers` aplicada en Neon; ocho campus iniciales y nuevas columnas disponibles. No activa DEMO ni crea pedidos. No se ejecutaron suites de pruebas ni operaciones de CRUD con datos ficticios.

## Revisión manual

1. En `/admin`, crear un campus con biblioteca; editar su dirección/mapa, desactivarlo y comprobar que desaparece del wizard al recargar. Reactivarlo; eliminar un campus de revisión sin pedidos. Probar nombre repetido, coordenada suelta/fuera de rango y URL que no sea de Google Maps embebido.
2. En `/admin/vista-previa`, seleccionar ambos sellos: sin portada, sin precios alternativos ni texto sobre ajuste de precios; sellos identificados con badges. Comprobar búsqueda/cantidades y único precio aplicado.
3. Comparar público/comunidad manteniendo su regla de cálculo y exigencia de sede/correo institucional, sin mensajes de diferenciación de precios.
4. Delivery: seleccionar Lima → Lima → un distrito, y Callao → Callao → un distrito: flete S/15 solo en sidebar. Seleccionar Lima → otra provincia: S/25. Seleccionar otra región: S/25. Cambiar departamento/provincia vacía selecciones dependientes; campos incompletos impiden avanzar. En mixto todo el flete va a Universidad.
5. Recojo: campus/biblioteca/mapa, flete cero solo en resumen. «Yo» usa los datos de comprador; «Otra persona» exige nombre, DNI y teléfono. Volver y cambiar comprador: «Yo» debe reflejar los datos actuales, no los anteriores.
6. Confirmación: geografía con nombres legibles, persona que recoge/recibe con documento/teléfono, edición de pasos y dos checkbox de consentimiento. Completar revisión no genera pedido ni modifica stock.
7. Revisar a 375 px/escritorio y con teclado. `/pedido` público excluye todos los DEMO; sin catálogo real se muestra vacío. Un no autorizado no accede a campus/vista previa/acciones.

Sin suites de pruebas automatizadas. No integrar fase 3 ni avanzar a fase 4 hasta aprobación explícita.

Ajuste visual: catálogo con filas compactas (precio/cantidad a la derecha en escritorio), sellos en badges sin prefijo, placeholders en campos libres y cursor de acción en controles habilitados. Una sola línea de envío en el resumen; los totales por cuenta conservan su asignación de flete. Confirmación exige dos consentimientos independientes con Zod; enlace de privacidad abre en otra pestaña. Botón «Enviar pedido» mantiene el alcance de vista previa de fase 3. Fase 4 deberá exigir ambos consentimientos también en su Server Action.
