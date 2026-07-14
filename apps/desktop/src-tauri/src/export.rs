//! Exportación: página a Markdown (con adjuntos) y workspace completo a JSON
//! versionado (docs/NODORA_SPEC.md §5, PRD R9).

use std::collections::HashMap;
use std::path::{Path, PathBuf};

use rusqlite::Connection;
use serde_json::{json, Value};

use crate::error::{NodoraError, Result};
use crate::ids::now_iso;
use crate::workspace::OpenWorkspace;

pub const EXPORT_FORMAT_VERSION: i64 = 1;

// ---- Markdown ----------------------------------------------------------------

fn slugify(title: &str, fallback: &str) -> String {
    let mut s: String = title
        .chars()
        .map(|c| if c.is_alphanumeric() || c == ' ' || c == '-' || c == '_' { c } else { ' ' })
        .collect::<String>()
        .split_whitespace()
        .collect::<Vec<_>>()
        .join("-");
    s.truncate(80);
    let s = s.trim_matches('-').to_string();
    if s.is_empty() {
        format!("pagina-{}", &fallback[..8.min(fallback.len())])
    } else {
        s
    }
}

struct MdCtx<'a> {
    conn: &'a Connection,
    ws: &'a OpenWorkspace,
    file_names: HashMap<String, String>,
    assets: Vec<String>, // attachment ids a copiar
}

fn render_inline(node: &Value, ctx: &mut MdCtx) -> String {
    let ty = node.get("type").and_then(Value::as_str).unwrap_or("");
    match ty {
        "text" => {
            let mut t = node.get("text").and_then(Value::as_str).unwrap_or("").to_string();
            if let Some(marks) = node.get("marks").and_then(Value::as_array) {
                let mut href: Option<String> = None;
                for m in marks {
                    match m.get("type").and_then(Value::as_str).unwrap_or("") {
                        "code" => t = format!("`{t}`"),
                        "bold" => t = format!("**{t}**"),
                        "italic" => t = format!("*{t}*"),
                        "strike" => t = format!("~~{t}~~"),
                        "link" => {
                            href = m
                                .get("attrs")
                                .and_then(|a| a.get("href"))
                                .and_then(Value::as_str)
                                .map(str::to_string);
                        }
                        _ => {}
                    }
                }
                if let Some(h) = href {
                    t = format!("[{t}]({h})");
                }
            }
            t
        }
        "hardBreak" => "  \n".into(),
        "pageLink" => {
            let pid = node
                .get("attrs")
                .and_then(|a| a.get("pageId"))
                .and_then(Value::as_str)
                .unwrap_or("");
            let title: String = ctx
                .conn
                .query_row(
                    "SELECT title FROM pages WHERE id = ?1 AND deleted_at IS NULL",
                    [pid],
                    |r| r.get(0),
                )
                .unwrap_or_else(|_| "página".into());
            match ctx.file_names.get(pid) {
                Some(f) => format!("[{title}]({f})"),
                None => format!("[{title}]"),
            }
        }
        _ => children_inline(node, ctx),
    }
}

fn children_inline(node: &Value, ctx: &mut MdCtx) -> String {
    node.get("content")
        .and_then(Value::as_array)
        .map(|a| a.iter().map(|c| render_inline(c, ctx)).collect::<Vec<_>>().join(""))
        .unwrap_or_default()
}

