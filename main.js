/* =====================================================================
   LÓGICA DEL PORTAFOLIO — Estrabismx
   Este archivo lo usan todas las páginas; cada parte solo se activa
   si la página tiene los elementos que necesita.
   Índice:
     1. Utilidades
     2. Enlaces antiguos (index.html#proyecto-01 → proyectos.html)
     3. Ventanas emergentes (contacto y alertas)
     4. Barra lateral: BROWSE BY TYPE
     5. Carrusel de proyectos (index.html)
     6. Paint (paint.html)
     7. Inicio de la página

   Los datos de los proyectos están en proyectos.js.
   ===================================================================== */


/* ---------- 1. Utilidades ---------- */

const $ = (id) => document.getElementById(id);

/* Texto "encriptado": los caracteres aparecen como 0 y 1 que cambian
   y se van revelando de izquierda a derecha
   (inspirado en ui.aceternity.com/components/encrypted-text).
   Uso: encryptText(elemento) anima su texto actual;
        encryptText(elemento, 'nuevo texto') lo cambia y lo anima. */
const ENCRYPT_TITLES = '.section-title, .sidebar-title, .doc-name, .doc-heading, .project-card-label, .detail-heading, .modal-title';
const ENCRYPT_DURATION = 1800; // ms máximos para revelar un título completo
const ENCRYPT_PER_CHAR = 100;  // ms máximos por carácter (títulos cortos)
const ENCRYPT_FLIP = 50;      // ms entre cada cambio de 0/1
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const encryptTimers = new WeakMap();

function encryptText(el, text) {
  if (!el) return;
  const final = text != null ? String(text) : el.dataset.encFinal || el.textContent;
  clearInterval(encryptTimers.get(el));
  el.dataset.encFinal = final;

  if (reduceMotion || !final.trim()) {
    el.textContent = final;
    return;
  }

  const chars = [...final];
  const perChar = Math.min(ENCRYPT_PER_CHAR, ENCRYPT_DURATION / chars.length);
  const start = performance.now();
  el.setAttribute('aria-label', final); // los lectores de pantalla leen el texto real

  const tick = () => {
    const revealed = Math.floor((performance.now() - start) / perChar);
    if (revealed >= chars.length) {
      clearInterval(encryptTimers.get(el));
      el.textContent = final;
      el.removeAttribute('aria-label');
      return;
    }
    el.textContent = chars
      .map((c, i) => (i < revealed || /\s/.test(c) ? c : Math.random() < 0.5 ? '0' : '1'))
      .join('');
  };

  tick();
  encryptTimers.set(el, setInterval(tick, ENCRYPT_FLIP));
}

// Cambia el texto solo si es distinto, y lo anima
function setEncrypted(el, text) {
  if (!el || el.dataset.encFinal === text) return;
  encryptText(el, text);
}

function encryptAll(selector = ENCRYPT_TITLES, root = document) {
  root.querySelectorAll(selector).forEach((el) => {
    // Los títulos de ventanas ocultas se animan al abrirlas (openModal)
    if (!el.closest('.modal-overlay:not(.open)')) encryptText(el);
  });
}

const PROJECTS = typeof PROYECTOS !== 'undefined' ? PROYECTOS : [];

const VIDEO_EXTENSIONS = ['mp4', 'webm', 'mov', 'm4v', 'ogv'];

function isVideo(archivo) {
  return VIDEO_EXTENSIONS.includes(archivo.split('.').pop().toLowerCase());
}

function projectFolder(p) {
  return `assets/proyecto-${p.id}/`;
}

// Primera imagen de la galería (los videos no sirven de portada)
function projectCover(p) {
  const img = (p.galeria || []).find((item) => !isVideo(item.archivo));
  return img ? projectFolder(p) + img.archivo : null;
}

// Quita etiquetas HTML (ej: "<i>Mimus</i>" → "Mimus")
function stripHtml(html) {
  const tmp = document.createElement('div');
  tmp.innerHTML = html;
  return tmp.textContent.trim();
}


/* ---------- 2. Enlaces antiguos ---------- */

// El editor abre index.html#proyecto-XX: ahora los proyectos viven en proyectos.html
function redirectOldProjectLinks() {
  if (document.body.dataset.page !== 'index') return false;
  if (!location.hash.startsWith('#proyecto-')) return false;
  location.replace('proyectos.html' + location.hash);
  return true;
}


/* ---------- 3. Ventanas emergentes ---------- */

function openModal(id) {
  const modal = $(id);
  if (!modal) return;
  modal.classList.add('open');
  modal.querySelectorAll('.modal-title').forEach((t) => encryptText(t));
  const close = modal.querySelector('.modal-close');
  if (close) close.focus();
}

function closeModal(id) {
  const modal = $(id);
  if (modal) modal.classList.remove('open');
}

function initModals() {
  // Cualquier enlace o botón con data-open-modal="id" abre esa ventana
  document.querySelectorAll('[data-open-modal]').forEach((trigger) => {
    trigger.addEventListener('click', (e) => {
      e.preventDefault();
      openModal(trigger.dataset.openModal);
    });
  });

  document.querySelectorAll('.modal-overlay').forEach((modal) => {
    // Cerrar con la "X" o con botones marcados con data-close-modal
    modal.querySelectorAll('.modal-close, [data-close-modal]').forEach((btn) => {
      btn.addEventListener('click', () => closeModal(modal.id));
    });
    // Cerrar al hacer clic en el fondo oscuro
    modal.addEventListener('click', (e) => {
      if (e.target === modal) closeModal(modal.id);
    });
  });

  // Cerrar con la tecla ESC
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    document.querySelectorAll('.modal-overlay.open').forEach((m) => closeModal(m.id));
  });
}

function showAlert(text) {
  const box = $('alertText');
  if (!box) return;
  box.textContent = text;
  openModal('alertModal');
}


/* ---------- 4. Barra lateral: BROWSE BY TYPE ---------- */

// Tipos únicos de los proyectos, en el orden en que aparecen en proyectos.js
function projectTypes() {
  return [...new Set(PROJECTS.map((p) => p.tipo).filter(Boolean))];
}

function renderTypeList() {
  const list = $('typeList');
  if (!list) return;

  const items = [{ label: 'Todos', tipo: '' }, ...projectTypes().map((t) => ({ label: t, tipo: t }))];
  list.innerHTML = '';

  items.forEach(({ label, tipo }) => {
    const li = document.createElement('li');
    const a = document.createElement('a');
    a.href = tipo ? `index.html?tipo=${encodeURIComponent(tipo)}#projects` : 'index.html#projects';
    a.dataset.tipo = tipo;
    a.textContent = `> ${label}`;

    // En index.html se filtra el carrusel sin recargar la página
    if ($('carouselDisplay')) {
      a.addEventListener('click', (e) => {
        e.preventDefault();
        setCarouselFilter(tipo);
        history.replaceState(null, '', a.getAttribute('href'));
        $('projects').scrollIntoView();
      });
    }

    li.appendChild(a);
    list.appendChild(li);
  });

  markActiveType(new URLSearchParams(location.search).get('tipo') || '');
}

function markActiveType(tipo) {
  document.querySelectorAll('#typeList a').forEach((a) => {
    a.classList.toggle('active', a.dataset.tipo === tipo);
  });
}


