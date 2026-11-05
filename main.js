/* =====================================================================
   LÓGICA DEL PORTAFOLIO — Estrabismx 98
   Índice:
     1. Utilidades
     2. Reloj
     3. Menú Inicio
     4. Sistema de ventanas (abrir, cerrar, enfocar, arrastrar, barra de tareas)
     5. Explorador de proyectos
     6. Ventana de proyecto (pestañas, galería, visor)
     7. WordPad (Sobre Mí)
     8. Paint
     9. Alertas
    10. Inicio de la página y enlaces directos (#proyecto-01, #sobre-mi ...)

   Los datos de los proyectos están en proyectos.js — normalmente no
   necesitas tocar este archivo para agregar un proyecto.
   ===================================================================== */


/* ---------- 1. Utilidades ---------- */

const $ = (id) => document.getElementById(id);

// Quita etiquetas HTML (ej: "<i>Mimus</i>" → "Mimus") para títulos de texto plano
function stripHtml(html) {
  const tmp = document.createElement('div');
  tmp.innerHTML = html;
  return tmp.textContent.trim();
}

function projectFolder(p) {
  return `assets/proyecto-${p.id}/`;
}

// Icono del proyecto en la carpeta (por defecto proyecto_XX.svg)
function projectIcon(p) {
  return projectFolder(p) + (p.icono || `proyecto_${p.id}.svg`);
}

// Archivos de la galería que se muestran con el reproductor de video
const VIDEO_EXTENSIONS = ['mp4', 'webm', 'mov', 'm4v', 'ogv'];

function isVideo(archivo) {
  return VIDEO_EXTENSIONS.includes(archivo.split('.').pop().toLowerCase());
}

function pauseVideosIn(element) {
  if (element) element.querySelectorAll('video').forEach((v) => v.pause());
}

// Las "animaciones" (GIF convertidos a video) se reproducen solas: se reanudan al volver a verse
function playAnimationsIn(element) {
  if (element) element.querySelectorAll('video[data-animacion]').forEach((v) => v.play().catch(() => {}));
}

// Video con reproductor (no las animaciones, que se comportan como imágenes)
function isPlayerVideo(item) {
  return isVideo(item.archivo) && !item.animacion;
}

function findProject(id) {
  return PROYECTOS.find((p) => p.id === id);
}


/* ---------- 2. Reloj ---------- */

function updateClock() {
  const date = new Date();
  let hours = date.getHours();
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12 || 12;
  $('system-clock').textContent = `${hours}:${minutes} ${ampm}`;
}


/* ---------- 3. Menú Inicio ---------- */

function toggleStartMenu(forceClose) {
  const menu = $('start-menu');
  const btn = $('start-btn');
  const open = forceClose ? false : menu.style.display !== 'flex';
  menu.style.display = open ? 'flex' : 'none';
  btn.classList.toggle('win98-inset', open);
}

function openFromStart(id) {
  openWindow(id);
  toggleStartMenu(true);
}


/* ---------- 4. Sistema de ventanas ---------- */

let maxZIndex = 100;
let cascadeOffset = 0;

function isVisible(win) {
  return win && win.style.display !== 'none';
}

function isFocused(win) {
  return isVisible(win) && parseInt(win.style.zIndex, 10) === maxZIndex;
}

// La primera vez que se abre una ventana, se centra y se ajusta al tamaño de pantalla
function placeWindow(win) {
  if (win.dataset.placed) return;
  win.dataset.placed = 'true';

  const vw = window.innerWidth;
  const vh = window.innerHeight - 40; // menos la barra de tareas
  const width = Math.min(parseInt(win.dataset.width, 10) || 440, vw - 16);
  win.style.width = width + 'px';

  if (win.dataset.height) {
    const height = Math.min(parseInt(win.dataset.height, 10), vh - 16);
    win.style.height = height + 'px';
  }

  const height = win.offsetHeight || 300;
  const left = Math.max(8, (vw - width) / 2 + cascadeOffset);
  const top = Math.max(8, Math.min((vh - height) / 2 + cascadeOffset, vh - height - 8));
  win.style.left = left + 'px';
  win.style.top = top + 'px';
  cascadeOffset = (cascadeOffset + 24) % 120;
}

