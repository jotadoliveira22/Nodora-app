# COMPETITOR_ANALYSIS.md — Análisis de productos afines

> Fecha: 2026-07-13. Análisis basado en documentación pública, repositorios
> open source y comportamientos observables. Ningún producto fue sometido a
> ingeniería inversa. Etiquetas: **[HECHO] [OBSERVADO] [INFERENCIA] [NODORA]**.

## 1. Panorama

| Producto | Modelo | Licencia | Local-first | Relevancia para Nodora |
|---|---|---|---|---|
| Notion | SaaS propietario | Propietaria | No (offline limitado) | Referencia conceptual de UX y modelo de bloques (solo vía docs públicas) |
| AppFlowy | Open source (Flutter+Rust) | AGPL-3.0 | Sí | Prueba de que la categoría funciona local-first; licencia incompatible con copia de código |
| AFFiNE | Open source | MIT (core) | Sí (Yjs/CRDT) | Valida Yjs + bloques; arquitectura documentada públicamente |
| Anytype | Source-available | ASAL (no OSI) | Sí (CRDT propio) | Valida cifrado local; licencia no compatible para reutilizar código |
| Logseq | Open source | AGPL-3.0 | Sí (archivos MD) | Valida backlinks/grafo; modelo archivo-céntrico distinto al de Nodora |
| Joplin | Open source | AGPL-3.0 | Sí | Valida sincronización cifrada extremo a extremo sobre backends tontos |
| Obsidian | Propietario gratuito | Propietaria | Sí (carpeta MD) | Valida demanda de "tus datos en tu disco"; plugin ecosystem |
| Outline | Source-available | BSL 1.1 | No (servidor) | Referencia de wiki de equipo self-hosted |
| SiYuan | Open source | AGPL-3.0 | Sí | Bloques + SQLite; valida elecciones técnicas parecidas |

**[HECHO]** Licencias verificadas en la investigación: AppFlowy, Logseq,
Joplin, SiYuan y Docmost son AGPL-3.0; Outline es BSL 1.1; Anytype usa la
licencia ASAL (source-available, no certificada OSI); AFFiNE aparece en
listados OSI-certificados; Tauri es MIT/Apache-2.0; Yjs, Automerge, Hocuspocus
y el core de Tiptap son MIT.

## 2. Lecciones por área

### Modelo de contenido
**[HECHO]** Notion documenta "todo es un bloque" con árbol padre/contenido.
**[OBSERVADO]** Logseq/Obsidian usan archivos Markdown como fuente de verdad:
excelente portabilidad, pero las bases de datos ricas y propiedades tipadas se
vuelven forzadas (frontmatter, sintaxis ad hoc).
**[INFERENCIA]** Markdown-como-verdad limita las bases de datos configurables
que Nodora necesita; una base SQLite con exportación Markdown de primera clase
da lo mejor de ambos mundos.
**[NODORA]** SQLite fuente de verdad + exportación Markdown/JSON garantizada
como derecho del usuario (criterio de aceptación, con tests).

### Offline y sincronización
**[OBSERVADO]** Notion degrada sin conexión (funcionalidad offline limitada y
relativamente reciente); Anytype/AppFlowy/Logseq operan 100% offline.
**[INFERENCIA]** Ser local-first desde el día 1 es una ventaja diferencial
frente a "cloud con caché offline", y es mucho más difícil de añadir a
posteriori que al revés.

### Colaboración
**[HECHO]** AFFiNE usa Yjs; Anytype su propio CRDT; AppFlowy ha documentado
públicamente trabajo de colaboración sobre su backend.
**[INFERENCIA]** Todas las rutas exitosas separan "contenido colaborativo"
(CRDT) de "metadatos estructurados" (DB relacional + operaciones). Nodora
adopta esa separación en su diseño futuro (SYNC_ARCHITECTURE.md).

### Seguridad y privacidad
**[OBSERVADO]** Anytype y Joplin destacan cifrado; Obsidian destaca simple
propiedad del archivo.
**[NODORA]** MVP: datos en disco del usuario sin telemetría y sin red;
cifrado local evaluado y documentado en THREAT_MODEL.md (decisión: no cifrar
en MVP, ver justificación allí).

## 3. Hueco de mercado que Nodora ocupa

**[NODORA]** Espacio de trabajo privado para una persona/consultora que:
1. exige propiedad total del dato (carpeta local, exportación completa),
2. necesita bases de datos ligeras + wiki + notas en un solo lugar,
3. quiere una ruta creíble hacia equipo/nube **sin migrar de producto**.
Los AGPL existentes cubren parte, pero Nodora se diseña como producto propio
con foco en robustez de persistencia y una ruta de evolución documentada.

## 4. Qué NO copiaremos

- Código de ningún producto AGPL/BSL/propietario (ver LEGAL_AND_LICENSES.md).
- Identidad visual, textos, iconografía o nombres internos de Notion.
- Pixel-layouts: la UI de Nodora se diseña desde tokens propios
  (DESIGN_SYSTEM.md).
