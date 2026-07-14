//! Bases de datos internas: schema de propiedades, registros (que SON
//! páginas, kind='record') y valores tipados. Conversión de tipos según la
//! matriz de docs/DATA_MODEL.md.

use std::collections::HashMap;

use rusqlite::{params, Connection, OptionalExtension};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};

use crate::error::{NodoraError, Result};
use crate::ids::{new_id, now_iso};
use crate::ordering::key_between;
use crate::pages::EMPTY_DOC;
use crate::workspace::{position_at_end, WorkspaceCtx};

pub const PROPERTY_TYPES: &[&str] = &[
    "title", "text", "number", "select", "multi_select", "status", "date", "checkbox", "url",
];

const OPTION_COLORS: &[&str] = &[
    "gray", "brown", "orange", "amber", "green", "teal", "blue", "indigo", "purple", "pink",
    "red", "olive",
];

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DatabaseProperty {
    pub id: String,
    pub database_id: String,
    pub name: String,
    #[serde(rename = "type")]
    pub prop_type: String,
    pub config_json: String,
    pub position: String,
    pub hidden: bool,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DatabaseDetail {
    pub id: String,
    pub page_id: String,
    pub title: String,
    pub properties: Vec<DatabaseProperty>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RecordRow {
    pub page_id: String,
    pub title: String,
    pub icon: Option<String>,
    pub values: HashMap<String, String>,
    pub position: String,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RecordSort {
    pub property_id: Option<String>,
    pub direction: String,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RecordFilter {
    pub property_id: String,
    pub operator: String,
    pub value_json: Option<String>,
}

// ---- Creación y lectura ------------------------------------------------------

/// Crea una base de datos: página kind='database' + fila databases +
/// propiedad título obligatoria.
pub fn create_database(
    conn: &mut Connection,
    ctx: &WorkspaceCtx,
    parent_page_id: Option<&str>,
    title: &str,
) -> Result<DatabaseDetail> {
    let tx = conn.transaction()?;
    let page_id = new_id();
    let db_id = new_id();
    let now = now_iso();
    let position = position_at_end(&tx, parent_page_id)?;
    tx.execute(
        "INSERT INTO pages (id, workspace_id, parent_page_id, title, position,
            content_json, content_text, kind, created_at, updated_at, created_by, updated_by, device_id)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, '', 'database', ?7, ?7, ?8, ?8, ?9)",
        params![page_id, ctx.workspace_id, parent_page_id, title, position, EMPTY_DOC, now, ctx.user_id, ctx.device_id],
    )?;
    tx.execute(
        "INSERT INTO pages_fts (rowid, title, content_text)
         SELECT rowid, title, content_text FROM pages WHERE id = ?1",
        [&page_id],
    )?;
    tx.execute(
        "INSERT INTO databases (id, workspace_id, page_id, created_at, updated_at, created_by, updated_by, device_id)
         VALUES (?1, ?2, ?3, ?4, ?4, ?5, ?5, ?6)",
        params![db_id, ctx.workspace_id, page_id, now, ctx.user_id, ctx.device_id],
    )?;
    let prop_pos = key_between(None, None)?;
    tx.execute(
        "INSERT INTO database_properties (id, database_id, name, type, config_json, position, created_at, updated_at)
         VALUES (?1, ?2, 'Título', 'title', '{}', ?3, ?4, ?4)",
        params![new_id(), db_id, prop_pos, now],
    )?;
    tx.commit()?;
    get_database(conn, &db_id)
}

pub fn database_by_page(conn: &Connection, page_id: &str) -> Result<DatabaseDetail> {
    let db_id: Option<String> = conn
        .query_row(
            "SELECT id FROM databases WHERE page_id = ?1 AND deleted_at IS NULL",
            [page_id],
            |r| r.get(0),
        )
        .optional()?;
    match db_id {
        Some(id) => get_database(conn, &id),
        None => Err(NodoraError::DatabaseNotFound),
    }
}

pub fn get_database(conn: &Connection, db_id: &str) -> Result<DatabaseDetail> {
    let (page_id, title): (String, String) = conn
        .query_row(
            "SELECT d.page_id, p.title FROM databases d JOIN pages p ON p.id = d.page_id
             WHERE d.id = ?1 AND d.deleted_at IS NULL",
            [db_id],
            |r| Ok((r.get(0)?, r.get(1)?)),
        )
        .optional()?
        .ok_or(NodoraError::DatabaseNotFound)?;
    let mut stmt = conn.prepare(
        "SELECT id, database_id, name, type, config_json, position, hidden
         FROM database_properties WHERE database_id = ?1 AND deleted_at IS NULL
         ORDER BY position",
    )?;
    let props = stmt
        .query_map([db_id], |r| {
            Ok(DatabaseProperty {
                id: r.get(0)?,
                database_id: r.get(1)?,
                name: r.get(2)?,
                prop_type: r.get(3)?,
                config_json: r.get(4)?,
                position: r.get(5)?,
                hidden: r.get(6)?,
            })
        })?
        .collect::<std::result::Result<Vec<_>, _>>()?;
    Ok(DatabaseDetail { id: db_id.to_string(), page_id, title, properties: props })
}

// ---- Propiedades -------------------------------------------------------------

pub fn add_property(
    conn: &Connection,
    db_id: &str,
    name: &str,
    prop_type: &str,
) -> Result<DatabaseProperty> {
    if !PROPERTY_TYPES.contains(&prop_type) || prop_type == "title" {
        return Err(NodoraError::InvalidInput("tipo de propiedad inválido".into()));
    }
    if name.trim().is_empty() || name.len() > 200 {
        return Err(NodoraError::InvalidInput("nombre de propiedad inválido".into()));
    }
    // Verifica que la base exista.
    let _: i64 = conn
        .query_row("SELECT 1 FROM databases WHERE id = ?1 AND deleted_at IS NULL", [db_id], |r| {
            r.get(0)
        })
        .optional()?
        .ok_or(NodoraError::DatabaseNotFound)?;
    let last: Option<String> = conn
        .query_row(
            "SELECT MAX(position) FROM database_properties WHERE database_id = ?1 AND deleted_at IS NULL",
            [db_id],
            |r| r.get(0),
        )
        .unwrap_or(None);
    let pos = key_between(last.as_deref(), None)?;
    let id = new_id();
    let now = now_iso();
    conn.execute(
        "INSERT INTO database_properties (id, database_id, name, type, config_json, position, created_at, updated_at)
         VALUES (?1, ?2, ?3, ?4, '{}', ?5, ?6, ?6)",
        params![id, db_id, name.trim(), prop_type, pos, now],
    )?;
    Ok(DatabaseProperty {
        id,
        database_id: db_id.to_string(),
        name: name.trim().to_string(),
        prop_type: prop_type.to_string(),
        config_json: "{}".into(),
        position: pos,
        hidden: false,
    })
}

pub fn rename_property(conn: &Connection, prop_id: &str, name: &str) -> Result<()> {
    if name.trim().is_empty() || name.len() > 200 {
        return Err(NodoraError::InvalidInput("nombre de propiedad inválido".into()));
    }
    let n = conn.execute(
        "UPDATE database_properties SET name = ?1, updated_at = ?2, version = version + 1
         WHERE id = ?3 AND deleted_at IS NULL",
        params![name.trim(), now_iso(), prop_id],
    )?;
    if n == 0 {
        return Err(NodoraError::PropertyNotFound);
    }
    Ok(())
}

pub fn set_property_hidden(conn: &Connection, prop_id: &str, hidden: bool) -> Result<()> {
    let n = conn.execute(
        "UPDATE database_properties SET hidden = ?1, updated_at = ?2, version = version + 1
         WHERE id = ?3 AND deleted_at IS NULL AND type != 'title'",
        params![hidden, now_iso(), prop_id],
    )?;
    if n == 0 {
        return Err(NodoraError::PropertyNotFound);
    }
    Ok(())
}

pub fn delete_property(conn: &mut Connection, prop_id: &str) -> Result<()> {
    let tx = conn.transaction()?;
    let ty: Option<String> = tx
        .query_row(
            "SELECT type FROM database_properties WHERE id = ?1 AND deleted_at IS NULL",
            [prop_id],
            |r| r.get(0),
        )
        .optional()?;
    match ty.as_deref() {
        None => return Err(NodoraError::PropertyNotFound),
        Some("title") => {
            return Err(NodoraError::InvalidInput("la propiedad título no puede eliminarse".into()))
        }
        _ => {}
    }
    tx.execute("DELETE FROM record_values WHERE property_id = ?1", [prop_id])?;
    tx.execute(
        "UPDATE database_properties SET deleted_at = ?1 WHERE id = ?2",
        params![now_iso(), prop_id],
    )?;
    tx.commit()?;
    Ok(())
}

// ---- Conversión de tipos -------------------------------------------------------

fn parse_config_options(config_json: &str) -> Vec<(String, String, String)> {
    let cfg: Value = serde_json::from_str(config_json).unwrap_or(json!({}));
    cfg.get("options")
        .and_then(Value::as_array)
        .map(|a| {
            a.iter()
                .filter_map(|o| {
                    Some((
                        o.get("id")?.as_str()?.to_string(),
                        o.get("name")?.as_str()?.to_string(),
                        o.get("color").and_then(Value::as_str).unwrap_or("gray").to_string(),
                    ))
                })
                .collect()
        })
        .unwrap_or_default()
}

/// Resultado de una conversión (o de su simulación con dry_run).
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ConversionReport {
    pub convertible: i64,
    pub lossy: i64,
    pub applied: bool,
}

/// Matriz de conversiones seguras (docs/DATA_MODEL.md). Devuelve un error
/// UNSAFE_TYPE_CONVERSION para pares no soportados.
pub fn change_property_type(
    conn: &mut Connection,
    prop_id: &str,
    new_type: &str,
    dry_run: bool,
) -> Result<ConversionReport> {
    if !PROPERTY_TYPES.contains(&new_type) || new_type == "title" {
        return Err(NodoraError::InvalidInput("tipo destino inválido".into()));
    }
    let (old_type, config_json): (String, String) = conn
        .query_row(
            "SELECT type, config_json FROM database_properties WHERE id = ?1 AND deleted_at IS NULL",
            [prop_id],
            |r| Ok((r.get(0)?, r.get(1)?)),
        )
        .optional()?
        .ok_or(NodoraError::PropertyNotFound)?;
    if old_type == "title" {
        return Err(NodoraError::InvalidInput("la propiedad título no cambia de tipo".into()));
    }
    if old_type == new_type {
        return Ok(ConversionReport { convertible: 0, lossy: 0, applied: false });
    }
    let supported: bool = matches!(
        (old_type.as_str(), new_type),
        ("text", "number")
            | ("text", "select")
            | ("text", "multi_select")
            | ("text", "status")
            | ("text", "date")
            | ("text", "url")
            | ("number", "text")
            | ("select", "text")
            | ("select", "multi_select")
            | ("select", "status")
            | ("multi_select", "text")
            | ("multi_select", "select")
            | ("status", "text")
            | ("status", "select")
            | ("status", "multi_select")
            | ("date", "text")
            | ("checkbox", "text")
            | ("url", "text")
    );
    if !supported {
        return Err(NodoraError::UnsafeTypeConversion(format!("{old_type} → {new_type}")));
    }

    let values: Vec<(String, String)> = {
        let mut stmt = conn
            .prepare("SELECT record_page_id, value_json FROM record_values WHERE property_id = ?1")?;
        let rows = stmt.query_map([prop_id], |r| Ok((r.get(0)?, r.get(1)?)))?;
        rows.collect::<std::result::Result<Vec<_>, _>>()?
    };

    let old_options = parse_config_options(&config_json);
    // name -> (id, color); para conversiones hacia select-familia.
    let mut new_options: Vec<(String, String, String)> = Vec::new();
    let mut option_by_name: HashMap<String, String> = HashMap::new();
    let mut converted: Vec<(String, Option<String>)> = Vec::new();
    let mut lossy = 0i64;

    let option_id_for = |name: &str,
                             new_options: &mut Vec<(String, String, String)>,
                             option_by_name: &mut HashMap<String, String>|
     -> String {
        if let Some(id) = option_by_name.get(name) {
            return id.clone();
        }
        let id = new_id();
        let color = OPTION_COLORS[new_options.len() % OPTION_COLORS.len()].to_string();
        new_options.push((id.clone(), name.to_string(), color));
        option_by_name.insert(name.to_string(), id.clone());
        id
    };

    let old_option_name =
        |id: &str| old_options.iter().find(|(oid, _, _)| oid == id).map(|(_, n, _)| n.clone());

    for (record, value_json) in &values {
        let v: Value = serde_json::from_str(value_json).unwrap_or(json!({}));
        let as_text: Option<String> = match old_type.as_str() {
            "text" => v.get("text").and_then(Value::as_str).map(str::to_string),
            "number" => v.get("number").and_then(Value::as_f64).map(|n| {
                if n.fract() == 0.0 && n.abs() < 1e15 { format!("{}", n as i64) } else { n.to_string() }
            }),
            "select" | "status" => {
                v.get(old_type.as_str()).and_then(Value::as_str).and_then(|id| old_option_name(id))
            }
            "multi_select" => v.get("multi_select").and_then(Value::as_array).map(|a| {
                a.iter()
                    .filter_map(Value::as_str)
                    .filter_map(|id| old_option_name(id))
                    .collect::<Vec<_>>()
                    .join(", ")
            }),
            "date" => v
                .get("date")
                .and_then(|d| d.get("start"))
                .and_then(Value::as_str)
                .map(str::to_string),
            "checkbox" => v.get("checkbox").and_then(Value::as_bool).map(|b| {
                if b { "Sí".to_string() } else { "No".to_string() }
            }),
            "url" => v.get("url").and_then(Value::as_str).map(str::to_string),
            _ => None,
        };
        let new_value: Option<String> = match new_type {
            "text" => as_text.map(|t| json!({ "text": t }).to_string()),
            "url" => as_text.map(|t| json!({ "url": t }).to_string()),
            "number" => match as_text.as_deref().map(str::trim) {
                Some(t) if !t.is_empty() => match t.replace(',', ".").parse::<f64>() {
                    Ok(n) => Some(json!({ "number": n }).to_string()),
                    Err(_) => {
                        lossy += 1;
                        None
                    }
                },
                _ => None,
            },
            "date" => match as_text.as_deref().map(str::trim) {
                Some(t) if !t.is_empty() => {
                    if chrono::NaiveDate::parse_from_str(&t[..t.len().min(10)], "%Y-%m-%d").is_ok() {
                        Some(json!({ "date": { "start": &t[..10], "end": null } }).to_string())
                    } else {
                        lossy += 1;
                        None
                    }
                }
                _ => None,
            },
            "select" | "status" => match old_type.as_str() {
                "multi_select" => {
                    let first = v
                        .get("multi_select")
                        .and_then(Value::as_array)
                        .and_then(|a| a.first())
                        .and_then(Value::as_str)
                        .and_then(|id| old_option_name(id));
                    if v.get("multi_select").and_then(Value::as_array).map(|a| a.len()).unwrap_or(0) > 1 {
                        lossy += 1;
                    }
                    first.map(|name| {
                        let id = option_id_for(&name, &mut new_options, &mut option_by_name);
                        json!({ new_type: id }).to_string()
                    })
                }
                _ => as_text.filter(|t| !t.trim().is_empty()).map(|name| {
                    let id = option_id_for(name.trim(), &mut new_options, &mut option_by_name);
                    json!({ new_type: id }).to_string()
                }),
            },
            "multi_select" => match old_type.as_str() {
                "select" | "status" => as_text.filter(|t| !t.trim().is_empty()).map(|name| {
                    let id = option_id_for(name.trim(), &mut new_options, &mut option_by_name);
                    json!({ "multi_select": [id] }).to_string()
                }),
                _ => as_text.filter(|t| !t.trim().is_empty()).map(|t| {
                    let ids: Vec<String> = t
                        .split(',')
                        .map(str::trim)
                        .filter(|s| !s.is_empty())
                        .take(50)
                        .map(|name| option_id_for(name, &mut new_options, &mut option_by_name))
                        .collect();
                    json!({ "multi_select": ids }).to_string()
                }),
            },
            _ => None,
        };
        converted.push((record.clone(), new_value));
    }

    let convertible = converted.iter().filter(|(_, v)| v.is_some()).count() as i64;
    if dry_run {
        return Ok(ConversionReport { convertible, lossy, applied: false });
    }

    let tx = conn.transaction()?;
    let now = now_iso();
    // Config nueva: opciones creadas (si aplica) o config vacía.
    let new_config = if matches!(new_type, "select" | "multi_select" | "status") {
        let opts: Vec<Value> = new_options
            .iter()
            .map(|(id, name, color)| json!({ "id": id, "name": name, "color": color }))
            .collect();
        json!({ "options": opts }).to_string()
    } else {
        "{}".to_string()
    };
    tx.execute(
        "UPDATE database_properties SET type = ?1, config_json = ?2, updated_at = ?3,
         version = version + 1 WHERE id = ?4",
        params![new_type, new_config, now, prop_id],
    )?;
    for (record, value) in converted {
        match value {
            Some(v) => {
                tx.execute(
                    "UPDATE record_values SET value_json = ?1, updated_at = ?2
                     WHERE record_page_id = ?3 AND property_id = ?4",
                    params![v, now, record, prop_id],
                )?;
            }
            None => {
                tx.execute(
                    "DELETE FROM record_values WHERE record_page_id = ?1 AND property_id = ?2",
                    params![record, prop_id],
                )?;
            }
        }
    }
    tx.commit()?;
    Ok(ConversionReport { convertible, lossy, applied: true })
}

/// Actualiza la configuración (opciones de select/status, formato).
pub fn set_property_config(conn: &Connection, prop_id: &str, config_json: &str) -> Result<()> {
    let parsed: Value = serde_json::from_str(config_json)
        .map_err(|_| NodoraError::InvalidInput("config no es JSON válido".into()))?;
    if !parsed.is_object() {
        return Err(NodoraError::InvalidInput("config debe ser objeto".into()));
    }
    if config_json.len() > 64 * 1024 {
        return Err(NodoraError::InvalidInput("config demasiado grande".into()));
    }
    let n = conn.execute(
        "UPDATE database_properties SET config_json = ?1, updated_at = ?2, version = version + 1
         WHERE id = ?3 AND deleted_at IS NULL",
        params![config_json, now_iso(), prop_id],
    )?;
    if n == 0 {
        return Err(NodoraError::PropertyNotFound);
    }
    Ok(())
}

// ---- Registros -----------------------------------------------------------------

pub fn create_record(conn: &Connection, ctx: &WorkspaceCtx, db_id: &str) -> Result<String> {
    let page_id_of_db: String = conn
        .query_row(
            "SELECT page_id FROM databases WHERE id = ?1 AND deleted_at IS NULL",
            [db_id],
            |r| r.get(0),
        )
        .optional()?
        .ok_or(NodoraError::DatabaseNotFound)?;
    let id = new_id();
    let now = now_iso();
    let last: Option<String> = conn
        .query_row(
            "SELECT MAX(position) FROM pages WHERE database_id = ?1 AND deleted_at IS NULL",
            [db_id],
            |r| r.get(0),
        )
        .unwrap_or(None);
    let position = key_between(last.as_deref(), None)?;
    conn.execute(
        "INSERT INTO pages (id, workspace_id, parent_page_id, title, position,
            content_json, content_text, kind, database_id,
            created_at, updated_at, created_by, updated_by, device_id)
         VALUES (?1, ?2, ?3, '', ?4, ?5, '', 'record', ?6, ?7, ?7, ?8, ?8, ?9)",
        params![id, ctx.workspace_id, page_id_of_db, position, EMPTY_DOC, db_id, now, ctx.user_id, ctx.device_id],
    )?;
    conn.execute(
        "INSERT INTO pages_fts (rowid, title, content_text)
         SELECT rowid, title, content_text FROM pages WHERE id = ?1",
        [&id],
    )?;
    Ok(id)
}

pub fn list_records(
    conn: &Connection,
    db_id: &str,
    sort: Option<&RecordSort>,
    filters: &[RecordFilter],
) -> Result<Vec<RecordRow>> {
    let mut rows: Vec<RecordRow> = {
        let mut stmt = conn.prepare(
            "SELECT id, title, icon, position FROM pages
             WHERE database_id = ?1 AND deleted_at IS NULL AND archived_at IS NULL
             ORDER BY position",
        )?;
        let mapped = stmt.query_map([db_id], |r| {
            Ok(RecordRow {
                page_id: r.get(0)?,
                title: r.get(1)?,
                icon: r.get(2)?,
                position: r.get(3)?,
                values: HashMap::new(),
            })
        })?;
        mapped.collect::<std::result::Result<Vec<_>, _>>()?
    };
    let mut by_id: HashMap<String, usize> =
        rows.iter().enumerate().map(|(i, r)| (r.page_id.clone(), i)).collect();
    {
        let mut stmt = conn.prepare(
            "SELECT rv.record_page_id, rv.property_id, rv.value_json
             FROM record_values rv JOIN pages p ON p.id = rv.record_page_id
             WHERE p.database_id = ?1 AND p.deleted_at IS NULL",
        )?;
        let mapped = stmt.query_map([db_id], |r| {
            Ok((r.get::<_, String>(0)?, r.get::<_, String>(1)?, r.get::<_, String>(2)?))
        })?;
        for item in mapped {
            let (rec, prop, val) = item?;
            if let Some(&i) = by_id.get(&rec) {
                rows[i].values.insert(prop, val);
            }
        }
    }

    // Filtrado en memoria (colecciones acotadas del MVP; docs/DATA_MODEL.md).
    let props = get_database(conn, db_id)?.properties;
    let prop_type: HashMap<&str, &str> =
        props.iter().map(|p| (p.id.as_str(), p.prop_type.as_str())).collect();
    if !filters.is_empty() {
        rows.retain(|row| filters.iter().all(|f| matches_filter(row, f, &prop_type)));
        by_id.clear();
    }

    if let Some(s) = sort {
        let dir = if s.direction == "desc" { -1 } else { 1 };
        match &s.property_id {
            None => rows.sort_by(|a, b| (a.title.to_lowercase().cmp(&b.title.to_lowercase())).then(a.position.cmp(&b.position))),
            Some(pid) => {
                let ty = prop_type.get(pid.as_str()).copied().unwrap_or("text");
                rows.sort_by(|a, b| compare_values(a, b, pid, ty));
            }
        }
        if dir < 0 {
            rows.reverse();
        }
    }
    Ok(rows)
}

fn value_of<'a>(row: &'a RecordRow, prop_id: &str) -> Option<Value> {
    row.values.get(prop_id).and_then(|s| serde_json::from_str(s).ok())
}