function focusWindow(id) {
  const win = $(id);
  if (!win) return;

  document.querySelectorAll('.window .win98-titlebar').forEach((t) => t.classList.add('inactive'));
  maxZIndex++;
  win.style.zIndex = maxZIndex;
  win.querySelector('.win98-titlebar').classList.remove('inactive');

  updateTaskbar();
}

function openWindow(id) {
  const win = $(id);
  if (!win) return;
  win.style.display = 'flex';
  placeWindow(win);
  focusWindow(id);
  playAnimationsIn(win);
}

function closeWindow(id) {
  const win = $(id);
  if (!win) return;
  pauseVideosIn(win);
  win.style.display = 'none';
  delete win.dataset.minimized;
  updateTaskbar();
}

// Minimizar = ocultar, pero el botón queda en la barra de tareas
function minimizeWindow(id) {
  const win = $(id);
  if (!win) return;
  pauseVideosIn(win);
  win.style.display = 'none';
  win.dataset.minimized = 'true';
  updateTaskbar();
}

// Abrir si está cerrada, traer al frente si está detrás, minimizar si ya está al frente
function toggleWindow(id) {
  const win = $(id);
  if (!win) return;
  if (!isVisible(win)) openWindow(id);
  else if (!isFocused(win)) focusWindow(id);
  else minimizeWindow(id);
}

function maximizeWindow(id) {
  const win = $(id);
  if (win) win.classList.toggle('maximized');
}

function updateTaskbar() {
  const container = $('taskbar-apps');
  container.innerHTML = '';

  document.querySelectorAll('.window').forEach((win) => {
    const open = isVisible(win);
    if (open) delete win.dataset.minimized;
    if (!open && !win.dataset.minimized) return;

    const btn = document.createElement('button');
    btn.className = 'win98-button taskbar-btn text-xs font-semibold flex items-center gap-1.5 flex-shrink-0';
    btn.style.height = '28px';
    if (isFocused(win)) btn.classList.add('win98-inset');

    btn.innerHTML = `<img src="${win.dataset.icon}" alt="" class="w-4 h-4 pointer-events-none"> <span class="ml-1"></span>`;
    btn.querySelector('span').textContent = win.dataset.title;
    btn.onclick = () => toggleWindow(win.id);
    container.appendChild(btn);
  });
}

// Arrastrar ventanas desde su barra de título (mouse y touch)
function makeDraggable(win) {
  const handle = win.querySelector('.win98-titlebar');
  let startX, startY, startLeft, startTop;

  handle.addEventListener('pointerdown', (e) => {
    if (e.target.closest('button') || win.classList.contains('maximized')) return;
    startX = e.clientX;
    startY = e.clientY;
    startLeft = win.offsetLeft;
    startTop = win.offsetTop;
    handle.setPointerCapture(e.pointerId);
    handle.addEventListener('pointermove', onMove);
    handle.addEventListener('pointerup', onUp, { once: true });
  });

  function onMove(e) {
    const left = Math.max(0, startLeft + e.clientX - startX);
    const top = Math.max(0, startTop + e.clientY - startY);
    win.style.left = left + 'px';
    win.style.top = top + 'px';
  }

  function onUp() {
    handle.removeEventListener('pointermove', onMove);
  }

  handle.addEventListener('dblclick', (e) => {
    if (!e.target.closest('button') && win.dataset.height) maximizeWindow(win.id);
  });
}


/* ---------- 5. Explorador de proyectos ---------- */

