//! Validación del documento del editor y extracción de proyecciones.
//!
//! El backend NUNCA confía en proyecciones calculadas por el frontend: el
//! texto para FTS, los enlaces internos y las referencias a adjuntos se
//! derivan aquí del propio documento, dentro de la transacción de guardado
//! (docs/DATA_MODEL.md, docs/SECURITY_ARCHITECTURE.md).

use serde_json::Value;

use crate::error::{NodoraError, Result};

const MAX_DEPTH: usize = 40;
const MAX_NODES: usize = 50_000;
const MAX_TEXT_BYTES: usize = 2 * 1024 * 1024;
const MAX_DOC_BYTES: usize = 8 * 1024 * 1024;

const ALLOWED_MARKS: &[&str] = &["bold", "italic", "strike", "code", "link"];
const ALLOWED_LINK_PROTOCOLS: &[&str] = &["http://", "https://", "mailto:"];

pub struct DocProjection {
    /// Texto plano para el índice FTS (bloques separados por '\n').
    pub text: String,
    /// Enlaces internos salientes: (target_page_id, block_id).
    pub links: Vec<(String, String)>,
    /// Ids de adjuntos referenciados por bloques de imagen.
    pub attachments: Vec<String>,
}

struct Walker {
    nodes: usize,
    text_bytes: usize,
    text: String,
    links: Vec<(String, String)>,
    attachments: Vec<String>,
}

fn err(msg: impl Into<String>) -> NodoraError {
    NodoraError::InvalidDocument(msg.into())
}

/// Valida `content_json` contra el schema de bloques permitido y devuelve
/// las proyecciones derivadas.
pub fn validate_and_project(content_json: &str) -> Result<DocProjection> {
    if content_json.len() > MAX_DOC_BYTES {
        return Err(err("el documento supera el tamaño máximo"));
    }
    let doc: Value =
        serde_json::from_str(content_json).map_err(|_| err("JSON de documento no válido"))?;
    let obj = doc
        .as_object()
        .ok_or_else(|| err("la raíz no es un objeto"))?;
    if obj.get("type").and_then(Value::as_str) != Some("doc") {
        return Err(err("la raíz debe ser type=doc"));
    }
    let mut w = Walker {
        nodes: 0,
        text_bytes: 0,
        text: String::new(),
        links: Vec::new(),
        attachments: Vec::new(),
    };
    if let Some(content) = obj.get("content") {
        let blocks = content
            .as_array()
            .ok_or_else(|| err("doc.content debe ser lista"))?;
        for block in blocks {
            let block_id = block
                .get("attrs")
                .and_then(|a| a.get("blockId"))
                .and_then(Value::as_str)
                .unwrap_or("")
                .to_string();
            walk_node(block, &mut w, 1, &block_id)?;
            if !w.text.is_empty() && !w.text.ends_with('\n') {
                w.text.push('\n');
            }
        }
    }
    let text = w.text.trim_end().to_string();
    Ok(DocProjection {
        text,
        links: w.links,
        attachments: w.attachments,
    })
}

fn check_marks(node: &Value) -> Result<()> {
    let Some(marks) = node.get("marks") else {
        return Ok(());
    };
    let marks = marks
        .as_array()
        .ok_or_else(|| err("marks debe ser lista"))?;
    for m in marks {
        let ty = m
            .get("type")
            .and_then(Value::as_str)
            .ok_or_else(|| err("mark sin type"))?;
        if !ALLOWED_MARKS.contains(&ty) {
            return Err(err(format!("mark no permitida: {ty}")));
        }
        if ty == "link" {
            let href = m
                .get("attrs")
                .and_then(|a| a.get("href"))
                .and_then(Value::as_str)
                .ok_or_else(|| err("link sin href"))?;
            if !ALLOWED_LINK_PROTOCOLS.iter().any(|p| href.starts_with(p)) {
                return Err(err("protocolo de enlace no permitido"));
            }
        }
    }
    Ok(())
}

