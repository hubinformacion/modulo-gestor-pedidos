"""Un solo lienzo con todas las tablas, columnas y FK del SQL inicial local.

Genera SVG y HTML con navegación local. No conecta a PostgreSQL ni cambia la PPT.
Ejecutar: python3 src/assets/diagramas/generate-database.py
"""
from pathlib import Path
from xml.sax.saxutils import escape
from collections import defaultdict
from heapq import heappop, heappush
import bisect
import json
import re
import sys

sys.dont_write_bytecode = True
ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT/'src/assets/presentacion'))
from database import GROUPS

DEST = ROOT/'docs/diagramas'
NAME = '06-base-datos-completa'
INK, MUTED, RULE, ACCENT = '#25202d', '#625c6d', '#ddd7e5', '#6802c1'
CARD, HEADER, ROW, GAP, PITCH = 640, 64, 24, 80, 800


def read_schema():
    source = (ROOT/'src/db/schema.sql').read_text()
    tables = {}
    for match in re.finditer(r'CREATE TABLE\s+"([^"]+)"\s*\((.*?)\n\);', source, re.S):
        name, body = match.groups()
        columns = []
        for line in body.splitlines():
            m = re.match(r'\s*"([^"]+)"\s+(.+)', line)
            if not m:
                continue
            col, definition = m.groups()
            typ = re.split(r'\s+(?:DEFAULT|NOT NULL|PRIMARY KEY|UNIQUE|CONSTRAINT|GENERATED)', definition.rstrip(','), maxsplit=1)[0]
            typ = typ.replace('timestamp with time zone', 'timestamptz').replace('character varying', 'varchar').replace('"', '')
            columns.append(dict(name=col, type=typ, pk='PRIMARY KEY' in definition,
                                nn='NOT NULL' in definition or 'PRIMARY KEY' in definition,
                                uq='UNIQUE' in definition, composite=False, identity='GENERATED' in definition, fk=[]))
        for constraint in re.finditer(r'CONSTRAINT\s+"[^"]+"\s+(PRIMARY KEY|UNIQUE)\s*\(([^)]+)\)', body):
            kind, fields = constraint.groups()
            names = re.findall(r'"([^"]+)"', fields)
            for c in columns:
                if c['name'] in names:
                    if kind == 'PRIMARY KEY':
                        c['pk'] = c['nn'] = True
                    elif len(names) == 1:
                        c['uq'] = True
                    else:
                        c['composite'] = True
        tables[name] = dict(name=name, columns=columns)
    fks = []
    pattern = r'ALTER TABLE "([^"]+)" ADD CONSTRAINT "([^"]+)" FOREIGN KEY \("([^"]+)"\) REFERENCES "(?:public"\.")?([^".]+)"\("([^"]+)"\) ON DELETE (\w+(?:\s+\w+)?)(?= ON UPDATE|;)'
    for i, m in enumerate(re.finditer(pattern, source), 1):
        table, name, col, target, target_col, action = m.groups()
        fk = dict(id=f'fk{i:02}', table=table, column=col, target=target, target_column=target_col, action=action.upper(), constraint=name)
        assert table in tables and target in tables
        [c for c in tables[table]['columns'] if c['name'] == col][0]['fk'].append(fk['id'])
        assert any(c['name'] == target_col for c in tables[target]['columns'])
        fks.append(fk)
    enums = [(m.group(1), re.findall(r"'((?:[^']|'')*)'", m.group(2))) for m in re.finditer(r'CREATE TYPE\s+"(?:public"\.")?([^".]+)" AS ENUM\((.*?)\);', source, re.S)]
    grouped = [row[0] for _, _, rows in GROUPS for row in rows]
    assert len(grouped) == len(set(grouped)) and set(grouped) == set(tables)
    assert len(fks) == source.count(' FOREIGN KEY '), 'Hay FK no interpretadas'
    return tables, fks, enums


def place(tables):
    for lane, (group, _, rows) in enumerate(GROUPS):
        y = 336
        for name, description, _ in rows:
            t = tables[name]
            t.update(x=80+lane*PITCH, y=y, w=CARD, h=HEADER+ROW*len(t['columns'])+12,
                     group=group, description=description, lane=lane)
            y += t['h']+GAP
    return 160+(len(GROUPS)-1)*PITCH+CARD, max(t['y']+t['h'] for t in tables.values())


