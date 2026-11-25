/* =====================================================================
   LÓGICA DEL PORTAFOLIO — Estrabismx
   Este archivo lo usan todas las páginas; cada parte solo se activa
   si la página tiene los elementos que necesita.
   Índice:
     1. Utilidades
     2. Enlaces antiguos (index.html#proyecto-01 → proyectos.html)
     3. Ventanas emergentes (contacto y alertas)
     4. Menú lateral (botón hamburguesa)
     5. Teleprompter de proyectos (index.html)
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
const ENCRYPT_TITLES = '.home-title, .home-statement, .home-nav a, .section-title,.doc-name, .doc-heading, .project-card-label, .detail-heading, .modal-title';
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

/* Versiones livianas de la galería (las genera editor/medios_web.py, sin tocar los originales):
     web/  foto en WebP de máx. 1600 px · GIF animado convertido a MP4
     min/  miniatura WebP de máx. 256 px
   Si alguna no existe (proyecto recién agregado), se carga el archivo original. */
const fileStem = (archivo) => archivo.replace(/\.[^.]+$/, '');

// Los GIF se muestran como animación (su versión web es un MP4 en bucle)
function isAnimation(item) {
  return item.archivo.split('.').pop().toLowerCase() === 'gif';
}

function mediaOriginal(p, item) {
  return projectFolder(p) + item.archivo;
}

function mediaWeb(p, item) {
  if (isVideo(item.archivo)) return mediaOriginal(p, item);
  return `${projectFolder(p)}web/${fileStem(item.archivo)}.${isAnimation(item) ? 'mp4' : 'webp'}`;
}

function mediaThumb(p, item) {
  return `${projectFolder(p)}min/${fileStem(item.archivo)}.webp`;
}

// Carga "src" y, si falla, "fallback" (una sola vez)
function setSrcWithFallback(el, src, fallback) {
  el.addEventListener('error', () => { if (fallback) el.src = fallback; }, { once: true });
  el.src = src;
}

// Imagen, animación o video de la galería en un panel grande.
// Las fotos se pueden ampliar (clic → visor); las animaciones y videos se reproducen ahí mismo.
function renderMainMedia(box, p, item) {
  const nombre = item.nombre || item.archivo;
  box.innerHTML = '';

  if (isVideo(item.archivo) || isAnimation(item)) {
    const video = document.createElement('video');
    video.playsInline = true;
    if (item.animacion || isAnimation(item)) {
      video.muted = true;
      video.setAttribute('muted', '');
      video.autoplay = true;
      video.loop = true;
    } else {
      video.controls = true;
      video.preload = 'metadata';
    }
    if (isAnimation(item)) {
      // Sin MP4 todavía: se muestra el GIF original
      video.addEventListener('error', () => {
        const img = document.createElement('img');
        img.src = mediaOriginal(p, item);
        img.alt = nombre;
        video.replaceWith(img);
      }, { once: true });
    }
    video.src = mediaWeb(p, item);
    box.appendChild(video);
    return;
  }

  const zoom = document.createElement('button');
  zoom.type = 'button';
  zoom.className = 'detail-zoom';
  zoom.title = 'Ampliar';
  const img = document.createElement('img');
  img.alt = nombre;
  setSrcWithFallback(img, mediaWeb(p, item), mediaOriginal(p, item));
  zoom.appendChild(img);
  zoom.addEventListener('click', () => openLightbox(item, p));
  box.appendChild(zoom);
}

// Botón miniatura de la galería
function thumbButton(p, item, lazy = true) {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'detail-thumb';
  btn.title = item.nombre || item.archivo;
  const img = document.createElement('img');
  img.alt = '';
  if (lazy) img.loading = 'lazy';
  if (isVideo(item.archivo)) {
    img.addEventListener('error', () => img.remove(), { once: true }); // queda solo el ▶
    img.src = mediaThumb(p, item);
  } else {
    setSrcWithFallback(img, mediaThumb(p, item), mediaOriginal(p, item));
  }
  btn.appendChild(img);
  if (isVideo(item.archivo) || isAnimation(item)) {
    const marca = document.createElement('span');
    marca.textContent = item.animacion || isAnimation(item) ? '∞' : '▶';
    btn.appendChild(marca);
  }
  return btn;
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


/* ---------- 4. Menú lateral (botón hamburguesa) ---------- */

// Tipos de un proyecto: "tipo" puede ser un texto o una lista (varias categorías)
function typesOf(p) {
  const tipo = p && p.tipo;
  return (Array.isArray(tipo) ? tipo : [tipo]).filter(Boolean);
}

// Tipos únicos de los proyectos, en el orden en que aparecen en proyectos.js
function projectTypes() {
  return [...new Set(PROJECTS.flatMap(typesOf))];
}

// "Fabricación Manual y Digital" → "fabricacion_manual_y_digital"
function typeSlug(tipo) {
  return tipo.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
    .replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
}

// Lista "# tipo" bajo // proyectos: cada una abre proyectos.html filtrado por ese tipo
function renderMenuTypes() {
  const list = $('menuTypes');
  if (!list) return;
  list.innerHTML = '';
  projectTypes().forEach((tipo) => {
    const li = document.createElement('li');
    const a = document.createElement('a');
    a.href = `proyectos.html?tipo=${encodeURIComponent(tipo)}`;
    a.textContent = `# ${typeSlug(tipo)}`;
    li.appendChild(a);
    list.appendChild(li);
  });
}

function initSideMenu() {
  const menu = $('sideMenu');
  const toggle = $('menuToggle');
  if (!menu || !toggle) return;
  const overlay = $('sideMenuOverlay');
  const close = menu.querySelector('.side-menu-close');
  renderMenuTypes();

  // Marca la página actual
  const page = location.pathname.split('/').pop() || 'index.html';
  menu.querySelectorAll('.side-menu-title').forEach((a) => {
    if (a.getAttribute('href') === page) a.setAttribute('aria-current', 'page');
  });

  const setOpen = (open) => {
    menu.classList.toggle('open', open);
    overlay.classList.toggle('open', open);
    toggle.setAttribute('aria-expanded', String(open));
    if (open) close.focus();
  };

  toggle.addEventListener('click', () => setOpen(true));
  close.addEventListener('click', () => { setOpen(false); toggle.focus(); });
  overlay.addEventListener('click', () => setOpen(false));
  // "// contacto" abre su ventana emergente: el menú se cierra para no quedar encima
  menu.querySelectorAll('[data-open-modal]').forEach((a) => {
    a.addEventListener('click', () => setOpen(false));
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && menu.classList.contains('open')) {
      setOpen(false);
      toggle.focus();
    }
  });
}


/* ---------- 5. Teleprompter de proyectos (index.html) ----------
   Franja con el SVG de cada proyecto (assets/proyecto-XX/proyecto_XX.svg) que se
   desplaza sola y a velocidad constante (con el mouse encima, más lento). Cada ícono
   abre su proyecto, pero el desplazamiento no se puede arrastrar ni deslizar.
   Si un proyecto aún no tiene SVG aparece un recuadro con su nombre;
   al agregar el archivo a su carpeta aparece solo. */

const TICKER_SPEED = 60; // píxeles por segundo

function projectIcon(p) {
  return `${projectFolder(p)}proyecto_${p.id}.svg`;
}

// hidden = copia de relleno: los lectores de pantalla y el teclado la saltan
function tickerItem({ p, icon }, hidden) {
  const name = stripHtml(p.titulo);
  const a = document.createElement('a');
  a.className = 'ticker-item';
  a.href = `proyectos.html?ver#proyecto-${p.id}`;
  a.draggable = false;
  a.title = name;
  if (hidden) {
    a.tabIndex = -1;
    a.setAttribute('aria-hidden', 'true');
  } else {
    a.setAttribute('aria-label', `Ver proyecto ${name}`);
  }

  if (icon) {
    const img = document.createElement('img');
    img.src = icon;
    img.alt = '';
    img.draggable = false;
    a.appendChild(img);
  } else {
    const box = document.createElement('span');
    box.className = 'ticker-placeholder';
    box.textContent = `[ ${name} ]`;
    a.appendChild(box);
  }
  return a;
}

