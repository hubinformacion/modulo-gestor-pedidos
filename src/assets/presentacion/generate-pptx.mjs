/** Exporta el modelo documental con PptxGenJS 4.0.1, sin acceso a servicios. */
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';

const require = createRequire(import.meta.url);
const modulePath = process.argv[2] || 'pptxgenjs';
const PptxGenJS = require(modulePath);
const model = JSON.parse(readFileSync(0, 'utf8'));
const pptx = new PptxGenJS();
pptx.defineLayout({ name: 'FEC', width: 1280 / 96, height: 720 / 96 });
pptx.layout = 'FEC';
pptx.author = 'Fondo Editorial Continental';
pptx.subject = 'Arquitectura, seguridad, respaldos y guías de uso';
pptx.title = 'Gestor de pedidos · Fondo Editorial Continental';
pptx.company = 'Universidad Continental';
pptx.lang = 'es-PE';
pptx.theme = { headFontFace: 'Inter', bodyFontFace: 'Inter', lang: 'es-PE' };

for (const item of model.slides) {
  const slide = pptx.addSlide();
  slide.background = { color: 'FFFFFF' };
  slide.addNotes(item.notes);
  for (const e of item.elements) {
    if (e.type === 'text') {
      slide.addText(e.lines.join('\n'), {
        x: e.x / 96, y: e.y / 96, w: e.w / 96, h: e.h / 96,
        fontFace: 'Inter', fontSize: e.size * 0.75,
        color: e.color, bold: e.bold, align: e.align,
        valign: 'top', margin: 0, wrap: false,
        paraSpaceAfter: 0, lineSpacingMultiple: 1.22,
        lang: 'es-PE', isTextBox: true,
      });
    } else if (e.type === 'rect') {
      slide.addShape(e.radius ? pptx.ShapeType.roundRect : pptx.ShapeType.rect, {
        x: e.x / 96, y: e.y / 96, w: e.w / 96, h: e.h / 96,
        rectRadius: e.radius ? 0.06 : 0,
        fill: { color: e.fill },
        line: e.stroke ? { color: e.stroke, width: 0.75 } : { transparency: 100 },
      });
    } else {
      const xs = e.points.map(p => p[0]);
      const ys = e.points.map(p => p[1]);
      const x = Math.min(...xs), y = Math.min(...ys);
      const w = Math.max(...xs) - x, h = Math.max(...ys) - y;
      const relative = ([px, py]) => ({ x: (px - x) / 96, y: (py - y) / 96 });
      const points = [relative(e.points[0])];
      for (let i = 1; i < e.points.length - 1; i++) {
        const [a, b, c] = e.points.slice(i - 1, i + 2);
        const r = Math.min(8, Math.abs(b[0] - a[0]) + Math.abs(b[1] - a[1]), Math.abs(c[0] - b[0]) + Math.abs(c[1] - b[1]));
        const toward = q => {
          const d = Math.abs(q[0] - b[0]) + Math.abs(q[1] - b[1]);
          return [b[0] + (q[0] - b[0]) * r / d, b[1] + (q[1] - b[1]) * r / d];
        };
        points.push(relative(toward(a)));
        const control = relative(b);
        points.push({ ...relative(toward(c)), curve: { type: 'quadratic', x1: control.x, y1: control.y } });
      }
      points.push(relative(e.points.at(-1)));
      slide.addShape(pptx.ShapeType.custGeom, {
        x: x / 96, y: y / 96, w: Math.max(w, 1) / 96, h: Math.max(h, 1) / 96,
        points,
        line: { color: e.color, width: 1.5, ...(e.dash ? { dashType: 'dash' } : {}), ...(e.arrow ? { endArrowType: 'triangle' } : {}) },
      });
    }
  }
}
await pptx.writeFile({ fileName: model.output, compression: true });