def routes(tables, fks, width, bottom):
    """Enrutado ortogonal A*: evita cajas; penaliza reutilizar segmentos."""
    xs = {24, width-24}
    ys = {208, 224, 240, 256, 272, bottom+32, bottom+64}
    for t in tables.values():
        for dx in [-64, -48, -32, -16, 16, 32, 48, 64]:
            xs.add(t['x']+dx if dx < 0 else t['x']+t['w']+dx)
        ys.update([t['y']-32, t['y']-16, t['y']+t['h']+16, t['y']+t['h']+32])

    def port(t, field, side):
        row = next(i for i, c in enumerate(t['columns']) if c['name'] == field)
        return (t['x']+(t['w'] if side == 'right' else 0), t['y']+HEADER+row*ROW+ROW/2)

    ends = []
    for f in fks:
        src, dst = tables[f['table']], tables[f['target']]
        ss, ds = ('right', 'left') if src['lane'] < dst['lane'] else ('left', 'right') if src['lane'] > dst['lane'] else ('right', 'right')
        a, b = port(src, f['column'], ss), port(dst, f['target_column'], ds)
        aa = (a[0]+(16 if ss == 'right' else -16), a[1])
        bb = (b[0]+(16 if ds == 'right' else -16), b[1])
        xs.update([aa[0], bb[0]]); ys.update([aa[1], bb[1]])
        ends.append((a, aa, bb, b))
    X, Y = sorted(xs), sorted(ys)
    obstacles = [(t['x']-8, t['y']-8, t['x']+t['w']+8, t['y']+t['h']+8) for t in tables.values()]
    obstacles += [(64+i*PITCH, 288, 736+i*PITCH, 336) for i in range(len(GROUPS))]

    def clear(x1, y1, x2, y2):
        lo_x, hi_x, lo_y, hi_y = min(x1, x2), max(x1, x2), min(y1, y2), max(y1, y2)
        for a, b, c, d in obstacles:
            if x1 == x2:
                if a < x1 < c and max(lo_y, b) < min(hi_y, d): return False
            elif b < y1 < d and max(lo_x, a) < min(hi_x, c): return False
        return True

    adjacency = defaultdict(list)
    for ix, x in enumerate(X):
        for iy, y in enumerate(Y):
            for jx, jy, direction in [(ix+1, iy, 0), (ix, iy+1, 1)]:
                if jx >= len(X) or jy >= len(Y): continue
                xx, yy = X[jx], Y[jy]
                if clear(x, y, xx, yy):
                    distance = abs(xx-x)+abs(yy-y)
                    adjacency[(ix, iy)].append(((jx, jy), direction, distance))
                    adjacency[(jx, jy)].append(((ix, iy), direction, distance))
    used = defaultdict(int)
    output = []
    for fk, (a, aa, bb, b) in zip(fks, ends):
        start = (bisect.bisect_left(X, aa[0]), bisect.bisect_left(Y, aa[1]))
        goal = (bisect.bisect_left(X, bb[0]), bisect.bisect_left(Y, bb[1]))
        initial = (*start, 2)
        todo = [(0, 0, initial)]; costs = {initial: 0}; previous = {}; final = None
        while todo:
            _, cost, state = heappop(todo)
            if cost != costs[state]: continue
            node, old_dir = state[:2], state[2]
            if node == goal:
                final = state; break
            for nxt, direction, distance in adjacency[node]:
                edge = tuple(sorted([node, nxt]))
                extra = distance*(1+used[edge]*.3)+(28 if direction != old_dir else 0)
                new = (*nxt, direction); new_cost = cost+extra
                if new_cost < costs.get(new, float('inf')):
                    costs[new] = new_cost; previous[new] = state
                    heuristic = abs(X[nxt[0]]-bb[0])+abs(Y[nxt[1]]-bb[1])
                    heappush(todo, (new_cost+heuristic, new_cost, new))
        if final is None: raise ValueError(f'Sin ruta para {fk["id"]}')
        chain = [final]
        while chain[-1] != initial: chain.append(previous[chain[-1]])
        chain.reverse()
        for p, q in zip(chain, chain[1:]): used[tuple(sorted([p[:2], q[:2]]))] += 1
        points = [a]+[(X[p[0]], Y[p[1]]) for p in chain]+[b]
        compressed = []
        for point in points:
            if compressed and point == compressed[-1]: continue
            while len(compressed) > 1 and ((compressed[-2][0] == compressed[-1][0] == point[0]) or (compressed[-2][1] == compressed[-1][1] == point[1])):
                compressed.pop()
            compressed.append(point)
        # Se conserva cada FK, incluidas las de retorno y las que comparten destino.
        output.append(dict(fk, points=compressed))
    return output


