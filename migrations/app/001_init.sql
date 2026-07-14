-- 001_init.sql — Registro global de la aplicación (app.db, fuera del workspace)

CREATE TABLE known_workspaces (
  id             TEXT PRIMARY KEY,
  name           TEXT NOT NULL,
  path           TEXT NOT NULL UNIQUE,
  last_opened_at TEXT
);

CREATE TABLE app_settings (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
