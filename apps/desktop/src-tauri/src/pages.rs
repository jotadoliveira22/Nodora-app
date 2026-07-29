//! Páginas: árbol, contenido, archivado, papelera, favoritos, recientes,
//! backlinks. Todo guardado actualiza FTS y page_links en la MISMA
//! transacción (docs/ARCHITECTURE.md, flujo de guardado).

use std::collections::HashMap;

use rusqlite::{params, Connection, OptionalExtension};
use serde::Serialize;

use crate::error::{NodoraError, Result};
use crate::ids::{new_id, now_iso};
use crate::ordering::key_between;
use crate::validate::validate_and_project;
use crate::workspace::{position_at_end, WorkspaceCtx};

pub const EMPTY_DOC: &str = r#"{"type":"doc","content":[]}"#;
const MAX_TITLE: usize = 500;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PageSummary {
    pub id: String,
    pub parent_page_id: Option<String>,
    pub title: String,
    pub icon: Option<String>,
    pub position: String,
    pub kind: String,
    pub database_id: Option<String>,
    pub archived_at: Option<String>,
    pub has_children: bool,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PageDetail {
    pub id: String,
    pub parent_page_id: Option<String>,
    pub title: String,
    pub icon: Option<String>,
    pub kind: String,
    pub database_id: Option<String>,
    pub archived_at: Option<String>,
    pub content_json: String,
    /// Portada: `None`, `Some("color")` o `Some("attachment")` (migración 002).
    pub cover_kind: Option<String>,
    pub cover_value: Option<String>,
    pub version: i64,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SaveResult {
    pub version: i64,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BacklinkItem {
    pub source_page_id: String,
    pub title: String,
    pub icon: Option<String>,
    pub block_id: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Crumb {
    pub id: String,
    pub title: String,
    pub icon: Option<String>,
}

fn validate_title(title: &str) -> Result<()> {
    if title.len() > MAX_TITLE {
        return Err(NodoraError::InvalidInput("título demasiado largo".into()));
    }
    Ok(())
}

fn log_activity(
    conn: &Connection,
    ctx: &WorkspaceCtx,
    entity_type: &str,
    entity_id: &str,
    action: &str,
) -> Result<()> {
    conn.execute(
        "INSERT INTO activity_log (id, workspace_id, entity_type, entity_id, action, actor_id, device_id, created_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
        params![new_id(), ctx.workspace_id, entity_type, entity_id, action, ctx.user_id, ctx.device_id, now_iso()],
    )?;
    Ok(())
}

// ---- Mantenimiento del índice FTS (contenido externo) --------------------

fn fts_insert(conn: &Connection, page_id: &str) -> Result<()> {
    conn.execute(
        "INSERT INTO pages_fts (rowid, title, content_text)
         SELECT rowid, title, content_text FROM pages WHERE id = ?1",
        [page_id],
    )?;
    Ok(())
}

/// FTS5 con contenido externo exige el comando 'delete' con los valores viejos.
fn fts_delete(conn: &Connection, page_id: &str) -> Result<()> {
    conn.execute(
        "INSERT INTO pages_fts (pages_fts, rowid, title, content_text)
         SELECT 'delete', rowid, title, content_text FROM pages WHERE id = ?1",
        [page_id],
    )?;
    Ok(())
}

// ---- Creación y lectura ---------------------------------------------------

pub fn create_page(
    conn: &Connection,
    ctx: &WorkspaceCtx,
    parent_page_id: Option<&str>,
    title: &str,
    icon: Option<&str>,
) -> Result<PageDetail> {
    create_page_with_content(conn, ctx, parent_page_id, title, icon, EMPTY_DOC)
}

pub fn create_page_with_content(
    conn: &Connection,
    ctx: &WorkspaceCtx,
    parent_page_id: Option<&str>,
    title: &str,
    icon: Option<&str>,
    content_json: &str,
) -> Result<PageDetail> {
    validate_title(title)?;
    let projection = validate_and_project(content_json)?;
    if let Some(p) = parent_page_id {
        let parent_kind: Option<String> = conn
            .query_row(
                "SELECT kind FROM pages WHERE id = ?1 AND deleted_at IS NULL",
                [p],
                |r| r.get(0),
            )
            .optional()?;
        match parent_kind.as_deref() {
            None => return Err(NodoraError::PageNotFound),
            Some("database") => {
                return Err(NodoraError::InvalidInput(
                    "usa la base de datos para crear registros".into(),
                ))
            }
            _ => {}
        }
    }
    let id = new_id();
    let now = now_iso();
    let position = position_at_end(conn, parent_page_id)?;
    conn.execute(
        "INSERT INTO pages (id, workspace_id, parent_page_id, title, icon, position,
            content_json, content_text, kind, created_at, updated_at, created_by, updated_by, device_id)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, 'page', ?9, ?9, ?10, ?10, ?11)",
        params![
            id, ctx.workspace_id, parent_page_id, title, icon, position, content_json,
            projection.text, now, ctx.user_id, ctx.device_id
        ],
    )?;
    fts_insert(conn, &id)?;
    reconcile_links(conn, &id, &projection.links)?;
    log_activity(conn, ctx, "page", &id, "create")?;
    get_page(conn, &id)
}

pub fn get_page(conn: &Connection, id: &str) -> Result<PageDetail> {
    conn.query_row(
        "SELECT id, parent_page_id, title, icon, kind, database_id, archived_at,
                content_json, cover_kind, cover_value, version, updated_at
         FROM pages WHERE id = ?1 AND deleted_at IS NULL",
        [id],
        |r| {
            Ok(PageDetail {
                id: r.get(0)?,
                parent_page_id: r.get(1)?,
                title: r.get(2)?,
                icon: r.get(3)?,
                kind: r.get(4)?,
                database_id: r.get(5)?,
                archived_at: r.get(6)?,
                content_json: r.get(7)?,
                cover_kind: r.get(8)?,
                cover_value: r.get(9)?,
                version: r.get(10)?,
                updated_at: r.get(11)?,
            })
        },
    )
    .optional()?
    .ok_or(NodoraError::PageNotFound)
}

const SUMMARY_SELECT: &str = "SELECT p.id, p.parent_page_id, p.title, p.icon, p.position, p.kind,
        p.database_id, p.archived_at, p.updated_at,
        EXISTS(SELECT 1 FROM pages c WHERE c.parent_page_id = p.id
               AND c.deleted_at IS NULL AND c.archived_at IS NULL AND c.kind != 'record')
 FROM pages p";

fn map_summary(r: &rusqlite::Row<'_>) -> rusqlite::Result<PageSummary> {
    Ok(PageSummary {
        id: r.get(0)?,
        parent_page_id: r.get(1)?,
        title: r.get(2)?,
        icon: r.get(3)?,
        position: r.get(4)?,
        kind: r.get(5)?,
        database_id: r.get(6)?,
        archived_at: r.get(7)?,
        updated_at: r.get(8)?,
        has_children: r.get(9)?,
    })
}

/// Todas las páginas visibles del árbol (no archivadas, no borradas, no
/// registros — los registros se listan dentro de su base de datos).
pub fn list_pages(conn: &Connection) -> Result<Vec<PageSummary>> {
    let sql = format!(
        "{SUMMARY_SELECT} WHERE p.deleted_at IS NULL AND p.archived_at IS NULL
         AND p.kind != 'record' ORDER BY p.position"
    );
    let mut stmt = conn.prepare(&sql)?;
    let rows = stmt.query_map([], map_summary)?;
    Ok(rows.collect::<std::result::Result<Vec<_>, _>>()?)
}

/// Raíces archivadas (se archiva el subárbol completo; ver DATA_MODEL.md).
pub fn list_archived(conn: &Connection) -> Result<Vec<PageSummary>> {
    let sql = format!(
        "{SUMMARY_SELECT} WHERE p.deleted_at IS NULL AND p.archived_at IS NOT NULL
           AND (p.parent_page_id IS NULL OR EXISTS(
                SELECT 1 FROM pages pp WHERE pp.id = p.parent_page_id
                AND pp.archived_at IS NULL AND pp.deleted_at IS NULL))
         ORDER BY p.archived_at DESC"
    );
    let mut stmt = conn.prepare(&sql)?;
    let rows = stmt.query_map([], map_summary)?;
    Ok(rows.collect::<std::result::Result<Vec<_>, _>>()?)
}

// ---- Edición ---------------------------------------------------------------

/// Renombra la página y devuelve su versión nueva.
///
/// Toda escritura sobre la entidad incrementa `version` (es la versión base
/// de la sincronización futura, ver docs/SYNC_DATA_MODEL.md), así que el
/// llamador debe adoptar la versión devuelta como nueva base del guardado de
/// contenido; si no, el siguiente autosave chocaría con un VERSION_CONFLICT
/// espurio y descartaría lo escrito.
pub fn rename_page(
    conn: &Connection,
    ctx: &WorkspaceCtx,
    id: &str,
    title: &str,
) -> Result<SaveResult> {
    validate_title(title)?;
    ensure_alive(conn, id)?;
    fts_delete(conn, id)?;
    let now = now_iso();
    conn.execute(
        "UPDATE pages SET title = ?1, updated_at = ?2, updated_by = ?3, device_id = ?4,
         version = version + 1 WHERE id = ?5",
        params![title, now, ctx.user_id, ctx.device_id, id],
    )?;
    fts_insert(conn, id)?;
    let version: i64 = conn.query_row("SELECT version FROM pages WHERE id = ?1", [id], |r| {
        r.get(0)
    })?;
    Ok(SaveResult {
        version,
        updated_at: now,
    })
}

/// Portadas de color disponibles. Son degradados propios de Nodora resueltos
/// en CSS: no hay imágenes empaquetadas ni descargas, así que la portada por
/// defecto funciona sin internet y no engorda el instalador.
pub const COVER_PRESETS: &[&str] = &[
    "arena", "salvia", "niebla", "tinta", "cobre", "musgo", "ciruela", "brasa",
];

/// Cambia la portada de una página. `kind` en `None` la quita.
///
/// La pareja (kind, value) se valida aquí y no con un CHECK en SQL: SQLite no
/// permite añadir restricciones con ALTER TABLE, y ampliar los tipos de
/// portada en el futuro obligaría a reescribir la tabla entera.
pub fn set_page_cover(
    conn: &Connection,
    ctx: &WorkspaceCtx,
    id: &str,
    kind: Option<&str>,
    value: Option<&str>,
) -> Result<SaveResult> {
    match (kind, value) {
        (None, _) => {}
        (Some("color"), Some(v)) if COVER_PRESETS.contains(&v) => {}
        (Some("color"), _) => {
            return Err(NodoraError::InvalidInput(
                "color de portada desconocido".into(),
            ))
        }
        (Some("attachment"), Some(v)) => {
            // La portada apunta a un adjunto del propio espacio: si no existe,
            // la página quedaría con una portada rota que nadie puede arreglar.
            let existe: i64 = conn.query_row(
                "SELECT COUNT(*) FROM attachments WHERE id = ?1 AND deleted_at IS NULL",
                [v],
                |r| r.get(0),
            )?;
            if existe == 0 {
                return Err(NodoraError::AttachmentNotFound);
            }
        }
        (Some("attachment"), None) => {
            return Err(NodoraError::InvalidInput("falta el adjunto".into()))
        }
        (Some(_), _) => {
            return Err(NodoraError::InvalidInput(
                "tipo de portada no válido".into(),
            ))
        }
    }
    ensure_alive(conn, id)?;
    let now = now_iso();
    // Quitar la portada limpia también el valor: dejar uno huérfano haría que
    // el recolector de adjuntos creyera que la imagen sigue en uso.
    let value = if kind.is_none() { None } else { value };
    conn.execute(
        "UPDATE pages SET cover_kind = ?1, cover_value = ?2, updated_at = ?3, updated_by = ?4,
         device_id = ?5, version = version + 1 WHERE id = ?6",
        params![kind, value, now, ctx.user_id, ctx.device_id, id],
    )?;
    let version: i64 = conn.query_row("SELECT version FROM pages WHERE id = ?1", [id], |r| {
        r.get(0)
    })?;
    Ok(SaveResult {
        version,
        updated_at: now,
    })
}

/// Cambia el icono y devuelve la versión nueva (misma razón que `rename_page`).
pub fn set_page_icon(
    conn: &Connection,
    ctx: &WorkspaceCtx,
    id: &str,
    icon: Option<&str>,
) -> Result<SaveResult> {
    if let Some(i) = icon {
        if i.len() > 64 {
            return Err(NodoraError::InvalidInput("icono demasiado largo".into()));
        }
    }
    ensure_alive(conn, id)?;
    let now = now_iso();
    conn.execute(
        "UPDATE pages SET icon = ?1, updated_at = ?2, updated_by = ?3, device_id = ?4,
         version = version + 1 WHERE id = ?5",
        params![icon, now, ctx.user_id, ctx.device_id, id],
    )?;
    let version: i64 = conn.query_row("SELECT version FROM pages WHERE id = ?1", [id], |r| {
        r.get(0)
    })?;
    Ok(SaveResult {
        version,
        updated_at: now,
    })
}

fn ensure_alive(conn: &Connection, id: &str) -> Result<()> {
    let exists: Option<i64> = conn
        .query_row(
            "SELECT 1 FROM pages WHERE id = ?1 AND deleted_at IS NULL",
            [id],
            |r| r.get(0),
        )
        .optional()?;
    exists.map(|_| ()).ok_or(NodoraError::PageNotFound)
}

fn reconcile_links(conn: &Connection, source: &str, links: &[(String, String)]) -> Result<()> {
    conn.execute("DELETE FROM page_links WHERE source_page_id = ?1", [source])?;
    let mut stmt = conn.prepare(
        "INSERT OR IGNORE INTO page_links (source_page_id, target_page_id, block_id)
         SELECT ?1, ?2, ?3 WHERE EXISTS(SELECT 1 FROM pages WHERE id = ?2 AND deleted_at IS NULL)",
    )?;
    for (target, block) in links {
        stmt.execute(params![source, target, block])?;
    }
    Ok(())
}

/// Guardado del contenido: validación, optimistic lock, FTS y enlaces en una
/// única transacción. Es la operación más crítica del MVP.
pub fn save_page_content(
    conn: &mut Connection,
    ctx: &WorkspaceCtx,
    id: &str,
    content_json: &str,
    base_version: i64,
) -> Result<SaveResult> {
    let projection = validate_and_project(content_json)?;
    let tx = conn.transaction()?;
    let current: Option<i64> = tx
        .query_row(
            "SELECT version FROM pages WHERE id = ?1 AND deleted_at IS NULL",
            [id],
            |r| r.get(0),
        )
        .optional()?;
    let current = current.ok_or(NodoraError::PageNotFound)?;
    if current != base_version {
        return Err(NodoraError::VersionConflict);
    }
    fts_delete(&tx, id)?;
    let now = now_iso();
    tx.execute(
        "UPDATE pages SET content_json = ?1, content_text = ?2, updated_at = ?3,
         updated_by = ?4, device_id = ?5, version = version + 1 WHERE id = ?6",
        params![
            content_json,
            projection.text,
            now,
            ctx.user_id,
            ctx.device_id,
            id
        ],
    )?;
    fts_insert(&tx, id)?;
    reconcile_links(&tx, id, &projection.links)?;
    tx.commit()?;
    Ok(SaveResult {
        version: base_version + 1,
        updated_at: now,
    })
}

// ---- Mover / duplicar -------------------------------------------------------

fn is_descendant(conn: &Connection, ancestor: &str, candidate: &str) -> Result<bool> {
    // ¿candidate está en el subárbol de ancestor (o es él mismo)?
    let mut cur = Some(candidate.to_string());
    let mut hops = 0;
    while let Some(c) = cur {
        if c == ancestor {
            return Ok(true);
        }
        hops += 1;
        if hops > 200 {
            return Err(NodoraError::Internal("árbol demasiado profundo".into()));
        }
        cur = conn
            .query_row(
                "SELECT parent_page_id FROM pages WHERE id = ?1",
                [&c],
                |r| r.get(0),
            )
            .optional()?
            .flatten();
    }
    Ok(false)
}

pub fn move_page(
    conn: &Connection,
    ctx: &WorkspaceCtx,
    id: &str,
    new_parent: Option<&str>,
    after: Option<&str>,
) -> Result<()> {
    let page = get_page(conn, id)?;
    if page.kind == "record" {
        return Err(NodoraError::InvalidInput(
            "los registros viven en su base de datos".into(),
        ));
    }
    if let Some(np) = new_parent {
        if np == id || is_descendant(conn, id, np)? {
            return Err(NodoraError::CycleDetected);
        }
        let parent = get_page(conn, np)?;
        if parent.kind == "database" {
            return Err(NodoraError::InvalidInput(
                "no se pueden mover páginas dentro de una base de datos".into(),
            ))?;
        }
    }
    let position = position_between_siblings(conn, new_parent, after, id)?;
    conn.execute(
        "UPDATE pages SET parent_page_id = ?1, position = ?2, updated_at = ?3,
         updated_by = ?4, device_id = ?5, version = version + 1 WHERE id = ?6",
        params![
            new_parent,
            position,
            now_iso(),
            ctx.user_id,
            ctx.device_id,
            id
        ],
    )?;
    log_activity(conn, ctx, "page", id, "move")?;
    Ok(())
}

/// Posición tras `after` (o al principio si `after` es None) entre los hijos
/// visibles de `parent`, excluyendo a la propia página movida.
fn position_between_siblings(
    conn: &Connection,
    parent: Option<&str>,
    after: Option<&str>,
    moving: &str,
) -> Result<String> {
    let siblings: Vec<(String, String)> = {
        let mut stmt = conn.prepare(
            "SELECT id, position FROM pages
             WHERE deleted_at IS NULL AND kind != 'record' AND id != ?1
               AND ((?2 IS NULL AND parent_page_id IS NULL) OR parent_page_id = ?2)
             ORDER BY position",
        )?;
        let rows = stmt.query_map(params![moving, parent], |r| Ok((r.get(0)?, r.get(1)?)))?;
        rows.collect::<std::result::Result<Vec<_>, _>>()?
    };
    let idx = match after {
        None => 0,
        Some(a) => {
            let i = siblings.iter().position(|(id, _)| id == a);
            match i {
                Some(i) => i + 1,
                None => siblings.len(),
            }
        }
    };
    let prev = if idx > 0 {
        siblings.get(idx - 1).map(|(_, p)| p.as_str())
    } else {
        None
    };
    let next = siblings.get(idx).map(|(_, p)| p.as_str());
    key_between(prev, next)
}

fn subtree_ids(conn: &Connection, root: &str) -> Result<Vec<String>> {
    let mut stmt = conn.prepare(
        "WITH RECURSIVE sub(id) AS (
           SELECT id FROM pages WHERE id = ?1 AND deleted_at IS NULL
           UNION ALL
           SELECT p.id FROM pages p JOIN sub s ON p.parent_page_id = s.id
           WHERE p.deleted_at IS NULL
         ) SELECT id FROM sub",
    )?;
    let rows = stmt.query_map([root], |r| r.get(0))?;
    Ok(rows.collect::<std::result::Result<Vec<_>, _>>()?)
}

pub fn duplicate_page(conn: &mut Connection, ctx: &WorkspaceCtx, id: &str) -> Result<String> {
    let original = get_page(conn, id)?;
    if original.kind == "record" {
        return Err(NodoraError::InvalidInput(
            "duplica registros desde su base de datos".into(),
        ));
    }
    let tx = conn.transaction()?;
    let position =
        position_between_siblings(&tx, original.parent_page_id.as_deref(), Some(id), "-")?;
    let mut db_map: HashMap<String, String> = HashMap::new();
    let mut prop_map: HashMap<String, String> = HashMap::new();
    let new_id = copy_subtree(
        &tx,
        ctx,
        id,
        original.parent_page_id.as_deref(),
        &position,
        true,
        &mut db_map,
        &mut prop_map,
    )?;
    log_activity(&tx, ctx, "page", &new_id, "duplicate")?;
    tx.commit()?;
    Ok(new_id)
}

#[allow(clippy::too_many_arguments)]
fn copy_subtree(
    conn: &Connection,
    ctx: &WorkspaceCtx,
    old_id: &str,
    new_parent: Option<&str>,
    position: &str,
    is_root: bool,
    db_map: &mut HashMap<String, String>,
    prop_map: &mut HashMap<String, String>,
) -> Result<String> {
    let (title, icon, kind, database_id, archived_at, content_json): (
        String,
        Option<String>,
        String,
        Option<String>,
        Option<String>,
        String,
    ) = conn.query_row(
        "SELECT title, icon, kind, database_id, archived_at, content_json
         FROM pages WHERE id = ?1 AND deleted_at IS NULL",
        [old_id],
        |r| {
            Ok((
                r.get(0)?,
                r.get(1)?,
                r.get(2)?,
                r.get(3)?,
                r.get(4)?,
                r.get(5)?,
            ))
        },
    )?;
    let new_page_id = new_id();
    let now = now_iso();
    let new_title = if is_root {
        format!("{title} (copia)")
    } else {
        title
    };
    let mapped_db = database_id.as_ref().and_then(|d| db_map.get(d).cloned());
    conn.execute(
        "INSERT INTO pages (id, workspace_id, parent_page_id, title, icon, position,
            content_json, content_text, kind, database_id, archived_at,
            created_at, updated_at, created_by, updated_by, device_id)
         SELECT ?1, workspace_id, ?2, ?3, ?4, ?5, content_json, content_text, kind, ?6, archived_at,
                ?7, ?7, ?8, ?8, ?9
         FROM pages WHERE id = ?10",
        params![
            new_page_id,
            new_parent,
            new_title,
            icon,
            position,
            mapped_db,
            now,
            ctx.user_id,
            ctx.device_id,
            old_id
        ],
    )?;
    let _ = archived_at;
    fts_insert(conn, &new_page_id)?;
    if let Ok(projection) = validate_and_project(&content_json) {
        reconcile_links(conn, &new_page_id, &projection.links)?;
        for att in projection.attachments {
            conn.execute(
                "UPDATE attachments SET ref_count = ref_count + 1 WHERE id = ?1",
                [att],
            )?;
        }
    }
    if kind == "database" {
        let old_db: Option<String> = conn
            .query_row(
                "SELECT id FROM databases WHERE page_id = ?1",
                [old_id],
                |r| r.get(0),
            )
            .optional()?;
        if let Some(old_db) = old_db {
            let new_db_id = new_id();
            db_map.insert(old_db.clone(), new_db_id.clone());
            conn.execute(
                "INSERT INTO databases (id, workspace_id, page_id, created_at, updated_at, created_by, updated_by, device_id)
                 VALUES (?1, ?2, ?3, ?4, ?4, ?5, ?5, ?6)",
                params![new_db_id, ctx.workspace_id, new_page_id, now, ctx.user_id, ctx.device_id],
            )?;
            let props: Vec<(String, String, String, String, String, bool)> = {
                let mut stmt = conn.prepare(
                    "SELECT id, name, type, config_json, position, hidden FROM database_properties
                     WHERE database_id = ?1 AND deleted_at IS NULL",
                )?;
                let rows = stmt.query_map([&old_db], |r| {
                    Ok((
                        r.get(0)?,
                        r.get(1)?,
                        r.get(2)?,
                        r.get(3)?,
                        r.get(4)?,
                        r.get(5)?,
                    ))
                })?;
                rows.collect::<std::result::Result<Vec<_>, _>>()?
            };
            for (pid, name, ty, config, pos, hidden) in props {
                let new_prop = new_id();
                prop_map.insert(pid, new_prop.clone());
                conn.execute(
                    "INSERT INTO database_properties (id, database_id, name, type, config_json, position, hidden, created_at, updated_at)
                     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?8)",
                    params![new_prop, new_db_id, name, ty, config, pos, hidden, now],
                )?;
            }
        }
    }
    if kind == "record" {
        let values: Vec<(String, String)> = {
            let mut stmt = conn.prepare(
                "SELECT property_id, value_json FROM record_values WHERE record_page_id = ?1",
            )?;
            let rows = stmt.query_map([old_id], |r| Ok((r.get(0)?, r.get(1)?)))?;
            rows.collect::<std::result::Result<Vec<_>, _>>()?
        };
        for (prop, value) in values {
            let mapped = prop_map.get(&prop).cloned().unwrap_or(prop);
            conn.execute(
                "INSERT INTO record_values (record_page_id, property_id, value_json, updated_at)
                 VALUES (?1, ?2, ?3, ?4)",
                params![new_page_id, mapped, value, now],
            )?;
        }
    }
    // Hijos en orden.
    let children: Vec<(String, String)> = {
        let mut stmt = conn.prepare(
            "SELECT id, position FROM pages WHERE parent_page_id = ?1 AND deleted_at IS NULL
             ORDER BY position",
        )?;
        let rows = stmt.query_map([old_id], |r| Ok((r.get(0)?, r.get(1)?)))?;
        rows.collect::<std::result::Result<Vec<_>, _>>()?
    };
    for (child_id, child_pos) in children {
        copy_subtree(
            conn,
            ctx,
            &child_id,
            Some(&new_page_id),
            &child_pos,
            false,
            db_map,
            prop_map,
        )?;
    }
    Ok(new_page_id)
}