def rounded(points):
    parts = [f'M {points[0][0]} {points[0][1]}']
    for a, b, c in zip(points, points[1:], points[2:]):
        r = min(8, (abs(b[0]-a[0])+abs(b[1]-a[1]))/2, (abs(c[0]-b[0])+abs(c[1]-b[1]))/2)
        def toward(q):
            distance = abs(q[0]-b[0])+abs(q[1]-b[1])
            return (b[0]+(q[0]-b[0])*r/distance, b[1]+(q[1]-b[1])*r/distance)
        p, q = toward(a), toward(c)
        parts.append(f'L {p[0]} {p[1]} Q {b[0]} {b[1]} {q[0]} {q[1]}')
    parts.append(f'L {points[-1][0]} {points[-1][1]}')
    return ' '.join(parts)


def make_svg(tables, edges, enums, width, bottom):
    height = bottom+144+len(enums)*44+112
    count = sum(len(t['columns']) for t in tables.values())
    out = [f'<svg xmlns="http://www.w3.org/2000/svg" width="{width}" height="{height}" viewBox="0 0 {width} {height}" role="img" aria-labelledby="db-full-title db-full-desc">',
        '<title id="db-full-title">Base de datos completa · Fondo Editorial Continental</title>',
        f'<desc id="db-full-desc">Un único lienzo con las {len(tables)} tablas, {count} columnas, {len(edges)} claves foráneas y {len(enums)} tipos enumerados del SQL inicial. Cada relación conecta la columna de origen con la referenciada. Los grupos son áreas documentales, no límites de permisos.</desc>',
        '<defs><marker id="db-full-arrow" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto"><path d="M0 0L8 4L0 8" fill="#8e819c"/></marker></defs>',
        '<style>text{font-family:Inter,Arial,sans-serif;fill:#25202d}.muted{fill:#625c6d}.coltype{font-family:monospace;fill:#625c6d}.fk-path{fill:none;stroke:#a89bb5;stroke-width:1.8;opacity:.65;marker-end:url(#db-full-arrow);pointer-events:stroke}.table{outline:none}.table:focus .table-frame{stroke:#6802c1;stroke-width:3}.col-row:hover rect{fill:#f0e5fa}.col-row{cursor:pointer}.hint{fill:#806c91}</style>',
        f'<rect width="{width}" height="{height}" fill="white"/>',
        f'<text x="80" y="56" font-size="32" font-weight="700" fill="{ACCENT}">FONDO EDITORIAL CONTINENTAL · MODELO COMPLETO</text>',
        f'<text x="80" y="112" font-size="36" font-weight="700">{len(tables)} tablas · {count} columnas · {len(edges)} relaciones FK · {len(enums)} tipos enumerados</text>',
        '<text x="80" y="152" font-size="20" class="muted">PK: clave primaria · FK: clave foránea · NN: no nulo · UQ: único · UQ*: unicidad compuesta · ID: identidad generada · flecha: origen → referencia</text>',
        '<text x="80" y="184" font-size="18" class="muted">Fuente: src/db/schema.sql. Sin datos reales ni conexión a BD. No se inventan FK para correos o listas JSON; índices, CHECK y defaults completos permanecen en el SQL.</text>']
    for lane, (group, _, rows) in enumerate(GROUPS):
        x=64+lane*PITCH
        out += [f'<rect x="{x}" y="288" width="672" height="{bottom-272}" rx="8" fill="#fbfafd" stroke="#ebe5f1"/>',
                f'<text x="{x+16}" y="312" font-size="18" font-weight="700" class="muted">{escape(group.upper())} · {len(rows)}</text>']
    for e in edges:
        label = f'{e["id"]}: {e["table"]}.{e["column"]} → {e["target"]}.{e["target_column"]} · ON DELETE {e["action"]}'
        out.append(f'<path id="{e["id"]}" class="fk-path" data-src="{e["table"]}" data-dst="{e["target"]}" d="{rounded(e["points"])}"><title>{escape(label)}</title></path>')
    for name, t in tables.items():
        x,y,w,h=t['x'],t['y'],t['w'],t['h']
        out += [f'<g id="table-{name}" class="table" data-table="{name}" tabindex="0" role="button" aria-label="Tabla {name}, {len(t["columns"])} columnas. Seleccionar para resaltar relaciones.">',
            f'<title>{escape(name+": "+t["description"])}</title>',
            f'<rect class="table-frame" x="{x}" y="{y}" width="{w}" height="{h}" rx="6" fill="white" stroke="{RULE}" stroke-width="2"/>',
            f'<rect x="{x+1}" y="{y+1}" width="{w-2}" height="62" rx="6" fill="#f3eafb"/>',
            f'<text x="{x+16}" y="{y+30}" font-size="24" font-weight="700">{name}</text>',
            f'<text x="{x+16}" y="{y+52}" font-size="13" class="muted">{len(t["columns"])} columnas · {sum(len(c["fk"]) for c in t["columns"])} FK salientes</text>']
        for i,c in enumerate(t['columns']):
            yy=y+HEADER+i*ROW
            flags=(['PK'] if c['pk'] else [])+(['FK '+','.join(f[2:] for f in c['fk'])] if c['fk'] else [])+(['UQ'] if c['uq'] else ['UQ*'] if c['composite'] else [])+(['NN'] if c['nn'] else [])+(['ID'] if c['identity'] else [])
            fk_info='; '.join(f'{e["target"]}.{e["target_column"]}, ON DELETE {e["action"]}' for e in edges if e['id'] in c['fk'])
            desc=f'{name}.{c["name"]} · {c["type"]} · '+', '.join(flags)+(f' → {fk_info}' if fk_info else '')
            out += [f'<g class="col-row" data-fk="{",".join(c["fk"])}"><title>{escape(desc)}</title>',
                f'<rect x="{x+1}" y="{yy}" width="{w-2}" height="{ROW}" fill="{"#faf9fc" if i%2==0 else "white"}"/>',
                f'<text x="{x+16}" y="{yy+17}" font-size="15">{escape(c["name"])}</text>',
                f'<text x="{x+344}" y="{yy+17}" font-size="13" class="coltype">{escape(c["type"])}</text>',
                f'<text x="{x+w-12}" y="{yy+16}" font-size="10" text-anchor="end" class="hint">{escape(" · ".join(flags))}</text></g>']
        out.append('</g>')
    yy=bottom+104
    out.append(f'<text x="80" y="{yy}" font-size="28" font-weight="700">Tipos enumerados SQL ({len(enums)})</text>')
    for i,(name,values) in enumerate(enums):
        out.append(f'<text x="80" y="{yy+48+i*44}" font-size="18"><tspan font-weight="700">{name}</tspan><tspan class="muted"> · {escape(" / ".join(values))}</tspan></text>')
    out.append(f'<text x="80" y="{height-44}" font-size="18" class="muted">Autorización por sesión/rol/unidad en servidor; no se afirma RLS ni cifrado propio por campo. Permisos SQL y cifrado efectivos requieren evidencia de TI.</text></svg>')
    return ''.join(out),height


