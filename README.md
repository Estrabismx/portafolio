# Portafolio

Hola soy Camila Ramírez, aka EstrabismX 

<https://estrabismx.github.io/portafolio/>

<br>

>[!NOTE]
> CHECKLIST 

- [x] Página principal

- [x] Sobre Mí

- [ ] Cambiar a iconos propios o con libre uso

- [ ] Ver la adaptabilidad a celulares

- [ ] Cargar proyectos

- [ ] ???

## Estructura

```
index.html    → escritorio y todas las ventanas (Mi PC, Proyectos, Sobre Mí, Contacto, Paint)
style.css     → estilos
main.js       → lógica (ventanas, barra de tareas, galería, Paint...)
proyectos.js  → datos de los proyectos (lo genera el editor)
assets/       → imágenes, videos e iconos (assets/proyecto-XX/)
editor/       → Editor de Portafolio (programa en Python para cargar proyectos)
```

## Cómo agregar o editar proyectos

1. Doble clic en `editor/abrir_editor.bat`.
   La primera vez instala lo necesario (Pillow y tkinterdnd2).
2. Elige un proyecto o crea uno con **+ Nuevo**, y completa las pestañas:
   - **General**: títulos, descripción y paleta de colores.
   - **Vista en carpeta Proyectos**: resumen, etiquetas e icono.
   - **Especificaciones**: ficha técnica y dificultad.
   - **Galería**: arrastra fotos o videos desde Windows y reordénalos arrastrando las miniaturas.
     La primera es la portada.
3. Pulsa **Guardar** o **Guardar y ver en el navegador**. El editor:
   - copia los archivos a `assets/proyecto-XX/` y los renombra en orden (`proyecto_07a.jpg`, `proyecto_07b.mp4`...);
   - reduce las fotos pesadas a 1600 px como máximo;
   - actualiza `proyectos.js`.
4. Haz el commit y súbelo a GitHub tú mismo (por ejemplo con GitHub Desktop). El editor nunca sube nada.

**Videos y GIF:** se admiten `.mp4`, `.webm`, `.mov` y `.gif`. Si [ffmpeg](https://ffmpeg.org) está instalado
(`winget install Gyan.FFmpeg`), el editor los comprime al guardar:

- los videos pasan a MP4 (H.264) de 1280 px de ancho como máximo, y se ven con un reproductor estilo Windows 98;
- los GIF animados pasan a MP4 en modo **animación** (se reproducen solos, en bucle y sin sonido): se ven igual que un GIF y pesan muchísimo menos.

La casilla "Mostrar como animación" de la galería permite usar ese modo con cualquier video.
El botón **Optimizar archivos existentes** aplica todo esto a lo que ya está cargado.

Enlace directo a un proyecto: `https://estrabismx.github.io/portafolio/#proyecto-03`
(también sirven `#proyectos`, `#sobre-mi`, `#contacto` y `#paint`).