// ---- Archivar / restaurar / eliminar ---------------------------------------

pub fn archive_page(conn: &mut Connection, ctx: &WorkspaceCtx, id: &str) -> Result<()> {
    ensure_alive(conn, id)?;
    let tx = conn.transaction()?;
    let ids = subtree_ids(&tx, id)?;
    let now = now_iso();
    for pid in &ids {
        tx.execute(
            "UPDATE pages SET archived_at = COALESCE(archived_at, ?1), updated_at = ?1,
             updated_by = ?2, device_id = ?3, version = version + 1 WHERE id = ?4",
            params![now, ctx.user_id, ctx.device_id, pid],
        )?;
    }
    log_activity(&tx, ctx, "page", id, "archive")?;
    tx.commit()?;
    Ok(())
}

pub fn restore_page(conn: &mut Connection, ctx: &WorkspaceCtx, id: &str) -> Result<()> {
    ensure_alive(conn, id)?;
    let tx = conn.transaction()?;
    let ids = subtree_ids(&tx, id)?;
    let now = now_iso();
    for pid in &ids {
        tx.execute(
            "UPDATE pages SET archived_at = NULL, updated_at = ?1, updated_by = ?2,
             device_id = ?3, version = version + 1 WHERE id = ?4",
            params![now, ctx.user_id, ctx.device_id, pid],
        )?;
    }
    // Si el padre sigue archivado o borrado, la raíz restaurada pasa a la raíz del árbol.
    let parent: Option<String> = tx
        .query_row(
            "SELECT parent_page_id FROM pages WHERE id = ?1",
            [id],
            |r| r.get(0),
        )
        .optional()?
        .flatten();
    if let Some(p) = parent {
        let parent_ok: Option<i64> = tx
            .query_row(
                "SELECT 1 FROM pages WHERE id = ?1 AND deleted_at IS NULL AND archived_at IS NULL",
                [&p],
                |r| r.get(0),
            )
            .optional()?;
        if parent_ok.is_none() {
            let pos = position_at_end(&tx, None)?;
            tx.execute(
                "UPDATE pages SET parent_page_id = NULL, position = ?1 WHERE id = ?2",
                params![pos, id],
            )?;
        }
    }
    log_activity(&tx, ctx, "page", id, "restore")?;
    tx.commit()?;
    Ok(())
}