function renderExplorer() {
  const files = $('explorer-files');
  files.innerHTML = '';

  PROYECTOS.forEach((p) => {
    const icon = document.createElement('div');
    icon.className = 'file-icon flex flex-col items-center';
    icon.tabIndex = 0;
    icon.dataset.id = p.id;
    icon.innerHTML = `
      <img src="${projectIcon(p)}" class="w-20 h-20 mb-1 object-contain pointer-events-none" alt="">
      <span class="icon-text px-1 truncate w-full">${p.titulo}</span>`;
    icon.onclick = () => selectProject(p.id);
    icon.ondblclick = () => openProject(p.id);
    icon.onkeydown = (e) => { if (e.key === 'Enter') openProject(p.id); };
    files.appendChild(icon);
  });

  $('explorer-status-right').textContent = `${PROYECTOS.length} archivo(s) (1.44 MB)`;
}

function selectProject(id) {
  const p = findProject(id);
  if (!p) return;

  document.querySelectorAll('.file-icon').forEach((el) => el.classList.toggle('selected', el.dataset.id === id));
  $('explorer-status-left').textContent = `Seleccionado: ${stripHtml(p.titulo)}${p.tamano ? ` (${p.tamano})` : ''}`;

  const etiquetas = (p.etiquetas || [])
    .map((t) => `<span class="bg-gray-200 text-gray-800 px-1 border border-gray-400 text-[9px]">${t}</span>`)
    .join('');

  $('explorer-preview').innerHTML = `
    <div class="flex flex-col h-full justify-between font-mono text-xs">
      <div>
        <h2 class="text-base font-bold text-[#000080] border-b-2 border-[#000080] pb-1 uppercase truncate">${p.titulo}</h2>
        <div class="border-2 border-inset p-1 my-3 flex items-center justify-center overflow-hidden h-32">
          <img src="${projectIcon(p)}" alt="" class="w-full h-full object-contain" onerror="this.src='https://placehold.co/400x150/c0c0c0/000000?text=Vista+Previa'">
        </div>
        <p class="font-bold text-[#000080] mb-1">${p.subtitulo || p.encabezado || p.titulo}</p>
        <p class="text-gray-700 leading-tight mb-3 text-[11px]">${p.resumen || ''}</p>
        <div class="flex flex-wrap gap-1 mb-3">${etiquetas}</div>
      </div>
      <div class="flex flex-col gap-2">
        <button class="win98-button w-full text-xs font-bold font-sans" onclick="openProject('${p.id}')">Visualizar</button>
        <div class="border border-dashed border-gray-400 p-2 bg-gray-200">
          ${p.anio ? `<span class="text-[10px] block text-gray-500">Año: ${p.anio}</span>` : ''}
          ${p.curso ? `<span class="text-[10px] block text-gray-500">Tipo: ${p.curso}</span>` : ''}
          ${p.tamano ? `<span class="text-[10px] block text-gray-500">Tamaño en disco: ${p.tamano}</span>` : ''}
        </div>
      </div>
    </div>`;
}


/* ---------- 6. Ventana de proyecto ---------- */

let currentProject = null;
let currentImageIndex = 0;

