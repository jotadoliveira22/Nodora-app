# USER_FLOWS.md — Flujos de usuario del MVP

## F1. Primer arranque

1. El usuario instala Nodora (instalador Windows) y la abre.
2. No existe ningún workspace → pantalla de bienvenida propia de Nodora.
3. Elige "Crear espacio": nombre + icono (emoji/inicial+color) + ubicación
   (por defecto `%APPDATA%/Nodora/workspaces/<slug>`; puede elegir carpeta).
4. Se crea la base SQLite, la carpeta `attachments/` y una página inicial
   "Bienvenida" con contenido propio de Nodora explicando lo básico.
5. El workspace queda registrado como "último usado".

## F2. Arranques siguientes

1. Abre la app → se abre directamente el último workspace y la última página
   visitada.
2. Si el workspace no está disponible (carpeta movida), pantalla de
   recuperación: localizar carpeta, abrir otro espacio o crear uno nuevo.
   Nunca un crash.

## F3. Crear y organizar páginas

1. Botón "+" en sidebar o Ctrl+N → nueva página sin título con foco en el
   título.
2. Enter baja al primer bloque del cuerpo.
3. Arrastrar página en el sidebar para reordenar o anidar; alternativa por
   menú contextual "Mover a…" con buscador de destino.
4. Menú contextual: duplicar, favorito, archivar, eliminar (si archivada),
   copiar enlace interno.
5. Archivar → la página desaparece del árbol y queda en la vista "Archivo";
   desde allí: restaurar o eliminar definitivamente (confirmación explícita,
   informa cuántas subpáginas/bloques se eliminarán).

## F4. Escribir con bloques

1. En un bloque vacío, `/` abre el menú de inserción filtrable; ↑↓ + Enter
   inserta.
2. Markdown shortcuts al escribir (`# `→H1, `- `→lista, `> `→cita, etc.).
3. Selección de texto → toolbar flotante (negrita, cursiva, código, enlace,
   convertir bloque).
4. Drag handle a la izquierda del bloque para arrastrar/reordenar; el mismo
   handle abre menú de bloque (convertir, duplicar, eliminar).
5. Indicador de guardado en la cabecera: "Guardando…" → "Guardado";
   si falla, estado de error con reintento manual y sin bloquear la edición.

## F5. Enlazar conocimiento

1. `@` (o `/enlace`) abre buscador de páginas → inserta enlace interno.
2. Clic en enlace interno → navega; Alt+← vuelve.
3. Panel plegable al pie de página: "N páginas enlazan aquí" con fragmento y
   salto directo.

## F6. Base de datos sencilla

1. `/base de datos` en el editor o "Nueva base de datos" en sidebar.
2. Se crea con columna "Título" + vista tabla vacía.
3. "+ Columna" → nombre y tipo. "+" fila → registro nuevo.
4. Clic en celda → editor del tipo (texto, número, fecha con calendario,
   select con opciones creables inline, checkbox, URL).
5. Abrir registro (icono ⤢) → página completa del registro con sus
   propiedades en la cabecera y cuerpo libre de bloques.
6. Cabecera de columna → ordenar asc/desc, filtrar, renombrar, cambiar tipo
   (solo conversiones seguras; las inseguras se ofrecen deshabilitadas con
   explicación), ocultar.

## F7. Buscar y navegar rápido

1. Ctrl+K en cualquier momento → paleta: escribir busca por título y
   contenido con fragmentos resaltados.
2. Enter abre; Ctrl+Enter abre manteniendo la paleta.
3. Filtros con chips: "archivadas", "solo títulos".
4. Secciones "Recientes" y "Favoritos" cuando la caja está vacía.

## F8. Adjuntar imagen

1. `/imagen`, arrastrar archivo al editor, o pegar desde portapapeles.
2. Nodora copia el archivo a `attachments/` (UUID), calcula hash, deduplica
   y muestra la imagen.
3. Si el archivo físico falta después (workspace copiado a medias), el bloque
   muestra placeholder de error con el nombre original y opción de
   relocalizar.

## F9. Exportar

1. Menú de página → "Exportar a Markdown" (con o sin subpáginas) → elige
   carpeta destino → `.md` + subcarpeta `assets/`.
2. Menú de workspace → "Exportar todo a JSON" → un archivo `.json` versionado.

## F10. Respaldo y restauración

1. Menú de workspace → "Crear respaldo" → ZIP con nombre
   `nodora-backup-<workspace>-<fecha>.zip` en carpeta elegida.
2. "Restaurar respaldo" → seleccionar ZIP → Nodora **valida** (manifiesto,
   versión de schema, hashes, integridad SQLite) y muestra resumen (páginas,
   registros, adjuntos, fecha).
3. Confirmación → restaura como **workspace nuevo** (o, si se elige
   reemplazar, crea primero copia automática del actual).
4. Un ZIP corrupto o manipulado se rechaza con mensaje claro sin tocar nada.

## F11. Recuperación ante cierre inesperado

1. La app se cierra mal (kill, apagón) mientras se editaba.
2. Al reabrir: SQLite en WAL se recupera solo; el contenido refleja el último
   autosave (≤2 s). No hay diálogos de pánico; como máximo un aviso discreto
   "Se recuperó la sesión anterior".

## Estados de interfaz transversales

Cada vista define: vacío (onboarding contextual), carga, guardando, guardado,
error (con acción), sin conexión (irrelevante en MVP: todo es local, pero el
componente existe para el futuro), respaldo/restauración en progreso.
