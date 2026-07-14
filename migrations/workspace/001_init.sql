-- 001_init.sql — Schema inicial del workspace de Nodora
-- Convenciones: UUID TEXT, fechas ISO-8601 UTC, borrado lógico deleted_at,
-- columnas de sync en entidades sincronizables (ver docs/DATA_MODEL.md).

CREATE TABLE workspaces (
  id            TEXT PRIMARY KEY,
  name          TEXT NOT NULL,
  icon          TEXT,
  settings_json TEXT NOT NULL DEFAULT '{}',
  version       INTEGER NOT NULL DEFAULT 1,
  created_at    TEXT NOT NULL,
  updated_at    TEXT NOT NULL,
  deleted_at    TEXT,
  created_by    TEXT NOT NULL,
  updated_by    TEXT NOT NULL,
  device_id     TEXT NOT NULL
);

CREATE TABLE users (
  id         TEXT PRIMARY KEY,
  name       TEXT NOT NULL,
  kind       TEXT NOT NULL DEFAULT 'local_owner',
  version    INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT
);

CREATE TABLE devices (
  id           TEXT PRIMARY KEY,
  name         TEXT NOT NULL,
  platform     TEXT NOT NULL,
  last_seen_at TEXT NOT NULL,
  version      INTEGER NOT NULL DEFAULT 1,
  created_at   TEXT NOT NULL,
  updated_at   TEXT NOT NULL,
  deleted_at   TEXT
);

-- Reservada para colaboración futura; vacía en el MVP.
CREATE TABLE memberships (
  id           TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id),
  user_id      TEXT NOT NULL REFERENCES users(id),
  role         TEXT NOT NULL,
  version      INTEGER NOT NULL DEFAULT 1,
  created_at   TEXT NOT NULL,
  updated_at   TEXT NOT NULL,
  deleted_at   TEXT,
  UNIQUE (workspace_id, user_id)
);

CREATE TABLE pages (
  id             TEXT PRIMARY KEY,
  workspace_id   TEXT NOT NULL REFERENCES workspaces(id),
  parent_page_id TEXT REFERENCES pages(id),
  title          TEXT NOT NULL DEFAULT '',
  icon           TEXT,
  position       TEXT NOT NULL,
  content_json   TEXT NOT NULL DEFAULT '{"type":"doc","content":[]}',
  content_text   TEXT NOT NULL DEFAULT '',
  kind           TEXT NOT NULL DEFAULT 'page'
                 CHECK (kind IN ('page','database','record')),
  database_id    TEXT REFERENCES databases(id),
  archived_at    TEXT,
  version        INTEGER NOT NULL DEFAULT 1,
  created_at     TEXT NOT NULL,
  updated_at     TEXT NOT NULL,
  deleted_at     TEXT,
  created_by     TEXT NOT NULL,
  updated_by     TEXT NOT NULL,
  device_id      TEXT NOT NULL,
  CHECK ((kind = 'record') = (database_id IS NOT NULL))
);
CREATE INDEX idx_pages_tree     ON pages(workspace_id, parent_page_id, position);
CREATE INDEX idx_pages_database ON pages(database_id);
CREATE INDEX idx_pages_archived ON pages(archived_at) WHERE archived_at IS NOT NULL;
CREATE INDEX idx_pages_deleted  ON pages(deleted_at)  WHERE deleted_at  IS NOT NULL;

-- Proyección derivada de enlaces internos; reconciliada en cada guardado.
CREATE TABLE page_links (
  source_page_id TEXT NOT NULL REFERENCES pages(id) ON DELETE CASCADE,
  target_page_id TEXT NOT NULL REFERENCES pages(id) ON DELETE CASCADE,
  block_id       TEXT NOT NULL,
  PRIMARY KEY (source_page_id, target_page_id, block_id)
);
CREATE INDEX idx_page_links_target ON page_links(target_page_id);

CREATE TABLE favorites (
  id           TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id),
  page_id      TEXT NOT NULL UNIQUE REFERENCES pages(id) ON DELETE CASCADE,
  position     TEXT NOT NULL,
  version      INTEGER NOT NULL DEFAULT 1,
  created_at   TEXT NOT NULL,
  updated_at   TEXT NOT NULL,
  deleted_at   TEXT
);

