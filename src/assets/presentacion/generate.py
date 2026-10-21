"""Genera HTML y exporta PPTX mediante PptxGenJS, sin tocar datos operativos."""

from pathlib import Path
from xml.sax.saxutils import escape
import base64
import json
import textwrap

ROOT = Path(__file__).resolve().parents[3]
OUT = ROOT / 'docs' / 'presentacion'
OUT.mkdir(parents=True, exist_ok=True)
W, H = 1280, 720
C = dict(ink='25202D', muted='625C6D', accent='6802C1', tint='F3EAFC', line='DDD7E5', paper='FFFFFF', soft='F8F7FA', green='216344', amber='895B15')
SLIDES = []


class Slide:
    def __init__(self, section, title, sub, source, notes):
        self.elements = []
        self.source = source
        self.notes = notes
        self.section = section
        SLIDES.append(self)
        self.rect(0, 0, W, H, C['paper'])
        self.rect(48, 40, 32, 4, C['accent'])
        self.text(92, 30, 1120, 24, section.upper(), 13, C['accent'], True)
        self.text(48, 76, 1184, 64, title, 34, bold=True)
        self.text(48, 148, 1184, 52, sub, 18, C['muted'])
        self.line([(48, 664), (1232, 664)], C['line'], arrow=False)
        self.text(48, 680, 1020, 20, 'FONDO EDITORIAL CONTINENTAL  ·  ' + source, 11, C['muted'])
        self.text(1140, 676, 92, 28, f'{len(SLIDES):02d} / 18', 14, C['accent'], True, 'right')

    def rect(self, x, y, w, h, fill, stroke=None, radius=0):
        self.elements.append(dict(type='rect', x=x, y=y, w=w, h=h, fill=fill, stroke=stroke, radius=radius))

    def text(self, x, y, w, h, content, size=20, color=None, bold=False, align='left'):
        self.elements.append(dict(type='text', x=x, y=y, w=w, h=h, text=content, size=size, color=color or C['ink'], bold=bold, align=align))

    def line(self, points, color=None, arrow=True, dash=False):
        self.elements.append(dict(type='line', points=points, color=color or C['muted'], arrow=arrow, dash=dash))

    def box(self, x, y, w, h, title, body='', focal=False, tag=None):
        self.rect(x, y, w, h, C['tint'] if focal else C['soft'], C['accent'] if focal else C['line'], 8)
        off = 16
        if tag:
            self.text(x+20, y+16, w-40, 24, tag.upper(), 12, C['accent'] if focal else C['muted'], True)
            off = 48
        self.text(x+20, y+off, w-40, 64 if '\n' in title else 40, title, 23, C['accent'] if focal else C['ink'], True)
        if body:
            self.text(x+20, y+off+(72 if '\n' in title else 48), w-40, h-off-56, body, 18, C['muted'])

    def band(self, content, y=592):
        self.rect(48, y, 1184, 48, C['tint'], radius=4)
        self.text(68, y+10, 1144, 32, content, 18, C['accent'], True)

    def steps(self, items, y=252, h=220):
        gap = 32
        n = len(items)
        w = (1184-gap*(n-1))/n
        for i in range(n-1):
            self.line([(48+(w+gap)*i+w, y+h/2), (48+(w+gap)*(i+1), y+h/2)])
        for i, (title, body) in enumerate(items):
            self.box(48+(w+gap)*i, y, w, h, title, body, focal=i==0, tag=f'{i+1:02d}')

    def row(self, y, label, value, height=72):
        self.rect(48, y, 1184, height, C['soft'], radius=4)
        self.text(68, y+16, 264, height-20, label, 20, C['accent'], True)
        self.text(356, y+16, 848, height-20, value, 19)


s = Slide('Visión general', 'Gestor de pedidos', 'Fondo Editorial Continental', '00–04 · Documentación del proyecto',
'''Presentación de síntesis para público funcional y técnico. Duración orientativa: 18–25 minutos; adaptar al ritmo de preguntas. Fuente única: docs/00-inicio.md a docs/04-guia-de-uso.md, revisión 20/10/2026. Los diagramas simplifican relaciones, no certifican configuraciones de consolas ni pruebas de producción. Todos los textos y formas del PPTX son editables. Se usa Inter; si el equipo no la tiene, PowerPoint puede sustituirla. No se han consultado datos operativos ni realizado envíos o respaldos.''')
s.text(48, 232, 760, 164, 'De la compra a la entrega,\ncon trazabilidad en cada paso.', 40, bold=True)
s.text(48, 440, 704, 112, 'Arquitectura · Seguridad\nRespaldos · Guías de uso', 25, C['muted'])
for i, word in enumerate(['Comprar', 'Atender', 'Documentar', 'Entregar']):
    y = 224+i*88
    if i < 3: s.line([(1000, y+64), (1000, y+88)])
    s.rect(840, y, 344, 64, C['tint'] if i==0 else C['soft'], C['line'], 8)
    s.text(864, y+16, 48, 32, f'0{i+1}', 18, C['accent'], True)
    s.text(928, y+16, 236, 32, word, 22, bold=True)