/* ---------- 5. Carrusel de proyectos ---------- */

let carouselItems = [];
let carouselIndex = 0;

function setCarouselFilter(tipo) {
  carouselItems = tipo ? PROJECTS.filter((p) => p.tipo === tipo) : PROJECTS.slice();
  if (!carouselItems.length) carouselItems = PROJECTS.slice(); // tipo desconocido en la URL
  carouselIndex = 0;
  markActiveType(carouselItems.length === PROJECTS.length ? '' : tipo);
  updateCarousel();
}

function updateCarousel() {
  const display = $('carouselDisplay');
  const title = $('carouselTitle');
  const counter = $('carouselCounter');
  const p = carouselItems[carouselIndex];

  if (!p) {
    setEncrypted(title, 'SIN PROYECTOS');
    counter.textContent = '0/0';
    display.querySelector('.carousel-media').innerHTML =
      '<div class="thumbnail-placeholder">[ SIN PROYECTOS ]</div>';
    return;
  }

  setEncrypted(title, `SYS_${p.id}: ${p.titulo}`);
  counter.textContent = `${carouselIndex + 1}/${carouselItems.length}`;

  // Botón ">> ver_proyecto": abre directo la vista de este proyecto en proyectos.html
  const open = $('carouselOpen');
  if (open) {
    open.href = `proyectos.html?ver#proyecto-${p.id}`;
    open.setAttribute('aria-label', `Ver proyecto ${stripHtml(p.titulo)}`);
  }

  const media = display.querySelector('.carousel-media');
  const cover = projectCover(p);
  media.innerHTML = '';

  if (cover) {
    const img = document.createElement('img');
    img.src = cover;
    img.alt = stripHtml(p.titulo);
    img.onerror = () => {
      media.innerHTML = '<div class="thumbnail-placeholder">[ IMAGEN NO DISPONIBLE ]</div>';
    };
    media.appendChild(img);
  } else {
    media.innerHTML = '<div class="thumbnail-placeholder">[ SIN IMAGEN ]</div>';
  }

  // Precarga la portada siguiente para que el cambio sea inmediato
  const next = carouselItems[(carouselIndex + 1) % carouselItems.length];
  const nextCover = next && projectCover(next);
  if (nextCover) new Image().src = nextCover;
}

function nextSlide() {
  if (!carouselItems.length) return;
  carouselIndex = (carouselIndex + 1) % carouselItems.length;
  updateCarousel();
}

function prevSlide() {
  if (!carouselItems.length) return;
  carouselIndex = (carouselIndex - 1 + carouselItems.length) % carouselItems.length;
  updateCarousel();
}

function initCarousel() {
  if (!$('carouselDisplay')) return;
  $('carouselPrev').addEventListener('click', prevSlide);
  $('carouselNext').addEventListener('click', nextSlide);
  setCarouselFilter(new URLSearchParams(location.search).get('tipo') || '');
}


/* ---------- 5b. Anillo 3D de proyectos (proyectos.html) — PRUEBA ----------
   Cada proyecto de proyectos.js es una lata low poly (placeholder) sobre un
   anillo que gira. La tarjeta de abajo muestra el proyecto que queda al centro.
   - Arrastrar el espacio vacío o usar la rueda: gira el anillo.
   - Arrastrar la lata del centro: la rota en 360°.
   - Clic en la lata del centro: abre la vista del proyecto.
   - Clic en otra lata: la trae al centro.
   Los valores del anillo siguen la guía de ejemplo.json. */

const RING_SETTINGS = {
  ringRadius: 6.5,
  snapToCenter: true,
  scrollFriction: 0.92,
  cameraZPosition: 10,
  dragSensitivity: 0.002,   // radianes de giro del anillo por píxel arrastrado
  wheelSensitivity: 0.0002, // radianes por unidad de rueda
  maxVelocity: 0.08,        // velocidad máxima de giro por cuadro
  modelSensitivity: 0.01,   // radianes de giro de la lata por píxel arrastrado
  clickTolerance: 5,        // píxeles: menos que esto cuenta como clic y no arrastre
  pixelSize: 3,             // 1 píxel de render = 3 píxeles de pantalla (look low-res)
  radialSegments: 10,       // caras de la lata (low poly)
};

// Valores 3D por defecto. Un proyecto puede cambiarlos con un campo opcional
// "modelo3d": { "archivo", "escala", "rotacion", "material": {...} } (aún no está en el editor)
const MODELO_POR_DEFECTO = {
  archivo: null,
  escala: [1, 1, 1],
  rotacion: [0, 0, 0],
  material: { tipo: 'MeshStandardMaterial', color: '#b8bcc4', metalness: 0.9, roughness: 0.35 },
};

function modelSettings(p) {
  const m = p.modelo3d || {};
  return {
    archivo: m.archivo || null,
    triangulos: m.triangulos || null,
    escala: m.escala || MODELO_POR_DEFECTO.escala,
    rotacion: m.rotacion || MODELO_POR_DEFECTO.rotacion,
    material: { ...MODELO_POR_DEFECTO.material, ...(m.material || {}) },
  };
}

// Color de la etiqueta de la lata: el primero de la paleta del proyecto
function labelColor(p) {
  return (p.colores && p.colores[0] && p.colores[0].hex) || '#AB3130';
}

const isEmpty = (value) => value === '' || value == null;

function fillDataList(dl, rows, hideEmpty = false) {
  dl.innerHTML = rows
    .filter(([, value]) => !(hideEmpty && isEmpty(value)))
    .map(([label, value]) => `<dt>${label}</dt><dd>${isEmpty(value) ? '—' : value}</dd>`)
    .join('');
}

function infoRows(p) {
  return [
    ['ID', `proyecto-${p.id}`],
    ['FABRICACIÓN', p.tipo],
    ['FECHA', p.anio],
    ['DESCRIPCIÓN', p.resumen],
  ];
}

function techRows(p) {
  const m = modelSettings(p);
  const mat = m.material;
  return [
    ['MODELO', modelLabel(p)],
    ['TRIÁNGULOS', m.archivo ? m.triangulos : null],
    ['MATERIAL', mat.tipo],
    ['COLOR', `<span class="swatch" style="background:${mat.color}"></span>${mat.color}`],
    ['METALNESS', mat.metalness],
    ['ROUGHNESS', mat.roughness],
    ['ESCALA', m.escala.join(' × ')],
    ['ROTACIÓN', `${m.rotacion.join(', ')} rad`],
    ['LUZ', lightPreset(p).nombre],
  ];
}

function updateProjectCard(index) {
  const p = PROJECTS[index];
  if (!p) {
    setEncrypted($('cardTitle'), 'SIN PROYECTOS');
    $('cardCounter').textContent = '0/0';
    fillDataList($('cardInfo'), []);
    fillDataList($('cardTech'), []);
    return;
  }

  setEncrypted($('cardTitle'), `SYS_${p.id}: ${p.titulo}`);
  $('cardCounter').textContent = `${index + 1}/${PROJECTS.length}`;
  fillDataList($('cardInfo'), infoRows(p));
  fillDataList($('cardTech'), techRows(p));

  // Enlace directo al proyecto (lo usa también el editor: proyectos.html#proyecto-XX)
  history.replaceState(null, '', `#proyecto-${p.id}`);
}

