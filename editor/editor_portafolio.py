"""
EDITOR DE PORTAFOLIO — Estrabismx 98
=====================================

Programa con ventanas para cargar y editar los proyectos del portafolio
sin tocar código.

  - Lee y escribe  proyectos.js  (en la carpeta principal del sitio).
  - Copia las imágenes y videos a  assets/proyecto-XX/  con nombres
    ordenados (proyecto_07a.jpg, proyecto_07b.mp4, ...).
  - Reduce automáticamente las fotos pesadas.
  - NO sube nada a GitHub: el commit lo haces tú (por ejemplo con GitHub Desktop).

Cómo abrirlo: doble clic en  abrir_editor.bat  (en esta misma carpeta).
"""

import copy
import hashlib
import json
import os
import queue
import re
import shutil
import subprocess
import sys
import tempfile
import threading
import webbrowser
from pathlib import Path
import tkinter as tk
from tkinter import ttk, filedialog, messagebox, colorchooser, simpledialog

try:
    from PIL import Image, ImageOps, ImageTk
except ImportError:
    tk.Tk().withdraw()
    messagebox.showerror(
        'Falta Pillow',
        'Falta instalar la librería Pillow.\n\nAbre una terminal en la carpeta "editor" y ejecuta:\n\n'
        'python -m pip install -r requirements.txt')
    sys.exit(1)

try:
    from tkinterdnd2 import TkinterDnD, DND_FILES
    HAY_ARRASTRE = True
except ImportError:
    HAY_ARRASTRE = False


# ---------------------------------------------------------------------------
# Configuración
# ---------------------------------------------------------------------------

RAIZ = Path(__file__).resolve().parent.parent      # carpeta del sitio
ARCHIVO_DATOS = RAIZ / 'proyectos.js'
ASSETS = RAIZ / 'assets'

EXT_IMAGEN = {'.jpg', '.jpeg', '.png', '.webp', '.gif'}
EXT_VIDEO = {'.mp4', '.webm', '.mov', '.m4v', '.ogv'}
EXT_COMPRIMIBLE = {'.jpg', '.jpeg', '.png', '.webp'}   # los GIF y videos se copian tal cual
EXT_ICONO = {'.svg', '.png', '.jpg', '.jpeg', '.webp', '.gif'}

MAX_LADO = 1600                      # px: lado más largo de las fotos optimizadas
UMBRAL_PESO = 800 * 1024             # fotos de más de 800 KB se optimizan
CALIDAD_JPG = 85
# Planos y láminas (líneas finas): se conserva más resolución y calidad
MAX_LADO_PLANO = 3000
CALIDAD_PLANO = 92
UMBRAL_PESO_PLANO = 2 * 1024 * 1024
VIDEO_AVISO = 50 * 1024 * 1024       # avisar sobre videos de más de 50 MB
VIDEO_MAXIMO = 95 * 1024 * 1024      # GitHub rechaza archivos de más de 100 MB
GIF_AVISO = 10 * 1024 * 1024

# Compresión de videos con ffmpeg
VIDEO_MAX_ANCHO = 1280               # px
VIDEO_CRF = 26                       # calidad H.264 (más bajo = mejor calidad y más peso)
VIDEO_BITRATE_ALTO = 3_000_000       # bits/s: videos por encima de esto se recomprimen al "optimizar"

FICHA_INICIAL = {'Herramientas': '', 'Tiempo de Desarrollo': '', 'Materiales': '', 'Origen': ''}

CABECERA = """/* =====================================================================
   PROYECTOS DEL PORTAFOLIO
   Este archivo lo genera el Editor de Portafolio (carpeta editor/).
   Para agregar o cambiar proyectos abre el editor con editor/abrir_editor.bat
   Si lo editas a mano, mantén el formato JSON (comillas dobles, sin comas al final).
   ===================================================================== */
"""

# Orden de los campos al escribir proyectos.js
ORDEN_CAMPOS = ['id', 'titulo', 'icono', 'subtitulo', 'resumen', 'etiquetas', 'curso', 'anio', 'tamano',
                'encabezado', 'tipo', 'objetivo', 'desafio', 'descripcion', 'colores', 'ficha',
                'dificultad', 'galeria']

# Tamaño de las miniaturas de la galería
CELDA_W, CELDA_H = 156, 150
THUMB_W, THUMB_H = 140, 100


# ---------------------------------------------------------------------------
# Utilidades
# ---------------------------------------------------------------------------

def sin_html(texto):
    return re.sub(r'<[^>]+>', '', texto or '').strip()


def letra(i):
    """0 → a, 1 → b ... 25 → z, 26 → aa ..."""
    s = ''
    while True:
        s = chr(97 + i % 26) + s
        i = i // 26 - 1
        if i < 0:
            return s


def formato_peso(bytes_):
    if bytes_ < 1024:
        return f'{bytes_} B'
    if bytes_ < 1024 ** 2:
        return f'{bytes_ / 1024:.0f} KB'
    return f'{bytes_ / 1024 ** 2:.1f} MB'


def carpeta_de(p):
    return ASSETS / f'proyecto-{p["id"]}'


def cargar_proyectos():
    texto = ARCHIVO_DATOS.read_text(encoding='utf-8')
    inicio = texto.index('[', texto.index('const PROYECTOS'))
    fin = texto.rindex(']')
    return json.loads(texto[inicio:fin + 1])


def escribir_proyectos(lista):
    contenido = CABECERA + 'const PROYECTOS = ' + json.dumps(lista, ensure_ascii=False, indent=2) + ';\n'
    temporal = ARCHIVO_DATOS.with_name('proyectos.js.tmp')
    temporal.write_text(contenido, encoding='utf-8')
    os.replace(temporal, ARCHIVO_DATOS)


def limpiar_para_guardar(p):
    """Quita los datos internos del editor y los campos vacíos."""
    salida = {}
    for clave in ORDEN_CAMPOS:
        valor = p.get(clave)
        if clave == 'galeria':
            valor = [dict({'archivo': g['archivo'], 'nombre': g.get('nombre', '')},
                          **({'animacion': True} if g.get('animacion') else {}),
                          **({'plano': bool(g['plano'])} if 'plano' in g else {}))
                     for g in (valor or [])]
        if clave == 'dificultad' and valor and not valor.get('texto') and not valor.get('porcentaje'):
            valor = None
        if clave == 'ficha' and valor:
            valor = {nombre: texto for nombre, texto in valor.items() if str(texto).strip()}
        if valor in (None, '', [], {}):
            continue
        salida[clave] = valor
    salida['id'] = p['id']
    return salida


def es_plano(ruta):
    """Detecta planos y láminas: imágenes casi todo fondo claro con líneas finas."""
    try:
        with Image.open(ruta) as im:
            im.draft('L', (400, 400))
            gris = im.convert('L')
            gris.thumbnail((300, 300))
            histograma = gris.histogram()
            claros = sum(histograma[230:])
            return claros / max(1, sum(histograma)) > 0.6
    except Exception:
        return False


def limites(plano):
    """(lado máximo, peso a partir del cual se optimiza, calidad) según el tipo de imagen."""
    if plano:
        return MAX_LADO_PLANO, UMBRAL_PESO_PLANO, CALIDAD_PLANO
    return MAX_LADO, UMBRAL_PESO, CALIDAD_JPG


def comprimir_imagen(origen, carpeta_destino, base, plano=False):
    """Reduce una foto pesada. Devuelve la ruta nueva, o None si no hacía falta."""
    ext = origen.suffix.lower()
    peso = origen.stat().st_size
    max_lado, umbral, calidad = limites(plano)
    with Image.open(origen) as im:
        if getattr(im, 'is_animated', False):
            return None
        grande = max(im.size) > max_lado
        if not grande and peso <= umbral:
            return None
        im = ImageOps.exif_transpose(im)
        im.thumbnail((max_lado, max_lado), Image.Resampling.LANCZOS)
        transparente = im.mode in ('RGBA', 'LA', 'PA') or (im.mode == 'P' and 'transparency' in im.info)
        if ext == '.webp':
            destino = carpeta_destino / f'{base}.webp'
            im.save(destino, 'WEBP', quality=calidad, method=6)
        elif transparente or (plano and ext == '.png'):
            # Los planos en PNG siguen en PNG: el JPG ensucia los bordes de las líneas
            destino = carpeta_destino / f'{base}.png'
            im.save(destino, 'PNG', optimize=True)
        else:
            destino = carpeta_destino / f'{base}.jpg'
            im.convert('RGB').save(destino, 'JPEG', quality=calidad, optimize=True, progressive=True,
                                   subsampling=0 if plano else 2)
    # Si no se achicó y la foto no era grande, mejor quedarse con el original
    if not grande and destino.stat().st_size >= peso:
        destino.unlink()
        return None
    return destino


# ---------------- ffmpeg (videos y GIF) ----------------

