"""
CONVERSIÓN DE MODELOS 3D — Editor de Portafolio
================================================

Convierte archivos .stl y .stp/.step al formato .glb que usa Three.js,
con apariencia low poly:

  1. Lee el archivo (STL binario o de texto; STEP con cadquery).
  2. Lo centra, lo gira de "Z hacia arriba" (programas CAD) a "Y hacia arriba"
     (Three.js) y lo ajusta al tamaño de la lata placeholder de la web.
  3. Baja la cantidad de triángulos agrupando vértices cercanos en una grilla
     (da el aspecto facetado low poly).
  4. Lo guarda como .glb (solo posiciones e índices: la web le pone el
     material y el sombreado plano).

Solo necesita numpy. Para STEP necesita cadquery (se importa solo si hace falta).
"""

import json
import struct
from pathlib import Path

import numpy as np

EXT_MODELO = {'.stl', '.stp', '.step'}

# Niveles de detalle: nombre visible → triángulos aproximados
NIVELES = {
    'muy_bajo': ('Muy bajo (~300 triángulos)', 300),
    'bajo': ('Bajo (~800 triángulos)', 800),
    'medio': ('Medio (~2000 triángulos)', 2000),
    'alto': ('Alto (~5000 triángulos)', 5000),
    'muy_alto': ('Muy alto (~12000 triángulos)', 12000),
}
NIVEL_POR_DEFECTO = 'bajo'

# Tamaño de la lata de la web: el modelo se ajusta a esta altura máxima
TAMANO_OBJETIVO = 2.4


# ---------------------------------------------------------------------------
# Lectura
# ---------------------------------------------------------------------------

def leer_stl(ruta):
    """Devuelve (vertices Nx3, caras Mx3) de un STL binario o de texto."""
    datos = Path(ruta).read_bytes()
    triangulos = None

    # STL binario: cabecera de 80 bytes + cantidad de triángulos + 50 bytes por triángulo
    if len(datos) >= 84:
        cantidad = struct.unpack_from('<I', datos, 80)[0]
        if 84 + cantidad * 50 == len(datos):
            registro = np.dtype([('normal', '<f4', 3), ('v', '<f4', (3, 3)), ('attr', '<u2')])
            triangulos = np.frombuffer(datos, dtype=registro, count=cantidad, offset=84)['v'].astype(np.float64)

    if triangulos is None:   # STL de texto
        texto = datos.decode('utf-8', errors='ignore')
        numeros = [linea.split()[1:4] for linea in texto.splitlines() if linea.strip().startswith('vertex')]
        if not numeros:
            raise ValueError('El archivo no parece un STL válido (no tiene triángulos).')
        triangulos = np.array(numeros, dtype=np.float64).reshape(-1, 3, 3)

    if len(triangulos) == 0:
        raise ValueError('El STL no tiene triángulos.')

    # Une los vértices repetidos (en STL cada triángulo trae sus 3 vértices sueltos)
    puntos = triangulos.reshape(-1, 3)
    redondeados = np.round(puntos, 6)
    vertices, inverso = np.unique(redondeados, axis=0, return_inverse=True)
    return vertices, inverso.reshape(-1, 3)


def leer_step(ruta, objetivo=800):
    """Devuelve (vertices Nx3, caras Mx3) de un STEP usando cadquery."""
    try:
        import cadquery as cq
    except ImportError as error:
        raise RuntimeError('Para abrir archivos .stp/.step hace falta cadquery.\n\n'
                           'Abre una terminal en la carpeta "editor" y ejecuta:\n'
                           'python -m pip install cadquery') from error

    pieza = cq.importers.importStep(str(ruta))
    solidos = pieza.vals()
    if not solidos:
        raise ValueError('El archivo STEP no tiene geometría.')
    forma = solidos[0] if len(solidos) == 1 else cq.Compound.makeCompound(solidos)

    # Teselado según el nivel: más fino para "Medio"; luego se simplifica al objetivo
    caja = forma.BoundingBox()
    if objetivo <= 800:
        factor, angulo = 0.004, 0.5
    elif objetivo <= 2000:
        factor, angulo = 0.001, 0.2
    elif objetivo <= 5000:
        factor, angulo = 0.0003, 0.1
    else:
        factor, angulo = 0.0001, 0.05
    tolerancia = max(caja.DiagonalLength * factor, 1e-4)
    puntos, caras = forma.tessellate(tolerancia, angulo)
    if not caras:
        raise ValueError('No se pudo convertir el STEP en triángulos.')
    vertices = np.array([[p.x, p.y, p.z] for p in puntos], dtype=np.float64)
    return vertices, np.array(caras, dtype=np.int64)


def leer_modelo(ruta, objetivo=800):
    extension = Path(ruta).suffix.lower()
    if extension == '.stl':
        return leer_stl(ruta)
    if extension in ('.stp', '.step'):
        return leer_step(ruta, objetivo)
    raise ValueError(f'Formato no soportado: {extension}. Usa .stl, .stp o .step')


# ---------------------------------------------------------------------------
# Preparación
# ---------------------------------------------------------------------------

def normalizar(vertices):
    """Centra el modelo, pasa de Z-arriba a Y-arriba y lo ajusta al tamaño de la lata."""
    v = vertices[:, [0, 2, 1]].copy()   # (x, y, z) → (x, z, -y)
    v[:, 2] *= -1
    minimo, maximo = v.min(axis=0), v.max(axis=0)
    v -= (minimo + maximo) / 2
    lado_mayor = float((maximo - minimo).max())
    if lado_mayor > 0:
        v *= TAMANO_OBJETIVO / lado_mayor
    return v