/// Eliminación definitiva: tombstone de sync + limpieza de contenido,
/// proyecciones y datos dependientes (docs/DATA_MODEL.md).
pub fn delete_page_permanently(
    conn: &mut Connection,
    ctx: &WorkspaceCtx,
    id: &str,
) -> Result<usize> {
    ensure_alive(conn, id)?;
    let tx = conn.transaction()?;
    let ids = subtree_ids(&tx, id)?;
    let now = now_iso();
    for pid in &ids {
        fts_delete(&tx, pid)?;
        tx.execute("DELETE FROM record_values WHERE record_page_id = ?1", [pid])?;
        tx.execute("DELETE FROM favorites WHERE page_id = ?1", [pid])?;
        tx.execute("DELETE FROM recents WHERE page_id = ?1", [pid])?;
        tx.execute(
            "DELETE FROM page_links WHERE source_page_id = ?1 OR target_page_id = ?1",
            [pid],
        )?;
        // Tombstone de bases de datos contenidas.
        tx.execute(
            "UPDATE database_properties SET deleted_at = ?1 WHERE database_id IN
             (SELECT id FROM databases WHERE page_id = ?2)",
            params![now, pid],
        )?;
        tx.execute(
            "UPDATE databases SET deleted_at = ?1 WHERE page_id = ?2",
            params![now, pid],
        )?;
        tx.execute(
            "UPDATE pages SET deleted_at = ?1, title = '', icon = NULL,
             content_json = ?2, content_text = '', updated_at = ?1,
             updated_by = ?3, device_id = ?4, version = version + 1 WHERE id = ?5",
            params![now, EMPTY_DOC, ctx.user_id, ctx.device_id, pid],
        )?;
    }
    log_activity(&tx, ctx, "page", id, "delete")?;
    tx.commit()?;
    Ok(ids.len())
}

