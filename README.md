# Nodora

**Espacio de trabajo privado y local-first** para notas, documentos, proyectos,
wikis y bases de datos ligeras. Todo se guarda en tu equipo: sin cuenta, sin
servidor, sin internet.

> Estado: MVP en desarrollo. Ver `PROJECT_STATE.md` para el estado exacto y
> `docs/NODORA_SPEC.md` para la especificación completa.

## Características del MVP

- Espacios de trabajo locales y portátiles (carpeta con SQLite + adjuntos).
- Árbol de páginas ilimitado: crear, mover, duplicar, archivar, restaurar.
- Editor por bloques (texto, encabezados, listas, tareas, citas, código,
  separadores, callouts, imágenes, enlaces internos, subpáginas) con menú `/`,
  atajos Markdown, undo/redo y guardado automático.
- Búsqueda de texto completo (SQLite FTS5, multilingüe) con Ctrl+K.
- Backlinks automáticos entre páginas.
- Bases de datos internas con vista de tabla y 9 tipos de propiedad.
- Exportación a Markdown y JSON; respaldos verificados y restauración segura.
- Liberación segura de adjuntos que ya no usa ninguna página.
- Modo claro/oscuro; interfaz en español optimizada para teclado.

## Desarrollo

Requisitos: Node 20+, pnpm 10, Rust estable, y en Linux las dependencias de
Tauri (`libwebkit2gtk-4.1-dev libgtk-3-dev`).

```bash
pnpm install
pnpm dev                 # app de escritorio en modo desarrollo
pnpm -r test             # tests TS (shared, editor, desktop)
cd apps/desktop/src-tauri && cargo test   # backend (53)
pnpm --filter @nodora/desktop test:ui     # interfaz y accesibilidad (24)
pnpm lint && pnpm -r typecheck
pnpm --filter @nodora/desktop tauri build # empaquetado
```

El instalador de Windows (NSIS) se genera en CI (`.github/workflows/ci.yml`,
job `windows-installer`) sobre `windows-latest`.

## Estructura

```text
apps/desktop      Aplicación Tauri 2 (React + TS) y backend Rust (SQLite)
apps/web|server   Placeholders documentados (roadmap de nube)
packages/shared   Tipos DTO, contratos cloud-ready, orden fraccionario
packages/editor   Capa de abstracción sobre Tiptap (ADR-004)
migrations/       SQL versionado (embebido en el binario con checksum)
docs/             Investigación, PRD, arquitectura, seguridad, diseño…
```

## Documentos clave

- `docs/NODORA_SPEC.md` — especificación obligatoria del producto.
- `PROJECT_STATE.md`, `TASKS.md`, `DECISIONS.md`, `CHANGELOG.md` — gestión.
- `docs/ARCHITECTURE.md`, `docs/DATA_MODEL.md`, `docs/SYNC_ARCHITECTURE.md`.
- `docs/THREAT_MODEL.md`, `SECURITY.md`.