fn compare_values(a: &RecordRow, b: &RecordRow, prop_id: &str, ty: &str) -> std::cmp::Ordering {
    use std::cmp::Ordering;
    let (va, vb) = (value_of(a, prop_id), value_of(b, prop_id));
    match (va, vb) {
        (None, None) => a.position.cmp(&b.position),
        (None, Some(_)) => Ordering::Greater, // vacíos al final
        (Some(_), None) => Ordering::Less,
        (Some(va), Some(vb)) => match ty {
            "number" => {
                let na = va.get("number").and_then(Value::as_f64).unwrap_or(f64::NAN);
                let nb = vb.get("number").and_then(Value::as_f64).unwrap_or(f64::NAN);
                na.partial_cmp(&nb).unwrap_or(Ordering::Equal)
            }
            "checkbox" => {
                let ba = va.get("checkbox").and_then(Value::as_bool).unwrap_or(false);
                let bb = vb.get("checkbox").and_then(Value::as_bool).unwrap_or(false);
                ba.cmp(&bb)
            }
            "date" => {
                let da = va.get("date").and_then(|d| d.get("start")).and_then(Value::as_str).unwrap_or("");
                let db = vb.get("date").and_then(|d| d.get("start")).and_then(Value::as_str).unwrap_or("");
                da.cmp(db)
            }
            _ => {
                let sa = flatten_text(&va, ty);
                let sb = flatten_text(&vb, ty);
                sa.to_lowercase().cmp(&sb.to_lowercase())
            }
        },
    }
}