// ---- Relaciones, favoritos, recientes ---------------------------------------

pub fn backlinks(conn: &Connection, id: &str) -> Result<Vec<BacklinkItem>> {
    let mut stmt = conn.prepare(
        "SELECT pl.source_page_id, p.title, p.icon, pl.block_id
         FROM page_links pl JOIN pages p ON p.id = pl.source_page_id
         WHERE pl.target_page_id = ?1 AND p.deleted_at IS NULL AND p.archived_at IS NULL
         ORDER BY p.updated_at DESC",
    )?;
    let rows = stmt.query_map([id], |r| {
        Ok(BacklinkItem {
            source_page_id: r.get(0)?,
            title: r.get(1)?,
            icon: r.get(2)?,
            block_id: r.get(3)?,
        })
    })?;
    Ok(rows.collect::<std::result::Result<Vec<_>, _>>()?)
}

pub fn breadcrumbs(conn: &Connection, id: &str) -> Result<Vec<Crumb>> {
    let mut out = Vec::new();
    let mut cur = Some(id.to_string());
    let mut hops = 0;
    while let Some(c) = cur {
        hops += 1;
        if hops > 100 {
            break;
        }
        let row: Option<(String, Option<String>, Option<String>)> = conn
            .query_row(
                "SELECT title, icon, parent_page_id FROM pages WHERE id = ?1 AND deleted_at IS NULL",
                [&c],
                |r| Ok((r.get(0)?, r.get(1)?, r.get(2)?)),
            )
            .optional()?;
        match row {
            None => break,
            Some((title, icon, parent)) => {
                out.push(Crumb { id: c, title, icon });
                cur = parent;
            }
        }
    }
    out.reverse();
    Ok(out)
}

