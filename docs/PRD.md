# PRD.md — Requisitos de producto (MVP)

> Clasificación de cada requisito: **[MVP]**, **[V2]** (segunda versión),
> **[COLAB]** (colaboración), **[NUBE]**, **[IA]**, **[FUERA]** (fuera de
> alcance). El detalle de corte está en `MVP_SCOPE.md`.

## R1. Espacios de trabajo

- R1.1 **[MVP]** Crear un espacio de trabajo local (carpeta en disco elegida o
  por defecto en datos de usuario).
- R1.2 **[MVP]** Editar nombre del espacio.
- R1.3 **[MVP]** Configurar icono/identificador visual (emoji o inicial +
  color de una paleta propia).
- R1.4 **[MVP]** Al iniciar, abrir automáticamente el último espacio usado.
- R1.5 **[V2]** Múltiples espacios abiertos simultáneamente en ventanas.

## R2. Páginas

- R2.1 **[MVP]** Crear páginas y subpáginas (jerarquía ilimitada).
- R2.2 **[MVP]** Editar título inline (sidebar y cabecera de página).
- R2.3 **[MVP]** Reordenar y mover páginas (drag & drop y menú "Mover a…").
- R2.4 **[MVP]** Duplicar página (con subárbol).
- R2.5 **[MVP]** Archivar página (sale del árbol, recuperable).
- R2.6 **[MVP]** Restaurar página archivada.
- R2.7 **[MVP]** Eliminar definitivamente (con confirmación; borra subárbol).
- R2.8 **[MVP]** Icono de página (emoji).
- R2.9 **[V2]** Portadas, plantillas de página, bloqueo de edición.

## R3. Editor por bloques

- R3.1 **[MVP]** Tipos: párrafo, encabezados H1–H3, lista con viñetas, lista
  numerada, lista de tareas, cita, código (con lenguaje), separador, callout,
  imagen local, enlace externo, enlace a página interna, subpágina embebida.
- R3.2 **[MVP]** Menú de inserción con `/` filtrable por texto.
- R3.3 **[MVP]** Atajos: negrita/cursiva/tachado/código inline, Ctrl+Z/Y,
  Markdown-shortcuts (`# `, `- `, `1. `, `> `, `[]`, ```` ``` ````).
- R3.4 **[MVP]** Copiar/pegar (texto plano y HTML saneado; pegar imagen del
  portapapeles como adjunto).
- R3.5 **[MVP]** Arrastrar bloques para reordenar (drag handle).
- R3.6 **[MVP]** Conversión entre bloques compatibles (párrafo↔encabezado↔
  listas↔cita↔callout).
- R3.7 **[MVP]** Guardado automático con indicador de estado
  (guardando/guardado/error) y debounce; flush inmediato al cerrar/cambiar de
  página.
- R3.8 **[MVP]** Recuperación ante cierre inesperado: al reabrir no se pierde
  más que el intervalo de debounce (≤2 s de escritura).
- R3.9 **[V2]** Tablas simples, toggles, columnas, embeds, LaTeX.
- R3.10 **[COLAB]** Cursores remotos, comentarios en bloques.

## R4. Navegación

- R4.1 **[MVP]** Barra lateral con árbol de páginas expandible.
- R4.2 **[MVP]** Favoritos (fijar/desfijar; sección propia en sidebar).
- R4.3 **[MVP]** Páginas recientes.
- R4.4 **[MVP]** Breadcrumbs con navegación.
- R4.5 **[MVP]** Historial atrás/adelante (Alt+←/→).
- R4.6 **[MVP]** Quick open por teclado (Ctrl+K / Ctrl+P): buscar y saltar.

## R5. Búsqueda

- R5.1 **[MVP]** Búsqueda por título y contenido (FTS5, BM25).
- R5.2 **[MVP]** Resultados con fragmentos resaltados (`snippet`).
- R5.3 **[MVP]** Filtros: incluir archivadas, solo títulos.
- R5.4 **[MVP]** Índice actualizado automáticamente en cada guardado
  (transaccional).
- R5.5 **[V2]** Búsqueda por propiedades de bases de datos, operadores.

## R6. Bases de datos internas

- R6.1 **[MVP]** Crear base de datos como página (vista tabla).
- R6.2 **[MVP]** Propiedades: título, texto, número, selección, selección
  múltiple, estado, fecha, checkbox, URL.
- R6.3 **[MVP]** Crear/renombrar columnas; cambiar tipo cuando la conversión
  es segura (matriz de conversiones en DATA_MODEL.md); ocultar propiedades.
- R6.4 **[MVP]** Añadir/editar/eliminar registros inline.
- R6.5 **[MVP]** Ordenar por columna; filtrar por valores (condiciones
  simples por tipo).
- R6.6 **[MVP]** Abrir registro como página (el registro ES una página).
- R6.7 **[V2]** Vistas kanban/calendario/galería, fórmulas, rollups,
  relaciones entre bases, agrupación.

## R7. Relaciones de conocimiento

- R7.1 **[MVP]** Enlaces internos a páginas desde el editor (`@` o menú `/`).
- R7.2 **[MVP]** Backlinks: panel "Páginas que enlazan aquí" derivado
  automáticamente.
- R7.3 **[MVP]** Las referencias sobreviven a renombrados (enlace por ID).
- R7.4 **[V2]** Vista de grafo, menciones de bloques, transclusión.

## R8. Archivos adjuntos

- R8.1 **[MVP]** Insertar imagen local (diálogo o pegado); se copia a la
  carpeta gestionada del workspace con UUID; hash SHA-256 para deduplicar.
- R8.2 **[MVP]** Los documentos referencian `attachment://<uuid>`, nunca
  rutas absolutas.
- R8.3 **[MVP]** Adjunto faltante se muestra como estado de error recuperable
  (no rompe la página).
- R8.4 **[V2]** Cualquier tipo de archivo con preview, gestor de adjuntos.

## R9. Exportación, respaldo y restauración

- R9.1 **[MVP]** Exportar página (con subpáginas opcional) a Markdown +
  carpeta de adjuntos.
- R9.2 **[MVP]** Exportar workspace completo a JSON versionado.
- R9.3 **[MVP]** Crear respaldo: ZIP con snapshot consistente de la base +
  adjuntos + manifiesto (versión de schema, hashes).
- R9.4 **[MVP]** Restaurar respaldo con validación previa (manifiesto,
  hashes, versión); nunca sobrescribe el workspace actual sin copia previa.
- R9.5 **[V2]** Respaldos programados, import de Markdown/Notion.

## R10. Multiusuario, nube, IA (diseño, no implementación)

- R10.1 **[COLAB]** Usuarios, equipos, roles, permisos, tiempo real (Yjs).
- R10.2 **[NUBE]** API, PostgreSQL, S3, web app, self-hosting Docker.
- R10.3 **[IA]** Asistencia de escritura/búsqueda semántica opt-in.
- El MVP entrega **interfaces y modelo de datos** compatibles (spec §6–§9).

## Requisitos no funcionales (MVP)

- N1 Arranque en frío < 3 s en hardware modesto; apertura de página < 200 ms
  con miles de páginas.
- N2 Sin pérdida de datos ante cierre abrupto (ver pruebas §12 spec).
- N3 Sin peticiones de red en ninguna operación del MVP.
- N4 Accesibilidad: navegación completa por teclado, contraste AA, modo
  claro/oscuro.
- N5 Idioma de UI: español primero, arquitectura preparada para i18n.
