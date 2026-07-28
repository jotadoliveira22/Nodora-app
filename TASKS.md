# TASKS.md — Nodora

Estados: `Pendiente` | `En progreso` | `Bloqueado` | `Terminado` | `Descartado`

## Fase 0 — Investigación

| # | Tarea | Estado |
|---|---|---|
| 0.1 | Inspección del entorno y herramientas | Terminado |
| 0.2 | Inicializar repo + archivos de gestión (PROJECT_STATE, TASKS, DECISIONS, CHANGELOG) | Terminado |
| 0.3 | Registrar especificación completa en docs/NODORA_SPEC.md | Terminado |
| 0.4 | Investigación web con fuentes: editores, CRDT, stacks escritorio, licencias | Terminado |
| 0.5 | docs/RESEARCH.md | Terminado |
| 0.6 | docs/COMPETITOR_ANALYSIS.md | Terminado |
| 0.7 | docs/TECHNOLOGY_EVALUATION.md | Terminado |
| 0.8 | docs/LEGAL_AND_LICENSES.md | Terminado |
| 0.9 | docs/RESEARCH_SOURCES.md | Terminado |

## Fase 1 — Definición de producto

| # | Tarea | Estado |
|---|---|---|
| 1.1 | docs/PRODUCT_VISION.md | Terminado |
| 1.2 | docs/PRD.md | Terminado |
| 1.3 | docs/USER_FLOWS.md | Terminado |
| 1.4 | docs/MVP_SCOPE.md | Terminado |
| 1.5 | docs/FUTURE_ROADMAP.md | Terminado |
| 1.6 | docs/NON_GOALS.md | Terminado |

## Fase 2 — Arquitectura y modelo de datos

| # | Tarea | Estado |
|---|---|---|
| 2.1 | docs/ARCHITECTURE.md (visión técnica MVP) | Terminado |
| 2.2 | docs/DATA_MODEL.md + docs/ERD.md | Terminado |
| 2.3 | docs/SYNC_DATA_MODEL.md + docs/SYNC_ARCHITECTURE.md | Terminado |
| 2.4 | docs/MIGRATION_STRATEGY.md | Terminado |
| 2.5 | Migraciones SQL iniciales | Terminado |
| 2.6 | docs/CLOUD_ARCHITECTURE.md, SELF_HOSTING.md, DEPLOYMENT_OPTIONS.md, COST_ESTIMATE.md | Terminado |
| 2.7 | docs/THREAT_MODEL.md, SECURITY_ARCHITECTURE.md, SECURITY.md | Terminado |
| 2.8 | docs/DESIGN_SYSTEM.md | Terminado |
| 2.9 | Punto de control pre-implementación | Terminado |

## Fase 3 — MVP (implementación por slices verticales)

| # | Tarea | Estado |
|---|---|---|
| 3.1 | Scaffold monorepo (pnpm workspaces, Tauri 2, React, TS estricto, Vite, ESLint, Prettier, Vitest) | Terminado |
| 3.2 | Capa SQLite en Rust: migraciones, repositorio, tests | Terminado |
| 3.3 | Workspaces: crear, renombrar, abrir último | Terminado |
| 3.4 | Páginas: CRUD, jerarquía, orden fraccionario, archivar/restaurar/eliminar, duplicar | Terminado |
| 3.5 | Editor por bloques (Tiptap + abstracción): tipos base, menú `/`, atajos, autosave | Terminado |
| 3.6 | Navegación: sidebar, favoritos, recientes, breadcrumbs, quick open | Terminado |
| 3.7 | Búsqueda FTS5 (título + contenido, fragmentos, filtros) | Terminado |
| 3.8 | Base de datos interna con vista tabla (9 tipos de propiedad, ordenar, filtrar) | Terminado |
| 3.9 | Enlaces internos + backlinks | Terminado |
| 3.10 | Adjuntos locales (carpeta gestionada, hash, ids internos) | Terminado |
| 3.11 | Export Markdown/JSON, respaldo y restauración con validación | Terminado |
| 3.12 | Recuperación ante cierre inesperado / autosave robusto | Terminado |

## Fase 4 — Calidad y empaquetado

| # | Tarea | Estado |
|---|---|---|
| 4.1 | Suite de pruebas críticas (persistencia, migraciones, backup corrupto, unicode, volumen) | Terminado |
| 4.2 | CI: lint + typecheck + tests + build | Terminado |
| 4.3 | CI: instalador Windows (NSIS) en runner Windows | Terminado |
| 4.4 | Documentación final de instalación y uso | Terminado |

## Fase 5 — Cierre del MVP

| # | Tarea | Estado |
|---|---|---|
| 5.1 | Ejecutar CI y obtener artefacto NSIS de Windows | Terminado |
| 5.2 | Pruebas de interfaz automatizadas (Playwright) | Terminado |
| 5.3 | Guía de usuario e instalación (docs/USER_GUIDE.md) | Terminado |
| 5.4 | Repaso de accesibilidad (WCAG AA verificado con axe-core) | Terminado |
| 5.5 | Registrar deuda técnica (docs/TECHNICAL_DEBT.md) | Terminado |
| 5.6 | Saldar deuda D1 (liberar adjuntos sin referencias) | Terminado |

## Fase 6 — Tras la beta privada v0.1.0

| # | Tarea | Estado |
|---|---|---|
| 6.1 | Pruebas manuales v0.1.0 (13/13 aprobadas) | Terminado |
| 6.2 | Validar a mano el criterio 15 (recuperación ante errores) | Pendiente |
| 6.3 | Validar a mano mover/duplicar/archivar, favoritos y liberar espacio | Pendiente |
| 6.4 | Horizonte 1 del roadmap (historial, bloques avanzados, vistas, importadores) | Pendiente |