function initialRingIndex() {
  const id = location.hash.replace('#proyecto-', '');
  const i = PROJECTS.findIndex((p) => p.id === id);
  return i >= 0 ? i : 0;
}

// Lata de aluminio low poly hecha con un perfil girado (LatheGeometry)
function buildCan(p) {
  const m = modelSettings(p);
  const mat = m.material;
  const Material = THREE[mat.tipo] || THREE.MeshStandardMaterial;
  const group = new THREE.Group();

  const perfil = [
    [0, -1.2], [0.5, -1.2], [0.6, -1.12], [0.66, -0.98], [0.66, 0.95],
    [0.6, 1.08], [0.52, 1.16], [0.53, 1.22], [0.47, 1.2], [0, 1.17],
  ].map(([x, y]) => new THREE.Vector2(x, y));

  group.add(new THREE.Mesh(
    new THREE.LatheGeometry(perfil, RING_SETTINGS.radialSegments),
    new Material({ color: mat.color, metalness: mat.metalness, roughness: mat.roughness, flatShading: true })
  ));

  const label = new THREE.Mesh(
    new THREE.CylinderGeometry(0.668, 0.668, 1.15, RING_SETTINGS.radialSegments, 1, true),
    new THREE.MeshStandardMaterial({ color: labelColor(p), metalness: 0.2, roughness: 0.6, flatShading: true })
  );
  label.position.y = -0.05;
  group.add(label);

  const tab = new THREE.Mesh(
    new THREE.BoxGeometry(0.3, 0.03, 0.16),
    new THREE.MeshStandardMaterial({ color: '#d0d0d0', metalness: 0.9, roughness: 0.3, flatShading: true })
  );
  tab.position.set(0, 1.21, 0.12);
  group.add(tab);

  // "pivot" recibe la escala y rotación inicial del proyecto; "spinner" es lo que se rota
  const pivot = new THREE.Group();
  pivot.add(group);
  pivot.scale.set(...m.escala);
  pivot.rotation.set(...m.rotacion);
  pivot.userData.spinner = group;
  return pivot;
}

function modelLabel(p) {
  const m = modelSettings(p);
  return m.archivo ? `${m.archivo} (low poly)` : 'Placeholder (lata low poly)';
}

// Los .glb se descargan una sola vez aunque los usen el anillo y el visor grande
const modelCache = new Map();

function loadModelGeometries(url) {
  if (!modelCache.has(url)) {
    modelCache.set(url, new Promise((resolve, reject) => {
      new THREE.GLTFLoader().load(url, (gltf) => {
        const geometries = [];
        gltf.scene.updateMatrixWorld(true);
        gltf.scene.traverse((child) => {
          if (child.isMesh) geometries.push(child.geometry.clone().applyMatrix4(child.matrixWorld));
        });
        geometries.length ? resolve(geometries) : reject(new Error('El modelo no tiene mallas'));
      }, undefined, reject);
    }));
  }
  return modelCache.get(url);
}

// Modelo del proyecto: muestra la lata y, si hay .glb, la reemplaza cuando termina de cargar.
// Si el archivo falla (o se abre el sitio sin servidor), se queda la lata.
function buildModel(p) {
  const pivot = buildCan(p);
  const m = modelSettings(p);
  if (!m.archivo || typeof THREE.GLTFLoader === 'undefined') return pivot;

  const Material = THREE[m.material.tipo] || THREE.MeshStandardMaterial;
  loadModelGeometries(projectFolder(p) + m.archivo)
    .then((geometries) => {
      const spinner = pivot.userData.spinner;
      const material = new Material({
        color: m.material.color, metalness: m.material.metalness, roughness: m.material.roughness,
        flatShading: true, side: THREE.DoubleSide,
      });
      disposeObject(spinner);
      while (spinner.children.length) spinner.remove(spinner.children[0]);
      geometries.forEach((geometry) => {
        const mesh = new THREE.Mesh(geometry, material);
        mesh.userData.shared = true; // la geometría es del caché: no se libera al cerrar el visor
        spinner.add(mesh);
      });
      pivot.userData.loaded = true;
    })
    .catch((err) => console.warn(`No se pudo cargar ${m.archivo}; se muestra la lata.`, err));
  return pivot;
}

function disposeObject(object) {
  object.traverse((child) => {
    if (child.geometry && !child.userData.shared) child.geometry.dispose();
    if (child.material) child.material.dispose();
  });
}

// Entorno simple con los colores del sitio para que el metal tenga reflejos
function buildEnvironment(renderer) {
  const envScene = new THREE.Scene();
  const colores = ['#EEDBBF', '#121212', '#EEDBBF', '#000000', '#AB3130', '#67191F'];
  envScene.add(new THREE.Mesh(
    new THREE.BoxGeometry(10, 10, 10),
    colores.map((c) => new THREE.MeshBasicMaterial({ color: c, side: THREE.BackSide }))
  ));
  const pmrem = new THREE.PMREMGenerator(renderer);
  const texture = pmrem.fromScene(envScene, 0.04).texture;
  pmrem.dispose();
  return texture;
}

