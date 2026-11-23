"""
DISEÑO DEL SITIO — Editor de Portafolio
=======================================

Lee y escribe  diseno.css  (carpeta principal del sitio). Ese archivo se carga
después de style.css y cambia sus variables (colores, tamaños, medidas)
sin tocar style.css.

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
    'colores': {'crema': '#EEDBBF', 'escarlata': '#F20530', 'rojo_oscuro': '#8C0B3B', 'ambar': '#F29F05',
                'ambar_detalle': '#F28907', 'fondo': '#0C1226', 'paneles': '#070B17'},
    'fuente_titulos': 'VT323',
    'fuente_texto': 'Roboto Mono',
    'escala_texto': 100,        # %
    'tam_logo': 42,             # px
    'tam_titulos': 32,
    'tam_statement': 22,
    'alto_visor': 420,
    'espacio_secciones': 50,
    'margen_interior': 20,
    'grosor_bordes': 4,
    'ancho_maximo': 1600,
}

NOMBRES_COLORES = {
    'crema': 'Texto', 'escarlata': 'Color principal',
    'rojo_oscuro': 'Detalles del principal (rellenos, sombras)',
    'ambar': 'Elementos llamativos (hover, indicadores)',
    'ambar_detalle': 'Detalles llamativos (bordes secundarios)',
    'fondo': 'Fondo', 'paneles': 'Paneles',
}
VARIABLES_COLORES = {'crema': '--cream', 'escarlata': '--scarlet', 'rojo_oscuro': '--deep-red', 'ambar': '--amber',
                     'ambar_detalle': '--amber-deep', 'fondo': '--midnight', 'paneles': '--black'}


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
    'tam_statement': ('Texto de la portada', 14, 36, 'px'),
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
        f'  --page-max: {d["ancho_maximo"]}px;',
        f'  --layout-padding: {d["margen_interior"]}px;',
        f'  --section-gap: {d["espacio_secciones"]}px;',
        f'  --border-width: {d["grosor_bordes"]}px;',
        f'  --detail-height: {d["alto_visor"]}px;',
        '}',
        '',
    ]
    return '\n'.join(lineas)


def escribir_diseno(ruta, d):
    ruta = Path(ruta)
    temporal = ruta.with_name(ruta.name + '.tmp')
    temporal.write_text(generar_css(d), encoding='utf-8')
    temporal.replace(ruta)