pub fn add_favorite(conn: &Connection, ctx: &WorkspaceCtx, page_id: &str) -> Result<()> {
    ensure_alive(conn, page_id)?;
    let last: Option<String> = conn
        .query_row("SELECT MAX(position) FROM favorites", [], |r| r.get(0))
        .unwrap_or(None);
    let pos = key_between(last.as_deref(), None)?;
    let now = now_iso();
    conn.execute(
        "INSERT INTO favorites (id, workspace_id, page_id, position, created_at, updated_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?5)
         ON CONFLICT(page_id) DO NOTHING",
        params![new_id(), ctx.workspace_id, page_id, pos, now],
    )?;
    Ok(())
}

pub fn remove_favorite(conn: &Connection, page_id: &str) -> Result<()> {
    conn.execute("DELETE FROM favorites WHERE page_id = ?1", [page_id])?;
    Ok(())
}

pub fn list_favorites(conn: &Connection) -> Result<Vec<PageSummary>> {
    let sql = format!(
        "{SUMMARY_SELECT} JOIN favorites f ON f.page_id = p.id
         WHERE p.deleted_at IS NULL AND p.archived_at IS NULL ORDER BY f.position"
    );
    let mut stmt = conn.prepare(&sql)?;
    let rows = stmt.query_map([], map_summary)?;
    Ok(rows.collect::<std::result::Result<Vec<_>, _>>()?)
}