// Renderer + escena + luces comunes al anillo y al visor del proyecto
function createViewer(canvas, stage, camera) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false });
  renderer.setPixelRatio(1);
  renderer.outputEncoding = THREE.sRGBEncoding;
  renderer.setClearColor('#000000');

  const scene = new THREE.Scene();
  scene.environment = buildEnvironment(renderer);

  // Tres luces cuyos valores vienen del estilo de luz (LUCES): ambiente, principal y contraluz
  const lights = {
    hemi: new THREE.HemisphereLight('#ffffff', '#000000', 0),
    key: new THREE.DirectionalLight('#ffffff', 0),
    rim: new THREE.DirectionalLight('#ffffff', 0),
  };
  Object.values(lights).forEach((light) => scene.add(light));

  // Se dibuja a baja resolución y el CSS lo agranda pixelado
  function resize() {
    const w = stage.clientWidth;
    const h = stage.clientHeight;
    if (!w || !h) return;
    renderer.setSize(Math.ceil(w / RING_SETTINGS.pixelSize), Math.ceil(h / RING_SETTINGS.pixelSize), false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  new ResizeObserver(resize).observe(stage);
  resize();

  const viewer = { renderer, scene, lights, envIntensity: 1 };
  applyLight(viewer, LUCES[LUZ_POR_DEFECTO], null, 1);
  return viewer;
}

/* Estilos de luz predefinidos. Cada proyecto elige uno en el editor ("modelo3d.luz").
   Las claves deben coincidir con LUCES en editor/editor_portafolio.py */
const LUZ_POR_DEFECTO = 'estudio';
const LUCES = {
  estudio: {
    nombre: 'Estudio',
    ambiente: { cielo: '#EEDBBF', suelo: '#67191F', intensidad: 0.6 },
    principal: { color: '#ffffff', intensidad: 1.2, posicion: [3, 5, 8] },
    contraluz: { color: '#ffffff', intensidad: 0, posicion: [0, 3, -8] },
    reflejos: 1,
  },
  atardecer: {
    nombre: 'Atardecer',
    ambiente: { cielo: '#ffb27a', suelo: '#2a1030', intensidad: 0.5 },
    principal: { color: '#ff8a3d', intensidad: 1.6, posicion: [-6, 2, 5] },
    contraluz: { color: '#6a5cff', intensidad: 0.7, posicion: [5, 3, -6] },
    reflejos: 0.6,
  },
  neon_rojo: {
    nombre: 'Neón rojo',
    ambiente: { cielo: '#330000', suelo: '#000000', intensidad: 0.35 },
    principal: { color: '#ff2a2a', intensidad: 1.8, posicion: [0, 4, 6] },
    contraluz: { color: '#ff00aa', intensidad: 1.3, posicion: [-5, 2, -4] },
    reflejos: 0.35,
  },
  contraluz: {
    nombre: 'Contraluz',
    ambiente: { cielo: '#222222', suelo: '#000000', intensidad: 0.25 },
    principal: { color: '#ffffff', intensidad: 0.35, posicion: [2, 3, 8] },
    contraluz: { color: '#EEDBBF', intensidad: 2.6, posicion: [0, 3, -8] },
    reflejos: 0.5,
  },
  noche: {
    nombre: 'Noche',
    ambiente: { cielo: '#20306a', suelo: '#05050f', intensidad: 0.45 },
    principal: { color: '#8fb4ff', intensidad: 0.7, posicion: [-3, 6, 4] },
    contraluz: { color: '#3050ff', intensidad: 0.7, posicion: [4, 2, -6] },
    reflejos: 0.3,
  },
};

function lightPreset(p) {
  return LUCES[(p && p.modelo3d && p.modelo3d.luz) || LUZ_POR_DEFECTO] || LUCES[LUZ_POR_DEFECTO];
}

// Lleva las luces del visor hacia el estilo indicado. t = 1 cambia de golpe; t < 1 hace una transición suave.
// "root" son los objetos a los que se les ajusta la intensidad de los reflejos del entorno.
function applyLight(viewer, preset, root, t) {
  const { hemi, key, rim } = viewer.lights;
  const lerp = (a, b) => a + (b - a) * t;
  const mix = (color, hex) => color.lerp(new THREE.Color(hex), t);

  mix(hemi.color, preset.ambiente.cielo);
  mix(hemi.groundColor, preset.ambiente.suelo);
  hemi.intensity = lerp(hemi.intensity, preset.ambiente.intensidad);

  [[key, preset.principal], [rim, preset.contraluz]].forEach(([light, valores]) => {
    mix(light.color, valores.color);
    light.intensity = lerp(light.intensity, valores.intensidad);
    light.position.lerp(new THREE.Vector3(...valores.posicion), t);
  });

  viewer.envIntensity = lerp(viewer.envIntensity, preset.reflejos);
  if (root) {
    root.traverse((child) => {
      if (child.material) child.material.envMapIntensity = viewer.envIntensity;
    });
  }
}

// Gira un objeto según el arrastre del mouse: horizontal = eje Y, vertical = eje X (360° libre)
function rotateByDrag(object, dx, dy) {
  const k = RING_SETTINGS.modelSensitivity;
  const qy = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), dx * k);
  const qx = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), dy * k);
  object.quaternion.premultiply(qy).premultiply(qx);
}

// Punto del puntero en coordenadas de la escena (-1 a 1)
function pointerToNdc(e, element) {
  const rect = element.getBoundingClientRect();
  return new THREE.Vector2(
    ((e.clientX - rect.left) / rect.width) * 2 - 1,
    -((e.clientY - rect.top) / rect.height) * 2 + 1
  );
}

function pauseMediaIn(element) {
  element.querySelectorAll('video').forEach((v) => v.pause());
}


/* ----- Vista del proyecto (reemplaza al anillo dentro de la sección) ----- */

let detailViewer = null;   // visor 3D grande, se crea la primera vez que se abre
let detailProject = null;
let detailMediaIndex = 0;
let closeDetailHandler = null;

function detailSection(title, html) {
  return `<div class="detail-block"><h4 class="project-card-label">/// ${title}</h4>${html}</div>`;
}

function renderDetailBody(p) {
  const etiquetas = (p.etiquetas || []).map((t) => `<span class="tag">${t}</span>`).join('');

  const parrafos = (p.descripcion && p.descripcion.length ? p.descripcion : [p.resumen])
    .filter(Boolean)
    .map((t) => `<p>${t}</p>`)
    .join('');

  const info = [
    ['TIPO', p.tipo], ['CURSO', p.curso], ['AÑO', p.anio],
    ['OBJETIVO', p.objetivo], ['DESAFÍO', p.desafio], ['TAMAÑO', p.tamano],
  ];
  // Igual que en el editor: las filas sin valor no se muestran
  const ficha = Object.entries(p.ficha || {}).filter(([, v]) => !isEmpty(v));

  const dif = p.dificultad;
  const dificultad = dif && dif.porcentaje != null ? `
    <div class="skill-bar difficulty"><div class="skill-fill" style="width:${dif.porcentaje}%"></div></div>
    <p class="detail-note">${dif.texto || ''} (${dif.porcentaje}%)</p>` : '';

  const colores = (p.colores || []).map((c) => `
    <li><span class="swatch" style="background:${c.hex}"></span>${c.nombre ? `${c.nombre} — ` : ''}${c.hex}</li>`).join('');

  const dl = (rows) => {
    const tmp = document.createElement('dl');
    tmp.className = 'project-card-data';
    fillDataList(tmp, rows, true);
    return tmp.outerHTML;
  };

  $('detailBody').innerHTML = `
    <div class="detail-header">
      <h3 class="detail-heading">${p.encabezado || p.titulo}</h3>
      ${p.subtitulo ? `<p class="detail-subtitle">${p.subtitulo}</p>` : ''}
      ${etiquetas ? `<div class="tags">${etiquetas}</div>` : ''}
    </div>
    <div class="detail-columns">
      <div>
        ${parrafos ? detailSection('DESCRIPCIÓN', `<div class="detail-text">${parrafos}</div>`) : ''}
        ${colores ? detailSection('PALETA_DE_COLORES', `<ul class="palette-list">${colores}</ul>`) : ''}
      </div>
      <div>
        ${detailSection('INFO', dl(info))}
        ${ficha.length ? detailSection('FICHA_TECNICA', dl(ficha)) : ''}
        ${dificultad ? detailSection('DIFICULTAD', dificultad) : ''}
        ${detailSection('DATOS_TECNICOS_MODELO', dl(techRows(p)))}
      </div>
    </div>`;
}

// Muestra un archivo de la galería en el panel grande (imagen, animación o video)
function showDetailMedia(index) {
  const galeria = (detailProject && detailProject.galeria) || [];
  const main = $('detailMain');
  pauseMediaIn(main);

  if (!galeria.length) {
    main.innerHTML = '<div class="thumbnail-placeholder">[ SIN IMÁGENES ]</div>';
    $('detailCaption').textContent = '';
    return;
  }

  detailMediaIndex = (index + galeria.length) % galeria.length;
  const item = galeria[detailMediaIndex];
  const src = projectFolder(detailProject) + item.archivo;

  if (isVideo(item.archivo)) {
    main.innerHTML = item.animacion
      ? `<video src="${src}" autoplay muted loop playsinline></video>`
      : `<video src="${src}" controls playsinline preload="metadata"></video>`;
  } else {
    main.innerHTML = `<button type="button" class="detail-zoom" title="Ampliar"><img src="${src}" alt="${item.nombre || item.archivo}"></button>`;
    main.querySelector('button').addEventListener('click', () => openLightbox(src, item));
  }

  $('detailCaption').textContent = `${detailMediaIndex + 1}/${galeria.length} — ${item.nombre || item.archivo}`;
  document.querySelectorAll('#detailThumbs button').forEach((b, i) => b.classList.toggle('active', i === detailMediaIndex));
}