def limpiar_caras(caras):
    """Quita triángulos degenerados (vértices repetidos) y duplicados."""
    a, b, c = caras[:, 0], caras[:, 1], caras[:, 2]
    caras = caras[(a != b) & (b != c) & (a != c)]
    if len(caras) == 0:
        return caras
    _, unicos = np.unique(np.sort(caras, axis=1), axis=0, return_index=True)
    return caras[np.sort(unicos)]


def agrupar_vertices(vertices, caras, celda):
    """Une todos los vértices que caen en la misma celda de una grilla de lado 'celda'."""
    indices_celda = np.floor((vertices - vertices.min(axis=0)) / celda).astype(np.int64)
    _, grupo, cantidad = np.unique(indices_celda, axis=0, return_inverse=True, return_counts=True)
    grupo = grupo.reshape(-1)
    nuevos = np.zeros((len(cantidad), 3))
    np.add.at(nuevos, grupo, vertices)
    nuevos /= cantidad[:, None]
    return nuevos, limpiar_caras(grupo[caras])


def simplificar(vertices, caras, objetivo):
    """Busca la grilla más fina que deja el modelo en 'objetivo' triángulos o menos."""
    caras = limpiar_caras(caras)
    if len(caras) <= objetivo:
        return vertices, caras

    diagonal = float(np.linalg.norm(vertices.max(axis=0) - vertices.min(axis=0)))
    fino, grueso = diagonal / 5000, diagonal / 4
    mejor = agrupar_vertices(vertices, caras, grueso)
    for _ in range(18):   # búsqueda binaria del tamaño de celda
        medio = (fino + grueso) / 2
        resultado = agrupar_vertices(vertices, caras, medio)
        if len(resultado[1]) > objetivo:
            fino = medio
        else:
            grueso = medio
            mejor = resultado
    return mejor


def quitar_vertices_sin_uso(vertices, caras):
    usados, nuevas = np.unique(caras, return_inverse=True)
    return vertices[usados], nuevas.reshape(-1, 3)


# ---------------------------------------------------------------------------
# Escritura GLB (glTF 2.0 binario)
# ---------------------------------------------------------------------------

def escribir_glb(ruta, vertices, caras):
    posiciones = vertices.astype('<f4').tobytes()
    tipo_indice = '<u2' if len(vertices) < 65536 else '<u4'
    indices = caras.astype(tipo_indice).tobytes()
    relleno = (4 - len(indices) % 4) % 4
    binario = posiciones + indices + b'\x00' * relleno

    gltf = {
        'asset': {'version': '2.0', 'generator': 'Editor de Portafolio — Estrabismx'},
        'scene': 0,
        'scenes': [{'nodes': [0]}],
        'nodes': [{'mesh': 0}],
        'meshes': [{'primitives': [{'attributes': {'POSITION': 0}, 'indices': 1, 'mode': 4}]}],
        'buffers': [{'byteLength': len(binario)}],
        'bufferViews': [
            {'buffer': 0, 'byteOffset': 0, 'byteLength': len(posiciones), 'target': 34962},
            {'buffer': 0, 'byteOffset': len(posiciones), 'byteLength': len(indices), 'target': 34963},
        ],
        'accessors': [
            {'bufferView': 0, 'componentType': 5126, 'count': len(vertices), 'type': 'VEC3',
             'min': vertices.min(axis=0).astype(float).tolist(), 'max': vertices.max(axis=0).astype(float).tolist()},
            {'bufferView': 1, 'componentType': 5123 if tipo_indice == '<u2' else 5125,
             'count': int(caras.size), 'type': 'SCALAR'},
        ],
    }
    texto = json.dumps(gltf, separators=(',', ':')).encode('utf-8')
    texto += b' ' * ((4 - len(texto) % 4) % 4)

    total = 12 + 8 + len(texto) + 8 + len(binario)
    with open(ruta, 'wb') as archivo:
        archivo.write(struct.pack('<4sII', b'glTF', 2, total))
        archivo.write(struct.pack('<I4s', len(texto), b'JSON'))
        archivo.write(texto)
        archivo.write(struct.pack('<I4s', len(binario), b'BIN\x00'))
        archivo.write(binario)


# ---------------------------------------------------------------------------
# Todo junto
# ---------------------------------------------------------------------------

def convertir(origen, destino, nivel=NIVEL_POR_DEFECTO, avisar=None):
    """Convierte 'origen' (.stl/.stp/.step) en 'destino' (.glb) low poly.
    Devuelve {'triangulos', 'triangulos_originales', 'peso'}."""
    avisar = avisar or (lambda texto: None)
    objetivo = NIVELES.get(nivel, NIVELES[NIVEL_POR_DEFECTO])[1]

    avisar(f'leyendo {Path(origen).name}')
    vertices, caras = leer_modelo(origen, objetivo)
    originales = len(caras)

    avisar(f'simplificando {originales:,} triángulos'.replace(',', '.'))
    vertices = normalizar(vertices)
    vertices, caras = simplificar(vertices, caras, objetivo)
    vertices, caras = quitar_vertices_sin_uso(vertices, caras)
    if len(caras) == 0:
        raise ValueError('El modelo quedó sin triángulos al simplificarlo.')

    avisar('escribiendo .glb')
    escribir_glb(destino, vertices, caras)
    return {'triangulos': int(len(caras)), 'triangulos_originales': int(originales),
            'peso': Path(destino).stat().st_size}