s = Slide('01 · Cómo funciona', 'Un proceso compartido, con responsabilidades claras', 'El comprador inicia; Fondo Editorial y Tesorería completan la atención.', '01 · Arquitectura / 04 · Guía de uso',
'''Abrir con el negocio antes de explicar tecnología. El sistema registra el pedido y coordina pagos, logística y documentos. No procesa tarjetas, transfiere dinero ni emite directamente comprobantes tributarios. Tesorería emite en su sistema habitual y adjunta el PDF. La entrega física y la emisión documental avanzan en paralelo una vez verificado el pago. Apoyo para recojo es un contacto, no un usuario del sistema.''')
s.steps([('Comprador', 'Selecciona títulos, registra\nsus datos y carga depósitos.'), ('Fondo Editorial', 'Verifica pagos y coordina\ndistribución y entrega.'), ('Tesorería', 'Revisa datos de emisión\ny adjunta boleta o factura.')], h=228)
s.band('El sistema coordina la operación; la validación del depósito y la emisión son institucionales.')

s = Slide('02 · Arquitectura', 'Una aplicación central conecta los servicios', 'WordPress contiene la compra; el personal trabaja directamente en Vercel.', '01 · Arquitectura',
'''Monolito modular Next.js sobre Vercel; React/TypeScript para interfaz, Better Auth y Google OAuth para acceso, Zod para entradas, Drizzle y PostgreSQL Neon para datos. El diagrama agrupa autenticación y correo como servicios Google distintos para simplificar. WordPress solo embebe compra/seguimiento. El login del personal no comparte sesión con el padre WordPress. Las líneas representan uso de servicios, no orden temporal. El cron diario reconcilia permisos Drive: no hace backups ni envía correos. Despliegue Git/GitHub → Vercel omitido del dibujo para mantener legibilidad.''')
s.line([(328, 292), (468, 292)])
s.line([(328, 468), (396, 468), (396, 412), (468, 412)])
for yy, port in [(264,284),(400,352),(536,420)]:
    s.line([(800, port), (864, port), (864, yy+40), (920, yy+40)])
s.box(48, 232, 280, 128, 'WordPress', 'Compra y seguimiento')
s.box(48, 408, 280, 128, 'Personal', 'Acceso directo + Google')
s.box(468, 232, 332, 304, 'Aplicación Next.js', 'Reglas del negocio\nAcceso y validaciones\nAcciones del servidor', focal=True, tag='Vercel')
s.box(920, 232, 312, 112, 'Neon', 'PostgreSQL · datos')
s.box(920, 368, 312, 112, 'Google Drive', 'Archivos privados')
s.box(920, 504, 312, 112, 'Google OAuth / Gmail', 'Identidad y avisos')
s.text(48, 588, 760, 40, 'Flecha = la aplicación utiliza el servicio indicado.', 16, C['muted'])

s = Slide('03 · Información', 'Datos, archivos y mensajes viven en lugares distintos', 'Esta separación también define qué debe protegerse y recuperarse.', '01 · Arquitectura / 03 · Operación',
'''Neon conserva identidad, autorización, configuración, compras, snapshots, intentos de carga, referencias/hash, actividad y metadatos de correo. Drive conserva bytes: depósitos, PDF de venta y evidencia privada. Gmail conserva conversaciones. La base no contiene una copia completa de los archivos ni de los mensajes. Los snapshots conservan título/precio/cuentas/destino/consentimiento de la compra aunque cambie la configuración. El seed solo incorpora configuración faltante; no es una copia de información operativa.''')
s.box(48, 236, 560, 288, 'Base de datos · Neon', 'Pedidos, stock e importes\nUsuarios, permisos y configuración\nHistorial y referencias de archivos', focal=True, tag='Registros')
s.box(648, 236, 584, 128, 'Drive · documentos', 'Depósitos, PDF de venta y evidencia privada')
s.box(648, 396, 584, 128, 'Gmail · comunicaciones', 'Conversaciones y avisos por audiencia')
s.band('Una copia de PostgreSQL no incluye los archivos de Drive ni los mensajes de Gmail.')