function renderDetailThumbs(p) {
  const thumbs = $('detailThumbs');
  thumbs.innerHTML = '';
  (p.galeria || []).forEach((item, i) => {
    const src = projectFolder(p) + item.archivo;
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'detail-thumb';
    btn.title = item.nombre || item.archivo;
    btn.innerHTML = isVideo(item.archivo)
      ? `<video src="${src}#t=0.5" muted preload="metadata" playsinline></video><span>${item.animacion ? '∞' : '▶'}</span>`
      : `<img src="${src}" alt="" loading="lazy">`;
    btn.addEventListener('click', () => showDetailMedia(i));
    thumbs.appendChild(btn);
  });
}

/* Imagen ampliada como "tarjeta 3D": se inclina siguiendo el mouse
   (efecto inspirado en ui.aceternity.com/components/3d-card-effect).
   Con < y > (o las flechas del teclado) se recorren las imágenes del proyecto. */
let lightboxImages = [];
let lightboxIndex = 0;

function openLightbox(src, item) {
  const galeria = (detailProject && detailProject.galeria) || [];
  lightboxImages = galeria.filter((g) => !isVideo(g.archivo));
  lightboxIndex = Math.max(0, lightboxImages.indexOf(item));
  if (!lightboxImages.length) lightboxImages = [item];
  showLightboxImage(lightboxIndex);
  openModal('lightboxModal');
  fitLightboxImage(); // se mide recién con la ventana visible
}

function showLightboxImage(index) {
  const total = lightboxImages.length;
  lightboxIndex = (index + total) % total;
  const item = lightboxImages[lightboxIndex];
  const src = projectFolder(detailProject) + item.archivo;
  const nombre = item.nombre || item.archivo;

  $('lightboxMedia').innerHTML = `
    <div class="card3d" id="lightboxCard">
      <img class="card3d-img" src="${src}" alt="${nombre}">
      <p class="card3d-caption">${nombre}${total > 1 ? ` <span>${lightboxIndex + 1}/${total}</span>` : ''}</p>
    </div>`;
  encryptText($('lightboxTitle'), nombre);
  $('lightboxPrev').hidden = $('lightboxNext').hidden = total < 2;

  const img = $('lightboxMedia').querySelector('.card3d-img');
  if (img.complete) fitLightboxImage();
  else img.addEventListener('load', fitLightboxImage, { once: true });
}

// Escala la imagen al máximo que cabe en la pantalla (agranda también las pequeñas)
// manteniendo su proporción. Verticales y horizontales usan el mismo alto máximo;
// solo las muy panorámicas quedan limitadas por el ancho. La ventana y el marco
// de la tarjeta se ajustan a la imagen.
function fitLightboxImage() {
  const win = $('lightboxModal').querySelector('.lightbox-window');
  const stage = $('lightboxMedia');
  const card = $('lightboxCard');
  const img = card && card.querySelector('.card3d-img');
  if (!img || !img.naturalWidth || !$('lightboxModal').classList.contains('open')) return;

  const px = (v) => parseFloat(v) || 0;
  const box = (el) => {
    const s = getComputedStyle(el);
    return {
      w: px(s.paddingLeft) + px(s.paddingRight) + px(s.borderLeftWidth) + px(s.borderRightWidth),
      h: px(s.paddingTop) + px(s.paddingBottom) + px(s.borderTopWidth) + px(s.borderBottomWidth),
    };
  };
  const winBox = box(win);
  const stageBox = box(stage);
  const cardBox = box(card);
  const header = win.querySelector('.modal-header');
  const controls = win.querySelector('.lightbox-controls');
  const caption = card.querySelector('.card3d-caption');
  const captionH = caption ? caption.offsetHeight + px(getComputedStyle(caption).marginTop) : 0;

  // Espacio libre = 96% de la pantalla − bordes/rellenos − encabezado − botones − texto
  const availW = window.innerWidth * 0.96 - winBox.w - stageBox.w - cardBox.w;
  const availH = window.innerHeight * 0.96 - winBox.h - (header ? header.offsetHeight : 0)
    - (controls ? controls.offsetHeight : 0) - stageBox.h - cardBox.h - captionH;

  const scale = Math.min(availW / img.naturalWidth, availH / img.naturalHeight);
  img.style.width = `${Math.max(0, Math.floor(img.naturalWidth * scale))}px`;
  img.style.height = `${Math.max(0, Math.floor(img.naturalHeight * scale))}px`;
}

function initLightbox3D() {
  const stage = $('lightboxMedia');
  if (!stage) return;

  window.addEventListener('resize', fitLightboxImage);

  stage.addEventListener('mousemove', (e) => {
    const card = $('lightboxCard');
    if (!card) return;
    const r = stage.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width - 0.5;  // -0.5 … 0.5
    const y = (e.clientY - r.top) / r.height - 0.5;
    card.style.transform = `rotateY(${x * 20}deg) rotateX(${-y * 20}deg)`;
    card.classList.add('is-hover');
  });

  stage.addEventListener('mouseleave', () => {
    const card = $('lightboxCard');
    if (!card) return;
    card.style.transform = '';
    card.classList.remove('is-hover');
  });

  $('lightboxPrev').addEventListener('click', () => showLightboxImage(lightboxIndex - 1));
  $('lightboxNext').addEventListener('click', () => showLightboxImage(lightboxIndex + 1));

  document.addEventListener('keydown', (e) => {
    if (!$('lightboxModal').classList.contains('open') || lightboxImages.length < 2) return;
    if (e.key === 'ArrowLeft') showLightboxImage(lightboxIndex - 1);
    if (e.key === 'ArrowRight') showLightboxImage(lightboxIndex + 1);
  });
}

// Visor 3D grande: arrastrar rota en 360°, la rueda acerca y aleja
function initDetailViewer() {
  if (detailViewer) return detailViewer;
  if (typeof THREE === 'undefined') {
    $('detailFallback').hidden = false;
    return null;
  }
  const stage = $('detailStage');
  const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 100);
  let viewer;
  try {
    viewer = createViewer($('detailCanvas'), stage, camera);
  } catch (err) {
    $('detailFallback').hidden = false;
    return null;
  }

  const ZOOM = { min: 3.5, max: 10, start: 6 };
  let distance = ZOOM.start;
  let dragging = false;
  let last = null;

  detailViewer = { ...viewer, camera, can: null, running: false };

  const placeCamera = () => {
    camera.position.set(0, 0.6 * (distance / ZOOM.start), distance);
    camera.lookAt(0, 0, 0);
  };
  placeCamera();

  detailViewer.reset = () => {
    distance = ZOOM.start;
    placeCamera();
    if (detailViewer.can) detailViewer.can.userData.spinner.quaternion.identity();
  };

  stage.addEventListener('pointerdown', (e) => {
    dragging = true;
    last = { x: e.clientX, y: e.clientY };
    stage.setPointerCapture(e.pointerId);
    stage.classList.add('dragging');
  });
  stage.addEventListener('pointermove', (e) => {
    if (!dragging || !detailViewer.can) return;
    rotateByDrag(detailViewer.can.userData.spinner, e.clientX - last.x, e.clientY - last.y);
    last = { x: e.clientX, y: e.clientY };
  });
  const release = () => { dragging = false; stage.classList.remove('dragging'); };
  stage.addEventListener('pointerup', release);
  stage.addEventListener('pointercancel', release);
  stage.addEventListener('wheel', (e) => {
    e.preventDefault();
    distance = Math.max(ZOOM.min, Math.min(ZOOM.max, distance + e.deltaY * 0.004));
    placeCamera();
  }, { passive: false });

  $('detailReset').addEventListener('click', () => detailViewer.reset());
  return detailViewer;
}

