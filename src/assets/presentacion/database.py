"""Inventario y diagramas documentales; lee el esquema local, nunca una BD."""
from pathlib import Path
from xml.sax.saxutils import escape
import re

ROOT = Path(__file__).resolve().parents[3]

# Nombre real, contenido explicado y campos representativos (sin valores reales).
GROUPS = [
    ('Identidad y acceso', 'I', [
        ('user', 'Identidad Google del personal: nombre, correo verificado e imagen.', 'id, name, email, email_verified'),
        ('session', 'Sesión, token, vencimiento y metadatos de conexión del personal.', 'id, user_id, token, expires_at'),
        ('account', 'Vinculación OAuth y tokens de identidad; contraseña local deshabilitada.', 'user_id, provider_id, access_token, refresh_token'),
        ('verification', 'Registros de verificación del esquema de Better Auth; no habilita registro abierto.', 'identifier, value, expires_at'),
        ('authorized_emails', 'Lista de acceso, rol, unidades y condición de buzón de servicio.', 'email, role, publisher_imprints, treasury_service'),
    ]),
    ('Configuración', 'C', [
        ('campuses', 'Bibliotecas: dirección, ubicación, horario, coordenadas y estado.', 'id, name, library_address, pickup_hours'),
        ('pickup_contacts', 'Contactos de apoyo para recojo; no son usuarios autorizados.', 'id, name, email, status'),
        ('bank_accounts', 'Cuentas receptoras por sello: titular, banco, número y CCI.', 'publisher_imprint, holder, account, cci'),
        ('treasury_mailboxes', 'Buzón institucional de avisos de Tesorería por unidad.', 'publisher_imprint, email'),
        ('delivery_rates', 'Tarifa vigente por zona; los pedidos guardan su costo histórico.', 'zone, price, status'),
    ]),
    ('Catálogo y descuentos', 'C / O', [
        ('books', 'Títulos reales, código, autor, sello, precios, stock y estado.', 'id, title, inventory_code, stock'),
        ('promotions', 'Campañas, porcentajes por público, alcance y vigencia.', 'id, name, community_percent, starts_at'),
        ('promotion_books', 'Relación entre una campaña y los títulos incluidos.', 'promotion_id, book_id'),
        ('coupons', 'Código, porcentaje, público, títulos, vigencia y límites de uso.', 'id, code, book_ids, used_count'),
        ('coupon_redemptions', 'Uso de cupón por pedido y fecha de liberación, si corresponde.', 'order_id, coupon_id, released_at'),
    ]),
    ('Pedidos, pagos y entrega', 'O', [
        ('orders', 'Comprador/receptor, facturación, destino, importes, estados, responsable, consentimiento y snapshots.', 'id, order_number, customer_document, tracking_token, order_status'),
        ('order_items', 'Partidas: título/código/precio histórico, cantidad, descuento e importe.', 'order_id, book_id, book_title, unit_price, quantity'),
        ('order_counters', 'Último número por año para numeración transaccional.', 'year, last_number'),
        ('payment_guides', 'Guía de pago histórica deduplicada: hash y PDF codificado en base64 dentro de PostgreSQL.', 'hash, content_base64'),
        ('payment_uploads', 'Intento durable de carga: hash, ID Drive reservado, formato y tamaño.', 'id, order_id, content_hash, drive_file_id'),
        ('payment_receipts', 'Comprobante recibido por pedido/sello, vinculado al intento y archivo Drive.', 'order_id, publisher_imprint, upload_id, drive_file_id'),
        ('pickup_evidence', 'Metadatos y autor de evidencia opcional de entrega/recojo; imagen privada en Drive.', 'order_id, actor_user_id, drive_file_id, content_hash'),
    ]),
    ('Tesorería y documentos', 'T', [
        ('caja_requests', 'Solicitud por pedido/sello: estado, ciclo, responsable, borrador, PDF final e hilo interno.', 'id, order_id, publisher_imprint, finalized_document_id'),
        ('sale_documents', 'Revisiones de PDF de venta por solicitud/ciclo, autor, hash y archivo privado.', 'id, request_id, cycle, content_hash, drive_file_id'),
        ('sale_document_batches', 'Lote inmutable de documentos vigentes remitidos al comprador.', 'id, order_id, document_ids, correction'),
        ('treasury_observations', 'Observación a Fondo Editorial, corrección solicitada, respuesta y resolución.', 'request_id, content, correction, response'),
        ('treasury_supporting_files', 'Adjuntos privados de subsanación: Drive, hash, tamaño y autor.', 'request_id, drive_file_id, content_hash, actor_id'),
        ('treasury_notes', 'Notas internas del equipo de Tesorería de la unidad, con autor y fecha.', 'request_id, actor_id, content'),
        ('treasury_activity', 'Historial de eventos de la solicitud y su actor.', 'request_id, actor_id, event, detail'),
    ]),
    ('Historial y avisos', 'A', [
        ('order_activity', 'Avances y notas internas de Fondo Editorial; salida pública mediante allowlist.', 'order_id, actor_user_id, event_type, detail'),
        ('order_emails', 'Auditoría del correo inicial y referencias/lease del hilo del comprador.', 'order_id, status, gmail_thread_id, attempts'),
        ('order_notifications', 'Evento nuevo, payload, resultado y referencias del aviso al comprador.', 'order_id, event_type, payload, status'),
        ('caja_notifications', 'Auditoría de avisos internos por solicitud/ciclo de Tesorería.', 'request_id, cycle, event_type, status'),
        ('pickup_notifications', 'Destinatario de apoyo y resultado del aviso de recojo.', 'order_id, contact_id, contact_email, status'),
        ('management_audit', 'Cambios de administración, actor, recurso y detalle de campos.', 'actor_email, event, resource, details'),
    ]),
    ('Permisos y cuotas', 'S', [
        ('drive_reader_grants', 'Seguimiento de permisos nominados y retiros pendientes de carpeta Drive.', 'folder_id, email, permission_id'),
        ('drive_file_reader_grants', 'Permisos nominados por archivo y solicitud de Tesorería, incluso intentos pendientes.', 'drive_file_id, email, request_id, permission_id'),
        ('order_admission_policy', 'Límites configurables de admisión de pedidos y autor de cambio.', 'email_day, global_day, pending_email, updated_by'),
        ('order_admission_counters', 'Contadores compartidos por ventana, con claves HMAC para correo/IP.', 'key, window_start, count'),
        ('order_admission_changes', 'Historial de cambios de límites: actor y valores anteriores/nuevos.', 'actor_email, previous, next'),
    ]),
]

