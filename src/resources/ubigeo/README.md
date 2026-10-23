# Ubigeo nacional

Snapshot local para los selectores y la clasificación de envío; no requiere API, credenciales ni peticiones externas durante el pedido. La calle/número sigue siendo texto libre.

- Fuente nominal: INEI / SISCONCODE, versión 2026.
- Archivo obtenido: [ubigeos_2026.csv](https://github.com/Rodasluis/Peru-maps/blob/main/salida/ubigeos_2026.csv), extraído por ese proyecto del listado del INEI. Fuente oficial enlazada: [SISCONCODE](https://webapp.inei.gob.pe:8443/sisconcode/main.htm).
- Consulta/descarga: 2026-10-05. SHA-256 del CSV: `d7192ef1ed4d62dd0828764a41f0c8847637e71231f8c762f3013e4d52146432`.
- `peru.json` conserva únicamente pares `[código, nombre]`: 25 departamentos, 196 provincias, 1893 distritos. No incluye cartografía, coordenadas ni población.
- Se conserva el aviso de licencia del repositorio de origen en `SOURCE-LICENSE.txt`; su licencia MIT corresponde al código, no se atribuye a los datos del INEI.

La jerarquía se obtiene por prefijos: departamento 2, provincia 4, distrito 6 dígitos. No confundir códigos INEI con códigos RENIEC. Lima/Callao corresponde a provincias `1501`/`0701`; otras provincias de Lima usan la tarifa de provincia.

Para actualizar, obtener una nueva versión del listado completo, transformar sus tres niveles al mismo formato, revisar los cambios y actualizar aquí origen/versión/hash/conteos. No incorporar distritos o códigos inventados. Cualquier nueva división geográfica requiere actualizar este archivo; el snapshot no se presenta como un servicio de actualización automática.
