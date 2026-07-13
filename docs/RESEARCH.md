# RESEARCH.md — Fase 0: Investigación conceptual y técnica

> Fecha: 2026-07-13. Fuentes detalladas en `docs/RESEARCH_SOURCES.md`.
> Convención de etiquetas usada en todo el documento:
> **[HECHO]** = públicamente documentado · **[OBSERVADO]** = comportamiento
> observable de producto · **[INFERENCIA]** = deducción técnica propia ·
> **[NODORA]** = decisión original propuesta para Nodora.

## 1. Sistemas basados en bloques

**[HECHO]** La API pública de Notion modela el contenido de una página como una
lista de objetos *block*. Cada bloque tiene `id`, `type` (que define cómo se
muestra e interpreta), `has_children` y un atributo `parent` que referencia a
su contenedor. Los bloques pueden contener a su vez listas ordenadas de IDs de
bloques hijos (p. ej. sub-ítems de una lista o el contenido de un toggle).
El post oficial de ingeniería de Notion ("The data model behind Notion's
flexibility") documenta que en Notion "todo es un bloque": texto, imágenes,
listas, filas de bases de datos e incluso páginas, y que los bloques forman un
árbol mediante referencias `content` (orden de hijos) y `parent`.

**[OBSERVADO]** En productos de esta categoría (Notion, AppFlowy, AFFiNE,
Logseq) el usuario manipula unidades discretas: arrastra bloques, los convierte
entre tipos compatibles, los anida y los referencia. Un menú contextual
lanzado con `/` es el patrón dominante de inserción.

**[INFERENCIA]** Un modelo árbol-de-bloques con hijos ordenados es la
estructura mínima que soporta a la vez: edición rica, drag & drop, conversión
de tipos, subpáginas y bases de datos embebidas. La alternativa (documento
monolítico HTML/Markdown) simplifica el MVP pero bloquea la evolución hacia
sincronización granular y colaboración.

**[NODORA]** Nodora usará un modelo híbrido pragmático:
- La **página** es la unidad de persistencia y sincronización futura.
- El contenido de la página se almacena como **documento JSON del editor**
  (árbol ProseMirror serializado) en SQLite, más una **proyección de texto
  plano** para indexación FTS y una **proyección de enlaces** para backlinks.
- Cada nodo de bloque lleva un `blockId` UUID estable como atributo, lo que
  permite en el futuro mapear el documento a operaciones por bloque (CRDT)
  sin migración destructiva.
- Justificación: persistir cada bloque como fila individual (modelo Notion
  puro) multiplica la complejidad de transacciones, orden e integridad para un
  MVP monousuario, sin aportar valor hasta que exista colaboración. La
  proyección por página + blockIds estables mantiene abierta la puerta CRDT
  (Yjs consume exactamente este árbol ProseMirror). Véase ADR-005.

## 2. Editores de texto enriquecido

**[HECHO]** ProseMirror es un toolkit de editores con modelo de documento en
árbol tipado por un *schema*, transacciones inmutables y sistema de plugins.
Tiptap es un framework "headless" construido sobre ProseMirror; su núcleo y
extensiones base son MIT (en 2025 liberó bajo MIT diez extensiones antes de
pago); sus productos de pago son servicios cloud (colaboración, IA, documentos
alojados), no el editor. Lexical (Meta) es MIT, con arquitectura propia no
basada en ProseMirror. Yjs ofrece bindings de colaboración para
ProseMirror/Tiptap (`y-prosemirror`), Lexical y otros.

**[INFERENCIA]** Para un editor de bloques con menú `/`, conversión de nodos,
drag handles y futura colaboración Yjs, el ecosistema
ProseMirror/Tiptap es el de menor riesgo: schema explícito (validación
estructural = defensa anti-corrupción), historial transaccional
(undo/redo robusto) y ruta probada a `y-prosemirror`.

**[NODORA]** Tiptap (core MIT) sobre ProseMirror, envuelto en un paquete
propio `@nodora/editor` que expone una API de dominio (insertar bloque,
convertir bloque, serializar, cargar) para que la aplicación nunca importe
Tiptap directamente fuera de ese paquete. Véase ADR-004.

## 3. Árbol de páginas, orden y jerarquía

**[HECHO]** El problema de ordenar secuencias editadas concurrentemente sin
renumerar la colección está documentado públicamente (Figma, "Realtime editing
of ordered sequences", 2017): asignar a cada elemento una **posición
fraccionaria** (cadena o número entre los vecinos) permite insertar y mover
tocando solo la fila movida. Los problemas conocidos son el crecimiento de la
longitud de la clave y el entrelazado en escrituras concurrentes; existen
mitigaciones (rebalanceo perezoso, jitter).

**[NODORA]** Páginas y filas de bases de datos usan una columna
`position TEXT` con claves de orden fraccionarias en base-62 generadas por una
utilidad propia en `@nodora/shared` (algoritmo estándar de *fractional
indexing*, documentado y testeado). Rebalanceo perezoso cuando la clave supere
un umbral de longitud. Dentro del contenido de una página el orden lo da el
propio árbol del documento, no hace falta clave por bloque en SQL. Véase
ADR-006.

## 4. Bases de datos configurables, propiedades y relaciones

**[HECHO]** La API de Notion modela las *databases* como colecciones de
páginas con un `schema` de propiedades tipadas (título, texto, número, select,
multi-select, estado, fecha, checkbox, URL, relación, etc.); cada fila es una
página cuyos valores de propiedad se validan contra el schema.

**[NODORA]** Nodora replica el concepto (no la implementación): tabla
`databases` (schema de propiedades como filas en `database_properties`),
`database_records` donde **cada registro referencia una página** (lo que da
"abrir registro como página" gratis), y valores en `record_values` tipados por
propiedad con almacenamiento JSON validado. Cambios de tipo de columna solo se
permiten cuando existe conversión segura (documentado en DATA_MODEL.md).

## 5. Backlinks y grafo de conocimiento

**[OBSERVADO]** Notion, Logseq, Obsidian y Anytype muestran "páginas que
enlazan aquí" calculadas automáticamente al crear enlaces internos.

**[INFERENCIA]** Los backlinks no deben almacenarse como dato primario editable
sino derivarse de los enlaces salientes; así nunca divergen del contenido.

**[NODORA]** Al guardar una página se extraen los nodos de enlace interno del
documento y se reconcilia la tabla `page_links (source_page_id, target_page_id,
block_id)` dentro de la misma transacción del guardado. Backlinks = consulta
inversa indexada. Esto también sirve de proyección para futuros grafos.

## 6. Búsqueda de texto completo

**[HECHO]** SQLite incluye el módulo FTS5: índice invertido dentro del mismo
archivo de base de datos, consultas con ranking BM25, funciones `snippet()` y
`highlight()`, tablas de *external content* para no duplicar el texto, y
tokenizador `unicode61` (con `remove_diacritics`) apto para contenido
multilingüe.

**[NODORA]** Tabla FTS5 externa-content sobre la proyección de texto de cada
página (título + texto plano), actualizada en la misma transacción del
guardado. Filtros básicos (espacio, archivadas) como columnas auxiliares.

## 7. Historial, edición offline, sincronización y conflictos

**[HECHO]** El ensayo "Local-first software" (Ink & Switch, 2019) define los
ideales local-first (el dispositivo posee la copia primaria; el trabajo nunca
se bloquea por red; los datos sobreviven al proveedor) y recomienda CRDTs como
fundamento técnico para la fusión sin conflictos. Yjs (MIT, usado por Linear,
GitBook, Evernote, ProtonMail Docs, JupyterLab, entre otros) y Automerge (MIT,
núcleo Rust) son las dos familias CRDT maduras; Hocuspocus (MIT) es el backend
WebSocket estándar para Yjs con hooks de autenticación y persistencia.

**[INFERENCIA]** Para el MVP monousuario/monodispositivo, un CRDT activo es
complejidad prematura; lo que sí es barato ahora y carísimo después es dejar
el modelo de datos listo: UUIDs, tombstones, contadores de versión, device_id
y un log de operaciones idempotentes.

**[NODORA]** MVP sin CRDT en ejecución. El diseño reserva: documento del
editor apto para Yjs (árbol ProseMirror), `blockId` estables, tabla
`sync_operations` (vacía en MVP, schema definido), y columnas de versión en
entidades sincronizables. Estrategia completa en `docs/SYNC_ARCHITECTURE.md`.

## 8. Permisos, colaboración y multiusuario

**[HECHO]** El post del modelo de datos de Notion documenta que los permisos
viven en los bloques/páginas y se heredan hacia abajo por el árbol.

**[NODORA]** MVP: usuario local único implícito (fila `users` con el
propietario) y sin verificación de permisos activa, pero el modelo incluye
`users`, `devices`, `memberships` y una interfaz `PermissionService` con
implementación local "allow-all" explícita, para que la futura autorización
sea un cambio aditivo.

## 9. Archivos adjuntos

**[INFERENCIA]** Guardar imágenes como blobs dentro de SQLite simplifica el
respaldo pero degrada rendimiento y memoria con archivos grandes; guardar
rutas absolutas rompe la portabilidad del workspace.

**[NODORA]** Carpeta `attachments/` gestionada dentro del directorio del
workspace; archivos nombrados por UUID + extensión saneada; tabla
`attachments` con hash SHA-256 (deduplicación e integridad), tamaño y MIME
declarado; los documentos referencian `attachment://<uuid>`, nunca rutas.

## 10. Exportación y respaldo

**[OBSERVADO]** Las herramientas serias de la categoría exportan Markdown y
formatos estructurados; los usuarios tratan la exportación como garantía
anti-lock-in.

**[NODORA]** Exportación por página a Markdown (CommonMark + extensiones GFM
para tareas/tablas), exportación de workspace a JSON versionado (schema
documentado), respaldo = archivo ZIP con la base SQLite consistente
(`VACUUM INTO` o copia bajo lock), manifiesto con versión de schema y hashes;
la restauración valida el manifiesto y los hashes **antes** de tocar datos
existentes y nunca sobrescribe en el lugar (restaura a un workspace nuevo o
previa copia de seguridad automática).

## 11. Riesgos identificados en la investigación

1. **Acoplamiento al editor** — mitigado por capa `@nodora/editor`.
2. **Cambio de licencia/pricing del ecosistema Tiptap** — el core es MIT y
   ProseMirror (MIT) es el sustrato; en el peor caso se puede descender a
   ProseMirror puro manteniendo el schema.
3. **Orden fraccionario degenerado** (claves largas) — rebalanceo perezoso.
4. **FTS5 y contenido multilingüe** — tokenizador unicode61 con
   remove_diacritics; pruebas con español, CJK y emoji.
5. **Corrupción SQLite por cierre abrupto** — WAL mode + transacciones +
   pruebas de crash-recovery.
6. **Empaquetado Windows desde Linux** — CI con runner Windows (ADR-000).

## 12. Criterios de cierre de la Fase 0

- [x] Modelo conceptual de bloques/páginas investigado con fuentes.
- [x] Alternativas de editor, CRDT, runtime de escritorio y persistencia
      evaluadas (ver `TECHNOLOGY_EVALUATION.md`).
- [x] Restricciones legales y de licencias documentadas
      (`LEGAL_AND_LICENSES.md`).
- [x] Competidores y proyectos afines analizados (`COMPETITOR_ANALYSIS.md`).
- [x] Fuentes registradas con fecha y afirmación respaldada
      (`RESEARCH_SOURCES.md`).