CONTROLS = [
    ('I · Identidad', 'Solo servidor: sesión vigente, Google verificado y lista autorizada. No publicar tokens ni registros de sesión. El rol SQL autorizado puede leerlos; no hay cifrado propio por campo declarado.'),
    ('C · Configuración', 'Gestores autorizados mantienen configuración según función; maestro administra accesos/buzones. La compra recibe solo catálogo, tarifas, campus y cuentas necesarios; no el correo del apoyo.'),
    ('O · Pedido', 'Comprador: token privado y respuesta mínima de su pedido. Gestor personal asignado: decisiones operativas. Stock/numeración/importes protegidos por validación, transacción, locks y versión.'),
    ('T · Tesorería', 'Sesión y unidades vigentes en servidor; asignación para operar. Notas privadas del equipo. Comprador descarga únicamente PDF finalizado vigente; nunca borradores, evidencia o notas.'),
    ('A · Auditoría', 'Historial interno y visibilidad por área; proyección pública con allowlist. Sin edición/borrado por UI. Avisos son auditoría, no cola. Append-only a nivel SQL requiere privilegios configurados por TI; no es WORM.'),
    ('S · Control técnico', 'Gestión desde servidor; cuotas editables por maestro. HMAC no es cifrado ni anonimización absoluta. ACL Drive privadas y revocaciones reconciliables; preservar owners/writers y permisos heredados.'),
]


