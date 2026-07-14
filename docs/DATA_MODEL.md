# DATA_MODEL.md — Modelo de datos

> Fuente de verdad del MVP: SQLite (una base por workspace, archivo
> `nodora.db` dentro de la carpeta del workspace). Diagrama en `docs/ERD.md`;
> evolución a PostgreSQL en `docs/MIGRATION_STRATEGY.md`; columnas de
> sincronización justificadas en `docs/SYNC_DATA_MODEL.md`.

## Convenciones

- **IDs:** UUID v4 en `TEXT` (36 chars). Estables de por vida; nunca se
  reciclan.
- **Timestamps:** `TEXT` ISO-8601 UTC (`YYYY-MM-DDTHH:MM:SS.sssZ`).
- **Borrado lógico:** `deleted_at` (tombstone) en entidades sincronizables;
  el borrado físico solo ocurre en "eliminar definitivamente" y purgas.
- **Columnas de sync en toda entidad sincronizable:** `created_at`,
  `updated_at`, `deleted_at`, `created_by`, `updated_by`, `device_id`,
  `version` (entero, incrementa en cada escritura; optimistic lock local y
  versión base para sync futura). Las fechas **no** son el mecanismo de
  resolución de conflictos (spec §7): la resolución futura usa
  `version` + log de operaciones (ver SYNC_DATA_MODEL.md).
- **Orden:** `position TEXT` con clave fraccionaria base-62 (orden
  lexicográfico). Generación en `@nodora/shared` (TS) y `ordering.rs` (Rust)
  con tests cruzados. Rebalanceo perezoso si `len(position) > 64`.
- **JSON:** columnas `*_json` validadas en Rust antes de escribir.

## Registro global de la aplicación (fuera del workspace)

Archivo `app.db` en el directorio de datos de usuario (p. ej.
`%APPDATA%/com.nodora.app/`): tabla `known_workspaces (id, name, path,
last_opened_at)` y `app_settings (key, value)`. Permite F2 (abrir último
workspace) sin acoplar los workspaces entre sí. Un workspace es portátil:
carpeta con `nodora.db` + `attachments/`.

## Tablas del workspace (nodora.db)

### workspaces
Una fila (el propio workspace); tabla en plural para compatibilidad futura
multi-workspace en servidor.

| Columna | Tipo | Notas |
|---|---|---|
| id | TEXT PK | UUID |
| name | TEXT NOT NULL | |
| icon | TEXT | emoji o `color:<token>:<inicial>` |
| settings_json | TEXT | preferencias del workspace |
| + columnas de sync | | |

### users
MVP: una fila "owner" creada con el workspace. Reservada para COLAB.

| id TEXT PK | name TEXT | kind TEXT ('local_owner' MVP) | + sync |

### devices
MVP: una fila por instalación (UUID generado al crear/abrir por primera vez).

| id TEXT PK | name TEXT | platform TEXT | last_seen_at TEXT | + sync |

### memberships (reservada, vacía en MVP)
| id PK | workspace_id FK | user_id FK | role TEXT | + sync |

### pages

| Columna | Tipo | Notas |
|---|---|---|
| id | TEXT PK | UUID |
| workspace_id | TEXT FK→workspaces | |
| parent_page_id | TEXT FK→pages NULL | NULL = raíz |
| title | TEXT NOT NULL DEFAULT '' | |
| icon | TEXT | emoji |
| position | TEXT NOT NULL | orden fraccionario entre hermanos |
| content_json | TEXT NOT NULL | documento del editor (árbol ProseMirror; cada bloque con attr `blockId` UUID) |
| content_text | TEXT NOT NULL DEFAULT '' | proyección texto plano (para FTS) |
| kind | TEXT NOT NULL DEFAULT 'page' | 'page' \| 'database' \| 'record' |
| database_id | TEXT FK→databases NULL | si kind='record': a qué base pertenece |
| archived_at | TEXT NULL | archivado ≠ borrado |
| + columnas de sync | | version, deleted_at, etc. |

Índices: `(workspace_id, parent_page_id, position)`, `(database_id)`,
`(archived_at)`, `(deleted_at)`.

Notas de diseño:
- **Registro de base de datos = página** (`kind='record'`): da "abrir registro
  como página" sin duplicar modelo (decisión NODORA, ver RESEARCH.md §4).
- El contenido es un documento por página, con `blockId` estable por bloque
  para la futura migración a operaciones por bloque/CRDT (ADR-005).
- `archived_at` es independiente de `deleted_at`: archivar es reversible y
  visible en la papelera; `deleted_at` es tombstone de sync tras "eliminar
  definitivamente" (el contenido se vacía, la fila persiste para replicar la
  eliminación).

### page_links (proyección derivada, no editable)

| source_page_id FK | target_page_id FK | block_id TEXT | PK(source,target,block) |