s = Slide('04 · Consistencia', 'El pedido se registra completo o se revierte', 'Las reglas se comprueban en el servidor, aunque la pantalla ya las haya validado.', '01 · Arquitectura / 04 · Reglas de demostración',
'''En una transacción se validan stock, cuotas, numeración anual, partidas y registro del aviso. Los precios se recalculan desde catálogo en céntimos. UUID/hash del intento evita duplicar la compra y consumo de stock al recuperar un intento confirmado. Locks ordenados, versión y asignación evitan decisiones concurrentes. Google queda fuera de los locks. No se reintenta automáticamente una mutación con resultado ambiguo. BD y Google no comparten transacción distribuida. Correo se intenta durante la solicitud tras commit y su fallo no revierte el negocio.''')
s.steps([('Validar', 'Datos, precio, cupón,\nstock y cuotas.'), ('Confirmar', 'Pedido, partidas, stock\ny numeración juntos.'), ('Comunicar', 'Aviso del evento nuevo\ndespués de guardar.')])
s.band('El mismo intento recupera el pedido creado; no se registra otra compra para comprobar el correo.')

s = Slide('05 · Accesos', 'Cada rol ve y hace solo lo que necesita', 'Entrar con Google no basta: la autorización vigente se consulta en la base de datos.', '02 · Matriz de permisos',
'''Comprador accede por posesión del enlace nanoid32, sin login ni identidad civil verificada. Gestor personal consulta casos y solo el asignado decide pagos/logística/subsanación/anulación; notas FE según autorización del área. Tesorería solo consulta unidades asignadas y el responsable atiende la solicitud. Maestro administra accesos/configuración y consulta, pero no atiende casos. Buzones de Tesorería son de consulta, sin operación. Apoyo para recojo no recibe login, ACL ni enlace privado. Revocación cierra sesiones y libera abiertos; historial de cerrados permanece. Permisos Drive se retiran con reconciliación si falla Google.''')
for y, a, b in [(224,'Comprador','Su pedido y PDF vigente mediante enlace privado.'),(296,'Gestor personal','Atención de pagos, distribución y entrega del caso asignado.'),(368,'Tesorería personal','Emisión y correcciones de solicitudes de sus unidades.'),(440,'Maestro y buzones','Consulta de casos; el maestro administra accesos y configuración.'),(512,'Apoyo para recojo','Recibe instrucciones del recojo asignado por correo; sin acceso al sistema.')]:
    s.row(y,a,b,64)
s.band('La pantalla orienta; el servidor comprueba sesión, rol, unidad y asignación en cada operación.')

s = Slide('06 · Seguridad', 'La protección se aplica en varias capas', 'Controles de aplicación documentados; configuración de proveedores por acreditar con TI.', '02 · Seguridad y accesos',
'''Síntesis de los 12 requisitos, no auditoría nueva ni certificación. Autenticación: Google OAuth, correo verificado, lista cerrada, sin contraseña local. Sesiones de siete días y renovación diaria solo por proxy. Entradas: Zod, consultas parametrizadas, escape y validación de URL/origen. Archivos: hasta 3 MiB, MIME/firma/hash y pertenencia. Iframe: handshake y origin/source exactos, sin PII por postMessage. Drive: permisos nominados, sin acceso público. Cuotas compartidas reducen admisión abusiva, pero no cubren todo HTTP. Cifrado tránsito/reposo depende de proveedor; no hay cifrado propio por campo.''')
layers=[('01','Identidad y sesión','Google + correo verificado + autorización vigente en BD.'),('02','Acción y datos','Validación servidor + rol/unidad/asignación + transacciones.'),('03','Archivos e integración','Firma y hash + Drive privado + iframe con origen exacto.'),('04','Operación y proveedores','Secretos privados + cuotas + configuración institucional de TI.')]
for i,(n,t,b) in enumerate(layers):
    y=224+i*88
    s.rect(48,y,1184,76,C['tint'] if i==0 else C['soft'],radius=4)
    s.text(68,y+20,56,36,n,22,C['accent'],True)
    s.text(148,y+20,320,36,t,21,bold=True)
    s.text(492,y+20,712,44,b,18,C['muted'])

s = Slide('07 · Auditoría y límites', 'Trazabilidad de cambios, con alcance explícito', 'Distinguir evidencia del sistema, decisiones institucionales y controles aún por validar.', '02 · Seguridad / 03 · Cierre',
'''Se registran cambios de estado, pagos, archivos, emisión/devolución, administración, cuotas y resultado de avisos. Notas conservan autor/fecha. No hay backfill ni borrado por UI. No se registra cada lectura o descarga ni se ofrece WORM frente al propietario de BD. TI debe aplicar permisos SQL append-only y runtime sin propiedad/DDL. No hay antivirus/CDR de PDF ni cifrado propio de PII/tokens por campo. Enlace comprador no tiene caducidad/rotación por UI y la sesión no tiene timeout adicional por inactividad. Legal/TI debe aceptar conservación indefinida y consentimiento. Nada de esto se presenta como vulnerabilidad demostrada en producción.''')
s.box(48,228,560,304,'Qué queda registrado','Actor, fecha y cambios operativos\nAccesos y configuración\nResultado de envíos y documentos',focal=True,tag='Evidencia de aplicación')
s.box(648,228,584,304,'Qué falta acreditar','MFA, IAM, cifrado y región\nPermisos efectivos SQL y Drive\nRestauración y aceptación de privacidad',tag='Responsabilidad compartida')
s.band('El historial no registra cada lectura ni es inalterable frente al propietario de la base de datos.')