function buildTicker(ticker, items) {
  const track = ticker.querySelector('.ticker-track');
  track.innerHTML = '';
  const group = document.createElement('div');
  group.className = 'ticker-group';
  track.appendChild(group);

  // Repite los proyectos hasta cubrir el ancho de la franja (así no quedan huecos)
  let copy = 0;
  do {
    items.forEach((item) => group.appendChild(tickerItem(item, copy > 0)));
    copy++;
  } while (group.offsetWidth < ticker.clientWidth && copy < 20);

  // Segunda copia idéntica: la animación recorre una copia completa y vuelve
  // a empezar sin que se note el salto
  const clone = group.cloneNode(true);
  clone.setAttribute('aria-hidden', 'true');
  clone.querySelectorAll('a').forEach((a) => { a.tabIndex = -1; });
  track.appendChild(clone);

  track.style.setProperty('--ticker-duration', `${group.offsetWidth / TICKER_SPEED}s`);
}

/* Aumento tipo "dock" (inspirado en ui.aceternity.com/components/floating-dock):
   los íconos cercanos al cursor crecen un poco, más mientras más cerca, y vuelven
   suavemente a su tamaño. Como la franja se mueve sola, se recalcula en cada cuadro
   mientras el mouse está encima. Solo con mouse (en touch no hay "pasar por encima"). */
const TICKER_MAGNIFY = 0.5;     // aumento máximo (50%): sale del marco hacia arriba
const TICKER_REACH = 300;       // px desde el cursor en que todavía hay aumento (alcanza a los vecinos)
const TICKER_SMOOTH = 0.18;     // 0–1: qué tan rápido sigue al cursor

/* Frenado al pasar el cursor (inspirado en motion-primitives.com/docs/infinite-slider,
   speed 100 → speedOnHover 20): la franja baja a 1/5 de su velocidad y, al salir,
   recupera la velocidad de a poco. Cambia la velocidad de la animación CSS. */
const TICKER_HOVER_RATE = 0.2;  // velocidad con el cursor encima (1 = normal)
const TICKER_RATE_SMOOTH = 0.06; // 0–1: qué tan rápido frena o acelera

function initTickerMagnify(ticker) {
  let mouseX = null;
  let frame = null;
  let rate = 1;
  const scales = new WeakMap();

  const step = () => {
    let settling = false;

    // Frenado: acerca la velocidad a la deseada en cada cuadro
    const targetRate = mouseX !== null ? TICKER_HOVER_RATE : 1;
    rate += (targetRate - rate) * (reduceMotion ? 1 : TICKER_RATE_SMOOTH);
    if (Math.abs(targetRate - rate) < 0.005) rate = targetRate;
    else settling = true;
    const animation = ticker.querySelector('.ticker-track').getAnimations()[0];
    if (animation && animation.playbackRate !== rate) animation.playbackRate = rate;

    ticker.querySelectorAll('.ticker-item').forEach((item) => {
      let target = 1;
      if (mouseX !== null) {
        const r = item.getBoundingClientRect();
        const distance = Math.abs(r.left + r.width / 2 - mouseX);
        // Curva suave: máximo bajo el cursor, cero al llegar al alcance
        if (distance < TICKER_REACH) target = 1 + TICKER_MAGNIFY * Math.cos((distance / TICKER_REACH) * Math.PI / 2) ** 2;
      }
      const current = scales.get(item) || 1;
      let next = current + (target - current) * (reduceMotion ? 1 : TICKER_SMOOTH);
      if (Math.abs(target - next) < 0.002) next = target;
      else settling = true;
      scales.set(item, next);
      item.style.transform = next === 1 ? '' : `scale(${next.toFixed(3)})`;
    });
    // Sigue mientras el mouse esté encima o algún ícono aún esté volviendo a su tamaño
    frame = mouseX !== null || settling ? requestAnimationFrame(step) : null;
  };
  const start = () => { if (!frame) frame = requestAnimationFrame(step); };

  ticker.addEventListener('pointermove', (e) => {
    if (e.pointerType !== 'mouse') return;
    mouseX = e.clientX;
    start();
  });
  ticker.addEventListener('pointerleave', () => {
    mouseX = null;
    start();
  });
}

function initTicker() {
  const ticker = $('projectTicker');
  if (!ticker || !PROJECTS.length) return;

  // Revisa una sola vez qué proyectos tienen SVG y después arma la franja
  const checks = PROJECTS.map((p) => new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve({ p, icon: img.src });
    img.onerror = () => resolve({ p, icon: null });
    img.src = projectIcon(p);
  }));

  Promise.all(checks).then((items) => {
    buildTicker(ticker, items);
    initTickerMagnify(ticker);
    // Si cambia el ancho de la pantalla se recalcula cuántas copias hacen falta
    let width = ticker.clientWidth;
    let timer;
    window.addEventListener('resize', () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        if (ticker.clientWidth === width) return;
        width = ticker.clientWidth;
        buildTicker(ticker, items);
      }, 200);
    });
  });
}


/* ---------- 5b. Anillo 3D de proyectos (proyectos.html) — PRUEBA ----------
   Cada proyecto de proyectos.js es una lata low poly (placeholder) sobre un
   anillo que gira. La tarjeta de abajo muestra el proyecto que queda al centro.
   - Arrastrar el espacio vacío o usar la rueda: gira el anillo.
   - Arrastrar la lata del centro: la rota en 360°.
   - Clic en la lata del centro: abre la vista del proyecto.
   - Clic en otra lata: la trae al centro.
   proyectos.html?tipo=X (categorías del menú lateral) muestra solo los proyectos de ese tipo. */

// Proyectos del anillo: todos, o solo los del tipo pedido en la URL (si el tipo no existe, todos)
const RING_TYPE = new URLSearchParams(location.search).get('tipo') || '';
const RING_PROJECTS = (() => {
  const filtered = PROJECTS.filter((p) => typesOf(p).includes(RING_TYPE));
  return filtered.length ? filtered : PROJECTS;
})();
const RING_FILTERED = RING_PROJECTS !== PROJECTS;

// Aviso "filtro: # tipo · ver_todos" sobre el anillo
function renderRingFilter() {
  const box = $('ringFilter');
  if (!box || !RING_FILTERED) return;
  box.textContent = 'filtro: ';
  const name = document.createElement('strong');
  name.textContent = `# ${typeSlug(RING_TYPE)}`;
  const all = document.createElement('a');
  all.href = 'proyectos.html';
  all.textContent = 'ver_todos';
  box.append(name, ' · ', all);
  box.hidden = false;
}

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

// Color de una variable de la paleta del sitio (style.css / diseno.css), para el 3D
function paletteColor(name, fallback) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;
}

// Color de la etiqueta de la lata: el primero de la paleta del proyecto
function labelColor(p) {
  return (p.colores && p.colores[0] && p.colores[0].hex) || paletteColor('--scarlet', '#F20530');
}

const isEmpty = (value) => value === '' || value == null;

function fillDataList(dl, rows, hideEmpty = false) {
  dl.innerHTML = rows
    .filter(([, value]) => !(hideEmpty && isEmpty(value)))
    .map(([label, value]) => `<dt>${label}</dt><dd>${isEmpty(value) ? '—' : value}</dd>`)
    .join('');
}

// Ficha breve (nombre, categoría y descripción) que sigue al cursor sobre la lata del centro.
// Inspirada en ui.aceternity.com/components/tooltip-card
const TOOLTIP_OFFSET = 18; // px entre el cursor y la ficha

function fillRingTooltip(p) {
  const tip = $('ringTooltip');
  if (!tip || !p) return;
  tip.querySelector('.ring-tooltip-title').innerHTML = p.titulo; // puede traer <i>
  tip.querySelector('.ring-tooltip-type').textContent = typesOf(p).map((t) => `# ${typeSlug(t)}`).join(' ');
  tip.querySelector('.ring-tooltip-desc').textContent = p.resumen || '';
}