fn flatten_text(v: &Value, ty: &str) -> String {
    match ty {
        "text" => v.get("text").and_then(Value::as_str).unwrap_or("").to_string(),
        "url" => v.get("url").and_then(Value::as_str).unwrap_or("").to_string(),
        "select" | "status" => v.get(ty).and_then(Value::as_str).unwrap_or("").to_string(),
        "multi_select" => v
            .get("multi_select")
            .and_then(Value::as_array)
            .map(|a| a.iter().filter_map(Value::as_str).collect::<Vec<_>>().join(","))
            .unwrap_or_default(),
        _ => String::new(),
    }
}

fn matches_filter(row: &RecordRow, f: &RecordFilter, prop_type: &HashMap<&str, &str>) -> bool {
    let ty = prop_type.get(f.property_id.as_str()).copied().unwrap_or("text");
    // Filtro por título (property especial "title").
    let title_prop = ty == "title";
    let v = value_of(row, &f.property_id);
    match f.operator.as_str() {
        "is_empty" => {
            if title_prop {
                row.title.trim().is_empty()
            } else {
                v.is_none() || flatten_text(v.as_ref().unwrap(), ty).is_empty()
            }
        }
        "not_empty" => {
            if title_prop {
                !row.title.trim().is_empty()
            } else {
                v.as_ref().map(|v| !flatten_text(v, ty).is_empty()).unwrap_or(false)
                    || matches!(ty, "number" | "checkbox" | "date") && v.is_some()
            }
        }
        "is_checked" => v
            .as_ref()
            .and_then(|v| v.get("checkbox"))
            .and_then(Value::as_bool)
            .unwrap_or(false),
        "not_checked" => !v
            .as_ref()
            .and_then(|v| v.get("checkbox"))
            .and_then(Value::as_bool)
            .unwrap_or(false),
        "contains" | "eq" | "gt" | "lt" => {
            let operand: Value = f
                .value_json
                .as_deref()
                .and_then(|s| serde_json::from_str(s).ok())
                .unwrap_or(Value::Null);
            match f.operator.as_str() {
                "contains" => {
                    let needle = operand.as_str().unwrap_or("").to_lowercase();
                    let hay = if title_prop {
                        row.title.clone()
                    } else {
                        v.as_ref().map(|v| flatten_text(v, ty)).unwrap_or_default()
                    };
                    hay.to_lowercase().contains(&needle)
                }
                "eq" => {
                    if title_prop {
                        row.title == operand.as_str().unwrap_or("")
                    } else {
                        match ty {
                            "number" => {
                                v.as_ref().and_then(|v| v.get("number")).and_then(Value::as_f64)
                                    == operand.as_f64()
                            }
                            "select" | "status" => {
                                v.as_ref().and_then(|v| v.get(ty)).and_then(Value::as_str)
                                    == operand.as_str()
                            }
                            "multi_select" => v
                                .as_ref()
                                .and_then(|v| v.get("multi_select"))
                                .and_then(Value::as_array)
                                .map(|a| a.iter().filter_map(Value::as_str).any(|s| Some(s) == operand.as_str()))
                                .unwrap_or(false),
                            "date" => {
                                v.as_ref()
                                    .and_then(|v| v.get("date"))
                                    .and_then(|d| d.get("start"))
                                    .and_then(Value::as_str)
                                    .map(|s| Some(&s[..s.len().min(10)]) == operand.as_str().map(|o| &o[..o.len().min(10)]))
                                    .unwrap_or(false)
                            }
                            _ => {
                                v.as_ref().map(|v| flatten_text(v, ty)).unwrap_or_default()
                                    == operand.as_str().unwrap_or("")
                            }
                        }
                    }
                }
                "gt" | "lt" => {
                    let cmp = match ty {
                        "number" => {
                            let a = v.as_ref().and_then(|v| v.get("number")).and_then(Value::as_f64);
                            let b = operand.as_f64();
                            match (a, b) {
                                (Some(a), Some(b)) => a.partial_cmp(&b),
                                _ => None,
                            }
                        }
                        "date" => {
                            let a = v
                                .as_ref()
                                .and_then(|v| v.get("date"))
                                .and_then(|d| d.get("start"))
                                .and_then(Value::as_str);
                            let b = operand.as_str();
                            match (a, b) {
                                (Some(a), Some(b)) => Some(a.cmp(b)),
                                _ => None,
                            }
                        }
                        _ => None,
                    };
                    match (f.operator.as_str(), cmp) {
                        ("gt", Some(std::cmp::Ordering::Greater)) => true,
                        ("lt", Some(std::cmp::Ordering::Less)) => true,
                        _ => false,
                    }
                }
                _ => true,
            }
        }
        _ => true,
    }
}