s = Slide('08 · Respaldos', 'Copia manual semanal, cifrada y con custodia separada', 'Es un procedimiento operativo documentado; su automatización no está implementada.', '03 · Respaldo manual semanal a Drive',
'''Responsable técnico: Fredy Paolo Romero Espinoza; custodios y herramienta de cifrado deben confirmarse con TI. Equipo institucional, directorio privado fuera de Git/sin sincronización automática; conexión Neon directa, pooling desactivado, rol backup y cliente compatible. Exportar pg_dump formato custom, revisar salida y pg_restore --list, cifrar antes de subir, no pasar claves como argumento. Subir a carpeta privada Drive distinta de comprobantes, sin permisos heredados al equipo. Registrar fecha/proyecto/versión/tamaño/hash cifrado/resultado y verificar carga y ACL. Clave en custodia institucional separada. El listado de dump no sustituye restauración. No se ha creado ningún respaldo como parte de esta presentación.''')
s.steps([('Exportar', 'Obtener copia de BD\ny verificar el formato.'),('Cifrar', 'Proteger el archivo;\ncustodiar la clave aparte.'),('Custodiar', 'Subir a Drive privado\ny registrar evidencia.')],y=224,h=208)
s.text(48,476,200,56,'7 días',40,C['accent'],True)
s.text(264,476,936,64,'RPO objetivo: pérdida máxima de datos desde la última copia válida.\nDepende de cumplir el respaldo semanal.',20)
s.band('El seed incorpora configuración; no recupera pedidos, numeración, historial ni archivos.')

s = Slide('09 · Recuperación', 'Una copia útil debe poder restaurarse', 'Ensayo en una base aislada, con efectos externos deshabilitados.', '03 · Restauración medida',
'''RTO objetivo cuatro horas, pendiente de ensayo medido. Medir desde descarga/descifrado hasta verificación de integridad y disponibilidad. Restaurar en base vacía aislada compatible sin envíos, cron ni cargas. Revisar versión, relaciones, referencias a Drive y contenido externo protegido por su política. Revisar revocaciones después del backup: restaurar puede reactivar autorizaciones antiguas. No reconciliar ACL de un ensayo contra carpeta operativa. Un cambio de esquema futuro requiere actualización incremental explícita respaldada fuera del build, nunca reset. Los planes de proveedores y sus ventanas no se afirman actualizados ni sustituyen el procedimiento.''')
s.steps([('Restaurar aislado','Descargar, descifrar\ny recuperar la base.'),('Verificar','Integridad, relaciones\ny referencias a archivos.'),('Revisar accesos','Reaplicar revocaciones\nantes de abrir tráfico.')],y=224,h=208)
s.text(48,476,200,56,'4 horas',40,C['accent'],True)
s.text(280,476,928,64,'RTO objetivo: tiempo para recuperar la operación.\nPendiente de demostrar con una restauración medida.',20)
s.band('Nunca restaurar sobre producción para comprobar que una copia funciona.')

s = Slide('10 · Guía del comprador', 'Comprar, pagar y consultar desde la página institucional', 'Un enlace privado reúne el seguimiento y los documentos de cada pedido.', '04 · Comprador',
'''Abrir fondoeditorial.continental.edu.pe/pedido/. Comunidad selecciona sede y correo institucional; declararlo no acredita pertenencia OAuth. Recojo permite consultar biblioteca/ubicación/mapa; delivery requiere ubigeo/dirección y receptor alterno si aplica. Confirmación incluye partidas, descuento, envío, facturación y cupón desplegable. Aceptar política y Enviar pedido. Conservar enlace privado y guía; si correo falla no crear pedido duplicado. Adjuntar PDF/JPG/PNG hasta 3 MiB; carga automática por unidad. No compartir enlace. Pago/Distribución/Entrega siguen consultables al cerrar. PDF finalizado vigente descargable en Pago. Puede cancelar pendiente sin pago verificado. Entrega estimada desde despacho: tres días hábiles Lima/Callao, cinco provincia, no garantía courier.''')
s.steps([('Elegir','Publicaciones, cantidades\ny datos de comprador.'),('Confirmar','Recojo o delivery,\nfacturación y política.'),('Pagar y seguir','Depositar, cargar recibos\ny consultar las etapas.')],h=236)
s.band('En pedidos mixtos: dos depósitos y una zona de carga por unidad.')