fn walk_node(node: &Value, w: &mut Walker, depth: usize, block_id: &str) -> Result<()> {
    if depth > MAX_DEPTH {
        return Err(err("documento demasiado profundo"));
    }
    w.nodes += 1;
    if w.nodes > MAX_NODES {
        return Err(err("demasiados nodos en el documento"));
    }
    let obj = node.as_object().ok_or_else(|| err("nodo no es objeto"))?;
    let ty = obj
        .get("type")
        .and_then(Value::as_str)
        .ok_or_else(|| err("nodo sin type"))?;
    let attrs = obj.get("attrs");
    let get_attr = |name: &str| attrs.and_then(|a| a.get(name));

    let mut walk_children = true;
    match ty {
        "paragraph" | "bulletList" | "orderedList" | "listItem" | "taskList" | "blockquote"
        | "callout" | "hardBreak" | "horizontalRule" => {}
        "heading" => {
            let level = get_attr("level").and_then(Value::as_i64).unwrap_or(0);
            if !(1..=3).contains(&level) {
                return Err(err("nivel de encabezado inválido"));
            }
        }
        "taskItem" => {
            if let Some(c) = get_attr("checked") {
                if !c.is_boolean() {
                    return Err(err("taskItem.checked debe ser booleano"));
                }
            }
        }
        "codeBlock" => {
            if let Some(lang) = get_attr("language") {
                if !(lang.is_null() || lang.is_string()) {
                    return Err(err("codeBlock.language inválido"));
                }
            }
        }
        "image" => {
            let att = get_attr("attachmentId")
                .and_then(Value::as_str)
                .ok_or_else(|| err("imagen sin attachmentId"))?;
            if !crate::ids::is_uuid_like(att) {
                return Err(err("attachmentId inválido"));
            }
            w.attachments.push(att.to_string());
            walk_children = false;
        }
        "pageLink" => {
            let pid = get_attr("pageId")
                .and_then(Value::as_str)
                .ok_or_else(|| err("pageLink sin pageId"))?;
            if !crate::ids::is_uuid_like(pid) {
                return Err(err("pageId inválido"));
            }
            w.links.push((pid.to_string(), block_id.to_string()));
            // El título mostrado se resuelve al renderizar; el nodo no lleva texto.
            walk_children = false;
        }
        "subpage" => {
            let pid = get_attr("pageId")
                .and_then(Value::as_str)
                .ok_or_else(|| err("subpage sin pageId"))?;
            if !crate::ids::is_uuid_like(pid) {
                return Err(err("pageId inválido"));
            }
            walk_children = false;
        }
        "text" => {
            let t = obj
                .get("text")
                .and_then(Value::as_str)
                .ok_or_else(|| err("text sin texto"))?;
            w.text_bytes += t.len();
            if w.text_bytes > MAX_TEXT_BYTES {
                return Err(err("el texto del documento supera el máximo"));
            }
            check_marks(node)?;
            w.text.push_str(t);
            walk_children = false;
        }
        other => return Err(err(format!("tipo de bloque no permitido: {other}"))),
    }

    if walk_children {
        if let Some(content) = obj.get("content") {
            let children = content
                .as_array()
                .ok_or_else(|| err("content debe ser lista"))?;
            for child in children {
                // Los hijos heredan el blockId del bloque de nivel superior.
                walk_node(child, w, depth + 1, block_id)?;
            }
            // Separación de texto entre sub-bloques.
            if matches!(ty, "listItem" | "taskItem" | "blockquote" | "callout")
                && !w.text.is_empty()
                && !w.text.ends_with('\n')
            {
                w.text.push('\n');
            }
        }
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn doc(inner: &str) -> String {
        format!(r#"{{"type":"doc","content":[{inner}]}}"#)
    }

    #[test]
    fn accepts_basic_paragraph() {
        let d = doc(
            r#"{"type":"paragraph","attrs":{"blockId":"b1"},"content":[{"type":"text","text":"Hola mundo"}]}"#,
        );
        let p = validate_and_project(&d).unwrap();
        assert_eq!(p.text, "Hola mundo");
    }

    #[test]
    fn rejects_unknown_node() {
        let d = doc(r#"{"type":"script","content":[]}"#);
        assert!(validate_and_project(&d).is_err());
    }

    #[test]
    fn rejects_javascript_href() {
        let d = doc(
            r#"{"type":"paragraph","content":[{"type":"text","text":"x","marks":[{"type":"link","attrs":{"href":"javascript:alert(1)"}}]}]}"#,
        );
        assert!(validate_and_project(&d).is_err());
    }

    #[test]
    fn extracts_links_and_attachments() {
        let pid = "7d444840-9dc0-11d1-b245-5ffdce74fad2";
        let att = "9d444840-9dc0-11d1-b245-5ffdce74fad2";
        let d = doc(&format!(
            r#"{{"type":"paragraph","attrs":{{"blockId":"blk-1"}},"content":[{{"type":"pageLink","attrs":{{"pageId":"{pid}"}}}}]}},{{"type":"image","attrs":{{"attachmentId":"{att}","blockId":"blk-2"}}}}"#
        ));
        let p = validate_and_project(&d).unwrap();
        assert_eq!(p.links, vec![(pid.to_string(), "blk-1".to_string())]);
        assert_eq!(p.attachments, vec![att.to_string()]);
    }

    #[test]
    fn text_projection_separates_blocks() {
        let d = doc(
            r#"{"type":"heading","attrs":{"level":2},"content":[{"type":"text","text":"Título"}]},{"type":"paragraph","content":[{"type":"text","text":"Cuerpo"}]}"#,
        );
        let p = validate_and_project(&d).unwrap();
        assert_eq!(p.text, "Título\nCuerpo");
    }

    #[test]
    fn rejects_heading_level_4() {
        let d = doc(r#"{"type":"heading","attrs":{"level":4},"content":[]}"#);
        assert!(validate_and_project(&d).is_err());
    }

    #[test]
    fn handles_multilingual_and_emoji() {
        let d = doc(
            r#"{"type":"paragraph","content":[{"type":"text","text":"日本語 中文 emoji 🚀 ñáéíóú"}]}"#,
        );
        let p = validate_and_project(&d).unwrap();
        assert!(p.text.contains("🚀"));
        assert!(p.text.contains("日本語"));
    }
}