Reconciliada transaccionalmente en cada guardado. Backlinks de X =
`SELECT source WHERE target = X AND source no archivada/borrada`.

### favorites
| id PK | workspace_id FK | page_id FK UNIQUE | position TEXT | + sync |

### recents (local puro, no sincronizable)
| page_id PK FK | visited_at TEXT | — ring buffer podado a 100 |

### databases

| id PK | workspace_id FK | page_id FK→pages | (la página kind='database' que la contiene) | + sync |

### database_properties

| Columna | Notas |
|---|---|
| id TEXT PK | |
| database_id FK | |
| name TEXT NOT NULL | |
| type TEXT NOT NULL | 'title'\|'text'\|'number'\|'select'\|'multi_select'\|'status'\|'date'\|'checkbox'\|'url' |
| config_json TEXT | opciones de select/status (id, nombre, color token), formato de número/fecha |
| position TEXT | orden de columnas |
| hidden INTEGER DEFAULT 0 | |
| + sync | |

Toda base tiene exactamente una propiedad `title` (invariante verificada).

### record_values

| record_page_id FK→pages | property_id FK | value_json TEXT | updated_at | PK(record,property) |

`value_json` tipado por propiedad: `{"text": "..."}`, `{"number": 3.14}`,
`{"select": "<optionId>"}`, `{"multi_select": ["id1","id2"]}`,
`{"date": {"start": "...", "end": null}}`, `{"checkbox": true}`,
`{"url": "https://..."}`. El título vive en `pages.title` (no se duplica).

**Matriz de conversión segura de tipos** (implementada y testeada):

| De → A | text | number | select | multi_select | status | date | checkbox | url |
|---|---|---|---|---|---|---|---|---|
| text | = | parse o null | opción por valor | opción por valor | opción | parse o null | no | sí |
| number | sí | = | no | no | no | no | no | no |
| select | sí | no | = | envolver | mapear | no | no | no |
| multi_select | sí (join) | no | primera | = | no | no | no | no |
| status | sí | no | mapear | envolver | = | no | no | no |
| date | sí (ISO) | no | no | no | no | = | no | no |
| checkbox | sí | no | no | no | no | no | = | no |
| url | sí | no | no | no | no | no | no | = |

Conversiones "no" se ofrecen deshabilitadas en UI con explicación. Toda
conversión ocurre en una transacción con recuento de valores no convertibles
informado antes de confirmar.

### attachments

| Columna | Notas |
|---|---|
| id TEXT PK | UUID; nombre físico = `<id>.<ext saneada>` en `attachments/` |
| workspace_id FK | |
| original_name TEXT | solo informativo |
| mime TEXT | detectado por contenido (magic bytes), no por extensión |
| size_bytes INTEGER | |
| sha256 TEXT | integridad + deduplicación (índice) |
| ref_count INTEGER DEFAULT 1 | dedup: mismo sha256 reutiliza fila |
| + sync | |

### activity_log (append-only)

| id PK | workspace_id | entity_type | entity_id | action TEXT | summary_json | actor_id | device_id | created_at |

MVP: registra acciones estructurales (crear/mover/archivar/eliminar/restaurar,
backup/restore, cambios de schema de bases). No registra contenido tecleado.

### sync_operations (schema listo, sin uso activo en MVP)

Ver `docs/SYNC_DATA_MODEL.md`. Vacía durante el MVP; existe para que la
migración a sync no altere el schema base.

### schema_migrations
| version INTEGER PK | name TEXT | applied_at TEXT | checksum TEXT |

## Búsqueda (FTS5)

```sql
CREATE VIRTUAL TABLE pages_fts USING fts5(
  title, content_text,
  content='pages', content_rowid='rowid',
  tokenize = 'unicode61 remove_diacritics 2'
);
```

Sincronizada por el repositorio dentro de la transacción de guardado (no por
triggers de SQLite, para mantener la lógica testeable y explícita en un solo
lugar — decisión documentada: los triggers dificultan el control del error y
la observabilidad desde Rust). Consultas con `bm25()` y `snippet()`.

## PRAGMAs de apertura

`journal_mode=WAL`, `foreign_keys=ON`, `synchronous=NORMAL` (durabilidad
adecuada con WAL; probada en tests de crash), `busy_timeout=5000`.

## Invariantes verificadas por tests

1. Ninguna página es ancestro de sí misma (check al mover).
2. `kind='record'` ⇒ `database_id` no nulo; `kind≠'record'` ⇒ nulo.
3. Toda base tiene exactamente una propiedad `title`.
4. `page_links` solo contiene páginas existentes (FK).
5. Tras cualquier guardado, FTS y `page_links` reflejan `content_json`.
6. `attachments.ref_count` ≥ 1 mientras exista referencia en documentos.