function openProject(id) {
  const p = findProject(id);
  if (!p) return;
  currentProject = p;

  const titulo = stripHtml(p.titulo);
  const win = $('window-proyecto');
  win.dataset.title = titulo;
  win.dataset.icon = projectIcon(p);
  $('proyecto-titlebar').textContent = `Propiedades: ${titulo}`;
  $('proyecto-archivo').textContent = `Archivo: C:\\Mis Documentos\\Proyectos\\Proyecto_${p.id}.3dm`;
  document.title = `${titulo} - Estrabismx`;

  // Recuadro de datos bajo la imagen
  const info = [['TIPO', p.tipo], ['OBJETIVO', p.objetivo], ['DESAFÍO', p.desafio]]
    .filter(([, valor]) => valor)
    .map(([etiqueta, valor]) => `<span class="block text-gray-500">• ${etiqueta}: ${valor}</span>`)
    .join('');
  $('proyecto-info').innerHTML = info;
  $('proyecto-info').classList.toggle('hidden', !info);

  // Pestaña General
  const parrafos = (p.descripcion || [])
    .map((txt) => `<p class="text-xs text-gray-700 leading-relaxed font-mono mb-4">${txt}</p>`)
    .join('');
  const colores = (p.colores || [])
    .map((c) => `<div class="w-6 h-6 border" style="background-color: ${c.hex};" title="${c.nombre || c.hex}"></div>`)
    .join('');
  $('content-desc').innerHTML = `
    <h1 class="text-lg font-bold text-[#000080] border-b pb-1 mb-3">${p.encabezado || p.titulo}</h1>
    ${parrafos}
    ${colores ? `
      <div class="mt-auto pt-4">
        <span class="font-bold text-xs block mb-1">Paletas de Colores Utilizadas:</span>
        <div class="flex gap-2">${colores}</div>
      </div>` : ''}`;

  // Pestaña Especificaciones
  const filas = Object.entries(p.ficha || {})
    .map(([nombre, valor]) => `
      <tr class="border-b border-gray-200">
        <td class="py-2 pr-2 font-bold text-gray-600 align-top">${nombre}:</td>
        <td class="py-2">${valor}</td>
      </tr>`)
    .join('');
  const dif = p.dificultad;
  $('content-specs').innerHTML = `
    <h1 class="text-lg font-bold text-[#000080] border-b pb-1 mb-3">FICHA TÉCNICA DEL DESARROLLO</h1>
    <table class="w-full text-xs font-mono text-left border-collapse"><tbody>${filas}</tbody></table>
    ${dif ? `
      <div class="mt-6">
        <span class="font-bold text-xs block mb-1 text-gray-700">Dificultad:</span>
        <div class="h-5 bg-gray-200 border border-[#808080] relative">
          <div class="h-full bg-blue-800" style="width: ${dif.porcentaje}%;"></div>
          <span class="absolute inset-0 flex items-center justify-center text-[10px] text-white font-bold">${dif.texto || ''}</span>
        </div>
      </div>` : ''}`;

  // Pestaña Galería
  const galeria = $('proyecto-galeria');
  galeria.innerHTML = '';
  (p.galeria || []).forEach((img, index) => {
    const src = projectFolder(p) + img.archivo;
    const miniatura = isVideo(img.archivo)
      ? `<video src="${src}#t=0.5" muted preload="metadata" playsinline class="w-full h-full object-cover pointer-events-none"></video>
         <span class="thumb-video-badge">${img.animacion ? '∞ ANIM' : '▶ VIDEO'}</span>`
      : `<img src="${src}" alt="${img.nombre || ''}" loading="lazy" class="w-full h-full object-cover pointer-events-none" onerror="this.src='https://placehold.co/150x80/c0c0c0/000000?text=${encodeURIComponent(img.archivo)}'">`;

    const thumb = document.createElement('div');
    thumb.className = 'border p-1 bg-gray-100 hover:bg-blue-100 cursor-pointer flex flex-col h-28 justify-between';
    thumb.innerHTML = `
      <div class="w-full h-20 bg-black flex items-center justify-center overflow-hidden relative">${miniatura}</div>
      <div class="text-[9px] font-mono text-center mt-1 text-gray-600 truncate">${img.archivo}</div>`;
    thumb.onclick = () => showImage(index);
    thumb.ondblclick = () => { showImage(index); openImageViewer(); };
    galeria.appendChild(thumb);
  });

  showImage(0);
  switchTab('desc');
  history.replaceState(null, '', `#proyecto-${p.id}`);
  openWindow('window-proyecto');
}

// "Aceptar", "Cancelar" y "X": cierra el proyecto y vuelve a la carpeta Proyectos
function closeProject() {
  closeWindow('window-proyecto');
  closeImageViewer();
  history.replaceState(null, '', location.pathname + location.search);
  document.title = 'Portafolio Diseño - Camila Ramírez "Estrabismx"';
  openWindow('window-proyectos');
}

function switchTab(tabId) {
  document.querySelectorAll('#window-proyecto .win98-tab').forEach((tab) => {
    tab.classList.toggle('active', tab.dataset.tab === tabId);
  });
  document.querySelectorAll('#window-proyecto .tab-content').forEach((content) => {
    content.classList.toggle('hidden', content.id !== `content-${tabId}`);
  });
}

