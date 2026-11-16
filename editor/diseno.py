"""
DISEÑO DEL SITIO — Editor de Portafolio
=======================================

Lee y escribe  diseno.css  (carpeta principal del sitio). Ese archivo se carga
después de style.css y cambia sus variables (colores, tamaños, medidas) más
el orden y la visibilidad de las secciones, sin tocar style.css.

Los valores elegidos se guardan dentro de diseno.css en un comentario
(/* DISENO {...} */) para que el editor pueda leerlos de vuelta.
"""

import copy
import json
import re
from pathlib import Path
from urllib.parse import quote_plus

# Valores originales del sitio (los mismos que style.css)
DISENO_INICIAL = {
    'colores': {'crema': '#EEDBBF', 'escarlata': '#AB3130', 'rojo_oscuro': '#67191F', 'fondo': '#121212'},
    'fuente_titulos': 'VT323',
    'fuente_texto': 'Roboto Mono',
    'escala_texto': 100,        # %
    'tam_logo': 42,             # px
    'tam_titulos': 32,
    'tam_statement': 22,
    'sidebar_lado': 'izquierda',   # izquierda | derecha | oculta
    'sidebar_ancho': 250,
    'orden_sidebar': ['browse', 'links', 'status', 'contact'],
    'ocultos_sidebar': [],
    'orden_portada': ['statement', 'projects', 'about'],
    'ocultos_portada': [],
    'alto_carrusel': 400,
    'alto_anillo': 460,
    'alto_visor': 420,
    'espacio_secciones': 50,
    'margen_interior': 20,
    'grosor_bordes': 4,
    'ancho_maximo': 1600,
}

NOMBRES_COLORES = {
    'crema': 'Crema (texto)', 'escarlata': 'Escarlata (acento)',
    'rojo_oscuro': 'Rojo oscuro (bordes)', 'fondo': 'Fondo',
}
VARIABLES_COLORES = {'crema': '--cream', 'escarlata': '--scarlet', 'rojo_oscuro': '--deep-red', 'fondo': '--midnight'}

NOMBRES_SIDEBAR = {'browse': 'Browse by type', 'links': 'Quick links', 'status': 'System status',
                   'contact': 'Establecer conexión'}
NOMBRES_PORTADA = {'statement': 'Statement (frases)', 'projects': 'Proyectos (carrusel)', 'about': 'Sobre mí'}

# Fuentes de Google disponibles: nombre → (grosores, familia de respaldo)
FUENTES_TITULOS = {
    'VT323': ('400', 'monospace'),
    'Press Start 2P': ('400', 'monospace'),
    'Silkscreen': ('400;700', 'monospace'),
    'Pixelify Sans': ('400;700', 'sans-serif'),
    'Space Mono': ('400;700', 'monospace'),
    'Roboto Mono': ('400;700', 'monospace'),
}
FUENTES_TEXTO = {
    'Roboto Mono': ('400;700', 'monospace'),
    'Space Mono': ('400;700', 'monospace'),
    'IBM Plex Mono': ('400;700', 'monospace'),
    'JetBrains Mono': ('400;700', 'monospace'),
    'Courier Prime': ('400;700', 'monospace'),
    'Inter': ('400;700', 'sans-serif'),
}
FUENTES_YA_CARGADAS = {'VT323', 'Roboto Mono'}   # las enlaza cada página en su <head>

# Rangos de los deslizadores: clave → (nombre, mínimo, máximo, unidad)
RANGOS = {
    'escala_texto': ('Texto general', 80, 150, '%'),
    'tam_titulos': ('Títulos de sección', 20, 60, 'px'),
    'tam_logo': ('Logo', 24, 72, 'px'),
    'tam_statement': ('Frases del statement', 14, 36, 'px'),
    'sidebar_ancho': ('Ancho de la barra lateral', 180, 400, 'px'),
    'alto_carrusel': ('Carrusel de la portada', 250, 700, 'px'),
    'alto_anillo': ('Anillo 3D (proyectos)', 300, 800, 'px'),
    'alto_visor': ('Visor del proyecto', 300, 700, 'px'),
    'espacio_secciones': ('Espacio entre secciones', 10, 100, 'px'),
    'margen_interior': ('Margen interior', 8, 60, 'px'),
    'grosor_bordes': ('Grosor de los bordes', 1, 8, 'px'),
    'ancho_maximo': ('Ancho máximo de la página', 900, 2400, 'px'),
}

MARCA = re.compile(r'/\* DISENO (\{.*?\}) \*/', re.S)


def completar(datos):
    """Mezcla lo guardado con los valores iniciales (por si faltan claves o hay claves viejas)."""
    d = copy.deepcopy(DISENO_INICIAL)
    for clave, valor in (datos or {}).items():
        if clave == 'colores' and isinstance(valor, dict):
            d['colores'].update({k: v for k, v in valor.items() if k in d['colores']})
        elif clave in d:
            d[clave] = valor
    # Listas de orden: mantener solo claves válidas y agregar las que falten
    for orden, nombres in (('orden_sidebar', NOMBRES_SIDEBAR), ('orden_portada', NOMBRES_PORTADA)):
        lista = [k for k in d[orden] if k in nombres]
        d[orden] = lista + [k for k in nombres if k not in lista]
    return d


