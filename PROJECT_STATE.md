# PROJECT_STATE.md — Nodora

> Última actualización: 2026-07-13 (sesión inicial)

## Estado actual

**Fase 0 — Investigación** (en curso).

El repositorio acaba de inicializarse. Se está ejecutando la investigación técnica
y de producto previa a cualquier código de producción.

## Entorno de desarrollo verificado

| Herramienta | Versión | Estado |
|---|---|---|
| SO de desarrollo | Linux x86_64 (contenedor remoto) | OK |
| Node.js | 22.22.2 | OK |
| pnpm | 10.33.0 | OK |
| Rust / Cargo | 1.94.1 | OK |
| Python | 3.11.15 | OK (solo scripts) |
| webkit2gtk-4.1 / gtk3 (deps Tauri Linux) | — | instalación en curso vía apt |
| sqlite3 CLI | no instalado | no bloqueante (rusqlite empaqueta SQLite) |

**Nota importante:** el objetivo de empaquetado es **Windows (instalador)**, pero el
entorno de desarrollo es Linux. El instalador de Windows se producirá vía CI
(GitHub Actions, runner `windows-latest`). En Linux se valida: compilación de
frontend, tests unitarios/integración, `cargo test`/`cargo check` del backend Tauri
y, si las dependencias del sistema lo permiten, build de escritorio Linux como
smoke test.

## Funciones terminadas

- (ninguna todavía)

## Funciones en desarrollo

- Fase 0: documentos de investigación (`docs/RESEARCH.md`, etc.)

## Bloqueos

- Ninguno bloqueante. Riesgo abierto: compilación Tauri en Linux depende de
  paquetes del sistema (instalación en curso).

## Riesgos activos

1. **Empaquetado Windows no ejecutable localmente** — mitigación: CI en Windows;
   el criterio "instalable en Windows" se valida con artefacto NSIS de CI.
2. **Alcance muy amplio del MVP** — mitigación: vertical slice estricto, fases
   pequeñas, TASKS.md como control.
3. **Acoplamiento al editor (Tiptap/ProseMirror)** — mitigación: capa de
   abstracción propia sobre el editor (documento en DECISIONS.md).
4. **Modelo de datos debe sobrevivir a la futura sincronización** — mitigación:
   UUIDs, tombstones, columnas de versión y device_id desde la primera migración.

## Próximo paso exacto

Completar `docs/RESEARCH.md`, `docs/COMPETITOR_ANALYSIS.md`,
`docs/TECHNOLOGY_EVALUATION.md`, `docs/LEGAL_AND_LICENSES.md`,
`docs/RESEARCH_SOURCES.md` y después la Fase 1 (definición de producto).

## Última prueba ejecutada

- Ninguna (no existe código todavía).

## Resultado de compilación

- N/A (no existe código todavía).
