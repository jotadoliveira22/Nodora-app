# PROJECT_STATE.md — Nodora

> Última actualización: 2026-07-28

## Estado actual

**MVP completo y validado también a mano: v0.1.0 aprobada como beta
privada.** Los 15 criterios de éxito de `docs/NODORA_SPEC.md` §16 tienen
evidencia automatizada, y 14 de ellos han sido además comprobados por una
persona sobre la aplicación instalada en Windows
(`docs/MANUAL_TEST_RESULTS.md`). El pipeline de CI pasa íntegro en Linux y
en Windows, y publica el instalador NSIS.

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
- Recolección segura de adjuntos sin referencias («Liberar espacio»), que
  recalcula las referencias reales desde el contenido y nunca borra archivos
  que no reconoce.
- 54 comandos IPC tipados; errores con códigos estables sin filtrar detalles
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

- Ninguna. El siguiente bloque de trabajo es el Horizonte 1 del roadmap
  (`docs/FUTURE_ROADMAP.md`): historial de versiones, bloques avanzados,
  vistas adicionales de bases de datos e importadores.

## Bloqueos

- Ninguno.

## Deuda técnica

Registrada en `docs/TECHNICAL_DEBT.md`: adjuntos no liberados (D1), títulos de
enlaces no refrescados en vivo (D2), mensaje genérico al superar el tamaño
máximo de documento (D3), instalador sin firmar (D4), sin auto-actualización
(D5) y backend simulado en las pruebas de interfaz (D6).

## Riesgos activos

1. **El instalador no está firmado** — SmartScreen advertirá al instalar
   (deuda D4, aceptada para uso privado).
2. **Las pruebas de interfaz usan un backend en memoria** — verifican los
   flujos de UI, no la persistencia real (esa la cubren las 44 pruebas de
   Rust). El contrato entre ambos lados está fijado por la prueba de
   serialización IPC.
3. **El criterio 15 (recuperación ante errores) no se ha validado a mano** —
   está cubierto por pruebas automatizadas, pero no aparece en la tanda
   manual de v0.1.0. Guion propuesto en `docs/MANUAL_TEST_RESULTS.md`.

## Próximo paso exacto

Cerrar la validación manual pendiente (criterio 15 y las funciones listadas
en `docs/MANUAL_TEST_RESULTS.md`) y, en paralelo, arrancar el Horizonte 1 del
roadmap (`docs/FUTURE_ROADMAP.md`): historial de versiones, bloques
avanzados, vistas adicionales de bases de datos e importadores.

## Última prueba ejecutada

`cargo test` (2026-07-27): **53 pruebas, 53 correctas** en Linux y en Windows
(vía CI)
- 13 unitarias (orden fraccionario, validación de documentos)
- 2 de aceptación (`tests/acceptance.rs`: los criterios 2-13 y 15 recorridos
  como una historia de usuario completa, más la portabilidad del espacio)
- 4 de guardarraíl offline (`tests/offline.rs`: sin dependencias de red, sin
  permisos de red, CSP sin orígenes remotos, frontend sin llamadas)
- 19 de integración (`tests/core.rs`: workspace, páginas, guardado, enlaces,
  búsqueda, bases de datos, adjuntos, exportación, respaldos, volumen)
- 15 de robustez (`tests/robustness.rs`: migración desde base antigua,
  rollback de migración fallida, inyección SQL, path traversal, zip-slip,
  documentos inválidos, operaciones repetidas, contrato IPC camelCase,
  multilingüe extremo a extremo, límites de adjuntos, invariantes del árbol y
  seguridad del recolector de adjuntos)

`pnpm --filter @nodora/desktop test:ui` (Playwright): **24 pruebas, 24
correctas** (16 de interfaz + 8 de accesibilidad WCAG 2.1 AA) — bienvenida, creación y titulación de páginas,
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
- CI (run #16, commit `e0c7a92`, 2026-07-27): **ambos jobs correctos**.
  - Linux: lint, formato TS y Rust, typecheck, pruebas TS, 53 pruebas de
    Rust, build del frontend, 24 pruebas de interfaz y auditoría.
  - Windows: 53 pruebas de Rust y compilación del instalador NSIS en 6 min.
- **Artefacto publicado:** `nodora-windows-installer` (2,6 MB),
  sha256 `4a0e5066…`.
- **Instalación en Windows real:** verificada por el propietario el
  2026-07-28 (prueba manual 1), junto con otras 12 pruebas, todas
  aprobadas. Detalle en `docs/MANUAL_TEST_RESULTS.md`.