def buscar_ffmpeg():
    """Devuelve (ffmpeg, ffprobe) o (None, None) si no está instalado."""
    ffmpeg = shutil.which('ffmpeg')
    if not ffmpeg:  # instalación de winget aún no cargada en el PATH
        base = Path(os.environ.get('LOCALAPPDATA', '')) / 'Microsoft' / 'WinGet' / 'Packages'
        encontrados = sorted(base.glob('Gyan.FFmpeg*/*/bin/ffmpeg.exe')) if base.exists() else []
        ffmpeg = str(encontrados[-1]) if encontrados else None
    if not ffmpeg:
        return None, None
    ffprobe = Path(ffmpeg).with_name('ffprobe' + Path(ffmpeg).suffix)
    return ffmpeg, (str(ffprobe) if ffprobe.exists() else shutil.which('ffprobe'))


FFMPEG, FFPROBE = buscar_ffmpeg()
SIN_CONSOLA = getattr(subprocess, 'CREATE_NO_WINDOW', 0)   # evita que aparezcan ventanas negras


def info_video(ruta):
    """Ancho, duración (s) y bitrate (bits/s) de un video. Valores en 0 si no se pueden leer."""
    if not FFPROBE:
        return 0, 0.0, 0
    try:
        salida = subprocess.run(
            [FFPROBE, '-v', 'error', '-select_streams', 'v:0', '-show_entries',
             'stream=width:format=duration,bit_rate', '-of', 'json', str(ruta)],
            capture_output=True, text=True, timeout=30, creationflags=SIN_CONSOLA).stdout
        datos = json.loads(salida or '{}')
        ancho = int((datos.get('streams') or [{}])[0].get('width') or 0)
        formato = datos.get('format', {})
        return ancho, float(formato.get('duration') or 0), int(formato.get('bit_rate') or 0)
    except Exception:
        return 0, 0.0, 0


def es_gif_animado(ruta):
    try:
        with Image.open(ruta) as im:
            return getattr(im, 'is_animated', False)
    except Exception:
        return False


def video_necesita_compresion(ruta):
    ancho, _, bitrate = info_video(ruta)
    return ruta.suffix.lower() != '.mp4' or ancho > VIDEO_MAX_ANCHO or bitrate > VIDEO_BITRATE_ALTO


def comprimir_video(origen, destino, sin_audio=False, progreso=None):
    """Convierte a MP4 H.264 para web. 'progreso' recibe un número de 0 a 1."""
    _, duracion, _ = info_video(origen)
    comando = [FFMPEG, '-y', '-hide_banner', '-nostats', '-progress', 'pipe:1', '-i', str(origen),
               '-vf', f"scale='trunc(min({VIDEO_MAX_ANCHO},iw)/2)*2':-2,format=yuv420p",
               '-c:v', 'libx264', '-crf', str(VIDEO_CRF), '-preset', 'slow', '-movflags', '+faststart']
    comando += ['-an'] if sin_audio else ['-c:a', 'aac', '-b:a', '128k']
    comando.append(str(destino))

    proceso = subprocess.Popen(comando, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True,
                               creationflags=SIN_CONSOLA)
    errores = []
    hilo_errores = threading.Thread(target=lambda: errores.extend(proceso.stderr), daemon=True)
    hilo_errores.start()
    for linea in proceso.stdout:
        if progreso and duracion and linea.startswith('out_time_us='):
            try:
                progreso(min(1.0, int(linea.split('=')[1]) / 1_000_000 / duracion))
            except ValueError:
                pass
    proceso.wait()
    hilo_errores.join(timeout=5)
    if proceso.returncode != 0 or not destino.exists():
        destino.unlink(missing_ok=True)
        raise RuntimeError(''.join(errores[-5:]).strip() or 'ffmpeg no pudo convertir el video')


def miniatura_video(ruta):
    """Extrae un fotograma del video para la galería del editor (o None)."""
    if not FFMPEG:
        return None
    clave = hashlib.md5(f'{ruta}{ruta.stat().st_mtime}'.encode()).hexdigest()
    cache = Path(tempfile.gettempdir()) / 'editor_portafolio_miniaturas'
    cache.mkdir(exist_ok=True)
    imagen = cache / f'{clave}.jpg'
    if not imagen.exists():
        subprocess.run([FFMPEG, '-y', '-v', 'error', '-ss', '0.5', '-i', str(ruta), '-frames:v', '1',
                        '-vf', f'scale={THUMB_W * 2}:-2', str(imagen)],
                       capture_output=True, timeout=60, creationflags=SIN_CONSOLA)
    return imagen if imagen.exists() else None


def preparar_archivo(origen, carpeta_destino, base, optimizar, progreso=None, plano=False):
    """Copia (u optimiza) un archivo a la carpeta temporal con su nombre final.
    Devuelve (ruta_final, es_animacion, aviso)."""
    ext = origen.suffix.lower()
    if ext == '.jpeg':
        ext = '.jpg'
    aviso = None

    if optimizar and ext in EXT_COMPRIMIBLE:
        resultado = comprimir_imagen(origen, carpeta_destino, base, plano)
        if resultado:
            return resultado, False, None

    if optimizar and FFMPEG and (ext in EXT_VIDEO or (ext == '.gif' and es_gif_animado(origen))):
        destino = carpeta_destino / f'{base}.mp4'
        es_gif = ext == '.gif'
        if es_gif or video_necesita_compresion(origen):
            try:
                comprimir_video(origen, destino, sin_audio=es_gif, progreso=progreso)
                # Si un MP4 ya liviano no se achicó, se conserva el original
                if ext == '.mp4' and destino.stat().st_size >= origen.stat().st_size:
                    destino.unlink()
                else:
                    return destino, es_gif, None
            except Exception as error:
                aviso = f'{origen.name}: no se pudo comprimir, se copió el original. ({str(error)[:200]})'

    destino = carpeta_destino / f'{base}{ext}'
    shutil.copy2(origen, destino)
    return destino, False, aviso


def abrir_en_navegador(proyecto_id=None):
    """Abre index.html (y el proyecto) en el navegador predeterminado."""
    destino = (RAIZ / 'index.html').as_uri() + (f'#proyecto-{proyecto_id}' if proyecto_id else '')
    # Windows pierde el "#proyecto-XX" al abrir archivos locales, por eso se usa una página puente
    puente = Path(tempfile.gettempdir()) / 'vista_previa_portafolio.html'
    puente.write_text(f'<meta charset="utf-8"><meta http-equiv="refresh" content="0; url={destino}">',
                      encoding='utf-8')
    webbrowser.open(puente.as_uri())


# ---------------------------------------------------------------------------
# Aplicación
# ---------------------------------------------------------------------------

