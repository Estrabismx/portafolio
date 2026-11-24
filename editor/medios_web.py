"""
VERSIONES LIVIANAS DE LA GALERÍA PARA LA WEB — Editor de Portafolio
====================================================================

Los archivos originales de cada proyecto NO se tocan. Junto a ellos se generan:

  assets/proyecto-XX/web/   versión para mostrar en la web
                              · fotos (jpg, png, webp) → WebP de máximo 1600 px (planos: 2400 px)
                              · GIF animados          → MP4 (mucho más liviano)
  assets/proyecto-XX/min/   miniatura WebP de máximo 256 px (de GIF y videos, un fotograma)

(El ícono SVG del teleprompter se usa tal cual: Illustrator lo escribe con coordenadas
relativas encadenadas y redondearlas deforma el dibujo.)

La web (main.js) usa estas versiones y, si alguna falta, carga el original.
El editor las genera solo al guardar. También se puede correr a mano:

    py editor/medios_web.py            todos los proyectos
    py editor/medios_web.py 03 05      solo esos proyectos
    py editor/medios_web.py --todo     rehace todo aunque ya exista
"""

import json
import os
import shutil
import subprocess
import sys
from pathlib import Path

from PIL import Image, ImageOps

RAIZ = Path(__file__).resolve().parent.parent
ARCHIVO_DATOS = RAIZ / 'proyectos.js'
ASSETS = RAIZ / 'assets'

EXT_FOTO = {'.jpg', '.jpeg', '.png', '.webp'}
EXT_VIDEO = {'.mp4', '.webm', '.mov', '.m4v', '.ogv'}

WEB_LADO, WEB_CALIDAD = 1600, 82              # fotos
WEB_LADO_PLANO, WEB_CALIDAD_PLANO = 2400, 90  # planos y láminas (líneas finas)
MIN_LADO, MIN_CALIDAD = 256, 72               # miniaturas
GIF_MAX_ANCHO, GIF_CRF = 1280, 26             # GIF → MP4

REGISTRO = '.fuentes.json'   # en cada carpeta: de qué original (tamaño y fecha) salió cada archivo
SIN_CONSOLA = getattr(subprocess, 'CREATE_NO_WINDOW', 0)


def buscar_ffmpeg():
    ffmpeg = shutil.which('ffmpeg')
    if not ffmpeg:  # instalación de winget aún no cargada en el PATH
        base = Path(os.environ.get('LOCALAPPDATA', '')) / 'Microsoft' / 'WinGet' / 'Packages'
        encontrados = sorted(base.glob('Gyan.FFmpeg*/*/bin/ffmpeg.exe')) if base.exists() else []
        ffmpeg = str(encontrados[-1]) if encontrados else None
    return ffmpeg


FFMPEG = buscar_ffmpeg()


def cargar_proyectos():
    texto = ARCHIVO_DATOS.read_text(encoding='utf-8')
    inicio = texto.index('[', texto.index('const PROYECTOS'))
    return json.loads(texto[inicio:texto.rindex(']') + 1])


def es_plano(ruta):
    """Planos y láminas: imágenes casi todo fondo claro con líneas finas (igual que el editor)."""
    try:
        with Image.open(ruta) as im:
            im.draft('L', (400, 400))
            gris = im.convert('L')
            gris.thumbnail((300, 300))
            histograma = gris.histogram()
            return sum(histograma[230:]) / max(1, sum(histograma)) > 0.6
    except Exception:
        return False


# ---------------- Conversiones ----------------

def guardar_webp(origen, destino, lado, calidad):
    with Image.open(origen) as im:
        im.seek(0)                       # GIF: primer fotograma
        im = ImageOps.exif_transpose(im)  # fotos de celular giradas
        im.thumbnail((lado, lado), Image.Resampling.LANCZOS)
        if im.mode not in ('RGB', 'RGBA'):
            im = im.convert('RGBA' if 'transparency' in im.info or im.mode in ('LA', 'PA') else 'RGB')
        im.save(destino, 'WEBP', quality=calidad, method=6)


def gif_a_mp4(origen, destino):
    if not FFMPEG:
        raise RuntimeError('ffmpeg no está instalado')
    resultado = subprocess.run(
        [FFMPEG, '-y', '-v', 'error', '-i', str(origen),
         '-vf', f"scale='trunc(min({GIF_MAX_ANCHO},iw)/2)*2':-2,format=yuv420p",
         '-c:v', 'libx264', '-crf', str(GIF_CRF), '-preset', 'slow', '-movflags', '+faststart', '-an',
         str(destino)],
        capture_output=True, text=True, creationflags=SIN_CONSOLA)
    if resultado.returncode != 0:
        raise RuntimeError(resultado.stderr.strip()[-300:] or 'ffmpeg no pudo convertir el GIF')


