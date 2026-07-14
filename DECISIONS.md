# DECISIONS.md — Nodora

Registro de decisiones de arquitectura y producto (formato ADR ligero).
Cada decisión incluye: contexto, opciones, decisión, razón, consecuencias y
posibilidad de reversión.

---

## ADR-000 — Entorno de desarrollo Linux, objetivo de empaquetado Windows

- **Fecha:** 2026-07-13
- **Contexto:** El desarrollo ocurre en un contenedor Linux; el criterio de éxito
  exige un instalador para Windows.
- **Opciones:** (a) compilar solo en Linux y asumir que Windows funcionará;
  (b) producir el instalador Windows mediante CI en runner Windows y validar en
  Linux todo lo validable (tests, typecheck, lint, `cargo test`, build Linux).
- **Decisión:** (b).
- **Razón:** Tauri usa el mismo código Rust/TS multiplataforma; CI en
  `windows-latest` produce el artefacto NSIS real. No se afirmará que el
  instalador funciona sin evidencia del pipeline.
- **Consecuencias:** El repositorio necesita workflow de GitHub Actions desde la
  fase de empaquetado.
- **Reversión:** Trivial (es infraestructura, no código de producto).

## ADR-001 — Los archivos de estado del proyecto viven en el repositorio

- **Fecha:** 2026-07-13
- **Contexto:** El desarrollo será por iteraciones largas y no debe depender del
  historial del chat.
- **Decisión:** `PROJECT_STATE.md`, `TASKS.md`, `DECISIONS.md`, `CHANGELOG.md` y
  `docs/NODORA_SPEC.md` se mantienen actualizados en cada iteración y se
  consultan antes de cada cambio.
- **Reversión:** N/A (regla de proceso).

---

## ADR-002 — Runtime de escritorio: Tauri 2

- **Fecha:** 2026-07-13
- **Contexto:** Se necesita app instalable en Windows, ligera, offline, con
  frontend reutilizable en una futura web (spec §6 propone Tauri 2 como
  referencia).
- **Opciones:** Tauri 2, Electron, web pura empaquetada.
- **Decisión:** Tauri 2 (MIT/Apache-2.0, v2 estable).
- **Razón:** binarios pequeños, backend Rust ideal para la capa de
  persistencia/seguridad, frontend 100 % web reutilizable. Evaluación completa
  en `docs/TECHNOLOGY_EVALUATION.md` §1.
- **Consecuencias:** requiere Rust; diferencias de webview entre SO (mitigado
  con CI multiplataforma).
- **Reversión:** cara (re-empaquetar backend); el frontend sobreviviría.

## ADR-003 — Persistencia: SQLite embebido vía rusqlite, acceso solo desde Rust

- **Fecha:** 2026-07-13
- **Contexto:** La base local es la fuente de verdad del MVP (spec §6).
- **Opciones:** rusqlite en backend; tauri-plugin-sql (SQL desde el frontend);
  IndexedDB.
- **Decisión:** rusqlite (bundled) con comandos de dominio tipados; el
  frontend jamás construye SQL. WAL + foreign_keys + FTS5.
- **Razón:** menor superficie de ataque, lógica testeable con `cargo test`,
  transacciones multi-tabla reales (guardado = contenido + FTS + links).
- **Consecuencias:** los DTOs IPC se definen dos veces (TS + serde) → tests de
  contrato los mantienen alineados.
- **Reversión:** moderada (la capa repository aísla el SQL).

## ADR-004 — Editor: Tiptap core (MIT) encapsulado en @nodora/editor

- **Fecha:** 2026-07-13
- **Contexto:** Editor de bloques con menú `/`, conversión, drag y ruta a Yjs.
- **Opciones:** Tiptap, ProseMirror puro, Lexical.
- **Decisión:** Tiptap core sobre ProseMirror, con capa de abstracción
  `@nodora/editor` (nada fuera del paquete importa Tiptap).
- **Razón:** ecosistema ProseMirror maduro + y-prosemirror probado; coste de
  desarrollo bajo. Riesgo comercial del vendor acotado por el fallback a
  ProseMirror puro (mismo formato de documento).
- **Reversión:** planificada como fallback documentado.

## ADR-005 — Contenido: documento por página con blockIds estables (no fila por bloque)

- **Fecha:** 2026-07-13
- **Contexto:** Spec exige bloques + preparación CRDT; Notion documenta
  públicamente "fila por bloque", pero eso multiplica la complejidad
  transaccional de un MVP monousuario.
- **Opciones:** (a) tabla `blocks` fila-por-bloque; (b) documento JSON por
  página con `blockId` UUID por nodo + proyecciones (texto FTS, links).
- **Decisión:** (b).
- **Razón:** el guardado es una transacción simple y atómica; Yjs consume
  exactamente este árbol; las proyecciones dan búsqueda y backlinks sin
  divergencia. La entidad `Block` existe en el dominio (tipos TS) aunque no
  tenga tabla propia; la migración futura a operaciones por bloque usa los
  blockIds ya persistidos.
- **Consecuencias:** consultas "por bloque" (transclusión futura) requerirán
  proyección adicional; aceptado y documentado en FUTURE_ROADMAP.
- **Reversión:** media; los blockIds estables son el seguro.

## ADR-006 — Orden de páginas/filas: claves fraccionarias base-62

- **Fecha:** 2026-07-13
- **Contexto:** Reordenar sin renumerar (spec §7); técnica documentada
  públicamente (Figma 2017).
- **Decisión:** columna `position TEXT` lexicográfica generada por utilidad
  propia testeada (TS y Rust equivalentes); rebalanceo perezoso >64 chars.
- **Reversión:** fácil (recalcular posiciones).

## ADR-007 — Estado UI: Zustand; estado del documento en el editor; verdad en SQLite

- **Fecha:** 2026-07-13
- **Decisión:** Zustand (MIT) para estado visual/navegación; sin Redux; el
  documento vive en ProseMirror; lo persistido solo en SQLite (nunca
  LocalStorage como principal).
- **Reversión:** fácil.

## ADR-008 — Sin cifrado local en reposo en el MVP

- **Fecha:** 2026-07-13
- **Contexto:** Spec §10 exige evaluar cifrado local y documentar cobertura.
- **Decisión:** No cifrar en MVP; recomendar cifrado de disco del SO;
  reevaluar antes del Horizonte 2 (sync).
- **Razón y análisis completo:** `docs/THREAT_MODEL.md` (SQLCipher complica
  FTS5/respaldos/recuperación; passphrase olvidada = pérdida total).
- **Reversión:** posible por-workspace en V2 (migración copia-a-cifrado).

## ADR-009 — Iconografía Lucide (ISC); tipografías del sistema

- **Fecha:** 2026-07-14
- **Decisión:** Lucide para iconos de UI (licencia ISC, permisiva); pila
  tipográfica del sistema (sin fuentes descargadas: regla offline y arranque
  rápido). Identidad propia definida en `docs/DESIGN_SYSTEM.md`.
- **Reversión:** fácil.