// Crea el elemento a mostrar: una imagen, una animación o el reproductor de video
function createMedia(src, item, imgClass) {
  const { archivo, nombre } = item;
  if (isPlayerVideo(item)) return createVideoPlayer(src);

  if (isVideo(archivo)) {
    // Animación: como un GIF, pero mucho más liviana
    const anim = document.createElement('video');
    anim.src = src;
    anim.muted = true;
    anim.loop = true;
    anim.autoplay = true;
    anim.playsInline = true;
    anim.setAttribute('playsinline', '');
    anim.dataset.animacion = 'true';
    anim.className = imgClass;
    anim.setAttribute('aria-label', nombre || archivo);
    return anim;
  }

  const img = document.createElement('img');
  img.src = src;
  img.alt = nombre || archivo;
  img.className = imgClass;
  img.onerror = () => { img.onerror = null; img.src =`https://placehold.co/600x400/000000/00ff00?text=${encodeURIComponent(archivo)}`; };
  return img;
}

// Muestra el archivo número "index" de la galería en la vista previa y en el visor
function showImage(index) {
  const imagenes = (currentProject && currentProject.galeria) || [];
  if (!imagenes.length) return;

  currentImageIndex = (index + imagenes.length) % imagenes.length; // da la vuelta al llegar al final
  const img = imagenes[currentImageIndex];
  const src = projectFolder(currentProject) + img.archivo;
  const video = isPlayerVideo(img);
  const tipo = video ? 'VIDEO' : (img.animacion ? 'ANIMACIÓN' : 'IMAGEN');
  const etiqueta = img.nombre ? `${img.nombre} — ${img.archivo}` : img.archivo;
  const viewerOpen = !$('image-viewer-window').classList.contains('hidden');

  pauseVideosIn($('preview-media'));
  pauseVideosIn($('viewer-media'));
  $('preview-media').replaceChildren(createMedia(src, img, 'max-w-full max-h-full object-contain'));
  $('viewer-media').replaceChildren(createMedia(src, img, 'max-w-full max-h-[70vh] object-contain border border-gray-700'));
  // Solo se anima lo que está a la vista (ahorra batería y procesador)
  pauseVideosIn(viewerOpen ? $('preview-media') : $('viewer-media'));

  $('preview-box').classList.toggle('cursor-pointer', !video);
  $('preview-zoom-hint').classList.toggle('hidden', video);
  $('preview-caption').textContent = `• ${tipo} ${currentImageIndex + 1}/${imagenes.length}: ${etiqueta}`;
  $('viewer-title').textContent = `${video ? 'Reproductor de Video' : 'Visor de Imágenes'} - [${img.archivo}]`;
  $('viewer-caption').textContent = `${currentImageIndex + 1} / ${imagenes.length}  ${img.nombre || ''}`;
}

// Clic en la vista previa: amplía las imágenes (los videos usan sus propios controles)
function onPreviewClick() {
  const img = currentProject && currentProject.galeria[currentImageIndex];
  if (img && !isPlayerVideo(img)) openImageViewer();
}

function navigateViewer(direction) {
  showImage(currentImageIndex + direction);
}

function openImageViewer() {
  if (!currentProject) return;
  // Si el video de la vista previa estaba sonando, sigue en el visor desde el mismo punto
  const previewVideo = $('preview-media').querySelector('video:not([data-animacion])');
  const viewerVideo = $('viewer-media').querySelector('video:not([data-animacion])');
  if (previewVideo && viewerVideo) {
    viewerVideo.currentTime = previewVideo.currentTime;
    if (!previewVideo.paused) viewerVideo.play();
  }
  pauseVideosIn($('preview-media'));
  playAnimationsIn($('viewer-media'));
  $('image-viewer-window').classList.remove('hidden');
}

function closeImageViewer() {
  pauseVideosIn($('viewer-media'));
  $('image-viewer-window').classList.add('hidden');
  playAnimationsIn($('preview-media'));
}