def schema_metadata():
    source = (ROOT / 'src/db/schema.sql').read_text()
    tables = {}
    for m in re.finditer(r'CREATE TABLE\s+"([^"]+)"\s*\((.*?)\n\);', source, re.S):
        tables[m.group(1)] = re.findall(r'^\s*"([^"]+)"\s+', m.group(2), re.M)
    declared = [row[0] for _, _, rows in GROUPS for row in rows]
    if len(declared) != len(set(declared)) or set(declared) != set(tables):
        raise ValueError('Actualizar inventario documental: tablas diferentes del SQL inicial')
    for _, _, rows in GROUPS:
        for name, _, fields in rows:
            if not set(fields.split(', ')).issubset(tables[name]):
                raise ValueError(f'Actualizar campos documentados de {name}')
    return tables


def add_database_slides(Slide, colors):
    tables = schema_metadata()
    result = {}

    def node(s, x, y, name, fields, focal=False, width=320):
        s.rect(x, y, width, 160, colors['tint'] if focal else colors['soft'], colors['accent'] if focal else colors['line'], 8)
        s.text(x+16, y+12, width-32, 32, name, 22, colors['accent'] if focal else colors['ink'], True)
        s.line([(x+16, y+52), (x+width-16, y+52)], colors['line'], arrow=False)
        s.text(x+16, y+56, width-32, 84, '\n'.join(fields), 14, colors['muted'])
        s.text(x+16, y+140, width-32, 18, f'+ {len(tables[name])-len(fields)} campos más', 11, colors['muted'])

    def cardinal(s, x, y, text):
        s.text(x, y, 48, 24, text, 14, colors['muted'], True)

    s = Slide('Datos · Vista general', '40 tablas organizan la operación', 'Vista por áreas: el inventario completo describe cada tabla, sus campos y su protección.', '01 · Modelo de datos / src/db/schema.sql',
        'Vista agrupada de las 40 tablas declaradas en schema.sql, contrastadas con schema.ts y auth-schema.ts. Los grupos organizan tablas; no representan esquemas SQL separados, ACL independientes ni relaciones FK. El catálogo completo está en docs/01-arquitectura.md. Las tres vistas siguientes muestran relaciones seleccionadas, con sus omisiones explícitas. No se consulta una BD operativa.')
    summaries = [
        'user · session · account\nverification · authorized_emails',
        'Campus y apoyo para recojo\nCuentas, buzones y tarifas',
        'Libros, campañas y títulos\nCupones y uso por pedido',
        'Comprador, partidas y numeración\nGuías, depósitos y evidencia',
        'Solicitudes, PDF y lotes\nObservaciones, adjuntos y notas',
        'Actividad, administración\nHilos y resultados de correo',
    ]
    for i, ((name, _, rows), summary) in enumerate(zip(GROUPS[:6], summaries)):
        x=48+(i%3)*400; y=224+(i//3)*176
        s.rect(x,y,384,152,colors['tint'] if i==3 else colors['soft'],colors['line'],8)
        s.text(x+16,y+16,352,32,f'{name} · {len(rows)}',20,colors['accent'] if i==3 else colors['ink'],True)
        s.text(x+16,y+64,352,76,summary,18,colors['muted'])
    s.band('5 tablas de permisos y cuotas: ACL Drive, política, contadores HMAC e historial de límites.',y=592)
    result['02-base-datos'] = s

    s = Slide('Datos · Pedidos y pagos', 'El pedido une publicaciones y depósitos', 'Relaciones seleccionadas: 5 tablas. Una línea une claves reales; 1 y N indican cardinalidad.', '01 · Modelo de datos / esquema local',
        'Relaciones FK representadas: order_items.book_id → books.id, order_items.order_id → orders.id, payment_uploads.order_id → orders.id, payment_receipts.order_id → orders.id, payment_receipts.upload_id → payment_uploads.id. 1:N significa que un registro puede tener cero o varios asociados. upload_id es único: un intento puede originar como máximo un recibo. Se omiten FKs de guía, campus, contacto, cupón, promoción, gestor y los recibos seleccionados de cada sello en orders; están en el inventario y en el esquema. Campos mostrados son ejemplos; el conteo adicional se obtiene del SQL inicial. Bytes de depósitos en Drive; payment_guides es excepción: su PDF base64 está en BD.')
    s.line([(208,384),(208,432)],arrow=False)
    s.line([(528,384),(528,512),(368,512)],arrow=False)
    s.line([(800,288),(912,288)],arrow=False)
    s.line([(800,352),(848,352),(848,512),(912,512)],arrow=False)
    s.line([(1072,384),(1072,432)],arrow=False)
    node(s,48,224,'books',['id · clave primaria','title · título','stock · existencias','standard_price · tarifa'])
    node(s,480,224,'orders',['id · clave primaria','customer_name · comprador','tracking_token · enlace privado','order_status · avance'],True)
    node(s,912,224,'payment_uploads',['id · intento durable','order_id · pedido','content_hash · integridad','drive_file_id · archivo'])
    node(s,48,432,'order_items',['order_id · pedido','book_id · publicación','unit_price · precio histórico','quantity · cantidad'])
    node(s,912,432,'payment_receipts',['id · recibo recibido','order_id · pedido','upload_id · intento único','publisher_imprint · sello'])
    for x,y,t in [(220,388,'1'),(220,408,'N'),(540,388,'1'),(376,516,'N'),(808,260,'1'),(872,260,'N'),(808,328,'1'),(872,520,'N'),(1084,388,'1'),(1084,408,'0..1')]:cardinal(s,x,y,t)
    s.text(48,616,1184,32,'Se muestran campos clave; las demás columnas y relaciones permanecen en el esquema.',17,colors['muted'])
    result['03-base-datos-pedidos'] = s

    s = Slide('Datos · Emisión', 'Cada solicitud conserva sus documentos y correcciones', 'Relaciones seleccionadas: 5 tablas. El lote agrupa los PDF que recibe el comprador.', '01 · Modelo de datos / esquema local',
        'FK representadas: caja_requests.order_id → orders.id, sale_documents.request_id → caja_requests.id, treasury_observations.request_id → caja_requests.id y sale_document_batches.order_id → orders.id. Un pedido mixto tiene solicitudes para ambos sellos. Se omiten notas, actividad, adjuntos y permisos en el dibujo, pero figuran en el inventario. Las referencias draft_document_id/finalized_document_id en caja_requests apuntan a sale_documents y no se dibujan para evitar el ciclo visual. document_ids del lote es JSON, no una FK SQL: la pertenencia se comprueba en servicios y transacción. Conservar revisiones y lotes no implica enviar avisos pendientes. No condiciona entrega física.')
    s.line([(352,304),(480,304)],arrow=False)
    s.line([(784,280),(912,280)],arrow=False)
    s.line([(200,384),(200,448)],arrow=False)
    s.line([(752,384),(752,408),(856,408),(856,528),(912,528)],arrow=False)
    node(s,48,224,'orders',['id · pedido','order_number · número','order_type · único / mixto','total · importe'],width=304)
    node(s,480,224,'caja_requests',['id · solicitud','order_id · pedido','publisher_imprint · unidad','status · atención'],True,width=304)
    node(s,912,224,'sale_documents',['id · revisión PDF','request_id · solicitud','cycle · ciclo de corrección','drive_file_id · archivo'])
    node(s,48,448,'sale_document_batches',['id · lote','order_id · pedido','document_ids · lista JSON','correction · corrección'],width=368)
    node(s,912,448,'treasury_observations',['request_id · solicitud','content · observación','correction · campos a corregir','resolved_at · resolución'])
    for x,y,t in [(360,272,'1'),(440,272,'N'),(792,248,'1'),(872,248,'N'),(212,388,'1'),(212,424,'N'),(764,388,'1'),(872,536,'N')]:cardinal(s,x,y,t)
    s.text(456,464,352,112,'document_ids es una lista JSON.\nLa aplicación valida los PDF\nque pertenecen al lote.\nNo es una clave foránea SQL.',18,colors['muted'])
    result['04-base-datos-emision'] = s

    s = Slide('Datos · Identidad', 'Una identidad Google no concede acceso por sí sola', 'La sesión identifica a la persona; authorized_emails define su autorización vigente.', '02 · Seguridad / esquema local',
        'FK físicas session.user_id → user.id y account.user_id → user.id, ambas con eliminación en cascada en esquema. authorized_emails.email se compara con user.email mediante lógica de servidor: no hay FK SQL entre ellas. Se dibuja con línea discontinua para no inventar una relación física. verification no tiene FK a user y queda independiente en este diagrama. El campo password de account forma parte del esquema estándar, pero emailAndPassword.enabled es false. No hay registro abierto. Las comprobaciones transaccionales vuelven a validar sesión, email verificado, rol y unidades. Retiro de authorized_emails elimina sesiones de forma transaccional; ACL externas se reconcilian.')
    s.line([(352,304),(480,304)],arrow=False)
    s.line([(784,304),(912,304)],arrow=False)
    s.line([(632,384),(632,448)],arrow=False,dash=True)
    node(s,48,224,'session',['user_id · persona','token · credencial','expires_at · vencimiento','ip_address · conexión'],width=304)
    node(s,480,224,'user',['id · identidad','email · correo único','email_verified · verificado','name · nombre'],True,width=304)
    node(s,912,224,'account',['user_id · persona','provider_id · Google','access_token · credencial','refresh_token · credencial'])
    node(s,448,448,'authorized_emails',['email · correo autorizado','role · gestor / caja','publisher_imprints · unidades','treasury_service · solo consulta'],True,width=368)
    node(s,48,448,'verification',['identifier · identificador','value · verificación','expires_at · vencimiento'],width=304)
    for x,y,t in [(360,272,'N'),(440,272,'1'),(792,272,'1'),(872,272,'N')]:cardinal(s,x,y,t)
    s.text(824,452,376,132,'Línea discontinua:\ncomparación por correo\nen el servidor.\nNo existe una FK SQL.',18,colors['muted'])
    result['05-base-datos-identidad'] = s

    s = Slide('Datos · Protección', 'La protección combina acceso, integridad y custodia', 'Lo declarado en el código se distingue de la configuración efectiva que TI debe acreditar.', '02 · Seguridad y accesos',
        'Controles de aplicación revisados: sesión y autorización BD; proyecciones mínimas para comprador/Tesorería; transacciones/locks/CAS/snapshots/hash e historial. Controles externos pendientes de evidencia: rol SQL mínimo sin DDL/propiedad, append-only para auditoría, IAM/MFA, cifrado efectivo del proveedor y carpeta de backups. No se afirma RLS por tabla: la separación de roles/unidades es lógica de servidor. PII y tokens no tienen cifrado propio por campo en la aplicación; un rol SQL autorizado puede leer la información. TLS/reposo del proveedor no sustituye ese control. Las copias deben cifrarse antes de subir a destino privado. Los hashes verifican integridad y HMAC seudonimiza contadores; no cifran un DNI/PDF. PostgreSQL conserva PDF de guía base64; los demás adjuntos operativos tienen bytes en Drive.')
    for y,label,value in [
        (224,'Acceso','Sesión vigente + rol/unidad + asignación + datos mínimos por audiencia.'),
        (312,'Integridad','Transacciones, claves, restricciones, versión, snapshots, hash e historial.'),
        (400,'Archivos privados','IDs y hashes en BD; adjuntos en Drive. La guía PDF también se guarda en BD.'),
        (488,'Custodia · validar TI','Privilegios SQL, cifrado efectivo, MFA y copias cifradas con clave separada.'),
    ]:s.row(y,label,value,76)
    s.band('No hay cifrado propio por campo ni garantía de auditoría inalterable frente al propietario de BD.')
    result['protection'] = s
    return result


def inventory_markdown():
    tables=schema_metadata()
    parts=['<!-- BEGIN:database-map -->', '## Base de datos: tablas, información y protección',
        'El esquema inicial local declara **40 tablas**. Esta documentación describe estructura y controles de código; no consulta datos ni acredita la configuración actual de Neon/Google. Fuente: `src/db/schema.ts`, `src/db/auth-schema.ts` y `src/db/schema.sql`.',
        '![Vista general de la base de datos](diagramas/02-base-datos.png)',
        '[Mapa completo en HTML, con cuatro diagramas e inventario](diagramas/02-base-datos.html) · [SVG de la vista general](diagramas/02-base-datos.svg).',
        '### Relaciones principales',
        'Las vistas ER muestran tablas reales y un subconjunto de campos/relaciones. **1:N** significa un registro relacionado con cero o varios; **1:0..1**, con cero o uno. Las líneas continuas corresponden a FK del esquema, sin representar el orden del proceso ni permisos. Una línea discontinua identifica una asociación lógica que valida la aplicación. Cada caja indica cuántos campos adicionales se omiten. Las relaciones no dibujadas siguen existiendo en el esquema.',
        '![Relaciones de publicaciones, pedidos y depósitos](diagramas/03-base-datos-pedidos.png)',
        '![Relaciones de solicitudes y documentos de Tesorería](diagramas/04-base-datos-emision.png)',
        '`caja_requests.draft_document_id` y `finalized_document_id` también referencian `sale_documents.id`; se omiten esas líneas de retorno para facilitar la lectura. `sale_document_batches.document_ids` y `coupons.book_ids` son listas JSON, no claves foráneas: los servicios validan sus referencias.',
        '![Identidad, sesiones y lista de autorización](diagramas/05-base-datos-identidad.png)',
        '`authorized_emails.email` se compara con `user.email` desde servidor; no existe una FK entre ambas. `verification` es independiente y no tiene FK a `user`. El esquema estándar incluye `account.password`, pero el login por contraseña local está deshabilitado.',
        '### Cómo se protege la información',
        '| Clave | Alcance del control |','| --- | --- |']
    for label,content in CONTROLS:parts.append(f'| {label} | {content} |')
    parts += [
        'La separación por rol/unidad/pedido se comprueba en consultas, acciones y transacciones del servidor; **no se presenta como RLS por tabla**. El navegador no recibe credenciales de BD. Restricciones/FK conservan relaciones, pero no sustituyen autorización.',
        '**Límites y responsabilidades de TI:** no hay cifrado propio por campo para datos personales/tokens ni log de cada lectura/descarga. El cifrado en tránsito/reposo, rol SQL mínimo, privilegios append-only, MFA/IAM y ACL efectivas requieren evidencia del proveedor. Hash/HMAC no cifran un DNI o un PDF. El propietario de BD puede alterar registros; el historial no es WORM. Backups manuales deben cifrarse antes de subir y requieren ensayo de restauración.',
        '**Dónde están los archivos:** recibos, PDF de venta, subsanaciones y evidencia guardan metadatos/IDs/hash en PostgreSQL y bytes en Drive privado. La excepción es `payment_guides`: conserva el PDF histórico en `content_base64`. Gmail conserva mensajes aparte. Un dump de BD no incluye los bytes de Drive ni las conversaciones de Gmail.',
        '### Inventario completo por tabla',
        'Los campos siguientes son representativos; la cantidad es el total de columnas del SQL inicial, no el número de registros. La clave de protección remite a la matriz anterior. El inventario no incluye valores ni datos de personas.',
    ]
    for group,control,rows in GROUPS:
        parts += [f'#### {group} · {len(rows)} tablas', '| Tabla | Información guardada | Campos de referencia | Protección |', '| --- | --- | --- | --- |']
        for name,desc,fields in rows:
            parts.append(f'| `{name}` ({len(tables[name])} columnas) | {desc} | '+', '.join(f'`{f}`' for f in fields.split(', '))+f' | {control} |')
    parts += ['Los controles se detallan y sus límites se mantienen en [Seguridad y accesos](02-seguridad.md). El esquema operativo solo cambia mediante actualización incremental explícita y respaldada, fuera del build.', '<!-- END:database-map -->']
    return '\n\n'.join(p if not p.startswith('|') else p for p in parts).replace('|\n\n|','|\n|')+'\n'


def write_database_docs(diagrams, render_svg):
    dest=ROOT/'docs/diagramas'
    figures=[]
    for i,(name,s) in enumerate(diagrams.items(),1):
        if name=='protection':continue
        # El documento usa la misma geometría del PPTX sin numeración de slides.
        import copy
        figure=copy.copy(s)
        figure.elements=[e for e in s.elements if not(e['type']=='text' and re.fullmatch(r'\d+ / \d+',e['text']))]
        svg=render_svg(figure,100+i)
        (dest/f'{name}.svg').write_text(svg)
        figures.append(svg)
    markdown=inventory_markdown()
    doc=ROOT/'docs/01-arquitectura.md';text=doc.read_text()
    if '<!-- BEGIN:database-map -->' in text:
        text=re.sub(r'<!-- BEGIN:database-map -->.*?<!-- END:database-map -->\n?',lambda _:markdown,text,flags=re.S)
    else:text=text.replace('## Consistencia y operación',markdown+'\n## Consistencia y operación')
    doc.write_text(text)
    # Inventario de texto accesible además de los gráficos; sin scripts remotos.
    catalog=[]
    for group,control,rows in GROUPS:
        catalog.append(f'<h2>{escape(group)}</h2><table><thead><tr><th>Tabla</th><th>Contenido</th><th>Campos de referencia</th><th>Protección</th></tr></thead><tbody>')
        for name,desc,fields in rows:catalog.append(f'<tr><th scope="row">{name}</th><td>{escape(desc)}</td><td>{escape(fields)}</td><td>{control}</td></tr>')
        catalog.append('</tbody></table>')
    protections=''.join(f'<dt>{escape(k)}</dt><dd>{escape(v)}</dd>' for k,v in CONTROLS)
    html='<!doctype html><html lang="es"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Base de datos · Fondo Editorial Continental</title><style>body{font-family:Inter,Arial,sans-serif;color:#25202d;background:#f8f7fa;margin:0;padding:24px}main{max-width:1280px;margin:auto}h1,h2{color:#6802c1}svg{width:100%;height:auto;background:white;margin:16px 0}table{border-collapse:collapse;width:100%;background:white;margin-bottom:32px;font-size:14px}th,td{padding:12px;text-align:left;border:1px solid #ddd7e5;vertical-align:top}dt{font-weight:bold;margin-top:20px}dd{margin:8px 0;line-height:1.6}p{line-height:1.6}@media print{svg{break-inside:avoid}table{font-size:11px}}</style><main><h1>Base de datos: estructura y protección</h1><p>40 tablas del esquema local. Diagramas por áreas y relaciones seleccionadas; el inventario inferior cubre todas las tablas. No contiene registros operativos ni acredita configuración de proveedores.</p>'+''.join(figures)+'<h2>Controles y límites</h2><dl>'+protections+'</dl><p>Sin cifrado propio por campo ni garantía WORM. Cifrado de proveedor, privilegios SQL y permisos efectivos requieren evidencia de TI. Listas JSON y comparación por correo no son claves foráneas. Ver docs/01-arquitectura.md y docs/02-seguridad.md para alcance, omisiones y responsabilidades.</p>'+''.join(catalog)+'</main></html>'
    (dest/'02-base-datos.html').write_text(html)
