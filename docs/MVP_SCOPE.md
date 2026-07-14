# MVP_SCOPE.md — Alcance del MVP

## Definición de terminado (del MVP completo)

Los 15 criterios de éxito de `NODORA_SPEC.md` §16, con evidencia:

| # | Criterio | Evidencia exigida |
|---|---|---|
| 1 | Instalar en Windows | Artefacto NSIS generado por CI en runner Windows |
| 2 | Crear workspace | Test integración + flujo manual F1 |
| 3 | Crear/organizar páginas | Tests repositorio (CRUD, mover, duplicar, archivar) |
| 4 | Escribir con bloques | Tests de serialización editor + smoke UI |
| 5–6 | Cerrar y reabrir sin pérdida | Test de persistencia y crash-recovery |
| 7 | Base de datos sencilla | Tests repositorio de databases |
| 8 | Buscar | Tests FTS (título, contenido, unicode) |
| 9 | Enlaces + backlinks | Tests de extracción/reconciliación de links |
| 10 | Adjuntar imagen | Tests de FileStorage (hash, dedup, faltante) |
| 11 | Exportar | Tests export MD/JSON |
| 12–13 | Respaldo/restauración | Tests con backup válido y corrupto |
| 14 | Sin internet | Ninguna llamada de red en el código del MVP (revisión + CSP) |
| 15 | Recuperación de errores | Tests de errores razonables sin corrupción |

## Dentro del MVP

Todo lo marcado **[MVP]** en `PRD.md`. Resumen: workspaces locales, árbol de
páginas completo (CRUD/mover/duplicar/archivar/restaurar/eliminar), editor de
bloques (12 tipos, menú `/`, atajos, autosave, undo/redo, drag, conversión),
navegación (sidebar, favoritos, recientes, breadcrumbs, atrás/adelante,
Ctrl+K), búsqueda FTS5 con fragmentos y filtros básicos, bases de datos con
vista tabla y 9 tipos de propiedad (ordenar/filtrar/ocultar/abrir como
página), enlaces internos + backlinks, imágenes locales gestionadas,
exportación MD/JSON, respaldo/restauración validados, i18n-ready con UI en
español, modo claro/oscuro.

## Fuera del MVP (clasificado)

| Función | Clase |
|---|---|
| Tablas, toggles, columnas, embeds, LaTeX en editor | V2 |
| Vistas kanban/calendario/galería, fórmulas, rollups, relaciones entre bases | V2 |
| Historial de versiones navegable | V2 |
| Importadores (Notion, Markdown, Evernote) | V2 |
| Respaldos programados | V2 |
| Multiventana / múltiples workspaces abiertos | V2 |
| Usuarios, roles, permisos activos | COLAB |
| Tiempo real, cursores, comentarios | COLAB |
| Sincronización entre dispositivos | NUBE |
| App web, API, PostgreSQL, S3, Docker self-host | NUBE |
| Asistencia IA | IA |
| Telemetría, cuentas, publicación web | FUERA |
| Cifrado en reposo | Aplazado (ver THREAT_MODEL.md) |

## Orden de implementación (slices verticales)

1. **Slice 0 — Esqueleto que persiste:** scaffold monorepo + Tauri 2 +
   SQLite con migraciones + workspace + página única editable con párrafos y
   autosave. *Criterio: cerrar y reabrir sin perder texto.*
2. **Slice 1 — Árbol de páginas:** sidebar, jerarquía, orden fraccionario,
   CRUD completo, archivo/papelera.
3. **Slice 2 — Editor completo:** 12 tipos de bloque, menú `/`, atajos,
   conversión, drag, imágenes adjuntas.
4. **Slice 3 — Encontrar:** FTS5, Ctrl+K, recientes, favoritos, breadcrumbs,
   atrás/adelante.
5. **Slice 4 — Relacionar:** enlaces internos, backlinks.
6. **Slice 5 — Estructurar:** bases de datos con vista tabla.
7. **Slice 6 — Poseer:** export MD/JSON, respaldo/restauración validados.
8. **Slice 7 — Endurecer y empaquetar:** pruebas de crash/volumen/unicode,
   pulido de UX/estados, CI Windows NSIS.

Cada slice termina con: tests en verde, typecheck, lint, build, actualización
de PROJECT_STATE/TASKS/CHANGELOG.