pub fn is_favorite(conn: &Connection, page_id: &str) -> Result<bool> {
    let row: Option<i64> = conn
        .query_row(
            "SELECT 1 FROM favorites WHERE page_id = ?1",
            [page_id],
            |r| r.get(0),
        )
        .optional()?;
    Ok(row.is_some())
}

pub fn touch_recent(conn: &Connection, page_id: &str) -> Result<()> {
    conn.execute(
        "INSERT INTO recents (page_id, visited_at) VALUES (?1, ?2)
         ON CONFLICT(page_id) DO UPDATE SET visited_at = ?2",
        params![page_id, now_iso()],
    )?;
    // Poda: conserva las 100 más recientes.
    conn.execute(
        "DELETE FROM recents WHERE page_id NOT IN
         (SELECT page_id FROM recents ORDER BY visited_at DESC LIMIT 100)",
        [],
    )?;
    Ok(())
}

pub fn list_recents(conn: &Connection, limit: i64) -> Result<Vec<PageSummary>> {
    let sql = format!(
        "{SUMMARY_SELECT} JOIN recents r ON r.page_id = p.id
         WHERE p.deleted_at IS NULL AND p.archived_at IS NULL
         ORDER BY r.visited_at DESC LIMIT ?1"
    );
    let mut stmt = conn.prepare(&sql)?;
    let rows = stmt.query_map([limit], map_summary)?;
    Ok(rows.collect::<std::result::Result<Vec<_>, _>>()?)
}

/// Páginas enlazables para el selector de @menciones (búsqueda por título).
pub fn linkable_pages(conn: &Connection, query: &str, limit: i64) -> Result<Vec<PageSummary>> {
    let pattern = format!("%{}%", query.replace('%', "\\%").replace('_', "\\_"));
    let sql = format!(
        "{SUMMARY_SELECT} WHERE p.deleted_at IS NULL AND p.archived_at IS NULL
           AND p.title LIKE ?1 ESCAPE '\\'
         ORDER BY p.updated_at DESC LIMIT ?2"
    );
    let mut stmt = conn.prepare(&sql)?;
    let rows = stmt.query_map(params![pattern, limit], map_summary)?;
    Ok(rows.collect::<std::result::Result<Vec<_>, _>>()?)
}
