# MIGRATION_STRATEGY.md — Estrategia de migraciones

## Migraciones locales (SQLite, MVP)

- Archivos SQL numerados en `migrations/` (`001_init.sql`, `002_....sql`),
  embebidos en el binario Rust en compilación (`include_str!`) — el instalador
  no depende de archivos sueltos.
- Tabla `schema_migrations (version, name, applied_at, checksum)`. El
  checksum (SHA-256 del SQL) detecta migraciones alteradas: si el checksum de
  una migración ya aplicada no coincide con la embebida, la app se niega a
  abrir el workspace con error explícito (previene corrupción silenciosa).
- Aplicación al abrir el workspace: cada migración pendiente corre en **una
  transacción**; si falla, rollback y el workspace queda en la versión
  anterior (la app informa y no abre a medias).
- Antes de migrar, si `user_version` avanza: **respaldo automático** del
  `nodora.db` a `backups/pre-migration-<version>-<fecha>.db` dentro del
  workspace (copia con `VACUUM INTO`).
- Regla: las migraciones son **aditivas** siempre que sea posible (añadir
  tablas/columnas/índices). Cambios destructivos exigen ADR + migración de
  datos + pruebas con base antigua real (spec §12: "migración desde una base
  antigua" es caso de prueba obligatorio).
- Compatibilidad hacia delante: un workspace con versión de schema MAYOR que
  la app instalada no se abre (mensaje "actualiza Nodora"), evitando daños.

## Pruebas de migración exigidas

1. Base vacía → todas las migraciones → invariantes del modelo OK.
2. Base poblada en versión N-1 → migrar → datos intactos (fixtures
   versionadas en `tests/fixtures/`).
3. Migración interrumpida (fallo inyectado) → rollback → base utilizable.
4. Checksum alterado → apertura rechazada.

## Evolución SQLite → PostgreSQL (Horizontes 2–4)

El servidor no "migra" el archivo SQLite: lo **replica lógicamente**.

1. **Equivalencia de schema:** el DDL se mantiene deliberadamente en el
   subconjunto común (TEXT/INTEGER/REAL, sin tipos exóticos). Mapeos:
   UUID TEXT→`uuid`, fechas ISO→`timestamptz`, `*_json`→`jsonb`,
   FTS5→`tsvector`+GIN (o Meilisearch si se necesita mejor multilingüe).
2. **Carga inicial:** exportación lógica del workspace (el mismo formato JSON
   del export completo del MVP sirve de vehículo) + subida de adjuntos por
   hash. Esto convierte el export del MVP en el camino de onboarding a la
   nube — razón adicional para testearlo a fondo desde ya.
3. **A partir de ahí:** el flujo de `sync_operations` (SYNC_ARCHITECTURE.md)
   mantiene ambos lados; SQLite sigue siendo la verdad local del dispositivo
   y PostgreSQL la verdad del servidor.
4. **Reglas de oro:** ninguna migración local puede romper la capacidad de
   generar el export JSON versionado; el número de versión del export
   (`formatVersion`) evoluciona con documentación de cambios.
