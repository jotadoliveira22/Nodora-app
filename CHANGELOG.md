# CHANGELOG.md — Nodora

Formato basado en [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/).

## [Unreleased]

### Añadido
- 2026-07-29 — **Eliminar espacios de trabajo.** Dos acciones separadas:
  «Quitar de la lista» (no toca el disco) y «Eliminar del disco…»
  (irreversible, exige escribir el nombre del espacio, muestra cuántas
  páginas y cuántos MB se pierden y ofrece respaldar antes). Solo se borran
  carpetas que contienen una base de Nodora reconocible.
- 2026-07-29 — **Portada de página** (migración de esquema 002): ocho
  degradados propios o una imagen del propio espacio. El recolector de
  adjuntos pasa a contar las portadas como referencias.
- 2026-07-29 — **Catálogo de 20 plantillas** agrupadas en consultora y
  clientes, proyectos, notas y conocimiento, personal y otras (CRM,
  planificador de contenidos y de clases, calendario, diario, diario de
  trading, procedimientos, reunión grabada y panel de control). Las que
  prometen algo que el MVP aún no hace lo advierten antes de aplicarse.
- 2026-07-29 — **Página nueva con punto de partida**: acciones «Añadir icono»
  y «Añadir portada» sobre el título, y una fila de arranque que desaparece
  al escribir. El icono se elige con un selector con buscador, en lugar del
  cuadro de texto del sistema.
- 2026-07-29 — El panel de espacios muestra qué contiene cada espacio
  (páginas, adjuntos y tamaño en disco).

### Corregido
- 2026-07-29 — **El editor no se refrescaba al reemplazar el contenido desde
  fuera.** Afectaba a la recarga tras un conflicto de versión: se recargaban
  los datos pero el editor seguía mostrando el documento anterior. Ahora se
  recrea de forma explícita solo en esos casos, sin perder el cursor durante
  la edición normal.
- 2026-07-29 — **El área de edición usaba `aria-label` sobre un `div` sin
  rol**, un atributo ARIA prohibido: los lectores de pantalla no la
  anunciaban. Detectado al pasar axe sobre una página vacía, que hasta ahora
  ninguna prueba auditaba.
- 2026-07-28 — **Los menús `/` y `@` no respondían al ratón.** La lista
  flotante reconstruía todo su DOM al pasar el cursor por encima, incluida la
  fila bajo el puntero: eso disparaba otro `mouseenter`, entrando en un bucle
  que impedía que el clic llegara a completarse. Ahora las filas se crean una
  sola vez por lista y el cambio de selección solo repinta clases.
- 2026-07-28 — **No se podían crear ni cambiar espacios sin reinstalar.** La
  pantalla de bienvenida solo aparecía cuando no había ningún espacio abierto,
  así que tras el primer arranque no había forma de crear otro. Nuevo gestor
  «Espacios de trabajo…» en el menú del espacio: crear uno nuevo, cambiar a
  otro conocido o abrir una carpeta existente.

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
- 2026-07-28 — **CI en verde con los dos arreglos de la beta** (run #20,
  commit `dec5865`): Linux (lint, formato, typecheck, 53 pruebas de Rust,
  12 de TypeScript, 27 de interfaz y accesibilidad, build) y Windows
  (53 pruebas de Rust + empaquetado NSIS). Instalador publicado como
  `nodora-windows-installer`, 2,618,728 bytes,
  sha256 `319b95df8bcf4cfb72e042c897eb90c67c57c6de46867550cecb301c159d2ff8`.
- 2026-07-28 — **Criterio 15 (recuperación ante errores) validado a mano:**
  5 de 5 escenarios aprobados — cierre abrupto durante la edición, respaldo
  manipulado rechazado sin tocar los datos, restauración del respaldo bueno,
  adjunto borrado a mano y carpeta del espacio movida. Con ello, los 15
  criterios de éxito quedan verificados de forma automatizada y manual.
- 2026-07-28 — **v0.1.0 aprobada como beta privada.** 13 pruebas manuales
  sobre la aplicación instalada en Windows, todas aprobadas: instalación y
  apertura, autosave y persistencia, apertura sin internet, crear páginas,
  renombrar, subpáginas, búsqueda, backlinks, base de datos, adjuntos,
  exportación, respaldo y restauración. Con ello, 14 de los 15 criterios de
  éxito quedan verificados también a mano
  (ver `docs/MANUAL_TEST_RESULTS.md`).
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