function startDetailLoop() {
  if (!detailViewer || detailViewer.running) return;
  detailViewer.running = true;
  const loop = () => {
    if (!detailViewer.running) return;
    // Se aplica en cada cuadro para que el modelo .glb (que carga después) también reciba los reflejos
    applyLight(detailViewer, lightPreset(detailProject), detailViewer.can, 0.15);
    detailViewer.renderer.render(detailViewer.scene, detailViewer.camera);
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
}

function openProjectDetail(index, onClose) {
  const p = PROJECTS[index];
  if (!p) return;
  detailProject = p;

  encryptText($('detailTitle'), `SYS_${p.id}: ${p.titulo}`);
  renderDetailBody(p);
  encryptAll(ENCRYPT_TITLES, $('detailBody'));
  renderDetailThumbs(p);

  $('ringView').hidden = true;
  $('detailView').hidden = false;
  showDetailMedia(0);
  $('detailModelName').textContent = `${modelLabel(p)} · Luz: ${lightPreset(p).nombre}`;

  const viewer = initDetailViewer();
  if (viewer) {
    if (viewer.can) { viewer.scene.remove(viewer.can); disposeObject(viewer.can); }
    viewer.can = buildModel(p);
    viewer.scene.add(viewer.can);
    applyLight(viewer, lightPreset(p), viewer.can, 1);
    viewer.reset();
    startDetailLoop();
  }

  closeDetailHandler = onClose;
  $('projects').scrollIntoView();
  $('detailBack').focus({ preventScroll: true });
}

function closeProjectDetail() {
  if ($('detailView').hidden) return;
  pauseMediaIn($('detailView'));
  if (detailViewer) detailViewer.running = false;
  $('detailView').hidden = true;
  $('ringView').hidden = false;
  if (closeDetailHandler) closeDetailHandler();
  $('projects').scrollIntoView();
}


/* ----- Anillo ----- */

function initProjectRing() {
  const stage = $('ringStage');
  if (!stage) return;

  const count = PROJECTS.length;
  let currentIndex = initialRingIndex();
  let ringRunning = true;
  let startRingLoop = () => {};

  // Avanza o retrocede "delta" proyectos (sin 3D solo cambia la tarjeta)
  let moveBy = (delta) => {
    if (!count) return;
    currentIndex = (currentIndex + delta + count) % count;
    updateProjectCard(currentIndex);
  };

  const openDetail = () => {
    ringRunning = false; // el anillo no se dibuja mientras la vista del proyecto está abierta
    openProjectDetail(currentIndex, () => { ringRunning = true; startRingLoop(); stage.focus({ preventScroll: true }); });
  };

  $('ringPrev').addEventListener('click', () => moveBy(-1));
  $('ringNext').addEventListener('click', () => moveBy(1));
  $('cardOpen').addEventListener('click', openDetail);
  $('detailBack').addEventListener('click', closeProjectDetail);
  stage.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowLeft') { e.preventDefault(); moveBy(-1); }
    if (e.key === 'ArrowRight') { e.preventDefault(); moveBy(1); }
    if (e.key === 'Enter') { e.preventDefault(); openDetail(); }
  });
  // Esc vuelve al anillo (si no hay una ventana emergente abierta)
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !document.querySelector('.modal-overlay.open')) closeProjectDetail();
  });

  updateProjectCard(currentIndex);
  if (!count) return;

  // Sin Three.js o sin WebGL la tarjeta y la vista del proyecto siguen funcionando
  let camera;
  let viewer;
  try {
    if (typeof THREE === 'undefined') throw new Error('Three.js no cargó');
    camera = new THREE.PerspectiveCamera(60, 1, 0.1, 100);
    viewer = createViewer($('ringCanvas'), stage, camera);
  } catch (err) {
    $('ringFallback').hidden = false;
    return;
  }
  const { renderer, scene } = viewer;
  scene.fog = new THREE.Fog('#000000', 8, 17);

  // Cámara un poco elevada mirando a la lata del frente; el resto del anillo queda detrás
  camera.position.set(0, 1.6, RING_SETTINGS.cameraZPosition);
  camera.lookAt(0, -0.35, RING_SETTINGS.ringRadius - 3);

  // Las latas se reparten en el anillo; la del ángulo 0 queda frente a la cámara
  const ring = new THREE.Group();
  const step = (Math.PI * 2) / count;
  const cans = PROJECTS.map((p, i) => {
    const can = buildModel(p);
    can.position.set(Math.sin(i * step) * RING_SETTINGS.ringRadius, 0, Math.cos(i * step) * RING_SETTINGS.ringRadius);
    can.userData.index = i;
    ring.add(can);
    return can;
  });
  scene.add(ring);
  applyLight(viewer, lightPreset(PROJECTS[currentIndex]), ring, 1);

  // Estado del giro
  let rotation = -currentIndex * step;
  let velocity = 0;
  let goal = null;          // ángulo al que se está acercando (snap, botones o clic)
  let drag = null;          // { mode: 'ring' | 'model', startX, startY, lastX, lastY, moved }
  let lastModelTouch = 0;   // momento en que se rotó la lata a mano (pausa el giro automático)
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const raycaster = new THREE.Raycaster();
  const POSE_ORIGEN = new THREE.Quaternion(); // sin rotación: la pose con que se cargó el modelo

  const indexAt = (angle) => ((Math.round(-angle / step) % count) + count) % count;

  // Botones y teclado: suman desde el destino pendiente, así varios clics seguidos
  // avanzan varios proyectos. La tarjeta cambia de inmediato.
  moveBy = (delta) => {
    velocity = 0;
    const base = goal !== null ? goal : -Math.round(-rotation / step) * step;
    goal = base - delta * step;
    currentIndex = indexAt(goal);
    updateProjectCard(currentIndex);
  };

  // ¿Qué lata hay bajo el puntero? (índice o -1)
  function canAt(e) {
    raycaster.setFromCamera(pointerToNdc(e, stage), camera);
    const hit = raycaster.intersectObjects(cans, true)[0];
    if (!hit) return -1;
    let obj = hit.object;
    while (obj && obj.userData.index === undefined) obj = obj.parent;
    return obj ? obj.userData.index : -1;
  }

  // La lata del centro solo cuenta como "seleccionada" cuando el anillo está quieto
  const isSettled = () => goal === null && Math.abs(velocity) < 0.002;

  stage.addEventListener('pointerdown', (e) => {
    const hit = canAt(e);
    const onSelected = hit === currentIndex && hit === indexAt(rotation);
    drag = { mode: onSelected ? 'model' : 'ring', hit, startX: e.clientX, startY: e.clientY, lastX: e.clientX, lastY: e.clientY, moved: false };
    if (drag.mode === 'ring') { goal = null; velocity = 0; }
    stage.setPointerCapture(e.pointerId);
    stage.classList.add('dragging');
  });

  stage.addEventListener('pointermove', (e) => {
    if (!drag) {
      // Pista visual: la lata del centro se puede rotar y abrir
      const hit = canAt(e);
      stage.classList.toggle('over-model', hit === currentIndex && isSettled());
      stage.classList.toggle('over-can', hit >= 0 && hit !== currentIndex);
      return;
    }
    const dx = e.clientX - drag.lastX;
    const dy = e.clientY - drag.lastY;
    drag.lastX = e.clientX;
    drag.lastY = e.clientY;
    if (Math.hypot(e.clientX - drag.startX, e.clientY - drag.startY) > RING_SETTINGS.clickTolerance) drag.moved = true;
    if (!drag.moved) return;

    if (drag.mode === 'model') {
      rotateByDrag(cans[currentIndex].userData.spinner, dx, dy);
      lastModelTouch = performance.now();
    } else {
      const delta = dx * RING_SETTINGS.dragSensitivity;
      rotation += delta;
      velocity = delta;
    }
  });

  const release = () => {
    if (!drag) return;
    const { mode, hit, moved } = drag;
    drag = null;
    stage.classList.remove('dragging');
    if (moved) return;
    // Clic sin arrastrar
    if (mode === 'model') openDetail();
    else if (hit >= 0) {
      // Trae al centro la lata clickeada por el camino más corto
      let delta = hit - currentIndex;
      if (delta > count / 2) delta -= count;
      if (delta < -count / 2) delta += count;
      moveBy(delta);
    }
  };
  stage.addEventListener('pointerup', release);
  stage.addEventListener('pointercancel', () => { drag = null; stage.classList.remove('dragging'); });

  // Rueda del mouse sobre el anillo
  stage.addEventListener('wheel', (e) => {
    e.preventDefault();
    goal = null;
    velocity -= (Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY) * RING_SETTINGS.wheelSensitivity;
    velocity = Math.max(-RING_SETTINGS.maxVelocity, Math.min(RING_SETTINGS.maxVelocity, velocity));
  }, { passive: false });

  function frame() {
    if (!ringRunning) return;
    const draggingRing = drag && drag.mode === 'ring';
    if (!draggingRing) {
      if (goal !== null) {
        rotation += (goal - rotation) * 0.12;
        if (Math.abs(goal - rotation) < 0.0005) { rotation = goal; goal = null; }
      } else if (Math.abs(velocity) > 0.002) {
        rotation += velocity;
        velocity *= RING_SETTINGS.scrollFriction;
      } else if (RING_SETTINGS.snapToCenter) {
        velocity = 0;
        const snap = -Math.round(-rotation / step) * step;
        if (Math.abs(snap - rotation) > 0.0005) goal = snap;
      }
    }
    ring.rotation.y = rotation;

    // Al arrastrar o con la rueda, la tarjeta sigue a la lata del centro
    const front = indexAt(rotation);
    if (goal === null && front !== currentIndex) {
      currentIndex = front;
      updateProjectCard(currentIndex);
    }

    // La lata del centro se agranda un poco y gira sola, salvo que se esté rotando a mano
    const autoSpin = !reduceMotion && performance.now() - lastModelTouch > 3000;
    cans.forEach((can, i) => {
      const target = i === front ? 1.1 : 1;
      const s = can.userData.highlight = (can.userData.highlight || 1) + (target - (can.userData.highlight || 1)) * 0.1;
      const base = modelSettings(PROJECTS[i]).escala;
      can.scale.set(base[0] * s, base[1] * s, base[2] * s);
      const spinner = can.userData.spinner;
      if (i === front) {
        if (autoSpin && !(drag && drag.mode === 'model')) {
          spinner.quaternion.premultiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), 0.012));
        }
      } else if (spinner.quaternion.angleTo(POSE_ORIGEN) > 0.001) {
        // Al dejar el centro, el modelo vuelve suavemente a su pose de origen
        spinner.quaternion.slerp(POSE_ORIGEN, 0.12);
      } else {
        spinner.quaternion.identity();
      }
    });

    // La luz pasa suavemente al estilo del proyecto del centro
    applyLight(viewer, lightPreset(PROJECTS[front]), ring, 0.06);

    renderer.render(scene, camera);
    requestAnimationFrame(frame);
  }
  startRingLoop = () => requestAnimationFrame(frame);
  startRingLoop();
}