// x, y: posición del cursor en la pantalla. La ficha va abajo a la derecha del cursor
// y se da vuelta si no cabe.
function showRingTooltip(x, y) {
  const tip = $('ringTooltip');
  if (!tip) return;
  tip.classList.add('visible');
  const { offsetWidth: w, offsetHeight: h } = tip;
  let left = x + TOOLTIP_OFFSET;
  let top = y + TOOLTIP_OFFSET;
  if (left + w > window.innerWidth - 8) left = x - TOOLTIP_OFFSET - w;
  if (top + h > window.innerHeight - 8) top = y - TOOLTIP_OFFSET - h;
  tip.style.left = `${Math.max(8, left)}px`;
  tip.style.top = `${Math.max(8, top)}px`;
}

function hideRingTooltip() {
  const tip = $('ringTooltip');
  if (tip) tip.classList.remove('visible');
}

// Fotos del proyecto del centro, a la derecha del anillo (sin videos:
// esos se ven en la vista del proyecto). Las animaciones (GIF) sí se muestran.
let ringPhotosProject = null;
let ringPhotosTimer = null;
let ringPhotosToken = 0;        // descarta cargas de un proyecto que ya no está al centro
const RING_PHOTOS_DELAY = 350;  // ms quieto antes de cargar las fotos del proyecto del centro
const RING_LOADING_MAX = 8000;  // ms: tope por si una foto nunca termina de cargar

// ¿El anillo sigue girando? (lo define initProjectRing; sin 3D nunca gira)
let ringIsMoving = () => false;

// Animación "cargando_" sobre el panel de fotos
function setRingLoading(on) {
  const loading = $('ringLoading');
  if (!loading) return;
  loading.classList.toggle('visible', on);
  $('ringPhotos').setAttribute('aria-busy', String(on));
}

// Espera a que una imagen o video termine de cargar (o falle del todo).
// Las imágenes con respaldo pueden fallar dos veces: la versión web y el original.
function mediaLoaded(el) {
  return new Promise((resolve) => {
    if (!el) return resolve();
    if (el.tagName === 'VIDEO') {
      if (el.readyState >= 2) return resolve();
      el.addEventListener('loadeddata', resolve, { once: true });
      el.addEventListener('error', resolve, { once: true });
      return;
    }
    if (el.complete && el.naturalWidth) return resolve();
    let errores = 0;
    el.addEventListener('load', resolve, { once: true });
    el.addEventListener('error', () => { if (++errores >= 2) resolve(); });
  });
}

function ringPhotoList(p) {
  return (p.galeria || []).filter((item) => !isVideo(item.archivo));
}

let ringPhotoIndex = 0;

function showRingPhoto(p, index) {
  const main = $('ringPhotoMain');
  const fotos = ringPhotoList(p);
  if (!fotos.length) {
    main.innerHTML = '<div class="thumbnail-placeholder">[ SIN IMÁGENES ]</div>';
    return;
  }
  ringPhotoIndex = index = (index + fotos.length) % fotos.length;
  renderMainMedia(main, p, fotos[index]);
  $('ringPhotoThumbs').querySelectorAll('button').forEach((b, i) => b.classList.toggle('active', i === index));
}

function renderRingPhotos(p) {
  if (!$('ringPhotoMain')) return;
  const token = ++ringPhotosToken;
  if (p === ringPhotosProject) {   // volvió al mismo proyecto: sus fotos ya están
    setRingLoading(false);
    return;
  }
  ringPhotosProject = p;
  const thumbs = $('ringPhotoThumbs');
  const fotos = ringPhotoList(p);
  thumbs.innerHTML = '';
  fotos.forEach((item, i) => {
    // Sin carga diferida: son livianas y la animación espera a que estén todas
    const btn = thumbButton(p, item, false);
    btn.addEventListener('click', () => showRingPhoto(p, i));
    thumbs.appendChild(btn);
  });
  thumbs.hidden = fotos.length < 2;
  showRingPhoto(p, 0);

  // La animación sigue hasta que cargan la foto grande y las miniaturas
  const media = [$('ringPhotoMain').querySelector('img, video'), ...thumbs.querySelectorAll('img')];
  Promise.race([
    Promise.all(media.map(mediaLoaded)),
    new Promise((resolve) => setTimeout(resolve, RING_LOADING_MAX)),
  ]).then(() => {
    if (token === ringPhotosToken) setRingLoading(false);
  });
}

// Las fotos se cargan cuando el anillo se detiene: al girar rápido no descarga
// la galería de cada proyecto por el que pasa. Mientras tanto, "cargando_".
function scheduleRingPhotos(p) {
  clearTimeout(ringPhotosTimer);
  ringPhotosToken++;   // una carga anterior que termine ahora ya no apaga la animación
  setRingLoading(true);
  const intentar = () => {
    if (ringIsMoving()) ringPhotosTimer = setTimeout(intentar, 120);
    else renderRingPhotos(p);
  };
  ringPhotosTimer = setTimeout(intentar, RING_PHOTOS_DELAY);
}

// Proyecto que quedó al centro del anillo: nombre, indicador, descripción, fotos y ficha
function updateRingSelection(index) {
  const p = RING_PROJECTS[index];
  if (!p) {
    setEncrypted($('ringName'), 'SIN PROYECTOS');
    $('ringCounter').textContent = '0/0';
    return;
  }

  setEncrypted($('ringName'), stripHtml(p.titulo));
  $('ringCounter').textContent = `${index + 1}/${RING_PROJECTS.length}`;
  $('ringDesc').textContent = p.resumen || '';
  scheduleRingPhotos(p);
  fillRingTooltip(p);

  // Enlace directo al proyecto (lo usa también el editor: proyectos.html#proyecto-XX)
  history.replaceState(null, '', `#proyecto-${p.id}`);
}

