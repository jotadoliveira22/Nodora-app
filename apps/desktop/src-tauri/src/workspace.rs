//! Ciclo de vida del workspace: crear, abrir, renombrar, icono.
//! Un workspace es una carpeta portátil: nodora.db + attachments/ + backups/.

use std::path::{Path, PathBuf};

use rusqlite::{params, Connection};
use serde::Serialize;

use crate::db;
use crate::error::{NodoraError, Result};
use crate::ids::{new_id, now_iso};
use crate::ordering::key_between;

pub const DB_FILE: &str = "nodora.db";
pub const ATTACHMENTS_DIR: &str = "attachments";
pub const BACKUPS_DIR: &str = "backups";

#[derive(Debug, Clone)]
pub struct WorkspaceCtx {
    pub workspace_id: String,
    pub user_id: String,
    pub device_id: String,
}

pub struct OpenWorkspace {
    pub conn: Connection,
    pub path: PathBuf,
    pub ctx: WorkspaceCtx,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WorkspaceInfo {
    pub id: String,
    pub name: String,
    pub icon: Option<String>,
    pub path: String,
}

impl OpenWorkspace {
    pub fn attachments_dir(&self) -> PathBuf {
        self.path.join(ATTACHMENTS_DIR)
    }

    pub fn info(&self) -> Result<WorkspaceInfo> {
        let (name, icon): (String, Option<String>) = self.conn.query_row(
            "SELECT name, icon FROM workspaces WHERE id = ?1",
            [&self.ctx.workspace_id],
            |r| Ok((r.get(0)?, r.get(1)?)),
        )?;
        Ok(WorkspaceInfo {
            id: self.ctx.workspace_id.clone(),
            name,
            icon,
            path: self.path.to_string_lossy().into_owned(),
        })
    }
}

fn validate_name(name: &str) -> Result<()> {
    let trimmed = name.trim();
    if trimmed.is_empty() || trimmed.len() > 200 {
        return Err(NodoraError::InvalidInput(
            "el nombre debe tener entre 1 y 200 caracteres".into(),
        ));
    }
    Ok(())
}

/// Crea un workspace nuevo en `dir` (la carpeta no debe contener ya uno).
pub fn create_workspace(
    dir: &Path,
    name: &str,
    icon: Option<&str>,
    device_id: &str,
) -> Result<OpenWorkspace> {
    validate_name(name)?;
    std::fs::create_dir_all(dir)?;
    let db_path = dir.join(DB_FILE);
    if db_path.exists() {
        return Err(NodoraError::InvalidInput(
            "la carpeta elegida ya contiene un espacio de Nodora".into(),
        ));
    }
    std::fs::create_dir_all(dir.join(ATTACHMENTS_DIR))?;
    std::fs::create_dir_all(dir.join(BACKUPS_DIR))?;

    let mut conn = db::open_with_migrations(&db_path, db::WORKSPACE_MIGRATIONS)?;
    let workspace_id = new_id();
    let user_id = new_id();
    let now = now_iso();

    let tx = conn.transaction()?;
    tx.execute(
        "INSERT INTO users (id, name, kind, created_at, updated_at) VALUES (?1, ?2, 'local_owner', ?3, ?3)",
        params![user_id, "Propietario", now],
    )?;
    tx.execute(
        "INSERT INTO devices (id, name, platform, last_seen_at, created_at, updated_at)
         VALUES (?1, ?2, ?3, ?4, ?4, ?4)",
        params![device_id, "Este equipo", std::env::consts::OS, now],
    )?;
    tx.execute(
        "INSERT INTO workspaces (id, name, icon, created_at, updated_at, created_by, updated_by, device_id)
         VALUES (?1, ?2, ?3, ?4, ?4, ?5, ?5, ?6)",
        params![workspace_id, name.trim(), icon, now, user_id, device_id],
    )?;
    tx.commit()?;

    let ws = OpenWorkspace {
        conn,
        path: dir.to_path_buf(),
        ctx: WorkspaceCtx {
            workspace_id,
            user_id,
            device_id: device_id.to_string(),
        },
    };
    create_welcome_page(&ws)?;
    Ok(ws)
}

fn create_welcome_page(ws: &OpenWorkspace) -> Result<()> {
    let content = serde_json::json!({
        "type": "doc",
        "content": [
            {"type": "heading", "attrs": {"level": 1, "blockId": new_id()},
             "content": [{"type": "text", "text": "Bienvenido a Nodora"}]},
            {"type": "paragraph", "attrs": {"blockId": new_id()},
             "content": [{"type": "text", "text": "Tu espacio de trabajo privado. Todo lo que escribas se guarda en tu equipo, sin internet y sin cuentas."}]},
            {"type": "bulletList", "attrs": {"blockId": new_id()}, "content": [
                {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Escribe / para insertar bloques."}]}]},
                {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Pulsa Ctrl+K para buscar y navegar."}]}]},
                {"type": "listItem", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Crea páginas dentro de páginas desde la barra lateral."}]}]}
            ]}
        ]
    });
    crate::pages::create_page_with_content(
        &ws.conn,
        &ws.ctx,
        None,
        "Bienvenida",
        Some("👋"),
        &content.to_string(),
    )?;
    Ok(())
}

/// Abre un workspace existente desde su carpeta.
pub fn open_workspace(dir: &Path, device_id: &str) -> Result<OpenWorkspace> {
    let db_path = dir.join(DB_FILE);
    if !db_path.exists() {
        return Err(NodoraError::WorkspaceNotFound);
    }
    let conn = db::open_with_migrations(&db_path, db::WORKSPACE_MIGRATIONS)?;
    db::quick_check(&conn)?;

    let workspace_id: String =
        conn.query_row("SELECT id FROM workspaces LIMIT 1", [], |r| r.get(0))?;
    let user_id: String = conn.query_row(
        "SELECT id FROM users WHERE kind = 'local_owner' LIMIT 1",
        [],
        |r| r.get(0),
    )?;
    let now = now_iso();
    conn.execute(
        "INSERT INTO devices (id, name, platform, last_seen_at, created_at, updated_at)
         VALUES (?1, ?2, ?3, ?4, ?4, ?4)
         ON CONFLICT(id) DO UPDATE SET last_seen_at = ?4, updated_at = ?4",
        params![device_id, "Este equipo", std::env::consts::OS, now],
    )?;
    // Asegura que attachments/ exista aunque el usuario haya copiado a medias.
    std::fs::create_dir_all(dir.join(ATTACHMENTS_DIR))?;
    std::fs::create_dir_all(dir.join(BACKUPS_DIR))?;

    Ok(OpenWorkspace {
        conn,
        path: dir.to_path_buf(),
        ctx: WorkspaceCtx {
            workspace_id,
            user_id,
            device_id: device_id.to_string(),
        },
    })
}

pub fn rename_workspace(ws: &OpenWorkspace, name: &str) -> Result<()> {
    validate_name(name)?;
    ws.conn.execute(
        "UPDATE workspaces SET name = ?1, updated_at = ?2, updated_by = ?3, device_id = ?4,
         version = version + 1 WHERE id = ?5",
        params![
            name.trim(),
            now_iso(),
            ws.ctx.user_id,
            ws.ctx.device_id,
            ws.ctx.workspace_id
        ],
    )?;
    Ok(())
}

pub fn set_workspace_icon(ws: &OpenWorkspace, icon: Option<&str>) -> Result<()> {
    if let Some(i) = icon {
        if i.len() > 64 {
            return Err(NodoraError::InvalidInput("icono demasiado largo".into()));
        }
    }
    ws.conn.execute(
        "UPDATE workspaces SET icon = ?1, updated_at = ?2, updated_by = ?3, device_id = ?4,
         version = version + 1 WHERE id = ?5",
        params![
            icon,
            now_iso(),
            ws.ctx.user_id,
            ws.ctx.device_id,
            ws.ctx.workspace_id
        ],
    )?;
    Ok(())
}

/// Posición para insertar al final de los hermanos de `parent`.
pub fn position_at_end(conn: &Connection, parent: Option<&str>) -> Result<String> {
    let last: Option<String> = match parent {
        Some(p) => conn
            .query_row(
                "SELECT MAX(position) FROM pages WHERE parent_page_id = ?1
                 AND deleted_at IS NULL",
                [p],
                |r| r.get(0),
            )
            .unwrap_or(None),
        None => conn
            .query_row(
                "SELECT MAX(position) FROM pages WHERE parent_page_id IS NULL
                 AND deleted_at IS NULL",
                [],
                |r| r.get(0),
            )
            .unwrap_or(None),
    };
    key_between(last.as_deref(), None)
}