-- Local puro: no se sincroniza (ver docs/SYNC_DATA_MODEL.md).
CREATE TABLE recents (
  page_id    TEXT PRIMARY KEY REFERENCES pages(id) ON DELETE CASCADE,
  visited_at TEXT NOT NULL
);

CREATE TABLE databases (
  id           TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id),
  page_id      TEXT NOT NULL UNIQUE REFERENCES pages(id),
  version      INTEGER NOT NULL DEFAULT 1,
  created_at   TEXT NOT NULL,
  updated_at   TEXT NOT NULL,
  deleted_at   TEXT,
  created_by   TEXT NOT NULL,
  updated_by   TEXT NOT NULL,
  device_id    TEXT NOT NULL
);

CREATE TABLE database_properties (
  id          TEXT PRIMARY KEY,
  database_id TEXT NOT NULL REFERENCES databases(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  type        TEXT NOT NULL CHECK (type IN
              ('title','text','number','select','multi_select',
               'status','date','checkbox','url')),
  config_json TEXT NOT NULL DEFAULT '{}',
  position    TEXT NOT NULL,
  hidden      INTEGER NOT NULL DEFAULT 0,
  version     INTEGER NOT NULL DEFAULT 1,
  created_at  TEXT NOT NULL,
  updated_at  TEXT NOT NULL,
  deleted_at  TEXT
);
CREATE INDEX idx_db_props ON database_properties(database_id, position);

CREATE TABLE record_values (
  record_page_id TEXT NOT NULL REFERENCES pages(id) ON DELETE CASCADE,
  property_id    TEXT NOT NULL REFERENCES database_properties(id) ON DELETE CASCADE,
  value_json     TEXT NOT NULL,
  updated_at     TEXT NOT NULL,
  PRIMARY KEY (record_page_id, property_id)
);
CREATE INDEX idx_record_values_prop ON record_values(property_id);

CREATE TABLE attachments (
  id            TEXT PRIMARY KEY,
  workspace_id  TEXT NOT NULL REFERENCES workspaces(id),
  original_name TEXT NOT NULL,
  mime          TEXT NOT NULL,
  size_bytes    INTEGER NOT NULL,
  sha256        TEXT NOT NULL,
  ref_count     INTEGER NOT NULL DEFAULT 1,
  version       INTEGER NOT NULL DEFAULT 1,
  created_at    TEXT NOT NULL,
  updated_at    TEXT NOT NULL,
  deleted_at    TEXT,
  created_by    TEXT NOT NULL,
  updated_by    TEXT NOT NULL,
  device_id     TEXT NOT NULL
);
CREATE INDEX idx_attachments_sha ON attachments(sha256);

CREATE TABLE activity_log (
  id           TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  entity_type  TEXT NOT NULL,
  entity_id    TEXT NOT NULL,
  action       TEXT NOT NULL,
  summary_json TEXT NOT NULL DEFAULT '{}',
  actor_id     TEXT NOT NULL,
  device_id    TEXT NOT NULL,
  created_at   TEXT NOT NULL
);
CREATE INDEX idx_activity_entity ON activity_log(entity_type, entity_id);
CREATE INDEX idx_activity_time   ON activity_log(created_at);

-- Log de operaciones para sincronización futura. Vacía durante el MVP.
CREATE TABLE sync_operations (
  operation_id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  entity_id    TEXT NOT NULL,
  entity_type  TEXT NOT NULL,
  actor_id     TEXT NOT NULL,
  device_id    TEXT NOT NULL,
  op_type      TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  base_version INTEGER NOT NULL,
  local_at     TEXT NOT NULL,
  server_at    TEXT,
  sync_status  TEXT NOT NULL DEFAULT 'pending'
               CHECK (sync_status IN ('pending','sent','acked','rejected'))
);
CREATE INDEX idx_sync_ops_status ON sync_operations(sync_status, local_at);
CREATE INDEX idx_sync_ops_entity ON sync_operations(entity_id, base_version);

-- Búsqueda full-text (contenido externo sobre pages).
CREATE VIRTUAL TABLE pages_fts USING fts5(
  title, content_text,
  content='pages', content_rowid='rowid',
  tokenize = 'unicode61 remove_diacritics 2'
);