s = Slide('11 · Guía de Fondo Editorial', 'Tomar atención y avanzar por cuatro pestañas', 'Solo el gestor personal asignado ejecuta las decisiones del pedido.', '04 · Gestor de Fondo Editorial',
'''Login Google personal autorizado en Vercel /admin/pedidos. Abrir Ver detalles y tomar atención. Atención contiene comprador/resumen. Pagos permite comprobar recibos Drive por unidad, verificar o rechazar con motivo, consultar Tesorería y subsanar observaciones. Todos los pagos verificados habilitan distribución. Delivery exige courier; recojo exige apoyo seleccionado, lugar y horario. Entrega: evidencia opcional JPG/PNG hasta 3 MiB; esperar carga y confirmar. Notas e historial desde cabecera; no envían correo. Anulación con motivo solo antes del despacho, conserva documentos/historial y restituye stock una vez. No devuelve dinero. PDF incorrecto se devuelve a Tesorería aun después de entrega. Maestro no atiende casos.''')
s.steps([('Atención','Tomar el caso y\nrevisar sus datos.'),('Pagos','Validar depósitos\ny subsanaciones.'),('Distribución','Courier o recojo\ncon apoyo definido.'),('Entrega','Confirmar recepción;\nevidencia opcional.')],y=252,h=232)
s.band('Verificar pagos requiere validación institucional del depósito; un archivo cargado no lo acredita.')

s = Slide('12 · Guía de Tesorería', 'El PDF se emite fuera y se finaliza dentro del sistema', 'Cargar un archivo crea un borrador; finalizar confirma la solicitud.', '04 · Operador de Tesorería Recaudación',
'''Login personal autorizado en /tesoreria-recaudacion; operador puede tener una o ambas unidades. Filtrar unidad/estado/responsable y Ver detalles. Tomar atención; reasignar exige motivo según caso. Revisar Boleta/Factura, datos fiscales/códigos/importes/depósitos de su unidad. Si hay error, usar observación dirigida a FE; notas son privadas del equipo Tesorería. Emitir con sistema tributario habitual, adjuntar PDF hasta 3 MiB y revisar vista previa, luego Finalizar solicitud. Observación abierta bloquea finalizar emisión, no logística. Devolución requiere corregir/cargar/finalizar nuevo ciclo conservando anterior. Buzón servicio solo consulta. El añadido final de seguridad/guía establece CC de gestores en avisos internos nuevos; la frase anterior sin CC a operadores no excluye CC a gestores.''')
s.steps([('Revisar','Tomar solicitud y\nvalidar datos de emisión.'),('Emitir y cargar','Generar PDF tributario\ny revisar vista previa.'),('Finalizar','Confirmar documento\no atender corrección.')],h=236)
s.band('Si los datos son incorrectos, registrar una observación para Fondo Editorial.')

s = Slide('13 · Dos recorridos paralelos', 'La entrega del libro y la emisión no se bloquean entre sí', 'Cada pago verificado genera la solicitud de su unidad, sin esperar a la otra.', '01 · Arquitectura / 04 · Estados y reglas',
'''La primera solicitud de Tesorería puede crearse antes de que estén todos los pagos mixtos verificados. La logística entra a distribución solo cuando todos los pagos aplicables están verificados. PDF no condiciona distribución/despacho/entrega. Observación abierta bloquea finalizar emisión, no logística. En mixtos el comprador recibe ambos PDF en un solo lote cuando ambas solicitudes están finalizadas. Correcciones generan un nuevo lote con vigentes cuando todas vuelven a estar finalizadas. Avisos comprador en su hilo; internos por unidad, apoyo recojo aparte; CC de gestores en nuevos eventos según política. No existe cola ni reenvío de históricos. No hay exactamente una entrega garantizada ante timeout Gmail.''')
s.text(48,216,220,36,'LIBROS',16,C['accent'],True)
s.text(48,416,220,36,'DOCUMENTOS',16,C['accent'],True)
for yy in [310,510]:
    s.line([(388,yy),(472,yy)])
    s.line([(788,yy),(872,yy)])
for x,t,b in [(48,'Pagos verificados','Todos los requeridos'),(472,'Distribución','Courier o listo para recojo'),(872,'Entrega','Recepción confirmada')]:
    s.box(x,252,340 if x==48 else 316 if x==472 else 360,116,t,b,focal=x==48)
for x,t,b in [(48,'Pago de una unidad','Abre su solicitud'),(472,'Tesorería','Revisa, emite y finaliza'),(872,'PDF al comprador','Mixto: ambos en un lote')]:
    s.box(x,452,340 if x==48 else 316 if x==472 else 360,116,t,b,focal=x==48)
s.band('Avisos del evento nuevo e inmediatos; los fallidos quedan auditados, sin reenvío automático.')