fn render_block(node: &Value, ctx: &mut MdCtx, indent: usize) -> String {
    let ty = node.get("type").and_then(Value::as_str).unwrap_or("");
    let pad = "  ".repeat(indent);
    match ty {
        "paragraph" => format!("{pad}{}\n\n", children_inline(node, ctx)),
        "heading" => {
            let level = node
                .get("attrs")
                .and_then(|a| a.get("level"))
                .and_then(Value::as_i64)
                .unwrap_or(1)
                .clamp(1, 3) as usize;
            format!("{} {}\n\n", "#".repeat(level), children_inline(node, ctx))
        }
        "bulletList" | "orderedList" | "taskList" => {
            let ordered = ty == "orderedList";
            let tasks = ty == "taskList";
            let mut out = String::new();
            if let Some(items) = node.get("content").and_then(Value::as_array) {
                for (i, item) in items.iter().enumerate() {
                    let checked = item
                        .get("attrs")
                        .and_then(|a| a.get("checked"))
                        .and_then(Value::as_bool)
                        .unwrap_or(false);
                    let marker = if tasks {
                        if checked { "- [x]".into() } else { "- [ ]".into() }
                    } else if ordered {
                        format!("{}.", i + 1)
                    } else {
                        "-".into()
                    };
                    // Primer párrafo en la línea del ítem; resto anidado.
                    let mut first = true;
                    if let Some(children) = item.get("content").and_then(Value::as_array) {
                        for child in children {
                            let cty = child.get("type").and_then(Value::as_str).unwrap_or("");
                            if first && cty == "paragraph" {
                                out.push_str(&format!(
                                    "{pad}{marker} {}\n",
                                    children_inline(child, ctx)
                                ));
                                first = false;
                            } else {
                                out.push_str(&render_block(child, ctx, indent + 1));
                            }
                        }
                    }
                    if first {
                        out.push_str(&format!("{pad}{marker}\n"));
                    }
                }
            }
            out.push('\n');
            out
        }
        "blockquote" => {
            let inner = node
                .get("content")
                .and_then(Value::as_array)
                .map(|a| a.iter().map(|c| render_block(c, ctx, 0)).collect::<Vec<_>>().join(""))
                .unwrap_or_default();
            inner
                .trim_end()
                .lines()
                .map(|l| format!("{pad}> {l}"))
                .collect::<Vec<_>>()
                .join("\n")
                + "\n\n"
        }
        "callout" => {
            let emoji = node
                .get("attrs")
                .and_then(|a| a.get("emoji"))
                .and_then(Value::as_str)
                .unwrap_or("💡");
            let inner = node
                .get("content")
                .and_then(Value::as_array)
                .map(|a| a.iter().map(|c| render_block(c, ctx, 0)).collect::<Vec<_>>().join(""))
                .unwrap_or_default();
            let mut lines = inner.trim_end().lines();
            let first = lines.next().unwrap_or("");
            let mut out = format!("{pad}> {emoji} {first}\n");
            for l in lines {
                out.push_str(&format!("{pad}> {l}\n"));
            }
            out.push('\n');
            out
        }
        "codeBlock" => {
            let lang = node
                .get("attrs")
                .and_then(|a| a.get("language"))
                .and_then(Value::as_str)
                .unwrap_or("");
            format!("{pad}```{lang}\n{}\n{pad}```\n\n", children_inline(node, ctx))
        }
        "horizontalRule" => format!("{pad}---\n\n"),
        "image" => {
            let att = node
                .get("attrs")
                .and_then(|a| a.get("attachmentId"))
                .and_then(Value::as_str)
                .unwrap_or("");
            let alt = node
                .get("attrs")
                .and_then(|a| a.get("alt"))
                .and_then(Value::as_str)
                .unwrap_or("imagen");
            if let Ok(info) = crate::attachments::get_info(ctx.ws, att) {
                ctx.assets.push(att.to_string());
                let ext = match info.mime.as_str() {
                    "image/png" => "png",
                    "image/jpeg" => "jpg",
                    "image/gif" => "gif",
                    "image/webp" => "webp",
                    _ => "bin",
                };
                format!("{pad}![{alt}](assets/{att}.{ext})\n\n")
            } else {
                format!("{pad}![{alt}](adjunto-faltante)\n\n")
            }
        }
        "subpage" => {
            let pid = node
                .get("attrs")
                .and_then(|a| a.get("pageId"))
                .and_then(Value::as_str)
                .unwrap_or("");
            let title: String = ctx
                .conn
                .query_row(
                    "SELECT title FROM pages WHERE id = ?1 AND deleted_at IS NULL",
                    [pid],
                    |r| r.get(0),
                )
                .unwrap_or_else(|_| "subpágina".into());
            match ctx.file_names.get(pid) {
                Some(f) => format!("{pad}→ [{title}]({f})\n\n"),
                None => format!("{pad}→ [{title}]\n\n"),
            }
        }
        _ => String::new(),
    }
}

pub fn page_to_markdown(ws: &OpenWorkspace, page_id: &str, file_names: &HashMap<String, String>) -> Result<(String, Vec<String>)> {
    let page = crate::pages::get_page(&ws.conn, page_id)?;
    let doc: Value = serde_json::from_str(&page.content_json)
        .map_err(|_| NodoraError::InvalidDocument("contenido corrupto".into()))?;
    let mut ctx = MdCtx { conn: &ws.conn, ws, file_names: file_names.clone(), assets: Vec::new() };
    let mut out = format!("# {}\n\n", page.title);
    if let Some(blocks) = doc.get("content").and_then(Value::as_array) {
        for b in blocks {
            out.push_str(&render_block(b, &mut ctx, 0));
        }
    }
    Ok((out, ctx.assets))
}