/* ---------- 6b. Reproductor de video estilo Windows 98 ---------- */

const PLAYER_ICONS = {
  play: '<svg viewBox="0 0 10 10"><path d="M2 1 L9 5 L2 9 Z"/></svg>',
  pause: '<svg viewBox="0 0 10 10"><rect x="2" y="1" width="2" height="8"/><rect x="6" y="1" width="2" height="8"/></svg>',
  stop: '<svg viewBox="0 0 10 10"><rect x="2" y="2" width="6" height="6"/></svg>',
  sound: '<svg viewBox="0 0 12 10"><path d="M1 3 H3 L6 0.5 V9.5 L3 7 H1 Z"/><path d="M8 3 Q9.5 5 8 7 M9.5 1.5 Q12 5 9.5 8.5" fill="none" stroke="currentColor" stroke-width="1"/></svg>',
  muted: '<svg viewBox="0 0 12 10"><path d="M1 3 H3 L6 0.5 V9.5 L3 7 H1 Z"/><path d="M8 3 L11 7 M11 3 L8 7" fill="none" stroke="currentColor" stroke-width="1.2"/></svg>',
  full: '<svg viewBox="0 0 10 10"><path d="M1 4 V1 H4 M6 1 H9 V4 M9 6 V9 H6 M4 9 H1 V6" fill="none" stroke="currentColor" stroke-width="1.4"/></svg>',
};

