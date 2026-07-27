# CHANGELOG.md — Nodora

Formato basado en [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/).

## [Unreleased]

### Añadido
- 2026-07-14 — **MVP funcional completo (Fase 3)**. Backend Rust/Tauri 2 con
  migraciones verificadas por checksum, workspaces portátiles, árbol de
  páginas con orden fraccionario, guardado transaccional con optimistic lock
  (contenido + FTS5 + enlaces en una sola transacción), búsqueda BM25 con
  fragmentos, backlinks derivados, bases de datos internas con 9 tipos de
  propiedad y conversión segura de tipos, adjuntos con SHA-256 y
  deduplicación, exportación Markdown/JSON y respaldos validados con
  manifiesto. Frontend React con pantalla de bienvenida, barra lateral,
  editor de bloques (menú `/`, menciones `@`, autosave), vista de tabla,
  paleta Ctrl+K y sistema visual propio claro/oscuro.
- 2026-07-14 — Suite de pruebas de robustez (`tests/robustness.rs`):
  migración desde base antigua, rollback de migración fallida, inyección SQL,
  path traversal y zip-slip, documentos y valores inválidos, operaciones
  repetidas, contrato de serialización IPC, contenido multilingüe de extremo
  a extremo, límites de adjuntos e invariantes del árbol. Total: 43 pruebas
  de backend en verde.
- 2026-07-14 — Pipeline de CI (lint, formato, typecheck, pruebas TS y Rust,
  build) más job de empaquetado del instalador NSIS en `windows-latest`.

### Verificado
- 2026-07-27 — **Instalador de Windows generado y publicado por CI**
  (artefacto `nodora-windows-installer`, 2,6 MB), con los dos jobs del
  pipeline en verde: Linux (lint, formato, typecheck, 53 pruebas de Rust,
  12 de TypeScript, 24 de interfaz y accesibilidad, build) y Windows
  (53 pruebas de Rust + empaquetado NSIS).
- 2026-07-14 — Compilación de escritorio completa (`Nodora_0.1.0_amd64.deb`) y
  arranque real del binario bajo Xvfb: la aplicación permanece viva, crea su
  directorio de datos, aplica las migraciones de `app.db` y genera su
  `device_id`.

- 2026-07-14 — Fases 1 y 2 documentadas: visión y PRD, flujos de usuario,
  alcance del MVP y roadmap; arquitectura técnica, modelo de datos + ERD,
  modelo y arquitectura de sincronización, estrategia de migraciones,
  arquitectura nube/self-hosting/costes, modelo de amenazas y arquitectura de
  seguridad, sistema de diseño; migraciones SQL iniciales
  (`migrations/workspace/001_init.sql`, `migrations/app/001_init.sql`);
  ADR-002 … ADR-009.
- 2026-07-13 — Inicialización del repositorio: archivos de gestión del proyecto
  (`PROJECT_STATE.md`, `TASKS.md`, `DECISIONS.md`, `CHANGELOG.md`),
  especificación completa (`docs/NODORA_SPEC.md`) y arranque de la Fase 0 de
  investigación.