/// Valida y guarda el valor de una propiedad de un registro.
pub fn set_record_value(
    conn: &Connection,
    ctx: &WorkspaceCtx,
    record_page_id: &str,
    prop_id: &str,
    value_json: Option<&str>,
) -> Result<()> {
    let (prop_type, db_id): (String, String) = conn
        .query_row(
            "SELECT type, database_id FROM database_properties WHERE id = ?1 AND deleted_at IS NULL",
            [prop_id],
            |r| Ok((r.get(0)?, r.get(1)?)),
        )
        .optional()?
        .ok_or(NodoraError::PropertyNotFound)?;
    // El registro debe pertenecer a la misma base.
    let belongs: Option<i64> = conn
        .query_row(
            "SELECT 1 FROM pages WHERE id = ?1 AND database_id = ?2 AND deleted_at IS NULL",
            params![record_page_id, db_id],
            |r| r.get(0),
        )
        .optional()?;
    if belongs.is_none() {
        return Err(NodoraError::PageNotFound);
    }
    if prop_type == "title" {
        // El título vive en pages.title; usa rename_page.
        return Err(NodoraError::InvalidInput("usa el título de la página".into()));
    }
    match value_json {
        None => {
            conn.execute(
                "DELETE FROM record_values WHERE record_page_id = ?1 AND property_id = ?2",
                params![record_page_id, prop_id],
            )?;
        }
        Some(vj) => {
            if vj.len() > 64 * 1024 {
                return Err(NodoraError::InvalidInput("valor demasiado grande".into()));
            }
            let v: Value = serde_json::from_str(vj)
                .map_err(|_| NodoraError::InvalidInput("valor no es JSON válido".into()))?;
            validate_value(&prop_type, &v)?;
            conn.execute(
                "INSERT INTO record_values (record_page_id, property_id, value_json, updated_at)
                 VALUES (?1, ?2, ?3, ?4)
                 ON CONFLICT(record_page_id, property_id) DO UPDATE SET value_json = ?3, updated_at = ?4",
                params![record_page_id, prop_id, vj, now_iso()],
            )?;
        }
    }
    let _ = ctx;
    Ok(())
}

fn validate_value(prop_type: &str, v: &Value) -> Result<()> {
    let ok = match prop_type {
        "text" => v.get("text").map(Value::is_string).unwrap_or(false),
        "number" => v.get("number").map(Value::is_number).unwrap_or(false),
        "select" => v.get("select").map(Value::is_string).unwrap_or(false),
        "status" => v.get("status").map(Value::is_string).unwrap_or(false),
        "multi_select" => v
            .get("multi_select")
            .and_then(Value::as_array)
            .map(|a| a.iter().all(Value::is_string))
            .unwrap_or(false),
        "date" => v
            .get("date")
            .and_then(|d| d.get("start"))
            .and_then(Value::as_str)
            .map(|s| chrono::NaiveDate::parse_from_str(&s[..s.len().min(10)], "%Y-%m-%d").is_ok())
            .unwrap_or(false),
        "checkbox" => v.get("checkbox").map(Value::is_boolean).unwrap_or(false),
        "url" => v
            .get("url")
            .and_then(Value::as_str)
            .map(|u| u.len() <= 2048)
            .unwrap_or(false),
        _ => false,
    };
    if ok {
        Ok(())
    } else {
        Err(NodoraError::InvalidInput(format!("valor inválido para tipo {prop_type}")))
    }
}