function formatTime(seconds) {
  if (!isFinite(seconds)) return '00:00';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function createVideoPlayer(src) {
  const player = document.createElement('div');
  player.className = 'video-player win98-outset';
  player.innerHTML = `
    <div class="video-screen">
      <video preload="metadata" playsinline></video>
      <button class="video-bigplay" title="Reproducir">${PLAYER_ICONS.play}</button>
      <p class="video-error hidden">No se pudo reproducir este video.<br>Formato no compatible con el navegador.</p>
    </div>
    <div class="video-controls">
      <button class="video-btn" data-action="play" title="Reproducir / Pausa">${PLAYER_ICONS.play}</button>
      <button class="video-btn" data-action="stop" title="Detener">${PLAYER_ICONS.stop}</button>
      <div class="video-seek win98-inset" title="Buscar"><div class="video-seek-fill"></div><div class="video-seek-thumb"></div></div>
      <span class="video-time">00:00 / 00:00</span>
      <button class="video-btn" data-action="mute" title="Silenciar">${PLAYER_ICONS.sound}</button>
      <button class="video-btn" data-action="full" title="Pantalla completa">${PLAYER_ICONS.full}</button>
    </div>`;

  const video = player.querySelector('video');
  const bigPlay = player.querySelector('.video-bigplay');
  const playBtn = player.querySelector('[data-action="play"]');
  const muteBtn = player.querySelector('[data-action="mute"]');
  const seek = player.querySelector('.video-seek');
  const fill = player.querySelector('.video-seek-fill');
  const thumb = player.querySelector('.video-seek-thumb');
  const time = player.querySelector('.video-time');
  video.src = src;

  const toggle = () => (video.paused || video.ended ? video.play() : video.pause());

  function refresh() {
    const ratio = video.duration ? video.currentTime / video.duration : 0;
    fill.style.width = `${ratio * 100}%`;
    thumb.style.left = `calc(${ratio * 100}% - 5px)`;
    time.textContent = `${formatTime(video.currentTime)} / ${formatTime(video.duration)}`;
  }

  function seekTo(e) {
    const rect = seek.getBoundingClientRect();
    const ratio = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
    if (video.duration) video.currentTime = ratio * video.duration;
  }

  video.addEventListener('click', toggle);
  bigPlay.addEventListener('click', toggle);
  playBtn.addEventListener('click', toggle);
  player.querySelector('[data-action="stop"]').addEventListener('click', () => {
    video.pause();
    video.currentTime = 0;
  });
  muteBtn.addEventListener('click', () => {
    video.muted = !video.muted;
    muteBtn.innerHTML = video.muted ? PLAYER_ICONS.muted : PLAYER_ICONS.sound;
    muteBtn.classList.toggle('active', video.muted);
  });
  player.querySelector('[data-action="full"]').addEventListener('click', () => {
    if (document.fullscreenElement) document.exitFullscreen();
    else if (player.requestFullscreen) player.requestFullscreen();
    else if (video.webkitEnterFullscreen) video.webkitEnterFullscreen(); // iPhone
  });

  seek.addEventListener('pointerdown', (e) => {
    seek.setPointerCapture(e.pointerId);
    seekTo(e);
    const move = (ev) => seekTo(ev);
    seek.addEventListener('pointermove', move);
    seek.addEventListener('pointerup', () => seek.removeEventListener('pointermove', move), { once: true });
  });

  video.addEventListener('play', () => {
    playBtn.innerHTML = PLAYER_ICONS.pause;
    playBtn.classList.add('active');
    bigPlay.classList.add('hidden');
  });
  video.addEventListener('pause', () => {
    playBtn.innerHTML = PLAYER_ICONS.play;
    playBtn.classList.remove('active');
    bigPlay.classList.remove('hidden');
  });
  video.addEventListener('timeupdate', refresh);
  video.addEventListener('loadedmetadata', refresh);
  video.addEventListener('error', () => {
    player.querySelector('.video-error').classList.remove('hidden');
    bigPlay.classList.add('hidden');
  });

  // Los clics del reproductor no deben abrir el visor ni otras acciones
  player.addEventListener('click', (e) => e.stopPropagation());
  return player;
}


/* ---------- 7. WordPad (Sobre Mí) ---------- */

function generateRuler() {
  const container = $('ruler-container');
  container.innerHTML = '';
  const spacing = 15;
  const totalTicks = Math.ceil(Math.max(window.innerWidth, 1200) / spacing);

  for (let i = 0; i < totalTicks; i++) {
    const tick = document.createElement('div');
    tick.className = 'ruler-tick';
    tick.style.left = `${i * spacing}px`;

    if (i % 5 === 0) {
      tick.style.height = '12px';
      if (i > 0) {
        const num = document.createElement('span');
        num.className = 'absolute text-[8px] font-mono font-bold text-gray-700';
        num.style.left = `${i * spacing - 3}px`;
        num.style.top = '2px';
        num.innerText = i / 5;
        container.appendChild(num);
      }
    } else {
      tick.style.height = '6px';
    }
    container.appendChild(tick);
  }
}

function changeFontFamily(val) {
  const content = $('docContent');
  content.classList.remove('font-sans-serif', 'font-serif', 'font-mono-retro');
  content.classList.add(val);
}

function changeFontSize(val) {
  const content = $('docContent');
  content.classList.remove('text-xs', 'text-sm', 'text-base', 'text-lg');
  content.classList.add(val);
}

function toggleStyle(style) {
  const clases = { bold: 'font-bold', italic: 'italic', underline: 'underline' };
  const botones = { bold: 'btnBold', italic: 'btnItalic', underline: 'btnUnderline' };
  $('docContent').classList.toggle(clases[style]);
  $(botones[style]).classList.toggle('active');
}


/* ---------- 8. Paint ---------- */

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

const classicColors = [
  '#000000', '#808080', '#800000', '#808000', '#008000', '#008080', '#000080', '#800080', '#808040', '#004040', '#0080ff', '#004080', '#400080', '#804000',
  '#ffffff', '#c0c0c0', '#ff0000', '#ffff00', '#00ff00', '#00ffff', '#0000ff', '#ff00ff', '#ffff80', '#00ff80', '#80ffff', '#8080ff', '#ff8000', '#ff8080'
];

function initPaint() {
  canvas = $('paintCanvas');
  ctx = canvas.getContext('2d', { willReadFrequently: true });

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  saveState();

  const paletteGrid = $('palette-grid');
  paletteGrid.innerHTML = '';
  classicColors.forEach((color) => {
    const colorBox = document.createElement('div');
    colorBox.className = 'w-4 h-4 border border-gray-600 cursor-pointer';
    colorBox.style.backgroundColor = color;
    colorBox.onclick = () => selectColor(color);
    paletteGrid.appendChild(colorBox);
  });

  canvas.addEventListener('pointerdown', (e) => {
    canvas.setPointerCapture(e.pointerId);
    startDrawing(e);
  });
  canvas.addEventListener('pointermove', draw);
  canvas.addEventListener('pointerup', stopDrawing);
  canvas.addEventListener('pointercancel', stopDrawing);

  // Ctrl+Z / Ctrl+Y solo cuando Paint está al frente
  document.addEventListener('keydown', (e) => {
    if (!e.ctrlKey || !isFocused($('window-paint'))) return;
    if (e.key === 'z') { e.preventDefault(); undo(); }
    if (e.key === 'y') { e.preventDefault(); redo(); }
  });
}

function saveState() {
  if (undoStack.length >= maxHistory) undoStack.shift();
  undoStack.push(ctx.getImageData(0, 0, canvas.width, canvas.height));
  redoStack = [];
}

function selectColor(color) {
  currentColor = color;
  $('color-primary').style.backgroundColor = color;
}

function updateStrokeSize(val) {
  strokeSize = parseInt(val, 10);
}

function setTool(tool) {
  currentTool = tool;
  document.querySelectorAll('.tool-button').forEach((btn) => btn.classList.remove('active'));
  const activeBtn = $(`tool-${tool}`);
  if (activeBtn) activeBtn.classList.add('active');
  $('paint-status').textContent = `Herramienta activa: ${tool.toUpperCase()}`;
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
  saveState();
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  $('paint-status').textContent = 'Lienzo limpio.';
}

function downloadImage() {
  const link = document.createElement('a');
  link.download = 'mi-dibujo-paint98.png';
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
  $('paint-coords').textContent = `${x}, ${y}px`;
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


/* ---------- 9. Alertas ---------- */

function showAlert(text) {
  $('sys-alert-text').innerText = text;
  $('sys-alert').classList.remove('hidden');
}

function closeAlert() {
  $('sys-alert').classList.add('hidden');
}


/* ---------- 10. Inicio de la página ---------- */

// Enlaces directos: index.html#proyectos, #sobre-mi, #paint, #contacto o #proyecto-01
function openFromHash() {
  const hash = location.hash.replace('#', '');
  if (!hash) return false;

  if (hash.startsWith('proyecto-')) {
    const id = hash.replace('proyecto-', '');
    if (findProject(id)) {
      openWindow('window-proyectos');
      selectProject(id);
      openProject(id);
      return true;
    }
    return false;
  }

  const win = $(`window-${hash}`);
  if (win && win.classList.contains('window')) {
    openWindow(win.id);
    return true;
  }
  return false;
}

document.addEventListener('DOMContentLoaded', () => {
  updateClock();
  setInterval(updateClock, 1000);

  document.querySelectorAll('.window').forEach((win) => {
    makeDraggable(win);
    // Al tocar cualquier parte de una ventana, pasa al frente
    win.addEventListener('pointerdown', () => {
      if (!isFocused(win)) focusWindow(win.id);
    });
  });

  // Cerrar el menú Inicio al hacer clic fuera de él
  document.addEventListener('pointerdown', (e) => {
    if (!e.target.closest('#start-menu') && !e.target.closest('#start-btn')) toggleStartMenu(true);
  });

  // Teclas del visor de imágenes
  document.addEventListener('keydown', (e) => {
    if ($('image-viewer-window').classList.contains('hidden')) return;
    if (e.key === 'Escape') closeImageViewer();
    if (e.key === 'ArrowLeft') navigateViewer(-1);
    if (e.key === 'ArrowRight') navigateViewer(1);
  });

  window.addEventListener('hashchange', openFromHash);

  renderExplorer();
  generateRuler();
  initPaint();

  // Si la URL trae un enlace directo se abre eso; si no, la ventana Mi PC
  if (!openFromHash()) openWindow('window-pc');
});