def make_html(svg,tables,edges,width,height):
    metadata={name:{k:t[k] for k in ['x','y','w','h','description']} for name,t in tables.items()}
    payload=json.dumps(dict(tables=metadata,edges=[{k:e[k] for k in ['id','table','column','target','target_column','action']} for e in edges],width=width,height=height),ensure_ascii=False).replace('<','\\u003c')
    options=''.join(f'<option value="{name}"></option>' for name in sorted(tables))
    return '''<!doctype html><html lang="es"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Base de datos completa · Fondo Editorial Continental</title><style>
*{box-sizing:border-box}body{margin:0;color:#25202d;background:#f5f2f8;font-family:Inter,Arial,sans-serif}header{padding:14px 20px;background:white;border-bottom:1px solid #ddd7e5;display:flex;align-items:center;gap:12px;flex-wrap:wrap}h1{font-size:18px;margin:0 auto 0 0}button,input,a{font:inherit}button,input{padding:8px 12px;background:white;border:1px solid #d7ccdf;border-radius:4px}button,a{cursor:pointer}a{color:#6802c1;font-size:13px}button:focus-visible,input:focus-visible,a:focus-visible{outline:3px solid #6802c1;outline-offset:2px}input{width:260px}#view{height:calc(100dvh - 160px);min-height:320px;overflow:auto;overscroll-behavior:contain;touch-action:pan-x pan-y;background:white;cursor:grab}#view.dragging{cursor:grabbing}#view svg{display:block;max-width:none}footer{padding:12px 20px;line-height:1.5;background:#fff;border-top:1px solid #ddd7e5;font-size:13px}#status{margin:0 0 4px;min-height:20px}.help{color:#625c6d;margin:0}body.selected .table{opacity:.4}body.selected .table.related{opacity:1}body.selected .table.chosen .table-frame{stroke:#6802c1;stroke-width:3}body.selected .fk-path{opacity:.07}body.selected .fk-path.related{opacity:1;stroke:#6802c1;stroke-width:3}.fk-path{cursor:pointer}#zoom{font-size:13px;min-width:42px}@media(max-width:760px){header{padding:10px}h1{width:100%}input{width:190px}#view{height:calc(100dvh - 235px)}}@media print{header,footer{display:none}#view{overflow:visible;height:auto}#view svg{width:100%!important;height:auto!important}.table,.fk-path{opacity:1!important}}
</style><header><h1>Base de datos completa · 40 tablas</h1><label><span class="help">Tabla </span><input id="search" list="tables" placeholder="Buscar y pulsar Enter" aria-label="Buscar una tabla"></label><datalist id="tables">'''+options+'''</datalist><button id="minus" aria-label="Alejar">−</button><output id="zoom" aria-live="polite"></output><button id="plus" aria-label="Acercar">+</button><button id="fit">Ver todo</button><button id="actual">100 %</button><a href="06-base-datos-completa.svg" download>Descargar SVG</a></header><main id="view" tabindex="0" aria-label="Lienzo único de toda la base de datos, desplazable horizontal y verticalmente">'''+svg+'''</main><footer><p id="status" role="status">40 tablas, 404 columnas y 44 claves foráneas en un solo lienzo. Selecciona una tabla o una columna FK para seguir sus relaciones.</p><p class="help">Zoom con +/− o Ctrl + rueda; arrastra el fondo o usa las barras para desplazarte. Enter sobre una tabla la selecciona; Escape quita el resaltado. No se oculta ninguna tabla. Fuente: esquema local, sin datos operativos. FK 01–44 identifica la relación; su detalle y ON DELETE aparecen al señalarla.</p></footer><script type="application/json" id="schema-model">'''+payload+'''</script><script>
const model=JSON.parse(document.querySelector('#schema-model').textContent),view=document.querySelector('#view'),svg=view.querySelector('svg'),status=document.querySelector('#status'),search=document.querySelector('#search');let zoom=1,drag=null;const tables=[...svg.querySelectorAll('.table')],paths=[...svg.querySelectorAll('.fk-path')];
function clear(){document.body.classList.remove('selected');tables.forEach(n=>n.classList.remove('related','chosen'));paths.forEach(n=>n.classList.remove('related'));status.textContent='40 tablas, 404 columnas y 44 claves foráneas. Todas permanecen en el mismo lienzo.'}
function setZoom(next,cx=view.clientWidth/2,cy=view.clientHeight/2){const old=zoom;zoom=Math.max(.05,Math.min(2.5,next));const px=(view.scrollLeft+cx)/old,py=(view.scrollTop+cy)/old;svg.style.width=`${model.width*zoom}px`;svg.style.height=`${model.height*zoom}px`;view.scrollLeft=px*zoom-cx;view.scrollTop=py*zoom-cy;document.querySelector('#zoom').textContent=`${Math.round(zoom*100)} %`}
function fit(){clear();setZoom(Math.min(view.clientWidth/model.width,view.clientHeight/model.height));view.scrollLeft=view.scrollTop=0}
function highlight(name,edgeId){const edges=model.edges.filter(e=>edgeId?e.id===edgeId:e.table===name||e.target===name),near=new Set([name,...edges.flatMap(e=>[e.table,e.target])]);document.body.classList.add('selected');tables.forEach(n=>{n.classList.toggle('related',near.has(n.dataset.table));n.classList.toggle('chosen',n.dataset.table===name)});paths.forEach(n=>n.classList.toggle('related',edges.some(e=>e.id===n.id)));status.textContent=edgeId?edges.map(e=>`${e.table}.${e.column} → ${e.target}.${e.target_column} · ON DELETE ${e.action}`).join(' '):`${name}: ${model.tables[name].description} ${edges.length} relaciones físicas.`}
function find(){const q=search.value.trim().toLowerCase(),names=Object.keys(model.tables),name=names.includes(q)?q:names.filter(n=>n.includes(q)).length===1?names.find(n=>n.includes(q)):null;if(!name){status.textContent='Escribe el nombre exacto de una tabla o una coincidencia única.';return}highlight(name);setZoom(Math.max(.85,zoom));const t=model.tables[name];view.scrollLeft=Math.max(0,t.x*zoom-48);view.scrollTop=Math.max(0,t.y*zoom-48)}
tables.forEach(n=>{n.addEventListener('click',e=>{e.stopPropagation();const row=e.target.closest('.col-row');highlight(n.dataset.table,row?.dataset.fk?.split(',')[0]||null)});n.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();highlight(n.dataset.table)}})});paths.forEach(n=>n.addEventListener('click',e=>{e.stopPropagation();highlight(n.dataset.src,n.id)}));search.addEventListener('keydown',e=>{if(e.key==='Enter')find()});search.addEventListener('change',()=>{if(model.tables[search.value])find()});document.querySelector('#plus').onclick=()=>setZoom(zoom*1.3);document.querySelector('#minus').onclick=()=>setZoom(zoom/1.3);document.querySelector('#fit').onclick=fit;document.querySelector('#actual').onclick=()=>setZoom(1);document.addEventListener('keydown',e=>{if(e.key==='Escape')clear()});view.addEventListener('wheel',e=>{if(e.ctrlKey||e.metaKey){e.preventDefault();const r=view.getBoundingClientRect();setZoom(zoom*(e.deltaY<0?1.15:1/1.15),e.clientX-r.left,e.clientY-r.top)}},{passive:false});view.addEventListener('pointerdown',e=>{if(e.button!==0||e.target.closest('.table,.fk-path'))return;drag={x:e.clientX,y:e.clientY,left:view.scrollLeft,top:view.scrollTop};view.setPointerCapture(e.pointerId);view.classList.add('dragging')});view.addEventListener('pointermove',e=>{if(drag){view.scrollLeft=drag.left-(e.clientX-drag.x);view.scrollTop=drag.top-(e.clientY-drag.y)}});function stop(){drag=null;view.classList.remove('dragging')}view.addEventListener('pointerup',stop);view.addEventListener('pointercancel',stop);fit();
</script></html>'''


if __name__=='__main__':
    tables,fks,enums=read_schema()
    width,bottom=place(tables)
    edges=routes(tables,fks,width,bottom)
    svg,height=make_svg(tables,edges,enums,width,bottom)
    DEST.mkdir(exist_ok=True)
    (DEST/f'{NAME}.svg').write_text(svg)
    (DEST/f'{NAME}.html').write_text(make_html(svg,tables,edges,width,height))
    print(f'Lienzo {width} × {height}: {len(tables)} tablas, {sum(len(t["columns"]) for t in tables.values())} columnas, {len(edges)} FK, {len(enums)} tipos. Sin omisiones de tablas/columnas/FK.')