class Editor:

    def __init__(self, root):
        self.root = root
        self.proyectos = []
        self.actual = None              # índice del proyecto seleccionado
        self.cargando = False           # True mientras se llenan los campos (no marca cambios)
        self.sucio = False              # hay cambios sin guardar
        self.carpetas_a_borrar = []
        self.cache_miniaturas = {}
        self.sel_galeria = None
        self.arrastre = None

        try:
            self.proyectos = cargar_proyectos()
        except Exception as error:
            messagebox.showerror('No se pudo leer proyectos.js',
                                 f'Revisa que el archivo exista y tenga formato JSON.\n\n{error}')
            root.destroy()
            return
        for p in self.proyectos:
            self.preparar_en_memoria(p)

        self.construir_interfaz()
        self.refrescar_lista()
        if self.proyectos:
            self.seleccionar_proyecto(0)
        self.actualizar_titulo()

    # ---------------- Datos ----------------

    def preparar_en_memoria(self, p):
        carpeta = carpeta_de(p)
        p.setdefault('galeria', [])
        for g in p['galeria']:
            g['_origen'] = str(carpeta / g['archivo'])
        p['_originales'] = [g['archivo'] for g in p['galeria']]
        p['_modificado'] = False

    def p(self):
        return self.proyectos[self.actual] if self.actual is not None else None

    def marcar_cambio(self, archivos=False):
        if self.cargando or self.p() is None:
            return
        if archivos:
            self.p()['_modificado'] = True
        if not self.sucio:
            self.sucio = True
            self.actualizar_titulo()

    def actualizar_titulo(self):
        self.root.title(('* ' if self.sucio else '') + 'Editor de Portafolio — Estrabismx 98')

    def siguiente_id(self):
        numeros = [int(p['id']) for p in self.proyectos if str(p['id']).isdigit()]
        for carpeta in ASSETS.glob('proyecto-*'):
            sufijo = carpeta.name.split('-', 1)[1]
            if sufijo.isdigit():
                numeros.append(int(sufijo))
        return f'{(max(numeros) if numeros else 0) + 1:02d}'

    # ---------------- Interfaz ----------------

    def construir_interfaz(self):
        root = self.root
        root.geometry('1180x780')
        root.minsize(980, 640)

        estilo = ttk.Style()
        estilo.configure('Titulo.TLabel', font=('Segoe UI', 11, 'bold'))
        estilo.configure('Ayuda.TLabel', foreground='#555555')
        estilo.configure('Guardar.TButton', font=('Segoe UI', 10, 'bold'))

        principal = ttk.Frame(root, padding=8)
        principal.pack(fill='both', expand=True)

        # --- Lista de proyectos (izquierda) ---
        izquierda = ttk.Frame(principal)
        izquierda.pack(side='left', fill='y', padx=(0, 8))
        ttk.Label(izquierda, text='Proyectos', style='Titulo.TLabel').pack(anchor='w')
        ttk.Label(izquierda, text='El orden es el de la carpeta\nProyectos del sitio.',
                  style='Ayuda.TLabel').pack(anchor='w', pady=(0, 4))

        self.lista = tk.Listbox(izquierda, width=30, height=20, activestyle='none', exportselection=False,
                                font=('Segoe UI', 10), selectbackground='#000080')
        self.lista.pack(fill='y', expand=True)
        self.lista.bind('<<ListboxSelect>>', self.al_elegir_en_lista)

        botones = ttk.Frame(izquierda)
        botones.pack(fill='x', pady=4)
        ttk.Button(botones, text='+ Nuevo', command=self.nuevo_proyecto).grid(row=0, column=0, sticky='ew')
        ttk.Button(botones, text='Duplicar', command=self.duplicar_proyecto).grid(row=0, column=1, sticky='ew')
        ttk.Button(botones, text='Eliminar', command=self.eliminar_proyecto).grid(row=0, column=2, sticky='ew')
        ttk.Button(botones, text='▲ Subir', command=lambda: self.mover_proyecto(-1)).grid(row=1, column=0, sticky='ew')
        ttk.Button(botones, text='▼ Bajar', command=lambda: self.mover_proyecto(1)).grid(row=1, column=1, sticky='ew')
        for i in range(3):
            botones.columnconfigure(i, weight=1)

        # --- Pestañas (derecha) ---
        derecha = ttk.Frame(principal)
        derecha.pack(side='left', fill='both', expand=True)

        self.etiqueta_carpeta = ttk.Label(derecha, text='', style='Ayuda.TLabel')
        self.etiqueta_carpeta.pack(anchor='w')

        self.pestanas = ttk.Notebook(derecha)
        self.pestanas.pack(fill='both', expand=True, pady=(2, 0))

        self.vars = {}
        self.construir_general()
        self.construir_carpeta()
        self.construir_especificaciones()
        self.construir_galeria()

        # --- Barra inferior ---
        inferior = ttk.Frame(root, padding=(8, 0, 8, 8))
        inferior.pack(fill='x')
        ttk.Button(inferior, text='💾 Guardar  (Ctrl+S)', style='Guardar.TButton',
                   command=self.guardar).pack(side='left')
        ttk.Button(inferior, text='Guardar y ver en el navegador',
                   command=self.guardar_y_ver).pack(side='left', padx=6)
        self.estado = ttk.Label(inferior, text='', style='Ayuda.TLabel')
        self.estado.pack(side='left', padx=10)
        ttk.Label(inferior, text='Este editor no sube nada a GitHub: después de guardar, haz tú el commit.',
                  style='Ayuda.TLabel').pack(side='right')

        root.bind('<Control-s>', lambda e: self.guardar())
        root.protocol('WM_DELETE_WINDOW', self.al_cerrar)

    def campo(self, padre, fila, etiqueta, clave, ayuda=None):
        ttk.Label(padre, text=etiqueta).grid(row=fila, column=0, sticky='nw', pady=3, padx=(0, 8))
        var = tk.StringVar()
        self.vars[clave] = var
        ttk.Entry(padre, textvariable=var).grid(row=fila, column=1, sticky='ew', pady=3)
        if ayuda:
            ttk.Label(padre, text=ayuda, style='Ayuda.TLabel').grid(row=fila, column=2, sticky='w', padx=6)
        var.trace_add('write', lambda *_: self.al_cambiar_campo(clave))
        return var

    def caja_texto(self, padre, alto):
        marco = ttk.Frame(padre)
        texto = tk.Text(marco, height=alto, wrap='word', font=('Segoe UI', 10), undo=True)
        barra = ttk.Scrollbar(marco, command=texto.yview)
        texto.configure(yscrollcommand=barra.set)
        texto.pack(side='left', fill='both', expand=True)
        barra.pack(side='right', fill='y')
        texto.bind('<<Modified>>', lambda e: self.al_modificar_texto(texto))
        return marco, texto

    # Pestaña General
    def construir_general(self):
        f = ttk.Frame(self.pestanas, padding=10)
        self.pestanas.add(f, text='  General  ')
        f.columnconfigure(1, weight=1)

        self.campo(f, 0, 'Título corto *', 'titulo', 'Nombre del icono y de la ventana')
        self.campo(f, 1, 'Encabezado', 'encabezado', 'Título grande de la pestaña General')
        self.campo(f, 2, 'Tipo', 'tipo')
        self.campo(f, 3, 'Objetivo', 'objetivo')
        self.campo(f, 4, 'Desafío', 'desafio')

        ttk.Label(f, text='Descripción').grid(row=5, column=0, sticky='nw', pady=3)
        marco, self.texto_descripcion = self.caja_texto(f, 10)
        marco.grid(row=5, column=1, columnspan=2, sticky='nsew', pady=3)
        ttk.Label(f, text='Deja una línea en blanco para separar párrafos. Puedes usar <i>cursiva</i> o <b>negrita</b>.',
                  style='Ayuda.TLabel').grid(row=6, column=1, columnspan=2, sticky='w')
        f.rowconfigure(5, weight=1)

        ttk.Label(f, text='Paleta de colores').grid(row=7, column=0, sticky='nw', pady=(10, 3))
        colores = ttk.Frame(f)
        colores.grid(row=7, column=1, columnspan=2, sticky='ew', pady=(10, 3))
        self.lista_colores = tk.Listbox(colores, height=5, width=34, activestyle='none',
                                        font=('Consolas', 10), exportselection=False)
        self.lista_colores.pack(side='left')
        self.lista_colores.bind('<Double-Button-1>', lambda e: self.editar_color())
        bc = ttk.Frame(colores)
        bc.pack(side='left', padx=6, anchor='n')
        ttk.Button(bc, text='+ Agregar color', command=self.agregar_color).pack(fill='x')
        ttk.Button(bc, text='Editar', command=self.editar_color).pack(fill='x')
        ttk.Button(bc, text='Quitar', command=self.quitar_color).pack(fill='x')
        ttk.Button(bc, text='▲', command=lambda: self.mover_color(-1)).pack(fill='x')
        ttk.Button(bc, text='▼', command=lambda: self.mover_color(1)).pack(fill='x')

    # Pestaña Carpeta Proyectos
    def construir_carpeta(self):
        f = ttk.Frame(self.pestanas, padding=10)
        self.pestanas.add(f, text='  Vista en carpeta Proyectos  ')
        f.columnconfigure(1, weight=1)

        ttk.Label(f, text='Así se muestra el proyecto al seleccionarlo en la carpeta "Proyectos" del sitio.',
                  style='Ayuda.TLabel').grid(row=0, column=0, columnspan=3, sticky='w', pady=(0, 6))
        self.campo(f, 1, 'Subtítulo', 'subtitulo')
        ttk.Label(f, text='Resumen').grid(row=2, column=0, sticky='nw', pady=3)
        marco, self.texto_resumen = self.caja_texto(f, 4)
        marco.grid(row=2, column=1, columnspan=2, sticky='ew', pady=3)
        self.campo(f, 3, 'Etiquetas', 'etiquetas', 'Separadas por comas')
        self.campo(f, 4, 'Tipo / curso', 'curso')
        self.campo(f, 5, 'Año', 'anio', 'Ej: 2025-2')
        self.campo(f, 6, 'Tamaño en disco', 'tamano')
        ttk.Button(f, text='Calcular real', command=self.calcular_tamano).grid(row=6, column=2, sticky='w', padx=6)

        ttk.Label(f, text='Icono').grid(row=7, column=0, sticky='nw', pady=(12, 3))
        icono = ttk.Frame(f)
        icono.grid(row=7, column=1, columnspan=2, sticky='w', pady=(12, 3))
        self.vista_icono = tk.Label(icono, width=12, height=6, relief='sunken', bg='white', text='')
        self.vista_icono.pack(side='left')
        lado = ttk.Frame(icono)
        lado.pack(side='left', padx=8, anchor='n')
        self.etiqueta_icono = ttk.Label(lado, text='')
        self.etiqueta_icono.pack(anchor='w')
        ttk.Button(lado, text='Elegir icono…', command=self.elegir_icono).pack(anchor='w', pady=4)
        ttk.Label(lado, text='SVG recomendado (también PNG o JPG).' +
                  ('\nTambién puedes arrastrarlo al recuadro.' if HAY_ARRASTRE else ''),
                  style='Ayuda.TLabel').pack(anchor='w')
        if HAY_ARRASTRE:
            self.vista_icono.drop_target_register(DND_FILES)
            self.vista_icono.dnd_bind('<<Drop>>', self.al_soltar_icono)

    # Pestaña Especificaciones
    def construir_especificaciones(self):
        f = ttk.Frame(self.pestanas, padding=10)
        self.pestanas.add(f, text='  Especificaciones  ')
        f.columnconfigure(0, weight=1)

        ttk.Label(f, text='Ficha técnica', style='Titulo.TLabel').grid(row=0, column=0, sticky='w')
        self.tabla_ficha = ttk.Treeview(f, columns=('nombre', 'valor'), show='headings', height=8,
                                        selectmode='browse')
        self.tabla_ficha.heading('nombre', text='Fila')
        self.tabla_ficha.heading('valor', text='Valor')
        self.tabla_ficha.column('nombre', width=180, stretch=False)
        self.tabla_ficha.grid(row=1, column=0, sticky='nsew', pady=4)
        self.tabla_ficha.bind('<<TreeviewSelect>>', self.al_elegir_fila)

        edicion = ttk.Frame(f)
        edicion.grid(row=2, column=0, sticky='ew')
        edicion.columnconfigure(3, weight=1)
        ttk.Label(edicion, text='Fila').grid(row=0, column=0)
        self.var_fila_nombre = tk.StringVar()
        ttk.Entry(edicion, textvariable=self.var_fila_nombre, width=24).grid(row=0, column=1, padx=4)
        ttk.Label(edicion, text='Valor').grid(row=0, column=2)
        self.var_fila_valor = tk.StringVar()
        ttk.Entry(edicion, textvariable=self.var_fila_valor).grid(row=0, column=3, sticky='ew', padx=4)
        bf = ttk.Frame(f)
        bf.grid(row=3, column=0, sticky='w', pady=4)
        ttk.Button(bf, text='Agregar / actualizar fila', command=self.guardar_fila).pack(side='left')
        ttk.Button(bf, text='Quitar fila', command=self.quitar_fila).pack(side='left', padx=4)
        ttk.Button(bf, text='▲', width=3, command=lambda: self.mover_fila(-1)).pack(side='left')
        ttk.Button(bf, text='▼', width=3, command=lambda: self.mover_fila(1)).pack(side='left')
        ttk.Label(bf, text='Las filas sin valor no se muestran en la web.',
                  style='Ayuda.TLabel').pack(side='left', padx=10)

        ttk.Label(f, text='Dificultad', style='Titulo.TLabel').grid(row=4, column=0, sticky='w', pady=(16, 2))
        dif = ttk.Frame(f)
        dif.grid(row=5, column=0, sticky='w')
        self.var_dif_porcentaje = tk.IntVar()
        self.var_dif_texto = tk.StringVar()
        ttk.Scale(dif, from_=0, to=100, length=260, variable=self.var_dif_porcentaje,
                  command=lambda v: self.al_cambiar_dificultad()).pack(side='left')
        self.etiqueta_porcentaje = ttk.Label(dif, width=6, text='0%')
        self.etiqueta_porcentaje.pack(side='left', padx=4)
        ttk.Label(dif, text='Texto de la barra').pack(side='left', padx=(10, 4))
        ttk.Entry(dif, textvariable=self.var_dif_texto, width=28).pack(side='left')
        self.var_dif_texto.trace_add('write', lambda *_: self.al_cambiar_dificultad())
        f.rowconfigure(1, weight=1)

    # Pestaña Galería
    def construir_galeria(self):
        f = ttk.Frame(self.pestanas, padding=10)
        self.pestanas.add(f, text='  Galería (fotos y videos)  ')

        barra = ttk.Frame(f)
        barra.pack(fill='x')
        ttk.Button(barra, text='+ Agregar archivos…', command=self.elegir_archivos).pack(side='left')
        ttk.Button(barra, text='◀ Mover', command=lambda: self.mover_archivo(-1)).pack(side='left', padx=(10, 0))
        ttk.Button(barra, text='Mover ▶', command=lambda: self.mover_archivo(1)).pack(side='left')
        ttk.Button(barra, text='Poner de portada', command=self.poner_portada).pack(side='left', padx=4)
        ttk.Button(barra, text='Quitar', command=self.quitar_archivo).pack(side='left')
        ttk.Button(barra, text='Optimizar archivos existentes', command=self.optimizar_existentes).pack(side='right')

        ttk.Label(f, text=('Arrastra fotos o videos desde Windows a este recuadro. ' if HAY_ARRASTRE else '') +
                  'Arrastra una miniatura sobre otra para reordenar. La primera es la portada.',
                  style='Ayuda.TLabel').pack(anchor='w', pady=(6, 2))

        marco = ttk.Frame(f, relief='sunken', borderwidth=2)
        marco.pack(fill='both', expand=True)
        self.lienzo = tk.Canvas(marco, bg='#ffffff', highlightthickness=0)
        barra_v = ttk.Scrollbar(marco, command=self.lienzo.yview)
        self.lienzo.configure(yscrollcommand=barra_v.set)
        self.lienzo.pack(side='left', fill='both', expand=True)
        barra_v.pack(side='right', fill='y')

        self.lienzo.bind('<Configure>', lambda e: self.dibujar_galeria())
        self.lienzo.bind('<ButtonPress-1>', self.al_presionar_miniatura)
        self.lienzo.bind('<B1-Motion>', self.al_arrastrar_miniatura)
        self.lienzo.bind('<ButtonRelease-1>', self.al_soltar_miniatura)
        self.lienzo.bind('<MouseWheel>', lambda e: self.lienzo.yview_scroll(int(-e.delta / 120), 'units'))
        self.lienzo.bind('<Delete>', lambda e: self.quitar_archivo())
        if HAY_ARRASTRE:
            self.lienzo.drop_target_register(DND_FILES)
            self.lienzo.dnd_bind('<<Drop>>', self.al_soltar_archivos)

        detalle = ttk.Frame(f)
        detalle.pack(fill='x', pady=(6, 0))
        ttk.Label(detalle, text='Nombre de la imagen seleccionada').pack(side='left')
        self.var_nombre_archivo = tk.StringVar()
        self.entrada_nombre_archivo = ttk.Entry(detalle, textvariable=self.var_nombre_archivo, width=40,
                                                state='disabled')
        self.entrada_nombre_archivo.pack(side='left', padx=6)
        self.var_nombre_archivo.trace_add('write', lambda *_: self.al_cambiar_nombre_archivo())
        self.var_animacion = tk.BooleanVar()
        self.casilla_animacion = ttk.Checkbutton(
            detalle, text='Animación (como GIF)',
            variable=self.var_animacion, command=self.al_cambiar_animacion, state='disabled')
        self.casilla_animacion.pack(side='left', padx=12)
        self.var_plano = tk.BooleanVar()
        self.casilla_plano = ttk.Checkbutton(
            detalle, text='Plano / lámina (conserva más resolución)',
            variable=self.var_plano, command=self.al_cambiar_plano, state='disabled')
        self.casilla_plano.pack(side='left')
        self.info_archivo = ttk.Label(f, text='', style='Ayuda.TLabel')
        self.info_archivo.pack(anchor='w', pady=(4, 0))

    # ---------------- Lista de proyectos ----------------

    def refrescar_lista(self):
        self.lista.delete(0, 'end')
        for p in self.proyectos:
            self.lista.insert('end', f'  {p["id"]}  ·  {sin_html(p.get("titulo")) or "(sin título)"}')
        if self.actual is not None:
            self.lista.selection_set(self.actual)
            self.lista.see(self.actual)

    def al_elegir_en_lista(self, _evento):
        seleccion = self.lista.curselection()
        if seleccion and seleccion[0] != self.actual:
            self.seleccionar_proyecto(seleccion[0])

    def seleccionar_proyecto(self, indice):
        self.guardar_textos()
        self.actual = indice
        self.sel_galeria = None
        self.lista.selection_clear(0, 'end')
        self.lista.selection_set(indice)
        self.cargar_formulario()

    def nuevo_proyecto(self):
        nuevo = {
            'id': self.siguiente_id(), 'titulo': 'Nuevo proyecto', 'etiquetas': [], 'descripcion': [],
            'colores': [], 'ficha': dict(FICHA_INICIAL), 'dificultad': {'porcentaje': 0, 'texto': ''},
            'galeria': [], '_originales': [], '_modificado': True,
        }
        self.proyectos.append(nuevo)
        self.marcar_sucio()
        self.refrescar_lista()
        self.seleccionar_proyecto(len(self.proyectos) - 1)
        self.pestanas.select(0)

    def duplicar_proyecto(self):
        p = self.p()
        if not p:
            return
        self.guardar_textos()
        copia = copy.deepcopy(p)
        copia['id'] = self.siguiente_id()
        copia['titulo'] = (p.get('titulo') or '') + ' (copia)'
        copia['_originales'] = []
        copia['_modificado'] = True
        copia.pop('icono', None)
        icono_actual = self.ruta_icono(p)
        if icono_actual and icono_actual.exists():
            copia['_icono_origen'] = str(icono_actual)
        for g in copia['galeria']:
            g['_nuevo'] = False   # ya están optimizadas: solo se copian
        self.proyectos.insert(self.actual + 1, copia)
        self.marcar_sucio()
        self.refrescar_lista()
        self.seleccionar_proyecto(self.actual + 1)

    def eliminar_proyecto(self):
        p = self.p()
        if not p:
            return
        nombre = sin_html(p.get('titulo'))
        if not messagebox.askyesno('Eliminar proyecto', f'¿Quitar "{nombre}" del portafolio?'):
            return
        carpeta = carpeta_de(p)
        if carpeta.exists() and messagebox.askyesno(
                'Eliminar archivos',
                f'¿Borrar también la carpeta\n{carpeta.relative_to(RAIZ)}\ncon sus imágenes al guardar?\n\n'
                'Si ya hiciste commit de esos archivos, podrás recuperarlos desde el historial de GitHub.'):
            self.carpetas_a_borrar.append(carpeta)
        del self.proyectos[self.actual]
        self.actual = None
        self.marcar_sucio()
        self.refrescar_lista()
        if self.proyectos:
            self.seleccionar_proyecto(0)
        else:
            self.cargar_formulario()

    def mover_proyecto(self, direccion):
        i = self.actual
        if i is None or not 0 <= i + direccion < len(self.proyectos):
            return
        self.guardar_textos()
        self.proyectos[i], self.proyectos[i + direccion] = self.proyectos[i + direccion], self.proyectos[i]
        self.actual = i + direccion
        self.marcar_sucio()
        self.refrescar_lista()

    def marcar_sucio(self):
        if not self.sucio:
            self.sucio = True
            self.actualizar_titulo()

    # ---------------- Formulario ----------------

    def cargar_formulario(self):
        p = self.p()
        self.cargando = True
        try:
            for clave, var in self.vars.items():
                valor = (p or {}).get(clave, '')
                if clave == 'etiquetas':
                    valor = ', '.join(valor or [])
                var.set(valor or '')
            for caja, valor in ((self.texto_descripcion, '\n\n'.join((p or {}).get('descripcion', []))),
                                (self.texto_resumen, (p or {}).get('resumen', ''))):
                caja.delete('1.0', 'end')
                caja.insert('1.0', valor)
                caja.edit_reset()
                caja.edit_modified(False)
            dificultad = (p or {}).get('dificultad') or {}
            self.var_dif_porcentaje.set(int(dificultad.get('porcentaje', 0)))
            self.var_dif_texto.set(dificultad.get('texto', ''))
            self.etiqueta_porcentaje.config(text=f'{self.var_dif_porcentaje.get()}%')
            self.var_fila_nombre.set('')
            self.var_fila_valor.set('')
        finally:
            self.cargando = False

        if p:
            self.etiqueta_carpeta.config(text=f'Proyecto {p["id"]} — archivos en  assets/proyecto-{p["id"]}/')
        else:
            self.etiqueta_carpeta.config(text='No hay proyectos. Usa "+ Nuevo".')
        self.refrescar_colores()
        self.refrescar_ficha()
        self.refrescar_icono()
        self.seleccionar_archivo(None)
        self.lienzo.yview_moveto(0)
        self.dibujar_galeria()

    def al_cambiar_campo(self, clave):
        if self.cargando or not self.p():
            return
        valor = self.vars[clave].get()
        if clave == 'etiquetas':
            valor = [t.strip() for t in valor.split(',') if t.strip()]
        self.p()[clave] = valor
        self.marcar_cambio()
        if clave == 'titulo':
            self.refrescar_lista()

    def al_modificar_texto(self, caja):
        if caja.edit_modified():
            caja.edit_modified(False)
            if not self.cargando:
                self.marcar_cambio()

    def guardar_textos(self):
        """Pasa el contenido de las cajas de texto grandes al proyecto actual."""
        p = self.p()
        if not p:
            return
        bruto = self.texto_descripcion.get('1.0', 'end').strip()
        parrafos = [re.sub(r'\s*\n\s*', ' ', t).strip() for t in re.split(r'\n\s*\n', bruto) if t.strip()]
        p['descripcion'] = parrafos
        p['resumen'] = re.sub(r'\s*\n\s*', ' ', self.texto_resumen.get('1.0', 'end').strip())

    def al_cambiar_dificultad(self):
        self.etiqueta_porcentaje.config(text=f'{self.var_dif_porcentaje.get()}%')
        if self.cargando or not self.p():
            return
        self.p()['dificultad'] = {'porcentaje': int(self.var_dif_porcentaje.get()),
                                  'texto': self.var_dif_texto.get()}
        self.marcar_cambio()

    def calcular_tamano(self):
        p = self.p()
        if not p:
            return
        total = sum(Path(g['_origen']).stat().st_size for g in p['galeria'] if Path(g['_origen']).exists())
        self.vars['tamano'].set(formato_peso(total))

    # ---------------- Colores ----------------

    def refrescar_colores(self):
        self.lista_colores.delete(0, 'end')
        for c in (self.p() or {}).get('colores', []):
            hexa = c.get('hex', '#ffffff')
            self.lista_colores.insert('end', f'  {hexa:<9} {c.get("nombre", "")}')
            try:
                r, g, b = (int(hexa[i:i + 2], 16) for i in (1, 3, 5))
                texto = '#000000' if (r * 299 + g * 587 + b * 114) / 1000 > 140 else '#ffffff'
                self.lista_colores.itemconfig('end', background=hexa, foreground=texto,
                                              selectbackground=hexa, selectforeground=texto)
            except (ValueError, tk.TclError):
                pass

    def agregar_color(self):
        if not self.p():
            return
        _, hexa = colorchooser.askcolor(title='Elige un color')
        if not hexa:
            return
        nombre = simpledialog.askstring('Nombre del color', 'Nombre (opcional):', parent=self.root) or ''
        self.p().setdefault('colores', []).append({'hex': hexa.upper(), 'nombre': nombre})
        self.marcar_cambio()
        self.refrescar_colores()

    def editar_color(self):
        sel = self.lista_colores.curselection()
        if not sel:
            return
        color = self.p()['colores'][sel[0]]
        _, hexa = colorchooser.askcolor(color=color.get('hex'), title='Cambia el color')
        if hexa:
            color['hex'] = hexa.upper()
        nombre = simpledialog.askstring('Nombre del color', 'Nombre (opcional):',
                                        initialvalue=color.get('nombre', ''), parent=self.root)
        if nombre is not None:
            color['nombre'] = nombre
        self.marcar_cambio()
        self.refrescar_colores()

    def quitar_color(self):
        sel = self.lista_colores.curselection()
        if sel:
            del self.p()['colores'][sel[0]]
            self.marcar_cambio()
            self.refrescar_colores()

    def mover_color(self, direccion):
        sel = self.lista_colores.curselection()
        colores = (self.p() or {}).get('colores', [])
        if not sel or not 0 <= sel[0] + direccion < len(colores):
            return
        i = sel[0]
        colores[i], colores[i + direccion] = colores[i + direccion], colores[i]
        self.marcar_cambio()
        self.refrescar_colores()
        self.lista_colores.selection_set(i + direccion)

    # ---------------- Ficha técnica ----------------

    def refrescar_ficha(self, seleccionar=None):
        self.tabla_ficha.delete(*self.tabla_ficha.get_children())
        for nombre, valor in (self.p() or {}).get('ficha', {}).items():
            item = self.tabla_ficha.insert('', 'end', values=(nombre, valor))
            if nombre == seleccionar:
                self.tabla_ficha.selection_set(item)

    def al_elegir_fila(self, _evento):
        sel = self.tabla_ficha.selection()
        if sel:
            nombre, valor = self.tabla_ficha.item(sel[0], 'values')
            self.var_fila_nombre.set(nombre)
            self.var_fila_valor.set(valor)

    def filas_ficha(self):
        return list((self.p() or {}).get('ficha', {}).items())

    def guardar_fila(self):
        if not self.p():
            return
        nombre = self.var_fila_nombre.get().strip()
        if not nombre:
            messagebox.showinfo('Ficha técnica', 'Escribe el nombre de la fila (por ejemplo "Materiales").')
            return
        filas = self.filas_ficha()
        sel = self.tabla_ficha.selection()
        anterior = self.tabla_ficha.item(sel[0], 'values')[0] if sel else None
        nombres = [n for n, _ in filas]
        if anterior in nombres:
            filas[nombres.index(anterior)] = (nombre, self.var_fila_valor.get())
        elif nombre in nombres:
            filas[nombres.index(nombre)] = (nombre, self.var_fila_valor.get())
        else:
            filas.append((nombre, self.var_fila_valor.get()))
        self.p()['ficha'] = dict(filas)
        self.marcar_cambio()
        self.refrescar_ficha(seleccionar=nombre)

    def quitar_fila(self):
        sel = self.tabla_ficha.selection()
        if not sel:
            return
        nombre = self.tabla_ficha.item(sel[0], 'values')[0]
        self.p()['ficha'].pop(nombre, None)
        self.marcar_cambio()
        self.refrescar_ficha()
        self.var_fila_nombre.set('')
        self.var_fila_valor.set('')

    def mover_fila(self, direccion):
        sel = self.tabla_ficha.selection()
        if not sel:
            return
        filas = self.filas_ficha()
        i = self.tabla_ficha.index(sel[0])
        if not 0 <= i + direccion < len(filas):
            return
        filas[i], filas[i + direccion] = filas[i + direccion], filas[i]
        self.p()['ficha'] = dict(filas)
        self.marcar_cambio()
        self.refrescar_ficha(seleccionar=filas[i + direccion][0])

    # ---------------- Icono ----------------

    def ruta_icono(self, p):
        if p.get('_icono_origen'):
            return Path(p['_icono_origen'])
        return carpeta_de(p) / (p.get('icono') or f'proyecto_{p["id"]}.svg')

    def refrescar_icono(self):
        p = self.p()
        self.vista_icono.config(image='', text='', width=12, height=6)
        self.vista_icono.imagen = None
        if not p:
            self.etiqueta_icono.config(text='')
            return
        ruta = self.ruta_icono(p)
        if not ruta.exists():
            self.etiqueta_icono.config(text='⚠ Falta el icono: elige uno.')
            self.vista_icono.config(text='Sin icono\n\n(arrastra aquí)' if HAY_ARRASTRE else 'Sin icono')
            return
        nuevo = ' (nuevo, se copiará al guardar)' if p.get('_icono_origen') else ''
        self.etiqueta_icono.config(text=f'{ruta.name}{nuevo}')
        if ruta.suffix.lower() == '.svg':
            self.vista_icono.config(text='SVG\n\n(se ve en el\nnavegador)')
            return
        try:
            with Image.open(ruta) as im:
                im = im.convert('RGBA')
                im.thumbnail((90, 90))
                foto = ImageTk.PhotoImage(im)
            self.vista_icono.config(image=foto, width=96, height=96)
            self.vista_icono.imagen = foto
        except Exception:
            self.vista_icono.config(text='(no se puede\nprevisualizar)')

    def poner_icono(self, ruta):
        ruta = Path(ruta)
        if ruta.suffix.lower() not in EXT_ICONO:
            messagebox.showwarning('Icono', 'El icono debe ser SVG, PNG, JPG, WEBP o GIF.')
            return
        self.p()['_icono_origen'] = str(ruta)
        self.marcar_cambio()
        self.refrescar_icono()

    def elegir_icono(self):
        if not self.p():
            return
        ruta = filedialog.askopenfilename(title='Elige el icono del proyecto',
                                          filetypes=[('Iconos', '*.svg *.png *.jpg *.jpeg *.webp *.gif')])
        if ruta:
            self.poner_icono(ruta)

    def al_soltar_icono(self, evento):
        rutas = self.root.tk.splitlist(evento.data)
        if rutas and self.p():
            self.poner_icono(rutas[0])

    # ---------------- Galería ----------------

    def galeria(self):
        return (self.p() or {}).get('galeria', [])

    def columnas(self):
        return max(1, (self.lienzo.winfo_width() - 8) // CELDA_W)

    def miniatura(self, g):
        ruta = Path(g['_origen'])
        if not ruta.exists():
            return 'falta'
        clave = (str(ruta), ruta.stat().st_mtime)
        if clave not in self.cache_miniaturas:
            fuente = ruta
            if ruta.suffix.lower() in EXT_VIDEO:
                fuente = miniatura_video(ruta)
                if not fuente:
                    return 'video'
            try:
                with Image.open(fuente) as im:
                    im.draft('RGB', (THUMB_W * 2, THUMB_H * 2))
                    im = ImageOps.exif_transpose(im).convert('RGB')
                    im.thumbnail((THUMB_W, THUMB_H))
                    self.cache_miniaturas[clave] = ImageTk.PhotoImage(im)
            except Exception:
                return 'error'
        return self.cache_miniaturas[clave]

    def dibujar_galeria(self):
        c = self.lienzo
        c.delete('all')
        galeria = self.galeria()
        ancho = max(c.winfo_width(), CELDA_W)
        if not galeria:
            c.create_text(ancho / 2, 120, fill='#888888', font=('Segoe UI', 12), justify='center',
                          text=('Arrastra aquí fotos o videos\n' if HAY_ARRASTRE else '') +
                               'o usa "+ Agregar archivos…"')
            c.configure(scrollregion=(0, 0, ancho, 240))
            return

        cols = self.columnas()
        for i, g in enumerate(galeria):
            x = 8 + (i % cols) * CELDA_W
            y = 8 + (i // cols) * CELDA_H
            seleccionada = i == self.sel_galeria
            c.create_rectangle(x, y, x + CELDA_W - 10, y + CELDA_H - 10,
                               fill='#cfe0ff' if seleccionada else '#f2f2f2',
                               outline='#000080' if seleccionada else '#b0b0b0',
                               width=3 if seleccionada else 1)
            cx = x + (CELDA_W - 10) / 2
            mini = self.miniatura(g)
            if isinstance(mini, str):
                textos = {'video': ('▶ VIDEO', '#00ff00'), 'falta': ('FALTA\nARCHIVO', '#ff5555'),
                          'error': ('NO SE PUEDE\nLEER', '#ff5555')}
                texto, color = textos[mini]
                c.create_rectangle(x + 8, y + 6, x + CELDA_W - 18, y + 6 + THUMB_H, fill='#000000')
                c.create_text(cx, y + 6 + THUMB_H / 2, text=texto, fill=color, justify='center',
                              font=('Consolas', 12, 'bold'))
            else:
                c.create_image(cx, y + 6 + THUMB_H / 2, image=mini)
                ext = Path(g['_origen']).suffix.lower()
                if ext in EXT_VIDEO or ext == '.gif':
                    animacion = g.get('animacion') or (ext == '.gif' and FFMPEG and
                                                       (g.get('_nuevo') or g.get('_optimizar')))
                    etiqueta = 'ANIMACIÓN' if animacion else ('GIF' if ext == '.gif' else '▶ VIDEO')
                    c.create_rectangle(x + 8, y + THUMB_H - 10, x + 86, y + THUMB_H + 6,
                                       fill='#000000', outline='')
                    c.create_text(x + 12, y + THUMB_H - 2, text=etiqueta, anchor='w', fill='#00ff00',
                                  font=('Consolas', 8, 'bold'))

            if i == 0:
                c.create_rectangle(x + 8, y + 6, x + 74, y + 22, fill='#000080', outline='')
                c.create_text(x + 12, y + 14, text='PORTADA', anchor='w', fill='white',
                              font=('Segoe UI', 8, 'bold'))
            if g.get('_nuevo'):
                c.create_rectangle(x + CELDA_W - 62, y + 6, x + CELDA_W - 18, y + 22, fill='#008000', outline='')
                c.create_text(x + CELDA_W - 40, y + 14, text='NUEVO', fill='white', font=('Segoe UI', 8, 'bold'))

            nombre = g.get('nombre') or Path(g['_origen']).name
            if len(nombre) > 22:
                nombre = nombre[:21] + '…'
            c.create_text(cx, y + THUMB_H + 20, text=f'{i + 1}. {nombre}', font=('Segoe UI', 9),
                          width=CELDA_W - 16)

        filas = (len(galeria) + cols - 1) // cols
        c.configure(scrollregion=(0, 0, ancho, filas * CELDA_H + 16))

    def indice_en(self, evento):
        x = self.lienzo.canvasx(evento.x)
        y = self.lienzo.canvasy(evento.y)
        col = int((x - 8) // CELDA_W)
        fila = int((y - 8) // CELDA_H)
        cols = self.columnas()
        if col < 0 or col >= cols or fila < 0:
            return None
        i = fila * cols + col
        return i if i < len(self.galeria()) else None

    def al_presionar_miniatura(self, evento):
        self.lienzo.focus_set()
        i = self.indice_en(evento)
        self.seleccionar_archivo(i)
        self.arrastre = {'desde': i, 'x': evento.x, 'y': evento.y, 'activo': False} if i is not None else None

    def al_arrastrar_miniatura(self, evento):
        if not self.arrastre:
            return
        if abs(evento.x - self.arrastre['x']) + abs(evento.y - self.arrastre['y']) > 8:
            self.arrastre['activo'] = True
            self.lienzo.config(cursor='fleur')
            self.lienzo.delete('indicador')
            destino = self.indice_en(evento)
            if destino is not None:
                cols = self.columnas()
                x = 8 + (destino % cols) * CELDA_W - 4
                y = 8 + (destino // cols) * CELDA_H
                self.lienzo.create_line(x, y, x, y + CELDA_H - 10, fill='#ff0000', width=4, tags='indicador')

    def al_soltar_miniatura(self, evento):
        self.lienzo.config(cursor='')
        self.lienzo.delete('indicador')
        if not self.arrastre or not self.arrastre['activo']:
            self.arrastre = None
            return
        desde = self.arrastre['desde']
        hacia = self.indice_en(evento)
        if hacia is None:
            hacia = len(self.galeria()) - 1
        self.arrastre = None
        self.mover_a(desde, hacia)

    def mover_a(self, desde, hacia):
        galeria = self.galeria()
        if desde == hacia or desde is None:
            return
        galeria.insert(hacia, galeria.pop(desde))
        self.marcar_cambio(archivos=True)
        self.seleccionar_archivo(hacia)

    def mover_archivo(self, direccion):
        i = self.sel_galeria
        if i is not None and 0 <= i + direccion < len(self.galeria()):
            self.mover_a(i, i + direccion)

    def poner_portada(self):
        if self.sel_galeria:
            self.mover_a(self.sel_galeria, 0)

    def seleccionar_archivo(self, i):
        self.sel_galeria = i
        self.cargando = True
        try:
            if i is None:
                self.var_nombre_archivo.set('')
                self.entrada_nombre_archivo.config(state='disabled')
                self.var_animacion.set(False)
                self.casilla_animacion.config(state='disabled')
                self.var_plano.set(False)
                self.casilla_plano.config(state='disabled')
                self.info_archivo.config(text='')
            else:
                g = self.galeria()[i]
                self.var_nombre_archivo.set(g.get('nombre', ''))
                self.entrada_nombre_archivo.config(state='normal')
                es_video = Path(g['_origen']).suffix.lower() in EXT_VIDEO
                self.var_animacion.set(bool(g.get('animacion')))
                self.casilla_animacion.config(state='normal' if es_video else 'disabled')
                es_foto = Path(g['_origen']).suffix.lower() in EXT_COMPRIMIBLE
                self.var_plano.set(bool(g.get('plano')))
                self.casilla_plano.config(state='normal' if es_foto else 'disabled')
                self.info_archivo.config(text=self.describir_archivo(g, i))
        finally:
            self.cargando = False
        self.dibujar_galeria()

    def describir_archivo(self, g, i):
        ruta = Path(g['_origen'])
        if not ruta.exists():
            return f'⚠ No se encuentra el archivo: {ruta}'
        partes = [ruta.name, formato_peso(ruta.stat().st_size)]
        ext = ruta.suffix.lower()
        if ext in EXT_IMAGEN:
            try:
                with Image.open(ruta) as im:
                    partes.append(f'{im.size[0]}×{im.size[1]} px')
            except Exception:
                pass
        else:
            ancho, duracion, _ = info_video(ruta)
            partes.append(f'video {ancho} px · {duracion:.0f} s' if ancho else 'video')
        base = f'proyecto_{self.p()["id"]}{letra(i)}'
        if g.get('_nuevo') or g.get('_optimizar'):
            if ext in EXT_COMPRIMIBLE and g.get('plano'):
                partes.append(f'→ plano: se conservará hasta {MAX_LADO_PLANO} px, calidad {CALIDAD_PLANO}% ({base})')
            elif ext in EXT_COMPRIMIBLE:
                partes.append(f'→ al guardar se optimizará si es pesada y quedará como {base}')
            elif FFMPEG and ext == '.gif' and es_gif_animado(ruta):
                partes.append(f'→ al guardar se convertirá en animación {base}.mp4')
            elif FFMPEG and ext in EXT_VIDEO:
                partes.append(f'→ al guardar se comprimirá a MP4 de {VIDEO_MAX_ANCHO} px si hace falta ({base}.mp4)')
            else:
                partes.append(f'→ al guardar se copiará como {base}{ext}')
        elif ruta.stem != base:
            partes.append(f'→ al guardar se renombrará a {base}{ext}')
        return '   ·   '.join(partes)

    def al_cambiar_animacion(self):
        if self.sel_galeria is None:
            return
        g = self.galeria()[self.sel_galeria]
        if self.var_animacion.get():
            g['animacion'] = True
        else:
            g.pop('animacion', None)
        self.marcar_cambio()
        self.dibujar_galeria()

    def al_cambiar_plano(self):
        if self.sel_galeria is None:
            return
        g = self.galeria()[self.sel_galeria]
        g['plano'] = bool(self.var_plano.get())   # se guarda también "False" para no volver a detectarlo
        self.marcar_cambio()
        self.seleccionar_archivo(self.sel_galeria)

    def al_cambiar_nombre_archivo(self):
        if self.cargando or self.sel_galeria is None:
            return
        self.galeria()[self.sel_galeria]['nombre'] = self.var_nombre_archivo.get()
        self.marcar_cambio()
        self.dibujar_galeria()

    def quitar_archivo(self):
        i = self.sel_galeria
        if i is None:
            return
        g = self.galeria()[i]
        aviso = '' if g.get('_nuevo') else '\n\nEl archivo se borrará de la carpeta del proyecto al guardar.'
        if not messagebox.askyesno('Quitar de la galería',
                                   f'¿Quitar "{g.get("nombre") or Path(g["_origen"]).name}"?{aviso}'):
            return
        del self.galeria()[i]
        self.marcar_cambio(archivos=True)
        self.seleccionar_archivo(min(i, len(self.galeria()) - 1) if self.galeria() else None)

    def elegir_archivos(self):
        if not self.p():
            return
        rutas = filedialog.askopenfilenames(
            title='Elige fotos o videos',
            filetypes=[('Fotos y videos', ' '.join(f'*{e}' for e in sorted(EXT_IMAGEN | EXT_VIDEO))),
                       ('Todos los archivos', '*.*')])
        if rutas:
            self.agregar_archivos(rutas)

    def al_soltar_archivos(self, evento):
        if self.p():
            self.agregar_archivos(self.root.tk.splitlist(evento.data))

    def agregar_archivos(self, rutas):
        archivos = []
        for ruta in map(Path, rutas):
            if ruta.is_dir():
                archivos.extend(sorted(r for r in ruta.iterdir() if r.is_file()))
            else:
                archivos.append(ruta)

        agregados, avisos, rechazados = 0, [], []
        for ruta in archivos:
            ext = ruta.suffix.lower()
            if ext not in EXT_IMAGEN | EXT_VIDEO:
                rechazados.append(f'{ruta.name}: formato no admitido')
                continue
            peso = ruta.stat().st_size
            if not FFMPEG:   # sin ffmpeg los videos se copian tal cual: avisar de los problemas
                if ext in EXT_VIDEO and peso > VIDEO_MAXIMO:
                    rechazados.append(f'{ruta.name}: pesa {formato_peso(peso)}. GitHub no acepta archivos de más '
                                      'de 100 MB. Instala ffmpeg para que el editor lo comprima.')
                    continue
                if ext in EXT_VIDEO and peso > VIDEO_AVISO:
                    avisos.append(f'{ruta.name}: pesa {formato_peso(peso)}; tardará en cargar en la web.')
                if ext == '.mov':
                    avisos.append(f'{ruta.name}: los .MOV pueden no reproducirse en Chrome o Edge. '
                                  'Instala ffmpeg para que el editor lo convierta a MP4.')
                if ext == '.gif' and peso > GIF_AVISO:
                    avisos.append(f'{ruta.name}: GIF de {formato_peso(peso)}. '
                                  'Con ffmpeg instalado se convertiría a un video mucho más liviano.')
            item = {'archivo': None, 'nombre': '', '_origen': str(ruta), '_nuevo': True}
            if ext in EXT_COMPRIMIBLE and es_plano(ruta):
                item['plano'] = True
            self.galeria().append(item)
            agregados += 1

        if agregados:
            self.marcar_cambio(archivos=True)
            self.seleccionar_archivo(len(self.galeria()) - 1)
            self.pestanas.select(3)
            self.estado.config(text=f'{agregados} archivo(s) agregado(s). Se copiarán al guardar.')
        if avisos or rechazados:
            texto = ''
            if rechazados:
                texto += 'No se agregaron:\n• ' + '\n• '.join(rechazados) + '\n\n'
            if avisos:
                texto += 'Ten en cuenta:\n• ' + '\n• '.join(avisos)
            messagebox.showwarning('Revisa estos archivos', texto)

    def optimizar_existentes(self):
        fotos, videos, gifs = [], [], []
        self.root.config(cursor='watch')
        self.root.update_idletasks()
        for g in self.galeria():
            ruta = Path(g['_origen'])
            ext = ruta.suffix.lower()
            if not ruta.exists():
                continue
            if ext in EXT_COMPRIMIBLE:
                if 'plano' not in g and es_plano(ruta):
                    g['plano'] = True
                max_lado, umbral, _ = limites(g.get('plano'))
                try:
                    with Image.open(ruta) as im:
                        if max(im.size) > max_lado or ruta.stat().st_size > umbral:
                            fotos.append(g)
                except Exception:
                    pass
            elif FFMPEG and ext == '.gif' and es_gif_animado(ruta):
                gifs.append(g)
            elif FFMPEG and ext in EXT_VIDEO and video_necesita_compresion(ruta):
                videos.append(g)
        self.root.config(cursor='')

        elegidos = fotos + videos + gifs
        if not elegidos:
            extra = '' if FFMPEG else '\n(Sin ffmpeg instalado, los GIF y videos no se optimizan.)'
            messagebox.showinfo('Optimizar archivos', f'Los archivos de este proyecto ya están livianos.{extra}')
            return
        total = sum(Path(g['_origen']).stat().st_size for g in elegidos)
        lineas = []
        planos = [g for g in fotos if g.get('plano')]
        if len(fotos) > len(planos):
            lineas.append(f'• {len(fotos) - len(planos)} foto(s): se reducen a {MAX_LADO} px '
                          '(los PNG sin transparencia pasan a JPG).')
        if planos:
            lineas.append(f'• {len(planos)} plano(s) o lámina(s): se reducen solo a {MAX_LADO_PLANO} px '
                          f'con calidad {CALIDAD_PLANO}% para no perder líneas finas.')
        if videos:
            lineas.append(f'• {len(videos)} video(s): se convierten a MP4 de {VIDEO_MAX_ANCHO} px como máximo.')
        if gifs:
            lineas.append(f'• {len(gifs)} GIF: se convierten a video MP4 que se reproduce solo, en bucle y '
                          'sin sonido (se ve igual que un GIF, pero pesa mucho menos).')
        if not messagebox.askyesno('Optimizar archivos',
                                   f'Estos archivos pesan {formato_peso(total)} en total:\n\n' +
                                   '\n'.join(lineas) + '\n\nSe procesan al guardar. ¿Continuar?'):
            return
        for g in elegidos:
            g['_optimizar'] = True
        self.marcar_cambio(archivos=True)
        self.seleccionar_archivo(self.sel_galeria)
        self.estado.config(text=f'{len(elegidos)} archivo(s) se optimizarán al guardar.')

    # ---------------- Guardar ----------------

    def validar(self):
        errores = []
        for p in self.proyectos:
            nombre = sin_html(p.get('titulo')) or f'Proyecto {p["id"]}'
            if not sin_html(p.get('titulo')):
                errores.append(f'Proyecto {p["id"]}: falta el título corto.')
            for g in p.get('galeria', []):
                if not Path(g['_origen']).exists():
                    errores.append(f'{nombre}: no se encuentra {g["_origen"]}')
        return errores

    @staticmethod
    def preparar_proyecto(p, avisar):
        """Fase 1 (en segundo plano): deja los archivos listos en una carpeta temporal.
        No borra nada. 'avisar(texto, fraccion)' informa el progreso."""
        carpeta = carpeta_de(p)
        carpeta.mkdir(parents=True, exist_ok=True)
        temporal = carpeta / '.editor_tmp'
        if temporal.exists():
            shutil.rmtree(temporal)
        temporal.mkdir()

        finales, animaciones, avisos = [], [], []
        if p.get('_modificado'):
            total = len(p['galeria'])
            for i, g in enumerate(p['galeria']):
                origen = Path(g['_origen'])
                optimizar = bool(g.get('_nuevo') or g.get('_optimizar'))
                texto = f'Proyecto {p["id"]} · archivo {i + 1} de {total}: {origen.name}'
                avisar(texto, None)
                destino, es_animacion, aviso = preparar_archivo(
                    origen, temporal, f'proyecto_{p["id"]}{letra(i)}', optimizar,
                    progreso=lambda f, t=texto: avisar(f'{t}  —  comprimiendo {f:.0%}', f),
                    plano=bool(g.get('plano')))
                if destino.stat().st_size > VIDEO_MAXIMO:
                    raise RuntimeError(f'{origen.name} pesa {formato_peso(destino.stat().st_size)} incluso '
                                       'después de comprimirlo. GitHub no acepta archivos de más de 100 MB.')
                finales.append(destino.name)
                animaciones.append(es_animacion or bool(g.get('animacion')))
                if aviso:
                    avisos.append(aviso)

        icono = None
        if p.get('_icono_origen'):
            origen = Path(p['_icono_origen'])
            icono = f'proyecto_{p["id"]}{origen.suffix.lower()}'
            shutil.copy2(origen, temporal / icono)
        return {'carpeta': carpeta, 'temporal': temporal, 'finales': finales,
                'animaciones': animaciones, 'avisos': avisos, 'icono': icono}

    def finalizar_proyecto(self, p, info):
        """Fase 2: reemplaza los archivos antiguos por los nuevos."""
        carpeta = info['carpeta']
        if p.get('_modificado'):
            for nombre in p.get('_originales', []):
                (carpeta / nombre).unlink(missing_ok=True)
        for archivo in info['temporal'].iterdir():
            os.replace(archivo, carpeta / archivo.name)
        info['temporal'].rmdir()

        if p.get('_modificado'):
            for g, nombre, animacion in zip(p['galeria'], info['finales'], info['animaciones']):
                g['archivo'] = nombre
                g['_origen'] = str(carpeta / nombre)
                g.pop('_nuevo', None)
                g.pop('_optimizar', None)
                if animacion:
                    g['animacion'] = True
                else:
                    g.pop('animacion', None)
            p['_originales'] = list(info['finales'])
            p['_modificado'] = False
        if info['icono']:
            p['icono'] = info['icono']
            p.pop('_icono_origen', None)

    def preparar_en_segundo_plano(self, pendientes):
        """Procesa los archivos en otro hilo y muestra una ventana de progreso.
        Devuelve la lista de (proyecto, info) o lanza el error ocurrido."""
        dialogo = tk.Toplevel(self.root)
        dialogo.title('Guardando…')
        dialogo.transient(self.root)
        dialogo.resizable(False, False)
        dialogo.protocol('WM_DELETE_WINDOW', lambda: None)   # no se puede cerrar a medias
        ttk.Label(dialogo, text='Copiando y comprimiendo archivos…', style='Titulo.TLabel').pack(
            anchor='w', padx=16, pady=(14, 4))
        texto = ttk.Label(dialogo, text='', width=80)
        texto.pack(anchor='w', padx=16)
        barra = ttk.Progressbar(dialogo, length=520, mode='indeterminate')
        barra.pack(padx=16, pady=(8, 4))
        barra.start(12)
        ttk.Label(dialogo, text='Los videos pueden tardar varios minutos. No cierres el editor.',
                  style='Ayuda.TLabel').pack(anchor='w', padx=16, pady=(0, 14))
        dialogo.update_idletasks()
        x = self.root.winfo_rootx() + (self.root.winfo_width() - dialogo.winfo_width()) // 2
        y = self.root.winfo_rooty() + (self.root.winfo_height() - dialogo.winfo_height()) // 3
        dialogo.geometry(f'+{x}+{y}')
        dialogo.grab_set()

        mensajes = queue.Queue()
        resultado = {}

        def trabajo():
            try:
                resultado['ok'] = [(p, self.preparar_proyecto(p, lambda t, f: mensajes.put((t, f))))
                                   for p in pendientes]
            except Exception as error:
                resultado['error'] = error

        hilo = threading.Thread(target=trabajo, daemon=True)
        hilo.start()
        modo = 'indeterminate'
        while hilo.is_alive():
            try:
                while True:
                    t, fraccion = mensajes.get_nowait()
                    texto.config(text=t)
                    nuevo_modo = 'determinate' if fraccion is not None else 'indeterminate'
                    if nuevo_modo != modo:
                        barra.stop()
                        barra.config(mode=nuevo_modo)
                        if nuevo_modo == 'indeterminate':
                            barra.start(12)
                        modo = nuevo_modo
                    if fraccion is not None:
                        barra['value'] = fraccion * 100
            except queue.Empty:
                pass
            self.root.update()
            hilo.join(0.05)

        dialogo.grab_release()
        dialogo.destroy()
        if 'error' in resultado:
            raise resultado['error']
        return resultado['ok']

    def guardar(self):
        if getattr(self, 'guardando', False):
            return False
        self.guardar_textos()
        errores = self.validar()
        if errores:
            messagebox.showerror('No se pudo guardar', '\n'.join(errores[:15]))
            return False

        pendientes = [p for p in self.proyectos if p.get('_modificado') or p.get('_icono_origen')]
        self.guardando = True
        try:
            preparados = self.preparar_en_segundo_plano(pendientes) if pendientes else []
        except Exception as error:
            for p in pendientes:
                shutil.rmtree(carpeta_de(p) / '.editor_tmp', ignore_errors=True)
            self.estado.config(text='')
            messagebox.showerror('No se pudo guardar',
                                 f'Hubo un problema al preparar los archivos. No se cambió nada.\n\n{error}')
            return False
        finally:
            self.guardando = False

        avisos = [a for _, info in preparados for a in info['avisos']]
        self.root.config(cursor='watch')
        try:
            for p, info in preparados:
                self.finalizar_proyecto(p, info)
            for carpeta in self.carpetas_a_borrar:
                shutil.rmtree(carpeta, ignore_errors=True)
            self.carpetas_a_borrar = []
            escribir_proyectos([limpiar_para_guardar(p) for p in self.proyectos])
        except Exception as error:
            self.root.config(cursor='')
            messagebox.showerror('Error al guardar', f'{error}')
            return False

        self.root.config(cursor='')
        self.sucio = False
        self.actualizar_titulo()
        self.cache_miniaturas.clear()
        if self.p():
            self.seleccionar_archivo(self.sel_galeria)
            self.refrescar_icono()
        self.estado.config(text='✔ Guardado. Recuerda hacer commit en GitHub Desktop para publicarlo.')
        if avisos:
            messagebox.showwarning('Guardado con avisos', '\n\n'.join(avisos))
        return True

    def guardar_y_ver(self):
        if self.guardar():
            abrir_en_navegador(self.p()['id'] if self.p() else None)

    def al_cerrar(self):
        if getattr(self, 'guardando', False):
            return
        if self.sucio:
            respuesta = messagebox.askyesnocancel('Cambios sin guardar', '¿Guardar los cambios antes de salir?')
            if respuesta is None:
                return
            if respuesta and not self.guardar():
                return
        self.root.destroy()


def main():
    try:  # texto nítido en pantallas con escalado
        import ctypes
        ctypes.windll.shcore.SetProcessDpiAwareness(1)
    except Exception:
        pass
    root = TkinterDnD.Tk() if HAY_ARRASTRE else tk.Tk()
    Editor(root)
    root.mainloop()


if __name__ == '__main__':
    main()
