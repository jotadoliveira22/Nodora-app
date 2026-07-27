# PROJECT_STATE.md — Nodora

> Última actualización: 2026-07-14

## Estado actual

**Fase 3 (MVP) completa y verificada; Fase 4 (calidad y empaquetado) en
curso.** El pipeline de CI pasa íntegro en Linux; el job de Windows está
pendiente de completar el instalador NSIS.

## Entorno de desarrollo verificado

| Herramienta | Versión | Estado |
|---|---|---|
| SO de desarrollo | Linux x86_64 (contenedor remoto) | OK |
| Node.js / pnpm | 22.22.2 / 10.33.0 | OK |
| Rust / Cargo | 1.94.1 | OK |
| webkit2gtk-4.1 + gtk3 | instaladas | OK |
| Xvfb (arranque headless) | instalado | OK |

El instalador Windows se produce en CI (`windows-latest`, NSIS): ADR-000.

## Funciones terminadas

**Documentación (Fases 0–2):** 27 documentos en `docs/` + `SECURITY.md` +
migraciones SQL iniciales. ADR-000 … ADR-009 en `DECISIONS.md`.

**Backend (Rust / Tauri 2):**
- Migraciones versionadas embebidas con verificación de checksum, rechazo de
  esquemas más nuevos y rollback transaccional ante fallo.
- Workspaces portátiles (crear, abrir, renombrar, icono, último usado).
- Páginas: árbol con orden fraccionario, crear/renombrar/mover (con detección
  de ciclos)/duplicar subárbol/archivar/restaurar/eliminar definitivamente.
- Guardado transaccional con optimistic lock (`version`) que actualiza en la
  misma transacción el índice FTS5 y la proyección de enlaces.
- Búsqueda FTS5 con BM25, `snippet()` y consultas MATCH saneadas.
- Backlinks derivados (nunca divergen del contenido).
- Bases de datos internas: 9 tipos de propiedad, registros que SON páginas,
  orden, filtros, ocultar columnas y conversión de tipos con matriz segura +
  informe previo (dry-run).
- Adjuntos: carpeta gestionada, MIME por magic bytes, SHA-256 con
  deduplicación, verificación de integridad y estado de archivo faltante.
- Exportación a Markdown (con subpáginas y assets) y a JSON versionado.
- Respaldos ZIP con manifiesto y hashes; validación completa previa a
  restaurar; restauración siempre a un espacio nuevo.
- 45 comandos IPC tipados; errores con códigos estables sin filtrar detalles
  internos; logging estructurado sin contenido de usuario.

**Frontend (React + TypeScript estricto):**
- Pantalla de bienvenida (crear/abrir espacio, restaurar respaldo).
- Barra lateral con árbol, favoritos, recientes y menús contextuales.
- Vista de página: breadcrumbs, historial atrás/adelante, indicador de
  guardado, autosave con debounce + flush + reintento, backlinks.
- Editor de bloques sobre `@nodora/editor` (menú `/`, menciones `@`,
  callouts, imágenes adjuntas, subpáginas, pegado de imágenes).
- Vista de tabla de bases de datos con editores por tipo de celda.
- Paleta de búsqueda (Ctrl+K) con fragmentos resaltados y filtros.
- Sistema visual propio con tema claro/oscuro y estados de UI.

## Funciones en desarrollo

- Instalador de Windows: el workflow ya ejecuta las pruebas de Rust en
  `windows-latest` y encadena el empaquetado NSIS; falta una ejecución
  completa que publique el artefacto.

## Bloqueos

- Ninguno.

## Deuda técnica

Registrada en `docs/TECHNICAL_DEBT.md`: adjuntos no liberados (D1), títulos de
enlaces no refrescados en vivo (D2), mensaje genérico al superar el tamaño
máximo de documento (D3), instalador sin firmar (D4), sin auto-actualización
(D5) y backend simulado en las pruebas de interfaz (D6).

## Riesgos activos

1. **Instalador Windows sin artefacto todavía** — es el único criterio de
   éxito del MVP aún sin evidencia. Las pruebas de Rust ya se ejecutan y
   pasan en `windows-latest`; falta que termine el empaquetado NSIS.
2. **Las pruebas de interfaz usan un backend en memoria** — verifican los
   flujos de UI, no la persistencia real (esa la cubren las 44 pruebas de
   Rust). El contrato entre ambos lados está fijado por la prueba de
   serialización IPC.
3. **Sin firma de código** — Windows SmartScreen advertirá al instalar
   (aceptado para uso privado; documentado en `docs/ARCHITECTURE.md`).

## Próximo paso exacto

Esperar a que el job `windows-installer` publique el artefacto NSIS y
comprobar que se genera correctamente (criterio de éxito nº 1). Después:
repaso de accesibilidad y pulido de UX (tarea 5.4).

## Última prueba ejecutada

`cargo test` (2026-07-27): **44 pruebas, 44 correctas** (Linux) y **44
correctas en Windows** vía CI
- 13 unitarias (orden fraccionario, validación de documentos)
- 18 de integración (`tests/core.rs`: workspace, páginas, guardado, enlaces,
  búsqueda, bases de datos, adjuntos, exportación, respaldos, volumen)
- 12 de robustez (`tests/robustness.rs`: migración desde base antigua,
  rollback de migración fallida, inyección SQL, path traversal, zip-slip,
  documentos inválidos, operaciones repetidas, contrato IPC camelCase,
  multilingüe extremo a extremo, límites de adjuntos, invariantes del árbol)

`pnpm --filter @nodora/desktop test:ui` (Playwright): **15 pruebas de
interfaz, 15 correctas** — bienvenida, creación y titulación de páginas,
autosave, menú `/`, atajos de Markdown, enlaces `@` con backlinks, búsqueda
Ctrl+K, archivar/restaurar, bases de datos, navegación, subpáginas, tema
oscuro, manejo de error de guardado y validación de respaldo.

`pnpm -r test`: 12 pruebas correctas (10 de orden fraccionario en TS + 2 de
renderizado seguro de fragmentos de búsqueda).
`pnpm lint`, `pnpm format:check`, `pnpm -r typecheck`: sin errores.

**Defectos encontrados por las pruebas de interfaz y corregidos:**
1. Pérdida de contenido al titular una página: `rename_page` incrementaba la
   versión y el autosave seguía usando la anterior, provocando un
   `VERSION_CONFLICT` espurio que descartaba lo escrito.
2. Los breadcrumbs mantenían el título anterior tras renombrar.

## Resultado de compilación

- `pnpm --filter @nodora/desktop build`: OK (549 kB JS, 14 kB CSS).
- `pnpm tauri build --bundles deb`: OK — `Nodora_0.1.0_amd64.deb` generado en
  5 min 28 s.
- **Arranque real verificado** (2026-07-14): el binario de release se ejecutó
  bajo Xvfb, permaneció vivo, creó su directorio de datos, aplicó las
  migraciones de `app.db` (schema_version = 1) y generó el `device_id`.
- CI (run #3, 2026-07-27): job `quality` en Linux **correcto** de principio a
  fin (lint, formato, typecheck, pruebas TS, 44 pruebas de Rust, build).
- CI job `windows-installer`: las pruebas de Rust pasan en `windows-latest`;
  el artefacto NSIS está **pendiente de una ejecución completa**.
