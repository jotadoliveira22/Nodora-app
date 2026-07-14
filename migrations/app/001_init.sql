-- 001_init.sql — Registro global de la aplicación (app.db, fuera del workspace)

-- La clave natural es la ruta: el mismo workspace (id) puede existir en dos
-- carpetas (p. ej. restaurado desde respaldo).
CREATE TABLE known_workspaces (
  id             TEXT NOT NULL,
  name           TEXT NOT NULL,
  path           TEXT PRIMARY KEY,
  last_opened_at TEXT
);

CREATE TABLE app_settings (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
