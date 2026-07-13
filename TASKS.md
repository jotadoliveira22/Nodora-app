# TASKS.md — Nodora

Estados: `Pendiente` | `En progreso` | `Bloqueado` | `Terminado` | `Descartado`

## Fase 0 — Investigación

| # | Tarea | Estado |
|---|---|---|
| 0.1 | Inspección del entorno y herramientas | Terminado |
| 0.2 | Inicializar repo + archivos de gestión (PROJECT_STATE, TASKS, DECISIONS, CHANGELOG) | Terminado |
| 0.3 | Registrar especificación completa en docs/NODORA_SPEC.md | Terminado |
| 0.4 | Investigación web con fuentes: editores, CRDT, stacks escritorio, licencias | En progreso |
| 0.5 | docs/RESEARCH.md | Pendiente |
| 0.6 | docs/COMPETITOR_ANALYSIS.md | Pendiente |
| 0.7 | docs/TECHNOLOGY_EVALUATION.md | Pendiente |
| 0.8 | docs/LEGAL_AND_LICENSES.md | Pendiente |
| 0.9 | docs/RESEARCH_SOURCES.md | Pendiente |

## Fase 1 — Definición de producto

| # | Tarea | Estado |
|---|---|---|
| 1.1 | docs/PRODUCT_VISION.md | Pendiente |
| 1.2 | docs/PRD.md | Pendiente |
| 1.3 | docs/USER_FLOWS.md | Pendiente |
| 1.4 | docs/MVP_SCOPE.md | Pendiente |
| 1.5 | docs/FUTURE_ROADMAP.md | Pendiente |
| 1.6 | docs/NON_GOALS.md | Pendiente |

## Fase 2 — Arquitectura y modelo de datos

| # | Tarea | Estado |
|---|---|---|
| 2.1 | docs/ARCHITECTURE.md (visión técnica MVP) | Pendiente |
| 2.2 | docs/DATA_MODEL.md + docs/ERD.md | Pendiente |
| 2.3 | docs/SYNC_DATA_MODEL.md + docs/SYNC_ARCHITECTURE.md | Pendiente |
| 2.4 | docs/MIGRATION_STRATEGY.md | Pendiente |
| 2.5 | Migraciones SQL iniciales | Pendiente |
| 2.6 | docs/CLOUD_ARCHITECTURE.md, SELF_HOSTING.md, DEPLOYMENT_OPTIONS.md, COST_ESTIMATE.md | Pendiente |
| 2.7 | docs/THREAT_MODEL.md, SECURITY_ARCHITECTURE.md, SECURITY.md | Pendiente |
| 2.8 | docs/DESIGN_SYSTEM.md | Pendiente |
| 2.9 | Punto de control pre-implementación | Pendiente |

## Fase 3 — MVP (implementación por slices verticales)

| # | Tarea | Estado |
|---|---|---|
| 3.1 | Scaffold monorepo (pnpm workspaces, Tauri 2, React, TS estricto, Vite, ESLint, Prettier, Vitest) | Pendiente |
| 3.2 | Capa SQLite en Rust: migraciones, repositorio, tests | Pendiente |
| 3.3 | Workspaces: crear, renombrar, abrir último | Pendiente |
| 3.4 | Páginas: CRUD, jerarquía, orden fraccionario, archivar/restaurar/eliminar, duplicar | Pendiente |
| 3.5 | Editor por bloques (Tiptap + abstracción): tipos base, menú `/`, atajos, autosave | Pendiente |
| 3.6 | Navegación: sidebar, favoritos, recientes, breadcrumbs, quick open | Pendiente |
| 3.7 | Búsqueda FTS5 (título + contenido, fragmentos, filtros) | Pendiente |
| 3.8 | Base de datos interna con vista tabla (9 tipos de propiedad, ordenar, filtrar) | Pendiente |
| 3.9 | Enlaces internos + backlinks | Pendiente |
| 3.10 | Adjuntos locales (carpeta gestionada, hash, ids internos) | Pendiente |
| 3.11 | Export Markdown/JSON, respaldo y restauración con validación | Pendiente |
| 3.12 | Recuperación ante cierre inesperado / autosave robusto | Pendiente |

## Fase 4 — Calidad y empaquetado

| # | Tarea | Estado |
|---|---|---|
| 4.1 | Suite de pruebas críticas (persistencia, migraciones, backup corrupto, unicode, volumen) | Pendiente |
| 4.2 | CI: lint + typecheck + tests + build | Pendiente |
| 4.3 | CI: instalador Windows (NSIS) en runner Windows | Pendiente |
| 4.4 | Documentación final de instalación y uso | Pendiente |
