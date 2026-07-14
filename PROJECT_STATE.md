# PROJECT_STATE.md — Nodora

> Última actualización: 2026-07-14

## Estado actual

**Fases 0–2 documentadas. Punto de control pre-implementación presentado.**
A continuación: Fase 3, Slice 0 (esqueleto que persiste).

## Entorno de desarrollo verificado

| Herramienta | Versión | Estado |
|---|---|---|
| SO de desarrollo | Linux x86_64 (contenedor remoto) | OK |
| Node.js / pnpm | 22.22.2 / 10.33.0 | OK |
| Rust / Cargo | 1.94.1 | OK |
| webkit2gtk-4.1 + gtk3 (deps Tauri Linux) | instaladas vía apt | OK |

El instalador Windows se produce vía CI (`windows-latest`, NSIS): ADR-000.

## Funciones terminadas

- Documentación completa de Fases 0 (investigación), 1 (producto) y 2
  (arquitectura, datos, sync, nube, seguridad, diseño): 26 documentos en
  `docs/` + migraciones SQL iniciales en `migrations/`.
- Decisiones ADR-000 … ADR-009 registradas en `DECISIONS.md`.

## Funciones en desarrollo

- Slice 0: scaffold monorepo + Tauri 2 + SQLite con migraciones + workspace +
  página editable con autosave. Criterio: cerrar y reabrir sin perder texto.

## Bloqueos

- Ninguno.

## Riesgos activos

1. Empaquetado Windows solo verificable en CI (ADR-000) — pendiente workflow.
2. Volumen de alcance del MVP — mitigado por slices de `MVP_SCOPE.md`.
3. Compilación Rust inicial de Tauri es lenta en contenedor (~minutos) —
   asumido; se cachea target/.

## Próximo paso exacto

Ejecutar tarea 3.1: `pnpm` workspaces + `apps/desktop` (Tauri 2 + React + TS
estricto + Vite) + `packages/shared` + tooling (ESLint, Prettier, Vitest) y
primer `cargo test` verde de la capa de migraciones (tarea 3.2).

## Última prueba ejecutada

- Ninguna (aún no hay código). Los docs de Fase 2 definen la matriz de
  pruebas exigidas.

## Resultado de compilación

- N/A todavía.