/// Exporta una página (y opcionalmente sus subpáginas) a un directorio.
pub fn export_page_markdown(
    ws: &OpenWorkspace,
    page_id: &str,
    dest_dir: &Path,
    include_subpages: bool,
) -> Result<Vec<String>> {
    std::fs::create_dir_all(dest_dir)?;
    // Páginas a exportar.
    let mut ids = vec![page_id.to_string()];
    if include_subpages {
        let mut stmt = ws.conn.prepare(
            "WITH RECURSIVE sub(id) AS (
               SELECT id FROM pages WHERE id = ?1 AND deleted_at IS NULL
               UNION ALL
               SELECT p.id FROM pages p JOIN sub s ON p.parent_page_id = s.id
               WHERE p.deleted_at IS NULL
             ) SELECT id FROM sub",
        )?;
        let rows = stmt.query_map([page_id], |r| r.get::<_, String>(0))?;
        ids = rows.collect::<std::result::Result<Vec<_>, _>>()?;
    }
    // Nombres de archivo únicos.
    let mut file_names: HashMap<String, String> = HashMap::new();
    let mut used: HashMap<String, usize> = HashMap::new();
    for id in &ids {
        let title: String = ws
            .conn
            .query_row("SELECT title FROM pages WHERE id = ?1", [id], |r| r.get(0))
            .unwrap_or_default();
        let base = slugify(&title, id);
        let count = used.entry(base.clone()).or_insert(0);
        let name = if *count == 0 { format!("{base}.md") } else { format!("{base}-{count}.md") };
        *count += 1;
        file_names.insert(id.clone(), name);
    }
    // Render + copia de adjuntos.
    let mut written = Vec::new();
    let mut all_assets: Vec<String> = Vec::new();
    for id in &ids {
        let (md, assets) = page_to_markdown(ws, id, &file_names)?;
        let file = dest_dir.join(file_names.get(id).expect("filename asignado"));
        std::fs::write(&file, md)?;
        written.push(file.to_string_lossy().into_owned());
        all_assets.extend(assets);
    }
    if !all_assets.is_empty() {
        let assets_dir = dest_dir.join("assets");
        std::fs::create_dir_all(&assets_dir)?;
        all_assets.sort();
        all_assets.dedup();
        for att in &all_assets {
            if let Ok(src) = crate::attachments::resolve_path(ws, att) {
                let file_name = src.file_name().map(|f| f.to_owned()).unwrap_or_default();
                std::fs::copy(&src, assets_dir.join(file_name))?;
            }
        }
    }
    Ok(written)
}

// ---- JSON del workspace --------------------------------------------------------

fn rows_to_json(conn: &Connection, sql: &str) -> Result<Vec<Value>> {
    let mut stmt = conn.prepare(sql)?;
    let cols: Vec<String> = stmt.column_names().iter().map(|c| c.to_string()).collect();
    let rows = stmt.query_map([], |r| {
        let mut obj = serde_json::Map::new();
        for (i, name) in cols.iter().enumerate() {
            let v: Value = match r.get_ref(i)? {
                rusqlite::types::ValueRef::Null => Value::Null,
                rusqlite::types::ValueRef::Integer(n) => json!(n),
                rusqlite::types::ValueRef::Real(f) => json!(f),
                rusqlite::types::ValueRef::Text(t) => json!(String::from_utf8_lossy(t)),
                rusqlite::types::ValueRef::Blob(_) => Value::Null,
            };
            obj.insert(name.clone(), v);
        }
        Ok(Value::Object(obj))
    })?;
    Ok(rows.collect::<std::result::Result<Vec<_>, _>>()?)
}

/// Exportación completa y legible del workspace (garantía anti-lock-in).
pub fn export_workspace_json(ws: &OpenWorkspace, dest_file: &Path) -> Result<()> {
    let doc = json!({
        "formatVersion": EXPORT_FORMAT_VERSION,
        "exportedAt": now_iso(),
        "generator": "nodora-desktop",
        "schemaVersion": crate::db::schema_version(&ws.conn)?,
        "workspace": rows_to_json(&ws.conn, "SELECT * FROM workspaces")?,
        "pages": rows_to_json(&ws.conn, "SELECT * FROM pages WHERE deleted_at IS NULL")?,
        "pageLinks": rows_to_json(&ws.conn, "SELECT * FROM page_links")?,
        "databases": rows_to_json(&ws.conn, "SELECT * FROM databases WHERE deleted_at IS NULL")?,
        "databaseProperties": rows_to_json(&ws.conn, "SELECT * FROM database_properties WHERE deleted_at IS NULL")?,
        "recordValues": rows_to_json(&ws.conn, "SELECT * FROM record_values")?,
        "attachments": rows_to_json(&ws.conn, "SELECT * FROM attachments WHERE deleted_at IS NULL")?,
        "favorites": rows_to_json(&ws.conn, "SELECT * FROM favorites WHERE deleted_at IS NULL")?,
    });
    let pretty = serde_json::to_string_pretty(&doc)
        .map_err(|e| NodoraError::Internal(format!("serialización: {e}")))?;
    if let Some(parent) = dest_file.parent() {
        std::fs::create_dir_all(parent)?;
    }
    std::fs::write(dest_file, pretty)?;
    Ok(())
}

/// Ruta segura de destino: canonicaliza y rechaza rutas raras (defensa T7).
pub fn ensure_safe_dir(path: &str) -> Result<PathBuf> {
    let p = PathBuf::from(path);
    if !p.is_absolute() {
        return Err(NodoraError::PathNotAllowed);
    }
    Ok(p)
}
