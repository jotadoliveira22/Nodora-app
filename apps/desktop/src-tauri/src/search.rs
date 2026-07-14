//! Búsqueda de texto completo sobre FTS5 (docs/DATA_MODEL.md §Búsqueda).

use rusqlite::{params, Connection};
use serde::Serialize;

use crate::error::Result;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SearchResultItem {
    pub page_id: String,
    pub title: String,
    pub icon: Option<String>,
    pub snippet: String,
    pub archived: bool,
    pub kind: String,
}

/// Construye una expresión MATCH segura: cada token del usuario se cita entre
/// comillas dobles (con escape) y se busca por prefijo. Impide inyectar
/// sintaxis FTS (NEAR, columnas, paréntesis).
fn build_match(query: &str, titles_only: bool) -> Option<String> {
    let tokens: Vec<String> = query
        .split_whitespace()
        .filter(|t| !t.is_empty())
        .take(12)
        .map(|t| format!("\"{}\"*", t.replace('"', "\"\"")))
        .collect();
    if tokens.is_empty() {
        return None;
    }
    let joined = tokens.join(" ");
    Some(if titles_only { format!("title: ({joined})") } else { joined })
}

pub fn search(
    conn: &Connection,
    query: &str,
    include_archived: bool,
    titles_only: bool,
    limit: i64,
) -> Result<Vec<SearchResultItem>> {
    let Some(match_expr) = build_match(query, titles_only) else {
        return Ok(Vec::new());
    };
    let mut stmt = conn.prepare(
        "SELECT p.id, p.title, p.icon, p.kind, p.archived_at IS NOT NULL,
                snippet(pages_fts, 1, '«', '»', '…', 12)
         FROM pages_fts JOIN pages p ON p.rowid = pages_fts.rowid
         WHERE pages_fts MATCH ?1 AND p.deleted_at IS NULL
           AND (?2 OR p.archived_at IS NULL)
         ORDER BY bm25(pages_fts, 5.0, 1.0)
         LIMIT ?3",
    )?;
    let rows = stmt.query_map(params![match_expr, include_archived, limit], |r| {
        Ok(SearchResultItem {
            page_id: r.get(0)?,
            title: r.get(1)?,
            icon: r.get(2)?,
            kind: r.get(3)?,
            archived: r.get(4)?,
            snippet: r.get(5)?,
        })
    })?;
    Ok(rows.collect::<std::result::Result<Vec<_>, _>>()?)
}