s = Slide('14 · Configuración y recojo', 'Configurar accesos y coordinar a las personas', 'Los contactos de apoyo reciben instrucciones, sin convertirse en usuarios del sistema.', '04 · Maestro / Recojo y personal de apoyo',
'''Maestro administra correos personales/roles/unidades/buzones, seguridad y auditoría; gestores autorizados mantienen configuración operativa según permisos. Altas no dan acceso por designación documental: deben registrarse. Revocar elimina sesiones/libera abiertos, conserva cerrados y exige revisar retiro ACL. Campus permite horario/ubicación; apoyo listado general real, editable/desactivable, eliminación solo si sin pedidos. En distribución recojo seleccionar apoyo es obligatorio. Comprador ve nombre, lugar y horario, no correo del apoyo. Apoyo recibe nombre/documento/teléfono de quien recoge y publicaciones en hilo separado con CC gestores, sin enlace comprador. Gestor confirma entrega. Para campus se requiere DNI, correo de orden y comprobante. Seed no se actualiza con cambios UI.''')
s.row(224,'Accesos y seguridad','Maestro: cuentas personales, roles/unidades, buzones y cuotas.',88)
s.row(328,'Configuración operativa','Mantener cuentas, guías, campus, horarios y contactos reales.',88)
s.row(432,'Recojo coordinado','Gestor elige apoyo → comprador conoce a quién consultar → gestor confirma.',104)
s.band('Un contacto de apoyo no recibe sesión, permisos Drive ni enlace privado del comprador.')

s = Slide('15 · Incidencias', 'Conservar el estado y diagnosticar con evidencia segura', 'Reportar pantalla, hora y acción al responsable funcional o técnico.', '03 · Incidentes / 04 · Dudas e incidencias',
'''BD/OAuth temporal: revisar código seguro y consola, no repetir mutaciones ambiguas ni borrar sesiones por indisponibilidad. Gmail falla: negocio permanece, revisar auditoría y coordinar comunicación externa; no reenvío automático ni recuperación histórica. Drive falla: conservar selección e intento, reintentar carga sin duplicar; confirmar retiro efectivo de permisos. invalid_grant de propietario: técnico revisa cliente/consentimiento/políticas y renueva token con mismo cliente/scopes; no imprimirlo. Esquema incompatible: detener y preparar actualización incremental respaldada, no reset. Enlace expuesto: escalar técnico, no tiene rotación por UI. No crear pedidos ni depósitos de prueba; no compartir secretos/PII/token.''')
s.row(224,'Falla el correo','El pedido puede existir: conservar enlace y revisar auditoría.',80)
s.row(320,'Falla una carga','Conservar selección e intento; reintentar la carga sin duplicar.',80)
s.row(416,'Falla BD o acceso','Revisar el error seguro; evitar repetir acciones de resultado incierto.',80)
s.band('No crear pedidos adicionales, repetir depósitos ni borrar información para diagnosticar.')

s = Slide('16 · Cierre institucional', 'La documentación orienta; la evidencia permite aceptar', 'Pendientes consignados en los documentos: confirmar su estado antes de la presentación.', '00 · Qué falta / 02 · Evidencias / 03 · Cierre',
'''La documentación enumera pendientes de validación de rama y de merge/publicación; esta presentación no verifica su estado actual. No afirmar que producción esté validada o que el proyecto no esté desplegado solo por esa lista. Reunir por evidencia: ambiente, versión, fecha, responsable, resultado. Funcional+técnico: casos de rol/asignación/observaciones/adjuntos/WordPress móvil. Técnico: cuotas/idempotencia/locks, ACL respuesta perdida, instalación compatible/rechazo sin tocar producción. TI: MFA/OAuth/IAM/SQL/región/cifrado/firewall/Drive. Técnico+funcional: primera copia/restauración ≤4h medida. Legal/funcional: finalidad, consentimiento, tercero receptor, retención y eventos. Build/lint no prueban OAuth/Gmail/Drive/WordPress ni cumplimiento. Capturas redactadas sin credenciales/documentos reales.''')
s.row(224,'Funcional + técnico','Validar permisos, flujo, concurrencia y comportamiento de integraciones.',80)
s.row(320,'TI / Seguridad','Acreditar MFA, privilegios SQL/IAM, Drive, cifrado y firewall.',80)
s.row(416,'Custodia + aceptación','Medir restauración y aprobar consentimiento, conservación y auditoría.',80)
s.band('Registrar ambiente, versión, fecha, responsable y resultado; adjuntar evidencia sin secretos.')

s = Slide('17 · Cierre', 'Tres ideas para recordar', 'Una operación coordinada, una seguridad verificable y una recuperación que debe ensayarse.', '00 · Responsables / 01–04 · Síntesis',
'''Cerrar reiterando: roles y responsabilidad personal, evidencia de controles compartidos, respaldo manual con ensayo pendiente. Contacto funcional Jullisa del Pilar Falla Aguirre, coordinadora Fondo Editorial, jfalla@continental.edu.pe. Técnico Fredy Paolo Romero Espinoza, asistente Plataformas Hub de Información y Fondo Editorial, fromeror@continental.edu.pe. Documentos completos en docs/00-inicio.md, docs/01-arquitectura.md, docs/02-seguridad.md, docs/03-operacion-y-cierre.md y docs/04-guia-de-uso.md. No se ejecutaron pruebas operativas, consultas a BD ni envíos para elaborar esta presentación.''')
for i,(t,b) in enumerate([('01 · Responsabilidad','Cada caso tiene un responsable personal.'),('02 · Trazabilidad','Los cambios dejan historial; TI completa las evidencias.'),('03 · Continuidad','Copia semanal y restauración medida para recuperar.')]):
    s.text(48,228+i*96,324,40,t,24,C['accent'],True)
    s.text(396,232+i*96,804,56,b,23)
