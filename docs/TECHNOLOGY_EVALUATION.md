# TECHNOLOGY_EVALUATION.md — Evaluación de alternativas técnicas

> Fecha: 2026-07-13. Fuentes en `docs/RESEARCH_SOURCES.md`. Los criterios
> evaluados por alternativa son: madurez, licencia, comunidad, rendimiento,
> complejidad, soporte offline, compatibilidad escritorio/web, self-hosting,
> riesgo de dependencia y facilidad de migración.

## 1. Runtime de escritorio

### Tauri 2 — **SELECCIONADO**
- **Madurez:** v2 estable (v2.11.x a mediados de 2026); usado en producción.
- **Licencia:** MIT / Apache-2.0. **Comunidad:** ~109k estrellas GitHub.
- **Rendimiento:** binarios pequeños (usa el webview del SO: WebView2 en
  Windows, WebKitGTK en Linux); menor RAM que Electron.
- **Complejidad:** requiere Rust para el backend — aceptable: el backend de
  persistencia se beneficia de Rust (rusqlite, integridad, tipos).
- **Offline/escritorio/web:** frontend 100% web reutilizable en la futura app
  web; soporta Windows 7+, macOS, Linux, iOS y Android.
- **Riesgos:** diferencias entre webviews de SO (WebView2 vs WebKitGTK);
  mitigación: CI multiplataforma y CSS/JS conservador.

### Electron — descartado
- Madurez y comunidad máximas; MIT. Pero binarios de >100 MB, mayor RAM,
  bundling de Chromium, y el modelo de proceso Node expone superficie de
  ataque mayor para una app local-first orientada a privacidad. Sin ventaja
  decisiva frente a Tauri para este alcance.

### App web pura (Next.js + IndexedDB) — descartada para el MVP
- No cumple el criterio "instalable en Windows sin servidor"; IndexedDB carece
  de FTS y de garantías de durabilidad equiparables a SQLite. Next.js queda
  reservado para la futura `apps/web`.

## 2. Frontend

### React 18 + TypeScript (estricto) + Vite — **SELECCIONADO**
- Madurez/comunidad máximas; MIT; requerido por Tiptap React bindings; el
  equipo futuro más probable lo conoce. Vite (MIT) es el estándar de build
  para Tauri 2.
- Estado: **Zustand** (MIT, minimalista, sin boilerplate) para estado visual y
  de aplicación; el estado del documento vive en el editor (ProseMirror) y el
  estado persistido en SQLite vía comandos Tauri. Alternativas descartadas:
  Redux (boilerplate innecesario a esta escala), Jotai (equivalente, menor
  familiaridad).

## 3. Editor

| Criterio | Tiptap (ProseMirror) | ProseMirror puro | Lexical |
|---|---|---|---|
| Madurez | Alta | Muy alta | Media-alta |
| Licencia | MIT (core) | MIT | MIT |
| Bloques/menú `/` | Extensiones listas | Manual | Manual/plugins |
| Colaboración Yjs | y-prosemirror probado | y-prosemirror | binding nativo |
| Riesgo | Presión comercial del vendor (cloud de pago) | Ninguno | Gobernado por Meta |
| Coste de desarrollo | Bajo | Alto | Medio |

**Decisión: Tiptap core (MIT)** con capa de abstracción `@nodora/editor`.
El fallback documentado es descender a ProseMirror puro conservando el schema
(mismo formato de documento), lo que acota el riesgo comercial del vendor.
En 2025 Tiptap además liberó bajo MIT diez extensiones antes de pago; los
productos de pago actuales son servicios cloud que Nodora no usa.

## 4. Persistencia local

### SQLite (vía `rusqlite` en el backend Tauri) — **SELECCIONADO**
- Dominio público; el motor embebido más desplegado del mundo; transacciones
  ACID, WAL, claves foráneas, FTS5 integrado.
- `rusqlite` (MIT) empaqueta SQLite en el binario (sin dependencia del SO).
- Alternativas descartadas:
  - **tauri-plugin-sql**: expone SQL crudo al frontend; preferimos comandos
    de dominio tipados en Rust (menor superficie de ataque, lógica testeable
    con `cargo test`).
  - **better-sqlite3/Node**: no hay Node en producción con Tauri.
  - **IndexedDB**: sin FTS, sin transacciones multi-tabla robustas.
  - **PostgreSQL local**: requiere servidor; reservado para la nube futura.

## 5. Búsqueda

**SQLite FTS5** (contenido externo + BM25 + `snippet()`/`highlight()`,
tokenizador `unicode61 remove_diacritics 2`). Alternativas descartadas:
Tantivy (índice separado que puede divergir; complejidad), búsqueda en JS
(no escala a miles de páginas).

## 6. CRDT / colaboración futura

| Criterio | Yjs | Automerge |
|---|---|---|
| Licencia | MIT | MIT |
| Madurez | 22k★; usado por Linear, GitBook, Evernote, ProtonMail Docs, JupyterLab | 6.4k★; Automerge 3 (2025) redujo ~10x memoria |
| Binding editor | y-prosemirror (Tiptap oficial) | Sin binding ProseMirror de primera clase |
| Backend | Hocuspocus (MIT), y-sweet, etc. | automerge-repo |

**Decisión (futura, no MVP): Yjs + Hocuspocus**, por el binding ProseMirror y
la adopción en producción. El MVP solo garantiza compatibilidad estructural
(documento ProseMirror + blockIds estables + log de operaciones).

## 7. Almacenamiento de archivos

MVP: sistema de archivos local en carpeta gestionada (`attachments/`) con
UUID + hash SHA-256. Futuro: interfaz `FileStorage` con implementación
S3-compatible (MinIO self-hosted primero). Descartado guardar blobs en SQLite
(rendimiento/memoria con archivos grandes) y rutas absolutas (portabilidad).

## 8. Monorepo y tooling

- **pnpm workspaces** (requerido por spec; eficiente en disco).
- **TypeScript estricto**, **ESLint 9 (flat config)**, **Prettier**.
- **Vitest** para unit/integración TS; **cargo test** para el backend Rust;
  **Playwright** reservado para pruebas E2E de UI (fase 4, si el tiempo de CI
  lo permite en Linux).
- **GitHub Actions**: lint+typecheck+tests en Linux; empaquetado NSIS en
  `windows-latest`.

## 9. Resumen del stack seleccionado

| Capa | Tecnología | Licencia |
|---|---|---|
| Shell escritorio | Tauri 2 | MIT/Apache-2.0 |
| UI | React 18 + TypeScript + Vite | MIT |
| Estado UI | Zustand | MIT |
| Editor | Tiptap core / ProseMirror | MIT |
| Persistencia | SQLite vía rusqlite (bundled) | Dominio público / MIT |
| Búsqueda | SQLite FTS5 | Dominio público |
| Orden | Fractional index propio (`@nodora/shared`) | Propio |
| Sync futura | Yjs + Hocuspocus (diseño) | MIT |
| Nube futura | PostgreSQL + S3-compatible + WebSockets (diseño) | — |
