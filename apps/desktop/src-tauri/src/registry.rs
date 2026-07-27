//! Registro global de la aplicación (app.db): workspaces conocidos y
//! preferencias. Vive en el directorio de datos de la app, fuera de los
//! workspaces (docs/DATA_MODEL.md).

use std::path::{Path, PathBuf};

use rusqlite::{params, Connection, OptionalExtension};
use serde::Serialize;

use crate::db;
use crate::error::Result;
use crate::ids::{new_id, now_iso};

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct KnownWorkspace {
    pub id: String,
    pub name: String,
    pub path: String,
    pub last_opened_at: Option<String>,
}

pub struct Registry {
    pub conn: Connection,
    pub device_id: String,
}

impl Registry {
    pub fn open(app_data_dir: &Path) -> Result<Self> {
        std::fs::create_dir_all(app_data_dir)?;
        let conn = db::open_with_migrations(&app_data_dir.join("app.db"), db::APP_MIGRATIONS)?;
        let device_id = match get_setting(&conn, "device_id")? {
            Some(v) => v,
            None => {
                let id = new_id();
                set_setting(&conn, "device_id", &id)?;
                id
            }
        };
        Ok(Self { conn, device_id })
    }

    pub fn list(&self) -> Result<Vec<KnownWorkspace>> {
        let mut stmt = self.conn.prepare(
            "SELECT id, name, path, last_opened_at FROM known_workspaces
             ORDER BY last_opened_at DESC NULLS LAST, name",
        )?;
        let rows = stmt.query_map([], |r| {
            Ok(KnownWorkspace {
                id: r.get(0)?,
                name: r.get(1)?,
                path: r.get(2)?,
                last_opened_at: r.get(3)?,
            })
        })?;
        Ok(rows.collect::<std::result::Result<Vec<_>, _>>()?)
    }

    pub fn remember(&self, id: &str, name: &str, path: &Path) -> Result<()> {
        self.conn.execute(
            "INSERT INTO known_workspaces (id, name, path, last_opened_at)
             VALUES (?1, ?2, ?3, ?4)
             ON CONFLICT(path) DO UPDATE SET id=?1, name=?2, last_opened_at=?4",
            params![id, name, path.to_string_lossy(), now_iso()],
        )?;
        Ok(())
    }

    pub fn forget(&self, path: &Path) -> Result<()> {
        self.conn.execute(
            "DELETE FROM known_workspaces WHERE path = ?1",
            [path.to_string_lossy()],
        )?;
        Ok(())
    }

    pub fn last_opened(&self) -> Result<Option<KnownWorkspace>> {
        Ok(self
            .conn
            .query_row(
                "SELECT id, name, path, last_opened_at FROM known_workspaces
                 WHERE last_opened_at IS NOT NULL
                 ORDER BY last_opened_at DESC LIMIT 1",
                [],
                |r| {
                    Ok(KnownWorkspace {
                        id: r.get(0)?,
                        name: r.get(1)?,
                        path: r.get(2)?,
                        last_opened_at: r.get(3)?,
                    })
                },
            )
            .optional()?)
    }

    pub fn get_setting(&self, key: &str) -> Result<Option<String>> {
        get_setting(&self.conn, key)
    }

    pub fn set_setting(&self, key: &str, value: &str) -> Result<()> {
        set_setting(&self.conn, key, value)
    }

    /// Ruta por defecto donde se crean workspaces nuevos.
    pub fn default_workspaces_dir(app_data_dir: &Path) -> PathBuf {
        app_data_dir.join("workspaces")
    }
}

fn get_setting(conn: &Connection, key: &str) -> Result<Option<String>> {
    Ok(conn
        .query_row(
            "SELECT value FROM app_settings WHERE key = ?1",
            [key],
            |r| r.get(0),
        )
        .optional()?)
}

fn set_setting(conn: &Connection, key: &str, value: &str) -> Result<()> {
    conn.execute(
        "INSERT INTO app_settings (key, value) VALUES (?1, ?2)
         ON CONFLICT(key) DO UPDATE SET value = ?2",
        params![key, value],
    )?;
    Ok(())
}