/* ---------- 6. Paint ---------- */

let canvas, ctx;
let currentTool = 'pencil';
let currentColor = '#000000';
let strokeSize = 3;
let isDrawing = false;
let startX = 0;
let startY = 0;
let undoStack = [];
let redoStack = [];
const maxHistory = 15;

const TOOL_NAMES = {
  eraser: 'Borrador', fill: 'Relleno', picker: 'Selector de color', pencil: 'Lápiz',
  brush: 'Pincel', line: 'Línea', rect: 'Rectángulo', ellipse: 'Elipse',
};

const classicColors = [
  '#000000', '#808080', '#800000', '#808000', '#008000', '#008080', '#000080', '#800080', '#808040', '#004040', '#0080ff', '#004080', '#400080', '#804000',
  '#ffffff', '#c0c0c0', '#ff0000', '#ffff00', '#00ff00', '#00ffff', '#0000ff', '#ff00ff', '#ffff80', '#00ff80', '#80ffff', '#8080ff', '#ff8000', '#ff8080'
];

function initPaint() {
  canvas = $('paintCanvas');
  if (!canvas) return;
  ctx = canvas.getContext('2d', { willReadFrequently: true });

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  saveState();

  const paletteGrid = $('paletteGrid');
  classicColors.forEach((color) => {
    const box = document.createElement('button');
    box.type = 'button';
    box.className = 'palette-color';
    box.style.backgroundColor = color;
    box.title = color;
    box.setAttribute('aria-label', `Color ${color}`);
    box.addEventListener('click', () => selectColor(color));
    paletteGrid.appendChild(box);
  });

  document.querySelectorAll('.tool-button').forEach((btn) => {
    btn.addEventListener('click', () => setTool(btn.dataset.tool));
  });
  $('strokeSize').addEventListener('change', (e) => { strokeSize = parseInt(e.target.value, 10); });
  $('btnNew').addEventListener('click', clearCanvas);
  $('btnSave').addEventListener('click', downloadImage);
  $('btnUndo').addEventListener('click', undo);
  $('btnRedo').addEventListener('click', redo);

  canvas.addEventListener('pointerdown', (e) => {
    canvas.setPointerCapture(e.pointerId);
    startDrawing(e);
  });
  canvas.addEventListener('pointermove', draw);
  canvas.addEventListener('pointerup', stopDrawing);
  canvas.addEventListener('pointercancel', stopDrawing);

  document.addEventListener('keydown', (e) => {
    if (!e.ctrlKey && !e.metaKey) return;
    const key = e.key.toLowerCase();
    if (key === 'z') { e.preventDefault(); undo(); }
    if (key === 'y') { e.preventDefault(); redo(); }
  });
}