s.rect(48,540,1184,104,C['soft'],radius=4)
s.text(68,552,560,32,'Funcional · Jullisa del Pilar Falla Aguirre',18,bold=True)
s.text(68,592,560,28,'jfalla@continental.edu.pe',18,C['muted'])
s.text(656,552,552,32,'Técnico · Fredy Paolo Romero Espinoza',18,bold=True)
s.text(656,592,552,28,'fromeror@continental.edu.pe',18,C['muted'])


def wrapped(e):
    # Reserva de anchura conservadora compartida por PowerPoint y SVG.
    limit = max(1, int(e['w']/(e['size']*.56)))
    return [line for para in e['text'].split('\n') for line in (textwrap.wrap(para, limit, break_long_words=False, break_on_hyphens=False) or [''])]


def svg_slide(s, index):
    svg=[f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}" role="img" aria-labelledby="slide-{index}-title slide-{index}-desc"><title id="slide-{index}-title">{escape(s.section)}</title><desc id="slide-{index}-desc">{escape(s.elements[3]["text"] if s.elements[3]["type"]=="text" else s.section)}</desc><defs><marker id="arrow-{index}" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto"><path d="M0 0L8 4L0 8" fill="#{C["muted"]}"/></marker></defs>']
    for e in s.elements:
        if e['type']=='rect':
            svg.append(f'<rect x="{e["x"]}" y="{e["y"]}" width="{e["w"]}" height="{e["h"]}" rx="{e["radius"]}" fill="#{e["fill"]}" stroke="#{e["stroke"] or e["fill"]}"/>')
        elif e['type']=='line':
            p=e['points']
            # Esquinas redondeadas en los recorridos ortogonales.
            d=f'M {p[0][0]} {p[0][1]}'
            for j in range(1,len(p)-1):
                a,b,c=p[j-1],p[j],p[j+1]
                r=min(8,abs(b[0]-a[0])+abs(b[1]-a[1]),abs(c[0]-b[0])+abs(c[1]-b[1]))
                def towards(a,b,r):
                    dist=abs(b[0]-a[0])+abs(b[1]-a[1])
                    return (a[0]+(b[0]-a[0])*r/dist,a[1]+(b[1]-a[1])*r/dist)
                pre=towards(b,a,r); post=towards(b,c,r)
                d+=f' L {pre[0]} {pre[1]} Q {b[0]} {b[1]} {post[0]} {post[1]}'
            d+=f' L {p[-1][0]} {p[-1][1]}'
            svg.append(f'<path d="{d}" fill="none" stroke="#{e["color"]}" stroke-width="2"'+(' stroke-dasharray="6 4"' if e['dash'] else '')+(f' marker-end="url(#arrow-{index})"' if e['arrow'] else '')+'/>')
        else:
            x=e['x']+ (e['w'] if e['align']=='right' else e['w']/2 if e['align']=='center' else 0)
            anchor={'left':'start','right':'end','center':'middle'}[e['align']]
            lines=wrapped(e)
            svg.append(f'<text font-family="Inter, Arial, sans-serif" font-size="{e["size"]}" font-weight="{700 if e["bold"] else 400}" fill="#{e["color"]}" text-anchor="{anchor}">')
            for j,line in enumerate(lines):
                svg.append(f'<tspan x="{x}" y="{e["y"]+e["size"]+j*e["size"]*1.22}">{escape(line)}</tspan>')
            svg.append('</text>')
    return ''.join(svg)+'</svg>'


# La exportación PPTX usa PptxGenJS: evita construir manualmente el paquete Office.
# Preparar la herramienta fuera de las dependencias de la aplicación:
# pnpm --dir /tmp/fec-pptx-tools add pptxgenjs@4.0.1
# python3 src/assets/presentacion/generate.py --pptxgenjs /tmp/fec-pptx-tools/node_modules/pptxgenjs

def make_pptx(module_path):
    import subprocess
    path = OUT / 'gestor-pedidos-presentacion.pptx'
    slides = []
    for s in SLIDES:
        elements = [dict(e, lines=wrapped(e)) if e['type'] == 'text' else e for e in s.elements]
        slides.append(dict(elements=elements, notes=s.notes + '\nFuente: ' + s.source))
    model = dict(output=str(path), slides=slides)
    subprocess.run(['node', str(Path(__file__).with_name('generate-pptx.mjs')), module_path],
                   input=json.dumps(model), text=True, check=True)
    return path


