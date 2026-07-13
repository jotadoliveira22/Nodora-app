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

(Las decisiones de stack, editor, persistencia, ordenación e IDs se registran al
cerrar la Fase 0/2 con su investigación de respaldo.)