function saveState() {
  if (undoStack.length >= maxHistory) undoStack.shift();
  undoStack.push(ctx.getImageData(0, 0, canvas.width, canvas.height));
  redoStack = [];
}

function selectColor(color) {
  currentColor = color;
  $('colorCurrent').style.backgroundColor = color;
}

function setTool(tool) {
  currentTool = tool;
  document.querySelectorAll('.tool-button').forEach((btn) => {
    const active = btn.dataset.tool === tool;
    btn.classList.toggle('active', active);
    btn.setAttribute('aria-pressed', active);
  });
  $('paintStatus').textContent = `Herramienta activa: ${(TOOL_NAMES[tool] || tool).toUpperCase()}`;
}

function undo() {
  if (undoStack.length > 1) {
    redoStack.push(undoStack.pop());
    ctx.putImageData(undoStack[undoStack.length - 1], 0, 0);
  } else {
    showAlert('No hay más acciones para deshacer.');
  }
}

function redo() {
  if (redoStack.length > 0) {
    const nextState = redoStack.pop();
    undoStack.push(nextState);
    ctx.putImageData(nextState, 0, 0);
  } else {
    showAlert('No hay acciones para rehacer.');
  }
}

function clearCanvas() {
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  saveState();
  $('paintStatus').textContent = 'Lienzo limpio.';
}

function downloadImage() {
  const link = document.createElement('a');
  link.download = 'mi-dibujo-paint.png';
  link.href = canvas.toDataURL();
  link.click();
}

function getCanvasCoords(e) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: Math.round((e.clientX - rect.left) * (canvas.width / rect.width)),
    y: Math.round((e.clientY - rect.top) * (canvas.height / rect.height)),
  };
}

function startDrawing(e) {
  const { x, y } = getCanvasCoords(e);
  startX = x;
  startY = y;
  isDrawing = true;

  if (currentTool === 'fill') {
    floodFill(startX, startY, currentColor);
    isDrawing = false;
    return;
  }
  if (currentTool === 'picker') {
    pickColor(startX, startY);
    isDrawing = false;
    return;
  }
  if (currentTool === 'pencil' || currentTool === 'brush' || currentTool === 'eraser') {
    ctx.beginPath();
    ctx.moveTo(startX, startY);
    draw(e);
  }
}

function draw(e) {
  const { x, y } = getCanvasCoords(e);
  $('paintCoords').textContent = `${x}, ${y}px`;
  if (!isDrawing) return;

  if (currentTool === 'pencil' || currentTool === 'brush' || currentTool === 'eraser') {
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    if (currentTool === 'pencil') {
      ctx.strokeStyle = currentColor;
      ctx.lineWidth = 1;
    } else if (currentTool === 'brush') {
      ctx.strokeStyle = currentColor;
      ctx.lineWidth = strokeSize;
    } else {
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = strokeSize * 1.5;
    }
    ctx.lineTo(x, y);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x, y);
  } else if (currentTool === 'line' || currentTool === 'rect' || currentTool === 'ellipse') {
    // Repinta el último estado para no dejar "fantasmas" mientras se arrastra
    ctx.putImageData(undoStack[undoStack.length - 1], 0, 0);
    ctx.beginPath();
    ctx.strokeStyle = currentColor;
    ctx.lineWidth = strokeSize;

    if (currentTool === 'line') {
      ctx.moveTo(startX, startY);
      ctx.lineTo(x, y);
      ctx.stroke();
    } else if (currentTool === 'rect') {
      ctx.strokeRect(startX, startY, x - startX, y - startY);
    } else {
      const radiusX = Math.abs(x - startX) / 2;
      const radiusY = Math.abs(y - startY) / 2;
      ctx.ellipse(startX + (x - startX) / 2, startY + (y - startY) / 2, radiusX, radiusY, 0, 0, 2 * Math.PI);
      ctx.stroke();
    }
  }
}

function stopDrawing() {
  if (!isDrawing) return;
  isDrawing = false;
  ctx.beginPath();
  saveState();
}

function pickColor(x, y) {
  const [r, g, b] = ctx.getImageData(x, y, 1, 1).data;
  const hex = '#' + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
  selectColor(hex);
  setTool('pencil');
}

// Bote de pintura (relleno por pila para no bloquear el navegador)
function floodFill(x0, y0, fillColorHex) {
  const width = canvas.width;
  const height = canvas.height;
  if (x0 < 0 || y0 < 0 || x0 >= width || y0 >= height) return;

  const imageData = ctx.getImageData(0, 0, width, height);
  const data = imageData.data;
  const target = getPixelColor(x0, y0, data, width);
  const fill = hexToRgb(fillColorHex);
  if (colorsMatch(target, fill)) return;

  const stack = [[x0, y0]];
  while (stack.length > 0) {
    const [x, y] = stack.pop();
    if (!colorsMatch(getPixelColor(x, y, data, width), target)) continue;
    setPixelColor(x, y, fill, data, width);
    if (x > 0) stack.push([x - 1, y]);
    if (x < width - 1) stack.push([x + 1, y]);
    if (y > 0) stack.push([x, y - 1]);
    if (y < height - 1) stack.push([x, y + 1]);
  }

  ctx.putImageData(imageData, 0, 0);
  saveState();
}

function getPixelColor(x, y, data, width) {
  const idx = (y * width + x) * 4;
  return { r: data[idx], g: data[idx + 1], b: data[idx + 2] };
}

function setPixelColor(x, y, color, data, width) {
  const idx = (y * width + x) * 4;
  data[idx] = color.r;
  data[idx + 1] = color.g;
  data[idx + 2] = color.b;
  data[idx + 3] = 255;
}

function colorsMatch(c1, c2) {
  return c1.r === c2.r && c1.g === c2.g && c1.b === c2.b;
}

function hexToRgb(hex) {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return m ? { r: parseInt(m[1], 16), g: parseInt(m[2], 16), b: parseInt(m[3], 16) } : { r: 0, g: 0, b: 0 };
}


/* ---------- 7. Inicio de la página ---------- */

if (!redirectOldProjectLinks()) {
  initModals();
  initLightbox3D();
  renderTypeList();
  initCarousel();
  initProjectRing();
  initPaint();
  encryptAll();
  openLinkedProject();
  trackHeaderHeight();
}

// Guarda la altura real del header en --header-height (la usa la barra lateral fija)
function trackHeaderHeight() {
  const header = document.querySelector('header');
  if (!header) return;
  const update = () => document.documentElement.style.setProperty('--header-height', `${header.offsetHeight}px`);
  update();
  window.addEventListener('resize', update);
  if (document.fonts) document.fonts.ready.then(update); // la fuente cambia la altura al cargar
}

// proyectos.html?ver#proyecto-XX (botón ">> ver_proyecto" del carrusel de index)
// abre directamente la vista de ese proyecto en vez de dejarlo solo seleccionado en el anillo
function openLinkedProject() {
  if (!$('cardOpen') || !new URLSearchParams(location.search).has('ver')) return;
  history.replaceState(null, '', location.pathname + location.hash); // quita ?ver de la URL
  $('cardOpen').click();
}