def miniatura_de_video(origen, destino):
    if not FFMPEG:
        raise RuntimeError('ffmpeg no está instalado')
    resultado = subprocess.run(
        [FFMPEG, '-y', '-v', 'error', '-ss', '0.5', '-i', str(origen), '-frames:v', '1',
         '-vf', f"scale='min({MIN_LADO},iw)':-2", '-c:v', 'libwebp', '-quality', str(MIN_CALIDAD),
         str(destino)],
        capture_output=True, text=True, creationflags=SIN_CONSOLA)
    if resultado.returncode != 0:
        raise RuntimeError(resultado.stderr.strip()[-300:] or 'ffmpeg no pudo extraer un fotograma')


# ---------------- Por proyecto ----------------

def tareas_de(p):
    """(origen, destino, función) de todo lo que se genera para un proyecto."""
    carpeta = ASSETS / f'proyecto-{p["id"]}'
    web, mini = carpeta / 'web', carpeta / 'min'
    tareas = []
    for g in p.get('galeria', []):
        origen = carpeta / g['archivo']
        ext, base = origen.suffix.lower(), origen.stem
        if ext in EXT_FOTO:
            plano = g['plano'] if 'plano' in g else None
            def foto(o, d, plano=plano):
                es = es_plano(o) if plano is None else plano
                guardar_webp(o, d, *((WEB_LADO_PLANO, WEB_CALIDAD_PLANO) if es else (WEB_LADO, WEB_CALIDAD)))
            tareas.append((origen, web / f'{base}.webp', foto))
            tareas.append((origen, mini / f'{base}.webp', lambda o, d: guardar_webp(o, d, MIN_LADO, MIN_CALIDAD)))
        elif ext == '.gif':
            tareas.append((origen, web / f'{base}.mp4', gif_a_mp4))
            tareas.append((origen, mini / f'{base}.webp', lambda o, d: guardar_webp(o, d, MIN_LADO, MIN_CALIDAD)))
        elif ext in EXT_VIDEO:
            tareas.append((origen, mini / f'{base}.webp', miniatura_de_video))
    return carpeta, tareas


def huella(ruta):
    estado = ruta.stat()
    return [ruta.name, estado.st_size, estado.st_mtime_ns]


def leer_registro(carpeta):
    try:
        return json.loads((carpeta / REGISTRO).read_text(encoding='utf-8'))
    except (OSError, ValueError):
        return {}


def generar_proyecto(p, rehacer=False, avisar=print):
    """Genera lo que falte o esté desactualizado y borra versiones que ya no corresponden
    a ningún archivo de la galería. Devuelve una lista de avisos (errores)."""
    carpeta, tareas = tareas_de(p)
    avisos = []
    esperados = {}
    for origen, destino, funcion in tareas:
        esperados.setdefault(destino.parent, set()).add(destino.name)
        if not origen.exists():
            continue
        registro = leer_registro(destino.parent)
        if not rehacer and destino.exists() and registro.get(destino.name) == huella(origen):
            continue
        destino.parent.mkdir(exist_ok=True)
        temporal = destino.with_name(f'.tmp_{destino.name}')
        avisar(f'proyecto-{p["id"]}: {origen.name} -> {destino.parent.name}/{destino.name}')
        try:
            funcion(origen, temporal)
            os.replace(temporal, destino)
        except Exception as error:
            temporal.unlink(missing_ok=True)
            avisos.append(f'{origen.name}: {error}')
            continue
        registro[destino.name] = huella(origen)
        (destino.parent / REGISTRO).write_text(json.dumps(registro, indent=1), encoding='utf-8')

    # Limpieza: solo dentro de web/ y min/ (nunca los originales)
    for sub in (carpeta / 'web', carpeta / 'min'):
        if not sub.is_dir():
            continue
        validos = esperados.get(sub, set())
        registro = leer_registro(sub)
        for archivo in sub.iterdir():
            if archivo.name != REGISTRO and archivo.name not in validos:
                archivo.unlink()
                registro.pop(archivo.name, None)
        registro = {k: v for k, v in registro.items() if k in validos}
        if validos:
            (sub / REGISTRO).write_text(json.dumps(registro, indent=1), encoding='utf-8')
        else:
            shutil.rmtree(sub, ignore_errors=True)
    return avisos


def generar(ids=None, rehacer=False, avisar=print):
    avisos = []
    for p in cargar_proyectos():
        if not ids or p['id'] in ids:
            avisos += generar_proyecto(p, rehacer, avisar)
    return avisos


if __name__ == '__main__':
    argumentos = [a for a in sys.argv[1:] if not a.startswith('--')]
    problemas = generar(set(argumentos) or None, rehacer='--todo' in sys.argv)
    for aviso in problemas:
        print('AVISO:', aviso)
    print('Listo.' if not problemas else f'Listo, con {len(problemas)} aviso(s).')