def make_html():
    font=ROOT/'node_modules/@fontsource-variable/inter/files/inter-latin-wght-normal.woff2'
    fontcss=''
    if font.exists(): fontcss="@font-face{font-family:Inter;src:url(data:font/woff2;base64,"+base64.b64encode(font.read_bytes()).decode()+") format('woff2');font-weight:100 900;}"
    style=fontcss+'''*{box-sizing:border-box}body{margin:0;background:#eeebf2;color:#25202d;font-family:Inter,Arial,sans-serif}header{position:sticky;top:0;z-index:2;background:white;border-bottom:1px solid #ddd7e5;padding:12px 24px;display:flex;align-items:center;gap:16px;flex-wrap:wrap}header span{margin-right:auto;font-weight:600}button,select{font:inherit;background:white;border:1px solid #ddd7e5;padding:8px 12px;border-radius:4px;cursor:pointer}button:focus-visible,select:focus-visible{outline:3px solid #6802c1}main{max-width:1328px;margin:auto;padding:24px}article{margin-bottom:32px}svg{display:block;width:100%;height:auto;background:white}details{background:white;padding:16px 24px;line-height:1.6}summary{cursor:pointer;color:#6802c1}details p{max-width:1000px}.present article{display:none}.present article.active{display:block}.present main{max-width:none;height:calc(100vh - 72px);display:grid;place-items:center;padding:12px}.present article.active{width:min(100%,calc((100vh - 104px)*16/9));margin:0}.present details{display:none}@media print{@page{size:landscape;margin:0}header,details{display:none!important}body,main{margin:0;padding:0;background:white;max-width:none}article,.present article{display:block!important;break-after:page;break-inside:avoid;margin:0}svg{width:100vw;height:100vh}}'''
    articles=[]
    for i,s in enumerate(SLIDES,1):
        articles.append(f'<article id="diapositiva-{i}" class="{"active" if i==1 else ""}">{svg_slide(s,i)}<details><summary>Notas del presentador · {i:02d}</summary><p>{escape(s.notes)}</p></details></article>')
    options=''.join(f'<option value="{i}">{i:02d} · {escape(s.section)}</option>' for i,s in enumerate(SLIDES,1))
    script='''let current=1;const slides=[...document.querySelectorAll('article')], sel=document.querySelector('select');function go(n){current=Math.max(1,Math.min(slides.length,n));slides.forEach((s,i)=>s.classList.toggle('active',i===current-1));sel.value=current;if(!document.body.classList.contains('present'))slides[current-1].scrollIntoView({block:'start'});}document.querySelector('#prev').onclick=()=>go(current-1);document.querySelector('#next').onclick=()=>go(current+1);sel.onchange=()=>go(+sel.value);document.querySelector('#mode').onclick=()=>{document.body.classList.toggle('present');go(current)};document.addEventListener('keydown',e=>{if(e.target.matches('select,button'))return;if(e.key==='ArrowRight'||e.key==='PageDown'){e.preventDefault();go(current+1)}if(e.key==='ArrowLeft'||e.key==='PageUp'){e.preventDefault();go(current-1)}if(e.key==='Escape')document.body.classList.remove('present')});'''
    (OUT/'gestor-pedidos-vista-previa.html').write_text('<!doctype html><html lang="es"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Gestor de pedidos · Presentación</title><style>'+style+'</style><body><header><span>Fondo Editorial Continental · 18 diapositivas</span><button id="prev" aria-label="Diapositiva anterior">←</button><select aria-label="Ir a diapositiva">'+options+'</select><button id="next" aria-label="Diapositiva siguiente">→</button><button id="mode">Alternar modo presentación</button></header><main>'+''.join(articles)+'</main><script>'+script+'</script></body></html>',encoding='utf-8')


if __name__=='__main__':
    import argparse
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--pptxgenjs', default='pptxgenjs', help='Ruta al módulo PptxGenJS 4.0.1')
    args = parser.parse_args()
    assert len(SLIDES)==18
    # Comprobaciones del artefacto, sin suites ni interacción con la aplicación.
    for i,s in enumerate(SLIDES,1):
        for e in s.elements:
            if e['type']=='text':
                height=len(wrapped(e))*e['size']*1.22
                if height>e['h']+5: print(f'Revisar altura: diapositiva {i}, {e["text"]!r}: {height:.0f} > {e["h"]}')
    print(make_pptx(args.pptxgenjs).relative_to(ROOT))
    make_html()
    (Path('/tmp')/'fec-presentacion-slides.json').write_text(json.dumps([svg_slide(s,i) for i,s in enumerate(SLIDES,1)]))
    print((OUT/'gestor-pedidos-vista-previa.html').relative_to(ROOT))