def leer_diseno(ruta):
    try:
        coincidencia = MARCA.search(Path(ruta).read_text(encoding='utf-8'))
        return completar(json.loads(coincidencia.group(1)) if coincidencia else None)
    except (OSError, ValueError):
        return completar(None)


def familia(nombre, fuentes):
    respaldo = fuentes.get(nombre, ('400', 'monospace'))[1]
    return f"'{nombre}', {respaldo}"


def generar_css(d):
    d = completar(d)
    lineas = []

    # Fuentes nuevas de Google (el @import debe ir al principio)
    importar = []
    for nombre, fuentes in ((d['fuente_titulos'], FUENTES_TITULOS), (d['fuente_texto'], FUENTES_TEXTO)):
        if nombre not in FUENTES_YA_CARGADAS and nombre in fuentes:
            grosores = fuentes[nombre][0]
            parametro = quote_plus(nombre) + (f':wght@{grosores}' if ';' in grosores else '')
            if parametro not in importar:
                importar.append(parametro)
    if importar:
        url = 'https://fonts.googleapis.com/css2?' + '&'.join(f'family={f}' for f in importar) + '&display=swap'
        lineas.append(f"@import url('{url}');")

    lineas += [
        '/* =====================================================================',
        '   DISEÑO DEL SITIO — lo genera el Editor de Portafolio (pestaña "Diseño").',
        '   No hace falta editarlo a mano: cambia los valores en el editor.',
        '   ===================================================================== */',
        f'/* DISENO {json.dumps(d, ensure_ascii=False)} */',
        '',
        ':root {',
    ]
    for clave, variable in VARIABLES_COLORES.items():
        lineas.append(f'  {variable}: {d["colores"][clave]};')
    lineas += [
        f'  --font-display: {familia(d["fuente_titulos"], FUENTES_TITULOS)};',
        f'  --font-text: {familia(d["fuente_texto"], FUENTES_TEXTO)};',
        f'  --text-scale: {d["escala_texto"] / 100:g};',
        f'  --font-logo: {d["tam_logo"]}px;',
        f'  --font-title: {d["tam_titulos"]}px;',
        f'  --font-statement: {d["tam_statement"]}px;',
        f'  --sidebar-width: {d["sidebar_ancho"]}px;',
        f'  --page-max: {d["ancho_maximo"]}px;',
        f'  --layout-padding: {d["margen_interior"]}px;',
        f'  --section-gap: {d["espacio_secciones"]}px;',
        f'  --border-width: {d["grosor_bordes"]}px;',
        f'  --carousel-height: {d["alto_carrusel"]}px;',
        f'  --ring-height: {d["alto_anillo"]}px;',
        f'  --detail-height: {d["alto_visor"]}px;',
        '}',
        '',
    ]

    # Barra lateral: lado
    if d['sidebar_lado'] == 'derecha':
        lineas += ['/* Barra lateral a la derecha (en celular sigue arriba) */',
                   '@media (min-width: 901px) {', '  .main-layout { flex-direction: row-reverse; }', '}', '']
    elif d['sidebar_lado'] == 'oculta':
        lineas += ['/* Barra lateral oculta */', '.sidebar { display: none; }', '']

    # Barra lateral: orden y visibilidad de los módulos
    lineas.append('/* Módulos de la barra lateral: orden y visibilidad */')
    for posicion, clave in enumerate(d['orden_sidebar']):
        regla = 'display: none;' if clave in d['ocultos_sidebar'] else f'order: {posicion};'
        lineas.append(f'.sidebar-module[data-module="{clave}"] {{ {regla} }}')
    lineas.append('')

    # Portada: orden y visibilidad de las secciones (solo index.html)
    lineas.append('/* Secciones de la portada: orden y visibilidad */')
    visibles = [k for k in d['orden_portada'] if k not in d['ocultos_portada']]
    for posicion, clave in enumerate(d['orden_portada']):
        selector = f'body[data-page="index"] #{clave}'
        if clave in d['ocultos_portada']:
            lineas.append(f'{selector} {{ display: none; }}')
        elif clave == 'statement':
            # El statement tiene su propio recuadro: solo cambia de lugar
            lineas.append(f'{selector} {{ order: {posicion}; }}')
        else:
            # La línea punteada separa secciones: la última visible no la lleva
            borde = ('border-bottom: none; padding-bottom: 0;' if clave == visibles[-1]
                     else 'border-bottom: 2px dashed var(--deep-red); padding-bottom: 30px;')
            lineas.append(f'{selector} {{ order: {posicion}; {borde} }}')
    lineas.append('')
    return '\n'.join(lineas)


def escribir_diseno(ruta, d):
    ruta = Path(ruta)
    temporal = ruta.with_name(ruta.name + '.tmp')
    temporal.write_text(generar_css(d), encoding='utf-8')
    temporal.replace(ruta)
