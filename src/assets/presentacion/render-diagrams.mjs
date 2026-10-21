/** Rasteriza únicamente documentación local; usa Sharp ya declarado en el proyecto. */
import sharp from 'sharp';
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const diagrams = resolve(root, 'docs/diagramas');
const names = ['02-base-datos', '03-base-datos-pedidos', '04-base-datos-emision', '05-base-datos-identidad'];
for (const name of names) {
  await sharp(resolve(diagrams, `${name}.svg`)).resize(2560, 1440).png().toFile(resolve(diagrams, `${name}.png`));
}
// El SVG original permanece intacto. Se recorta su área principal para 16:9;
// respaldo se mantiene como texto nativo y leyenda en las notas de la diapositiva.
const architecture = (await readFile(resolve(diagrams, '01-arquitectura.svg'), 'utf8'))
  .replace('width="1600" height="1180" viewBox="0 0 1600 1180"', 'width="1480" height="680" viewBox="60 176 1480 680"');
if (!architecture.includes('viewBox="60 176 1480 680"')) throw new Error('Revisar encuadre del SVG de arquitectura');
await sharp(Buffer.from(architecture)).resize(2304, 1058).png().toFile('/tmp/fec-arquitectura-ampliada.png');