function initialRingIndex() {
  const id = location.hash.replace('#proyecto-', '');
  const i = RING_PROJECTS.findIndex((p) => p.id === id);
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
        if (!geometries.length) { reject(new Error('El modelo no tiene mallas')); return; }
        // Centra el modelo en el origen: así gira como trompo sobre el eje del canvas
        // que pasa por su centro, y no alrededor del origen con que se exportó el archivo
        const box = new THREE.Box3();
        geometries.forEach((g) => { g.computeBoundingBox(); box.union(g.boundingBox); });
        const center = box.getCenter(new THREE.Vector3());
        geometries.forEach((g) => { g.translate(-center.x, -center.y, -center.z); g.computeBoundingSphere(); });
        resolve(geometries);
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
  const colores = [
    paletteColor('--cream', '#EEDBBF'), paletteColor('--midnight', '#0C1226'),
    paletteColor('--amber', '#F29F05'), paletteColor('--black', '#070B17'),
    paletteColor('--scarlet', '#F20530'), paletteColor('--deep-red', '#8C0B3B'),
  ];
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
  renderer.setClearColor(paletteColor('--black', '#070B17')); // mismo color que los paneles

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
    ambiente: { cielo: '#EEDBBF', suelo: '#8C0B3B', intensidad: 0.6 },
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

// Ejes del canvas: X = horizontal de la pantalla, Y = vertical de la pantalla
// (arreglos simples: THREE puede no estar cargado cuando se lee este archivo)
const CANVAS_X = [1, 0, 0];
const CANVAS_Y = [0, 1, 0];

// Gira un objeto en un eje del canvas (visto desde la cámara), no en sus ejes propios:
// así da igual la "rotacion" del proyecto o cuánto haya girado el anillo
function rotateOnCanvasAxis(object, camera, canvasAxis, angle) {
  const parentQ = new THREE.Quaternion();
  object.parent.getWorldQuaternion(parentQ);
  const axis = new THREE.Vector3(...canvasAxis)
    .applyQuaternion(camera.quaternion)   // eje de pantalla -> mundo
    .applyQuaternion(parentQ.invert())    // mundo -> espacio del padre del objeto
    .normalize();
  object.quaternion.premultiply(new THREE.Quaternion().setFromAxisAngle(axis, angle));
}

// Gira un objeto según el arrastre del mouse: horizontal = eje Y del canvas, vertical = eje X del canvas (360° libre)
function rotateByDrag(object, camera, dx, dy) {
  const k = RING_SETTINGS.modelSensitivity;
  rotateOnCanvasAxis(object, camera, CANVAS_Y, dx * k);
  rotateOnCanvasAxis(object, camera, CANVAS_X, dy * k);
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

// Tecla de navegación: ← o < = -1, → o > = 1 (si no, 0). Con Ctrl/Alt/Cmd no cuenta.
function navStep(e) {
  if (e.ctrlKey || e.altKey || e.metaKey) return 0;
  return { ArrowLeft: -1, '<': -1, ArrowRight: 1, '>': 1 }[e.key] || 0;
}

// Rectángulo donde se ve de verdad una imagen/video con object-fit: contain
function shownMediaRect(el) {
  const r = el.getBoundingClientRect();
  const w = el.naturalWidth || el.videoWidth;
  const h = el.naturalHeight || el.videoHeight;
  if (!w || !h) return r;
  const scale = Math.min(r.width / w, r.height / h);
  const sw = w * scale;
  const sh = h * scale;
  const left = r.left + (r.width - sw) / 2;
  const top = r.top + (r.height - sh) / 2;
  return { left, top, right: left + sw, bottom: top + sh };
}

// -1 / 1 si el puntero está en el panel pero fuera de la imagen (según el lado), 0 si está sobre ella
function sideOfMedia(box, e) {
  const media = box.querySelector('img, video');
  if (media) {
    const m = shownMediaRect(media);
    if (e.clientX >= m.left && e.clientX <= m.right && e.clientY >= m.top && e.clientY <= m.bottom) return 0;
  }
  const r = box.getBoundingClientRect();
  return e.clientX < r.left + r.width / 2 ? -1 : 1;
}

// Clic dentro del panel pero fuera de la foto: va a la anterior (mitad izquierda) o a la siguiente
function initSideClickNav(box, go) {
  if (!box) return;
  box.addEventListener('click', (e) => {
    const step = sideOfMedia(box, e);
    if (!step) return;
    e.preventDefault();
    e.stopPropagation(); // no abre la imagen ampliada
    go(step);
  }, true);
  box.addEventListener('mousemove', (e) => {
    const step = sideOfMedia(box, e);
    box.classList.toggle('nav-prev', step < 0);
    box.classList.toggle('nav-next', step > 0);
  });
  box.addEventListener('mouseleave', () => box.classList.remove('nav-prev', 'nav-next'));
}


/* ----- Vista del proyecto (reemplaza al anillo dentro de la sección) ----- */

let detailViewer = null;   // visor 3D grande, se crea la primera vez que se abre
let detailProject = null;
let detailMediaIndex = 0;
let closeDetailHandler = null;

// Información del proyecto por secciones: una pestaña por sección, se ve una a la vez
function showDetailTab(index) {
  const tabs = document.querySelectorAll('#detailBody .detail-tab');
  const panels = document.querySelectorAll('#detailBody .detail-block');
  tabs.forEach((t, i) => {
    t.classList.toggle('active', i === index);
    t.setAttribute('aria-selected', i === index);
    t.tabIndex = i === index ? 0 : -1;
  });
  panels.forEach((panel, i) => { panel.hidden = i !== index; panel.scrollTop = 0; });
}

function initDetailTabs() {
  const tabs = [...document.querySelectorAll('#detailBody .detail-tab')];
  tabs.forEach((tab, i) => {
    tab.addEventListener('click', () => showDetailTab(i));
    // Flechas izquierda/derecha recorren las pestañas (patrón de pestañas accesibles)
    tab.addEventListener('keydown', (e) => {
      const step = navStep(e);
      if (!step) return;
      e.preventDefault();
      const next = (i + step + tabs.length) % tabs.length;
      showDetailTab(next);
      tabs[next].focus();
    });
  });
  showDetailTab(0);
}

function renderDetailBody(p) {
  const etiquetas = (p.etiquetas || []).map((t) => `<span class="tag">${t}</span>`).join('');

  const parrafos = (p.descripcion && p.descripcion.length ? p.descripcion : [p.resumen])
    .filter(Boolean)
    .map((t) => `<p>${t}</p>`)
    .join('');

  const info = [
    ['TIPO', typesOf(p).join(', ')], ['CURSO', p.curso], ['AÑO', p.anio],
    ['OBJETIVO', p.objetivo], ['DESAFÍO', p.desafio], ['TAMAÑO', p.tamano],
  ];
  // Igual que en el editor: las filas sin valor no se muestran
  const ficha = Object.entries(p.ficha || {}).filter(([, v]) => !isEmpty(v));

  const dif = p.dificultad;
  const dificultad = dif && dif.porcentaje != null ? `
    <div class="skill-bar difficulty"><div class="skill-fill" style="width:${dif.porcentaje}%"></div></div>
    <p class="detail-note">${dif.texto || ''} (${dif.porcentaje}%)</p>` : '';

  // Colores del proyecto (sin nombre): cuadrados que muestran el hex al pasar el cursor
  // y lo copian al hacer clic (ver initSwatchCopy)
  const colores = (p.colores || []).filter((c) => c && c.hex).map((c) => `
    <button type="button" class="swatch-copy" style="--swatch:${c.hex}" data-hex="${c.hex}" aria-label="Copiar ${c.hex}"></button>`).join('');

  const dl = (rows) => {
    const tmp = document.createElement('dl');
    tmp.className = 'project-card-data';
    fillDataList(tmp, rows, true);
    return tmp.outerHTML;
  };

  // La ficha técnica: datos arriba y, abajo a la derecha, los colores (sin título)
  const fichaHtml = (ficha.length || colores) && `
    <div class="ficha-layout">
      ${ficha.length ? dl(ficha) : ''}
      ${colores ? `<div class="swatch-row" aria-label="Colores del proyecto">${colores}</div>` : ''}
    </div>`;

  // [título de la pestaña, contenido]; las secciones vacías no aparecen
  const secciones = [
    ['DESCRIPCIÓN', parrafos && `<div class="detail-text">${parrafos}</div>`],
    ['INFO', dl(info)],
    ['FICHA_TECNICA', fichaHtml],
    ['DIFICULTAD', dificultad],
  ].filter(([, html]) => html);

  $('detailBody').innerHTML = `
    <div class="detail-header">
      <h3 class="detail-heading">${p.encabezado || p.titulo}</h3>
      ${p.subtitulo ? `<p class="detail-subtitle">${p.subtitulo}</p>` : ''}
      ${etiquetas ? `<div class="tags">${etiquetas}</div>` : ''}
    </div>
    <div class="detail-tabs" role="tablist" aria-label="Secciones del proyecto">
      ${secciones.map(([title], i) => `
        <button type="button" class="detail-tab" role="tab" id="detailTab${i}" aria-controls="detailSection${i}">/// ${title}</button>`).join('')}
    </div>
    ${secciones.map(([, html], i) => `
      <div class="detail-block" role="tabpanel" id="detailSection${i}" aria-labelledby="detailTab${i}" tabindex="0">${html}</div>`).join('')}`;
  initDetailTabs();
  initSwatchCopy($('detailBody'));
}

// Clic en un color de la ficha técnica: copia su código hex
function initSwatchCopy(root) {
  if (!root || root.dataset.swatchCopy) return;
  root.dataset.swatchCopy = '1';
  root.addEventListener('click', async (e) => {
    const btn = e.target.closest('.swatch-copy');
    if (!btn) return;
    const hex = btn.dataset.hex;
    let ok = false;
    try {
      await navigator.clipboard.writeText(hex);
      ok = true;
    } catch (err) {
      // Sin permiso de portapapeles (p. ej. abriendo el archivo sin servidor): método antiguo
      const tmp = document.createElement('textarea');
      tmp.value = hex;
      document.body.appendChild(tmp);
      tmp.select();
      ok = document.execCommand('copy');
      tmp.remove();
    }
    btn.dataset.copied = ok ? 'copiado' : 'error';
    clearTimeout(btn._copyTimer);
    btn._copyTimer = setTimeout(() => delete btn.dataset.copied, 1200);
  });
}

// Visor del proyecto: el ítem 0 es el modelo 3D; los siguientes, los archivos de la galería
// (imagen, animación o video). La foto se muestra encima del visor 3D, que se pausa.
function showDetailMedia(index) {
  const galeria = (detailProject && detailProject.galeria) || [];
  const total = galeria.length + 1;
  const main = $('detailMain');
  pauseMediaIn(main);

  detailMediaIndex = (index + total) % total;
  const is3D = detailMediaIndex === 0;
  main.hidden = is3D;
  $('detailReset').hidden = !is3D;
  document.querySelectorAll('#detailThumbs button').forEach((b, i) => b.classList.toggle('active', i === detailMediaIndex));

  if (is3D) {
    main.innerHTML = '';
    $('detailCaption').textContent = `${modelLabel(detailProject)} · Luz: ${lightPreset(detailProject).nombre}`;
    startDetailLoop();
    return;
  }

  if (detailViewer) detailViewer.running = false;
  const item = galeria[detailMediaIndex - 1];
  renderMainMedia(main, detailProject, item);
  $('detailCaption').textContent = `${detailMediaIndex}/${galeria.length} — ${item.nombre || item.archivo}`;
}

function renderDetailThumbs(p) {
  const thumbs = $('detailThumbs');
  thumbs.innerHTML = '';

  const model = document.createElement('button');
  model.type = 'button';
  model.className = 'detail-thumb detail-thumb-3d';
  model.setAttribute('aria-label', 'Modelo 3D');
  model.textContent = '3D';
  model.addEventListener('click', () => showDetailMedia(0));
  thumbs.appendChild(model);

  (p.galeria || []).forEach((item, i) => {
    const btn = thumbButton(p, item);
    btn.addEventListener('click', () => showDetailMedia(i + 1));
    thumbs.appendChild(btn);
  });
}

/* Imagen ampliada como "tarjeta 3D": se inclina siguiendo el mouse
   (efecto inspirado en ui.aceternity.com/components/3d-card-effect).
   Con < y > (o las flechas del teclado) se recorren las imágenes del proyecto. */
let lightboxImages = [];
let lightboxIndex = 0;
let lightboxProject = null;

// project: el proyecto de la imagen. Solo recorre fotos (no videos ni animaciones).
function openLightbox(item, project) {
  lightboxProject = project;
  const galeria = (project && project.galeria) || [];
  lightboxImages = galeria.filter((g) => !isVideo(g.archivo) && !isAnimation(g));
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
  const nombre = item.nombre || item.archivo;

  $('lightboxMedia').innerHTML = `
    <div class="card3d" id="lightboxCard">
      <img class="card3d-img" alt="${nombre}">
      <p class="card3d-caption">${nombre}${total > 1 ? ` <span>${lightboxIndex + 1}/${total}</span>` : ''}</p>
    </div>`;
  encryptText($('lightboxTitle'), nombre);
  $('lightboxPrev').hidden = $('lightboxNext').hidden = total < 2;

  // Versión web (1600 px); si no existe, el original. Se ajusta al tamaño al cargar.
  const img = $('lightboxMedia').querySelector('.card3d-img');
  img.addEventListener('load', fitLightboxImage);
  setSrcWithFallback(img, mediaWeb(lightboxProject, item), mediaOriginal(lightboxProject, item));
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
    const step = navStep(e);
    if (!step) return;
    e.preventDefault();
    showLightboxImage(lightboxIndex + step);
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
  // Misma lente que el anillo, para que el modelo se vea igual que al centro de él
  const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 100);
  let viewer;
  try {
    viewer = createViewer($('detailCanvas'), stage, camera);
  } catch (err) {
    $('detailFallback').hidden = false;
    return null;
  }

  // Zoom como múltiplo de la distancia del anillo (1 = el mismo encuadre que la lata del centro)
  const ZOOM = { min: 0.6, max: 1.8, start: 1 };
  let distance = ZOOM.start;
  // Cámara del anillo vista desde la lata del frente: mismo ángulo desde arriba
  const camOffset = new THREE.Vector3(0, 1.6, RING_SETTINGS.cameraZPosition - RING_SETTINGS.ringRadius);
  const lookOffset = new THREE.Vector3(0, -0.35, -3);
  let dragging = false;
  let last = null;

  detailViewer = { ...viewer, camera, can: null, running: false };

  const placeCamera = () => {
    camera.position.copy(camOffset).multiplyScalar(distance);
    camera.lookAt(lookOffset.clone().multiplyScalar(distance));
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
    rotateByDrag(detailViewer.can.userData.spinner, camera, e.clientX - last.x, e.clientY - last.y);
    last = { x: e.clientX, y: e.clientY };
  });
  const release = () => { dragging = false; stage.classList.remove('dragging'); };
  stage.addEventListener('pointerup', release);
  stage.addEventListener('pointercancel', release);
  stage.addEventListener('wheel', (e) => {
    e.preventDefault();
    distance = Math.max(ZOOM.min, Math.min(ZOOM.max, distance + e.deltaY * 0.0007));
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

// El modelo tal como se ve al centro del anillo: el anillo gira el conjunto
// (-índice × paso) y la lata del centro se agranda un 10 %; aquí se repite igual
function buildDetailModel(p, index) {
  const pivot = buildModel(p);
  const holder = new THREE.Group();
  holder.add(pivot);
  holder.rotation.y = -index * (Math.PI * 2) / RING_PROJECTS.length;
  holder.scale.setScalar(1.1);
  holder.userData.spinner = pivot.userData.spinner;
  return holder;
}

function openProjectDetail(index, onClose) {
  const p = RING_PROJECTS[index];
  if (!p) return;
  detailProject = p;

  encryptText($('detailTitle'), `SYS_${p.id}: ${p.titulo}`);
  renderDetailBody(p);
  encryptAll(ENCRYPT_TITLES, $('detailBody'));
  renderDetailThumbs(p);

  $('ringView').hidden = true;
  $('detailView').hidden = false;

  const viewer = initDetailViewer();
  if (viewer) {
    if (viewer.can) { viewer.scene.remove(viewer.can); disposeObject(viewer.can); }
    viewer.can = buildDetailModel(p, index);
    viewer.scene.add(viewer.can);
    applyLight(viewer, lightPreset(p), viewer.can, 1);
    viewer.reset();
  }
  showDetailMedia(0); // abre en el modelo 3D (y arranca su animación)

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

// Abre la vista del proyecto del centro (la define initProjectRing; la usa openLinkedProject)
let openRingProject = null;

function initProjectRing() {
  const stage = $('ringStage');
  if (!stage) return;

  const count = RING_PROJECTS.length;
  let currentIndex = initialRingIndex();
  let ringRunning = true;
  let startRingLoop = () => {};

  // Avanza o retrocede "delta" proyectos (sin 3D solo cambia la selección)
  let moveBy = (delta) => {
    if (!count) return;
    currentIndex = (currentIndex + delta + count) % count;
    updateRingSelection(currentIndex);
  };

  const openDetail = () => {
    if (!count) return;
    hideRingTooltip();
    ringRunning = false; // el anillo no se dibuja mientras la vista del proyecto está abierta
    openProjectDetail(currentIndex, () => { ringRunning = true; startRingLoop(); stage.focus({ preventScroll: true }); });
  };
  openRingProject = openDetail;

  // Flechas dentro del anillo: no deben iniciar el arrastre del anillo
  // (ni mostrar la ficha de la lata al pasar por encima)
  ['ringPrev', 'ringNext', 'ringSelect'].forEach((id, i) => {
    const button = $(id);
    button.addEventListener('pointerdown', (e) => e.stopPropagation());
    button.addEventListener('pointermove', (e) => { e.stopPropagation(); hideRingTooltip(); });
    button.addEventListener('keydown', (e) => { if (!navStep(e)) e.stopPropagation(); }); // Enter/espacio = solo este botón
    button.addEventListener('click', () => (id === 'ringSelect' ? openDetail() : moveBy(i === 0 ? -1 : 1)));
  });
  stage.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); openDetail(); }
  });
  // Flechas o < y >: en el anillo lo giran; en la vista del proyecto recorren la galería
  // (Esc no vuelve al anillo: solo cierra la imagen ampliada y las ventanas emergentes)
  document.addEventListener('keydown', (e) => {
    const step = navStep(e);
    if (!step || document.querySelector('.modal-overlay.open, .side-menu.open')) return;
    if (e.target.closest && e.target.closest('input, textarea, select, [contenteditable="true"], .detail-tab')) return;
    e.preventDefault();
    if ($('detailView').hidden) moveBy(step);
    else showDetailMedia(detailMediaIndex + step);
  });
  // Clic en el panel de fotos fuera de la imagen: anterior / siguiente
  initSideClickNav($('detailMain'), (step) => showDetailMedia(detailMediaIndex + step));
  initSideClickNav($('ringPhotoMain'), (step) => ringPhotosProject && showRingPhoto(ringPhotosProject, ringPhotoIndex + step));

  renderRingFilter();
  updateRingSelection(currentIndex);
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
  // Las latas del fondo se funden con el color del panel
  scene.fog = new THREE.Fog(paletteColor('--black', '#070B17'), 8, 17);

  // Cámara un poco elevada mirando a la lata del frente; el resto del anillo queda detrás
  camera.position.set(0, 1.6, RING_SETTINGS.cameraZPosition);
  camera.lookAt(0, -0.35, RING_SETTINGS.ringRadius - 3);

  // Las latas se reparten en el anillo; la del ángulo 0 queda frente a la cámara
  const ring = new THREE.Group();
  const step = (Math.PI * 2) / count;
  const cans = RING_PROJECTS.map((p, i) => {
    const can = buildModel(p);
    can.position.set(Math.sin(i * step) * RING_SETTINGS.ringRadius, 0, Math.cos(i * step) * RING_SETTINGS.ringRadius);
    can.userData.index = i;
    ring.add(can);
    return can;
  });
  scene.add(ring);
  applyLight(viewer, lightPreset(RING_PROJECTS[currentIndex]), ring, 1);

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
  // avanzan varios proyectos. La selección cambia de inmediato.
  moveBy = (delta) => {
    hideRingTooltip(); // la lata bajo el cursor cambia: la ficha vuelve al mover el mouse
    velocity = 0;
    const base = goal !== null ? goal : -Math.round(-rotation / step) * step;
    goal = base - delta * step;
    currentIndex = indexAt(goal);
    updateRingSelection(currentIndex);
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
  // Las fotos del panel esperan a que el anillo se detenga (ver scheduleRingPhotos)
  ringIsMoving = () => (drag && drag.mode === 'ring') || !isSettled();

  stage.addEventListener('pointerdown', (e) => {
    hideRingTooltip();
    const hit = canAt(e);
    const onSelected = hit === currentIndex && hit === indexAt(rotation);
    drag = { mode: onSelected ? 'model' : 'ring', hit, startX: e.clientX, startY: e.clientY, lastX: e.clientX, lastY: e.clientY, moved: false };
    if (drag.mode === 'ring') { goal = null; velocity = 0; }
    stage.setPointerCapture(e.pointerId);
    stage.classList.add('dragging');
  });

  stage.addEventListener('pointermove', (e) => {
    if (!drag) {
      // Sobre las flechas no cuenta la lata que haya detrás
      const hit = e.target.closest('.ring-arrow') ? -1 : canAt(e);
      // Pista visual: la lata del centro se puede rotar y abrir
      const overModel = hit === currentIndex && isSettled();
      stage.classList.toggle('over-model', overModel);
      stage.classList.toggle('over-can', hit >= 0 && hit !== currentIndex);
      // Ficha del proyecto junto al cursor (solo con mouse o lápiz; en touch no hay "pasar por encima")
      if (overModel && e.pointerType !== 'touch') showRingTooltip(e.clientX, e.clientY);
      else hideRingTooltip();
      return;
    }
    const dx = e.clientX - drag.lastX;
    const dy = e.clientY - drag.lastY;
    drag.lastX = e.clientX;
    drag.lastY = e.clientY;
    if (Math.hypot(e.clientX - drag.startX, e.clientY - drag.startY) > RING_SETTINGS.clickTolerance) drag.moved = true;
    if (!drag.moved) return;

    if (drag.mode === 'model') {
      rotateByDrag(cans[currentIndex].userData.spinner, camera, dx, dy);
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
  stage.addEventListener('pointerleave', () => {
    hideRingTooltip();
    stage.classList.remove('over-model', 'over-can');
  });

  // Rueda del mouse sobre el anillo
  stage.addEventListener('wheel', (e) => {
    e.preventDefault();
    hideRingTooltip();
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

    // Al arrastrar o con la rueda, la selección sigue a la lata del centro
    const front = indexAt(rotation);
    if (goal === null && front !== currentIndex) {
      currentIndex = front;
      updateRingSelection(currentIndex);
    }

    // La lata del centro se agranda un poco y gira sola, salvo que se esté rotando a mano
    const autoSpin = !reduceMotion && performance.now() - lastModelTouch > 3000;
    cans.forEach((can, i) => {
      const target = i === front ? 1.1 : 1;
      const s = can.userData.highlight = (can.userData.highlight || 1) + (target - (can.userData.highlight || 1)) * 0.1;
      const base = modelSettings(RING_PROJECTS[i]).escala;
      can.scale.set(base[0] * s, base[1] * s, base[2] * s);
      const spinner = can.userData.spinner;
      if (i === front) {
        if (autoSpin && !(drag && drag.mode === 'model')) {
          // Giro de trompo en el eje vertical del canvas (pasa por el centro del modelo), independiente de su pose
          rotateOnCanvasAxis(spinner, camera, CANVAS_Y, -0.012);
        }
      } else if (spinner.quaternion.angleTo(POSE_ORIGEN) > 0.001) {
        // Al dejar el centro, el modelo vuelve suavemente a su pose de origen
        spinner.quaternion.slerp(POSE_ORIGEN, 0.12);
      } else {
        spinner.quaternion.identity();
      }
    });

    // La luz pasa suavemente al estilo del proyecto del centro
    applyLight(viewer, lightPreset(RING_PROJECTS[front]), ring, 0.06);

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


/* ---------- 6b. Fondo "matrix trail" (todas las páginas) ----------
   Grilla de 0 y 1 que se encienden bajo el cursor y se apagan
   dejando un rastro (inspirado en ui.aceternity.com/interactions/matrix-trail).
   El canvas va fijo detrás del marco central (.wrapper), que es opaco,
   así que el rastro solo se ve en el fondo de afuera. */
const TRAIL_CELL = 18;      // px por celda
const TRAIL_RADIUS = 2.2;   // radio del pincel, en celdas
const TRAIL_DECAY = 0.025;  // cuánto se apaga cada celda por cuadro (~0.7 s)
const TRAIL_FLIP = 0.08;    // probabilidad por cuadro de que una celda cambie 0 ↔ 1

function initMatrixTrail() {
  if (!document.querySelector('.wrapper')) return;
  const canvas = document.createElement('canvas');
  canvas.className = 'matrix-trail';
  canvas.setAttribute('aria-hidden', 'true');
  document.body.prepend(canvas);
  const ctx = canvas.getContext('2d');

  const head = hexToRgb(paletteColor('--amber', '#F29F05'));
  const tail = hexToRgb(paletteColor('--scarlet', '#F20530'));
  let cols = 0, rows = 0, life, chars, dpr = 1;
  const active = new Set();
  let running = false, last = null;

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = innerWidth * dpr;
    canvas.height = innerHeight * dpr;
    cols = Math.ceil(innerWidth / TRAIL_CELL);
    rows = Math.ceil(innerHeight / TRAIL_CELL);
    life = new Float32Array(cols * rows);
    chars = new Uint8Array(cols * rows).map(() => Math.random() < 0.5 ? 0 : 1);
    active.clear();
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.font = `${TRAIL_CELL}px ${getComputedStyle(document.body).getPropertyValue('--font-display') || 'monospace'}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.clearRect(0, 0, innerWidth, innerHeight);
  }

  // Enciende las celdas alrededor de (x, y)
  function stamp(x, y) {
    const cx = x / TRAIL_CELL, cy = y / TRAIL_CELL;
    const r = Math.ceil(TRAIL_RADIUS);
    for (let j = Math.floor(cy) - r; j <= Math.floor(cy) + r; j++) {
      if (j < 0 || j >= rows) continue;
      for (let i = Math.floor(cx) - r; i <= Math.floor(cx) + r; i++) {
        if (i < 0 || i >= cols) continue;
        const d = Math.hypot(i + 0.5 - cx, j + 0.5 - cy) / TRAIL_RADIUS;
        if (d > 1 || Math.random() < d * 0.6) continue; // borde irregular
        const k = j * cols + i;
        const v = 1 - d * 0.5;
        if (v > life[k]) {
          if (life[k] === 0) chars[k] = Math.random() < 0.5 ? 0 : 1;
          life[k] = v;
        }
        active.add(k);
      }
    }
  }

  function frame() {
    ctx.clearRect(0, 0, innerWidth, innerHeight);
    for (const k of active) {
      const v = life[k];
      if (v <= 0) { life[k] = 0; active.delete(k); continue; }
      if (!reduceMotion && Math.random() < TRAIL_FLIP) chars[k] ^= 1;
      // recién encendida = ámbar; al apagarse pasa a escarlata y se desvanece
      const r = Math.round(tail.r + (head.r - tail.r) * v);
      const g = Math.round(tail.g + (head.g - tail.g) * v);
      const b = Math.round(tail.b + (head.b - tail.b) * v);
      ctx.fillStyle = `rgba(${r},${g},${b},${Math.min(1, v * 1.2)})`;
      const i = k % cols, j = (k - i) / cols;
      ctx.fillText(chars[k], (i + 0.5) * TRAIL_CELL, (j + 0.5) * TRAIL_CELL);
      life[k] = v - TRAIL_DECAY;
    }
    if (active.size) requestAnimationFrame(frame);
    else running = false;
  }

  window.addEventListener('pointermove', (e) => {
    // interpola entre posiciones para que el rastro no quede con huecos
    const from = last || { x: e.clientX, y: e.clientY };
    const steps = Math.max(1, Math.ceil(Math.hypot(e.clientX - from.x, e.clientY - from.y) / (TRAIL_CELL * 0.75)));
    for (let s = 1; s <= steps; s++) {
      stamp(from.x + (e.clientX - from.x) * s / steps, from.y + (e.clientY - from.y) * s / steps);
    }
    last = { x: e.clientX, y: e.clientY };
    if (!running) { running = true; requestAnimationFrame(frame); }
  }, { passive: true });
  document.documentElement.addEventListener('pointerleave', () => { last = null; });
  window.addEventListener('pointerdown', () => { last = null; }); // en táctil no une toques separados
  window.addEventListener('blur', () => { last = null; });
  window.addEventListener('resize', resize);
  resize();
  // la fuente VT323 puede cargar después: actualiza el canvas cuando esté lista
  if (document.fonts) document.fonts.ready.then(resize);
}


/* ---------- 6d. Habilidades: barras o gráfico araña (sobre_mi.html) ----------
   Los datos salen de las barras del HTML (nombre y width en %), así que
   para cambiar una habilidad basta con editar sobre_mi.html.
   La vista elegida se recuerda entre visitas. */
// El gráfico se dibuja en píxeles reales según el espacio disponible, así los nombres
// mantienen su tamaño aunque el gráfico se achique; se redibuja al cambiar el tamaño.
// (el ancho y alto de las etiquetas se miden en drawRadar con la letra de las barras)
const RADAR = { labelGap: 8, minRadius: 40, rings: [25, 50, 75, 100] };
const SVG_NS = 'http://www.w3.org/2000/svg';
const RADAR_FILLS_COLUMN = window.matchMedia('(min-width: 901px)'); // igual que en style.css

function svgEl(tag, attrs = {}) {
  const el = document.createElementNS(SVG_NS, tag);
  Object.entries(attrs).forEach(([k, v]) => el.setAttribute(k, v));
  return el;
}

const skillShortName = (name) => name.replace(/^#\s*/, '');

// Mide texto con la misma letra que el nombre en la vista de barras
const measureCtx = document.createElement('canvas').getContext('2d');
function skillFont(group) {
  const ref = group.querySelector('.skill-name');
  const cs = getComputedStyle(ref || group);
  return { css: `${cs.fontSize} ${cs.fontFamily}`, size: parseFloat(cs.fontSize) || 13 };
}
function textWidth(text, font) {
  measureCtx.font = font;
  return measureCtx.measureText(text).width;
}

// Nombre para el gráfico: el mismo que en las barras ("# nombre"), partido en líneas
// que no pasen de maxW píxeles ("#" siempre va pegado a la primera palabra)
function radarLabelLines(name, font, maxW) {
  const words = skillShortName(name).split(/\s+/);
  words[0] = `# ${words[0]}`;
  const lines = [];
  words.forEach((word) => {
    const lastLine = lines[lines.length - 1];
    if (lastLine && textWidth(`${lastLine} ${word}`, font) <= maxW) lines[lines.length - 1] = `${lastLine} ${word}`;
    else lines.push(word);
  });
  return lines;
}

function drawRadar(box, skills) {
  const { labelGap, minRadius, rings } = RADAR;
  const w = box.clientWidth;
  if (!w) return; // vista oculta: se dibuja al mostrarse
  // Alto: en escritorio, el que le da la columna; en celular, uno proporcional al ancho
  const h = RADAR_FILLS_COLUMN.matches ? box.clientHeight : Math.min(w * 0.8, 320);
  if (!h) return;
  // Etiquetas con la letra de las barras: su ancho y alto reales definen cuánto espacio dejar
  const font = skillFont(box.parentElement);
  const longestWord = Math.max(...skills.flatMap((s) => radarLabelLines(s.name, font.css, 0)).map((l) => textWidth(l, font.css)));
  const maxLineW = Math.max(longestWord, w * 0.3);
  const labels = skills.map((s) => radarLabelLines(s.name, font.css, maxLineW));
  const labelW = Math.max(...labels.flat().map((l) => textWidth(l, font.css)));
  const labelH = Math.max(...labels.map((l) => l.length)) * font.size * 1.2;
  const radius = Math.max(minRadius, Math.min((w - 2 * (labelW + labelGap)) / 2, (h - 2 * (labelH + labelGap)) / 2));
  const cx = w / 2, cy = h / 2;
  const n = skills.length;
  // Primer eje hacia arriba, luego en sentido horario
  const at = (i, r) => {
    const a = -Math.PI / 2 + (i * 2 * Math.PI) / n;
    return [cx + Math.cos(a) * r, cy + Math.sin(a) * r];
  };
  const poly = (r) => skills.map((_, i) => at(i, r).join(',')).join(' ');

  const svg = svgEl('svg', { width: w, height: h, viewBox: `0 0 ${w} ${h}`, role: 'img' });
  svg.setAttribute('aria-label', `Gráfico araña: ${skills.map((s) => `${skillShortName(s.name)} ${s.value}%`).join(', ')}`);

  // Grilla: anillos cada 25% y un eje por habilidad
  rings.forEach((pct) => svg.appendChild(svgEl('polygon', { class: 'radar-grid', points: poly(radius * pct / 100) })));
  skills.forEach((_, i) => {
    const [x, y] = at(i, radius);
    svg.appendChild(svgEl('line', { class: 'radar-axis', x1: cx, y1: cy, x2: x, y2: y }));
  });
  // Escala en el primer eje (solo 50% y 100%, para no recargar)
  [50, 100].forEach((pct) => {
    const t = svgEl('text', { class: 'radar-tick', x: cx + 4, y: cy - radius * pct / 100 + 10 });
    t.textContent = `${pct}%`;
    svg.appendChild(t);
  });

  // Área de los valores
  svg.appendChild(svgEl('polygon', {
    class: 'radar-area',
    points: skills.map((s, i) => at(i, radius * s.value / 100).join(',')).join(' '),
    style: `--cx:${cx}px; --cy:${cy}px`,
  }));

  // Puntos con su ficha al pasar el cursor (área de toque más grande que el punto)
  const tip = box.querySelector('.radar-tip');
  // Radio chico: el área de toque no puede tapar a los puntos vecinos
  const hitR = Math.min(14, radius / 3);
  skills.forEach((s, i) => {
    const [x, y] = at(i, radius * s.value / 100);
    const g = svgEl('g', { class: 'radar-point', tabindex: '0' });
    g.appendChild(svgEl('circle', { class: 'radar-hit', cx: x, cy: y, r: hitR }));
    g.appendChild(svgEl('circle', { class: 'radar-dot', cx: x, cy: y, r: 5 }));
    const show = () => {
      tip.textContent = `${s.name} · ${s.value}%`;
      tip.style.left = `${x}px`;
      tip.style.top = `${y}px`;
      tip.hidden = false;
    };
    const hide = () => { tip.hidden = true; };
    g.addEventListener('pointerenter', show);
    g.addEventListener('pointerleave', hide);
    g.addEventListener('focus', show);
    g.addEventListener('blur', hide);
    svg.appendChild(g);

    // Nombre fuera del círculo, alineado según el lado
    const [lx, ly] = at(i, radius + labelGap);
    const anchor = Math.abs(lx - cx) < 1 ? 'middle' : lx > cx ? 'start' : 'end';
    const lines = labels[i];
    const label = svgEl('text', { class: 'radar-label', x: lx, y: ly, 'text-anchor': anchor });
    // Arriba el texto crece hacia arriba, abajo hacia abajo, a los lados queda centrado
    const firstDy = ly < cy - 1 ? -(lines.length - 1) * 1.2 : ly > cy + 1 ? 0.8 : -(lines.length - 1) * 0.6 + 0.35;
    lines.forEach((line, k) => {
      const span = svgEl('tspan', { x: lx, dy: `${k === 0 ? firstDy : 1.2}em` });
      span.textContent = line;
      label.appendChild(span);
    });
    svg.appendChild(label);
  });

  const old = box.querySelector('svg');
  if (old) old.replaceWith(svg);
  else box.prepend(svg);
}

function buildRadar(group) {
  const skills = [...group.querySelectorAll('.skill')].map((s) => ({
    name: s.querySelector('.skill-name').textContent.trim(),
    value: parseFloat(s.querySelector('.skill-fill').style.width) || 0,
  }));
  if (skills.length < 3) return; // con menos de 3 ejes no hay "araña"

  const box = document.createElement('div');
  box.className = 'radar';
  const tip = document.createElement('div');
  tip.className = 'radar-tip';
  tip.hidden = true;
  box.appendChild(tip);
  group.appendChild(box);

  let lastSize = '';
  const redraw = () => {
    const size = `${box.clientWidth}x${box.clientHeight}`;
    if (size === lastSize) return;
    lastSize = size;
    drawRadar(box, skills);
  };
  // En el cuadro siguiente, para no redibujar dentro del mismo cálculo de tamaños
  new ResizeObserver(() => requestAnimationFrame(redraw)).observe(box);
  // Las etiquetas se miden con la letra web: al terminar de cargar, se vuelve a dibujar
  if (document.fonts) document.fonts.ready.then(() => { lastSize = ''; redraw(); });
}

// Datos de un grupo, leídos de sus barras (nombre y width en %)
function readSkills(group) {
  return [...group.querySelectorAll('.skill')].map((s) => ({
    name: s.querySelector('.skill-name').textContent.trim(),
    value: parseFloat(s.querySelector('.skill-fill').style.width) || 0,
  }));
}

// Anillos: un medidor circular por habilidad, con el % al centro
function buildRings(group, skills) {
  const R = 30;
  const len = 2 * Math.PI * R;
  const box = document.createElement('div');
  box.className = 'rings';
  skills.forEach((s, i) => {
    const fig = document.createElement('figure');
    fig.className = 'ring';
    fig.style.setProperty('--i', i);
    const svg = svgEl('svg', { viewBox: '0 0 76 76', 'aria-hidden': 'true' });
    svg.appendChild(svgEl('circle', { class: 'ring-track', cx: 38, cy: 38, r: R }));
    svg.appendChild(svgEl('circle', {
      class: 'ring-fg', cx: 38, cy: 38, r: R,
      'stroke-dasharray': len,
      'stroke-dashoffset': len * (1 - s.value / 100),
      transform: 'rotate(-90 38 38)', // empieza arriba
      style: `--len:${len}`,
    }));
    const t = svgEl('text', { class: 'ring-value', x: 38, y: 38, 'text-anchor': 'middle', 'dominant-baseline': 'central' });
    t.textContent = `${s.value}%`;
    svg.appendChild(t);
    const cap = document.createElement('figcaption');
    cap.textContent = s.name; // igual que en la vista de barras
    fig.setAttribute('aria-label', `${skillShortName(s.name)}: ${s.value}%`);
    fig.append(svg, cap);
    box.appendChild(fig);
  });
  group.appendChild(box);
}

function initSkillCharts() {
  const stats = document.querySelector('.about-stats');
  if (!stats) return;
  stats.querySelectorAll('.skill-group').forEach((group) => {
    // Orden de cada barra para que crezcan una tras otra
    group.querySelectorAll('.skill').forEach((s, i) => s.style.setProperty('--i', i));
    const skills = readSkills(group);
    buildRadar(group);
    buildRings(group, skills);
  });

  // Viñetas (grupo) y selector (forma); los dos se recuerdan entre visitas
  const choose = (attr, selector, key, value) => {
    stats.dataset[attr] = value;
    stats.querySelectorAll(selector).forEach((b) => b.setAttribute('aria-pressed', String(b.dataset[attr] === value)));
    try { localStorage.setItem(key, value); } catch (err) { /* sin almacenamiento */ }
  };
  const setup = (attr, selector, key) => {
    const buttons = [...stats.querySelectorAll(selector)];
    buttons.forEach((b) => b.addEventListener('click', () => choose(attr, selector, key, b.dataset[attr])));
    let saved = null;
    try { saved = localStorage.getItem(key); } catch (err) { /* sin almacenamiento */ }
    if (buttons.some((b) => b.dataset[attr] === saved)) choose(attr, selector, key, saved);
  };
  setup('group', '.stats-tab', 'grupoHabilidades');
  setup('view', '.stats-toggle-btn', 'vistaHabilidades');
}


/* ---------- 6c. Botón "volver" junto al título (todas las pestañas) ----------
   "< // título" es una sola casilla: el "<" y el título vuelven atrás.
   En proyectos.html, con un proyecto abierto, vuelve primero al anillo. */
function goBack() {
  if (!$('detailView') || $('detailView').hidden) {
    // Si se llegó desde otra página del sitio, vuelve a ella; si no, a la portada
    const fromSite = document.referrer && new URL(document.referrer).origin === location.origin;
    if (fromSite && history.length > 1) history.back();
    else location.href = 'index.html';
    return;
  }
  closeProjectDetail();
}

function initBackButtons() {
  document.querySelectorAll('.section-head').forEach((head) => {
    const btn = head.querySelector('.btn-back');
    if (!btn) return;
    btn.addEventListener('click', goBack);
    head.querySelector('.section-title').addEventListener('click', goBack);
  });
}


/* ---------- 7. Inicio de la página ---------- */

if (!redirectOldProjectLinks()) {
  initMatrixTrail();
  initBackButtons();
  initSkillCharts();
  initModals();
  initLightbox3D();
  initSideMenu();
  initTicker();
  initProjectRing();
  initPaint();
  encryptAll();
  openLinkedProject();
}

// proyectos.html?ver#proyecto-XX (íconos del teleprompter de index)
// abre directamente la vista de ese proyecto en vez de dejarlo solo seleccionado en el anillo
function openLinkedProject() {
  const params = new URLSearchParams(location.search);
  if (!openRingProject || !params.has('ver')) return;
  params.delete('ver'); // quita ?ver de la URL (y deja ?tipo si lo hay)
  const query = params.toString();
  history.replaceState(null, '', location.pathname + (query ? `?${query}` : '') + location.hash);
  openRingProject();
}
