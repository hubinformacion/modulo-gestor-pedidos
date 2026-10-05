# Wizard de pedido

## Alcance de fase 3

`/pedido` es público y no requiere Google. `/` conserva su entrada administrativa. El wizard tiene cuatro pasos con validación Zod antes de avanzar: publicaciones, comprador, entrega y confirmación. Volver o editar conserva los datos en memoria y exige validar nuevamente antes de avanzar; una recarga inicia otro borrador. No se guarda información personal en localStorage.

La página servidor consulta solo libros activos, excluyendo códigos `DEMO-*`; no envía configuración privada ni datos auth al cliente. Búsqueda por título/autor/código, filtros por sello, cantidades limitadas al stock mostrado, estados vacío/agotado/error y skeleton `boneyard-js`. La disponibilidad final y los precios volverán a comprobarse en la transacción de fase 4.

La vista previa `/admin/vista-previa` requiere sesión y autorización vigentes, también al leer la BD. Permite recorrer los cuatro libros DEMO inactivos sin activarlos ni modificar stock. Comparte el mismo componente/cálculo/validación y las direcciones reales del wizard público. El botón final solo completa la revisión local, con una aclaración explícita. El registro público de pedidos permanece deshabilitado hasta fase 4.

## Reglas implementadas

- Cada selección conserva solo `bookId` y cantidad. Tipo de pedido y sellos se derivan de los libros; los importes se recalculan desde el catálogo recibido del servidor.
- Importes en céntimos enteros; formateo en soles al mostrar. Público general usa `standard_price`; comunidad usa `community_price` al seleccionar su tipo y exige sede/correo `@continental.edu.pe` para continuar.
- Comprador: nombre, correo, teléfono, documento. Factura opcional: exige RUC de 11 dígitos y razón social. Normalización de espacios/correo y descarte de campos que no aplican al validar.
- Recojo S/0, Lima/Callao S/15, provincia S/25. Provincia exige departamento/ciudad. Dirección y receptor obligatorios para delivery; campus y receptor obligatorios para recojo.
- Desglose por cuenta: publicaciones, flete, total. Mixto exige dos depósitos y asigna todo el flete a Universidad. Pedido de un solo sello asigna el flete a su cuenta. Sin zona elegida, se muestra subtotal y envío por seleccionar.
- Confirmación con datos y controles para editar cada paso; checkbox de revisión. No crea pedido, número/token, reserva, comprobante ni correo: esas operaciones pertenecen a fase 4.

Validaciones/cálculo compartidos en `src/lib/orders`; interfaz en `src/components/order-wizard`. Las próximas Server Actions deberán usar Zod y recuperar catálogo, precios, stock y campus desde fuentes del servidor: el resultado del navegador no es una orden confiable.

## Campus y mapas

`src/config/fulfillment.ts` contiene los ocho campus y las direcciones suministradas por el usuario: Arequipa, Ayacucho, Cusco, Huancayo Instituto, Huancayo Universidad, Ica, Lima Los Olivos y Lima Miraflores. Todos recogen en biblioteca.

Cada objeto `Campus` admite dos campos opcionales:

| Campo | Formato | Uso |
| --- | --- | --- |
| `coordinates` | `{ latitude: number, longitude: number }` | Coordenadas reales en grados decimales, latitud entre −90/90 y longitud entre −180/180 |
| `googleMapsEmbedUrl` | String HTTPS de `https://www.google.com/maps/embed?...` | URL `src` del iframe de Google Maps; prioridad sobre coordenadas/dirección |

Para configurar el punto preciso, añadir coordenadas reales al objeto del campus o abrir el punto en Google Maps → **Compartir / Insertar un mapa**, copiar el HTML y guardar únicamente el contenido de `src` en `googleMapsEmbedUrl`. No pegar el iframe entero ni un enlace corto de compartir. [Instrucciones oficiales de Google](https://support.google.com/maps/answer/7101463?hl=es).

Sin esos campos, el iframe busca por dirección y muestra que la ubicación debe confirmarse; no se afirma que el resultado esté georreferenciado con precisión. Las coordenadas fuera de rango y URLs de otros dominios se descartan. El mapa se carga al elegir un campus, tiene título accesible, carga diferida y enlace alternativo para abrir Google Maps. El enlace externo usa [Maps URLs](https://developers.google.com/maps/documentation/urls/get-started).

El mapa no añade SDK, key ni permisos Drive/Gmail. Antes de producción, revisar el punto de cada biblioteca; en fase 6, cualquier CSP de recursos deberá permitir el iframe de Google además de `frame-ancestors` para WordPress.

## Estado de entrega

Lint, tipos y build de producción correctos. El endpoint de mapa por dirección respondió HTTP 200 sin X-Frame-Options; esto no confirma que los pines sean exactos ni reemplaza la revisión visual del navegador. No hubo nuevas migraciones, activación de DEMO ni escrituras de pedidos.

## Revisión manual

1. Entrar en `/admin` con correo autorizado y abrir **Vista previa del pedido**. Seleccionar un libro de cada sello, cambiar cantidades, probar filtros/búsqueda y volver al primer paso sin perder la selección.
2. Comparar público general/comunidad: al seleccionar comunidad cambian precios y resumen. Exigir sede y correo institucional; rechazar correo externo, teléfono/documento vacíos y RUC incompleto cuando se pide factura.
3. Probar recojo en cada campus: dirección, biblioteca, mapa y flete cero. Revisar manualmente el pin de Google Maps; añadir coordenadas/URL exacta si no coincide.
4. En carrito mixto, seleccionar Lima/Callao: S/15 solo en Universidad; provincia: S/25 solo en Universidad y departamento/ciudad obligatorios. Quitar un sello y confirmar tipo/importes correspondientes.
5. Revisar confirmación y editar comprador/entrega/publicaciones; cambiar un dato exige nueva revisión. Completar la vista previa solo después de marcar el checkbox; no debe aparecer número de pedido ni descuento de stock.
6. Abrir `/pedido` sin sesión: ningún DEMO aparece aunque esté activo por accidente. Con el catálogo actual DEMO/inactivo, se muestra el estado vacío. La pantalla de inventario real se implementará en fase 5.
7. Revisar a 375 px y escritorio: pasos, formularios, botones y resumen legibles, sin desplazamiento horizontal. Usar teclado para radios, campos, navegación y correcciones.

Sin suites de pruebas automatizadas, según la instrucción del usuario. No integrar fase 3 ni avanzar a fase 4 hasta aprobación explícita.
