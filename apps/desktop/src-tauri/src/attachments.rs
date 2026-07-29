//! Adjuntos: carpeta gestionada, nombres físicos por UUID, MIME por magic
//! bytes, hash SHA-256 para deduplicación e integridad
//! (docs/SECURITY_ARCHITECTURE.md, docs/DATA_MODEL.md).

use std::path::PathBuf;

use rusqlite::{params, OptionalExtension};
use serde::Serialize;

use crate::db::sha256_hex;
use crate::error::{NodoraError, Result};
use crate::ids::{new_id, now_iso};
use crate::workspace::OpenWorkspace;

pub const MAX_ATTACHMENT_BYTES: usize = 50 * 1024 * 1024;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AttachmentInfo {
    pub id: String,
    pub original_name: String,
    pub mime: String,
    pub size_bytes: i64,
    pub sha256: String,
}

/// Tipos de imagen permitidos en el MVP, detectados por contenido.
fn sniff_image(bytes: &[u8]) -> Option<(&'static str, &'static str)> {
    if bytes.starts_with(b"\x89PNG\r\n\x1a\n") {
        Some(("image/png", "png"))
    } else if bytes.starts_with(b"\xFF\xD8\xFF") {
        Some(("image/jpeg", "jpg"))
    } else if bytes.starts_with(b"GIF87a") || bytes.starts_with(b"GIF89a") {
        Some(("image/gif", "gif"))
    } else if bytes.len() > 12 && &bytes[0..4] == b"RIFF" && &bytes[8..12] == b"WEBP" {
        Some(("image/webp", "webp"))
    } else {
        None
    }
}

fn ext_for_mime(mime: &str) -> &'static str {
    match mime {
        "image/png" => "png",
        "image/jpeg" => "jpg",
        "image/gif" => "gif",
        "image/webp" => "webp",
        _ => "bin",
    }
}

/// Importa bytes como adjunto. Deduplica por hash: si ya existe un adjunto
/// idéntico, devuelve el existente (e incrementa ref_count).
pub fn import_bytes(
    ws: &OpenWorkspace,
    bytes: &[u8],
    original_name: &str,
) -> Result<AttachmentInfo> {
    if bytes.len() > MAX_ATTACHMENT_BYTES {
        return Err(NodoraError::AttachmentTooLarge);
    }
    let (mime, ext) = sniff_image(bytes).ok_or(NodoraError::AttachmentTypeForbidden)?;
    let hash = sha256_hex(bytes);

    let existing: Option<AttachmentInfo> = ws
        .conn
        .query_row(
            "SELECT id, original_name, mime, size_bytes, sha256 FROM attachments
             WHERE sha256 = ?1 AND deleted_at IS NULL",
            [&hash],
            |r| {
                Ok(AttachmentInfo {
                    id: r.get(0)?,
                    original_name: r.get(1)?,
                    mime: r.get(2)?,
                    size_bytes: r.get(3)?,
                    sha256: r.get(4)?,
                })
            },
        )
        .optional()?;
    if let Some(info) = existing {
        // El archivo físico debe existir; si falta (workspace copiado a
        // medias), lo re-escribimos.
        let path = ws
            .attachments_dir()
            .join(format!("{}.{}", info.id, ext_for_mime(&info.mime)));
        if !path.exists() {
            std::fs::write(&path, bytes)?;
        }
        ws.conn.execute(
            "UPDATE attachments SET ref_count = ref_count + 1, updated_at = ?1 WHERE id = ?2",
            params![now_iso(), info.id],
        )?;
        return Ok(info);
    }

    let id = new_id();
    let file_name = format!("{id}.{ext}");
    let path = ws.attachments_dir().join(&file_name);
    std::fs::write(&path, bytes)?;

    let now = now_iso();
    // Nombre original saneado: solo informativo, longitud limitada.
    let safe_name: String = original_name.chars().take(255).collect();
    ws.conn.execute(
        "INSERT INTO attachments (id, workspace_id, original_name, mime, size_bytes, sha256,
            created_at, updated_at, created_by, updated_by, device_id)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?7, ?8, ?8, ?9)",
        params![
            id,
            ws.ctx.workspace_id,
            safe_name,
            mime,
            bytes.len() as i64,
            hash,
            now,
            ws.ctx.user_id,
            ws.ctx.device_id
        ],
    )?;
    Ok(AttachmentInfo {
        id,
        original_name: safe_name,
        mime: mime.to_string(),
        size_bytes: bytes.len() as i64,
        sha256: hash,
    })
}

/// Importa un archivo del disco del usuario (elegido con diálogo nativo).
pub fn import_from_path(ws: &OpenWorkspace, src: &str) -> Result<AttachmentInfo> {
    let path = PathBuf::from(src);
    let meta = std::fs::metadata(&path)?;
    if !meta.is_file() {
        return Err(NodoraError::InvalidInput("la ruta no es un archivo".into()));
    }
    if meta.len() as usize > MAX_ATTACHMENT_BYTES {
        return Err(NodoraError::AttachmentTooLarge);
    }
    let bytes = std::fs::read(&path)?;
    let name = path
        .file_name()
        .map(|n| n.to_string_lossy().into_owned())
        .unwrap_or_else(|| "archivo".into());
    import_bytes(ws, &bytes, &name)
}

pub fn get_info(ws: &OpenWorkspace, id: &str) -> Result<AttachmentInfo> {
    ws.conn
        .query_row(
            "SELECT id, original_name, mime, size_bytes, sha256 FROM attachments
             WHERE id = ?1 AND deleted_at IS NULL",
            [id],
            |r| {
                Ok(AttachmentInfo {
                    id: r.get(0)?,
                    original_name: r.get(1)?,
                    mime: r.get(2)?,
                    size_bytes: r.get(3)?,
                    sha256: r.get(4)?,
                })
            },
        )
        .optional()?
        .ok_or(NodoraError::AttachmentNotFound)
}

/// Ruta absoluta del archivo físico (para convertFileSrc en el frontend).
/// Falla con ATTACHMENT_NOT_FOUND si el archivo no está en disco: la UI
/// muestra el estado de error recuperable (PRD R8.3).
pub fn resolve_path(ws: &OpenWorkspace, id: &str) -> Result<PathBuf> {
    let info = get_info(ws, id)?;
    let path = ws
        .attachments_dir()
        .join(format!("{}.{}", info.id, ext_for_mime(&info.mime)));
    if !path.exists() {
        return Err(NodoraError::AttachmentNotFound);
    }
    Ok(path)
}

/// Verifica integridad del archivo contra su hash registrado.
pub fn verify(ws: &OpenWorkspace, id: &str) -> Result<bool> {
    let info = get_info(ws, id)?;
    let path = ws
        .attachments_dir()
        .join(format!("{}.{}", info.id, ext_for_mime(&info.mime)));
    if !path.exists() {
        return Ok(false);
    }
    let bytes = std::fs::read(path)?;
    Ok(sha256_hex(&bytes) == info.sha256)
}

/// Resultado de una recolección de adjuntos sin referencias.
#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CleanupReport {
    /// Adjuntos que ninguna página viva referencia.
    pub unreferenced: i64,
    /// Bytes que ocupaban esos adjuntos.
    pub bytes_freed: i64,
    /// Archivos presentes en la carpeta sin fila en la base de datos.
    pub orphan_files: i64,
    /// Falso cuando solo se ha simulado.
    pub applied: bool,
}

/// Recolecta los adjuntos que ya no referencia ninguna página viva
/// (deuda D1 de docs/TECHNICAL_DEBT.md).
///
/// La verdad son los documentos, no el contador `ref_count`: se recorren
/// todas las páginas no borradas, se extraen las referencias reales y se
/// recalcula el contador. Con `dry_run` solo informa, sin tocar nada.
pub fn collect_unreferenced(ws: &OpenWorkspace, dry_run: bool) -> Result<CleanupReport> {
    use std::collections::{HashMap, HashSet};

    // Referencias reales según el contenido de las páginas vivas.
    let mut referenced: HashMap<String, i64> = HashMap::new();
    {
        let mut stmt = ws
            .conn
            .prepare("SELECT content_json FROM pages WHERE deleted_at IS NULL")?;
        let docs = stmt.query_map([], |r| r.get::<_, String>(0))?;
        for doc in docs {
            let doc = doc?;
            // Un documento corrupto no debe provocar borrados: se ignora su
            // aportación y se conserva lo que referencie el resto.
            if let Ok(projection) = crate::validate::validate_and_project(&doc) {
                for att in projection.attachments {
                    *referenced.entry(att).or_insert(0) += 1;
                }
            }
        }
    }

    // Las portadas de página también son referencias, y no viven en el
    // documento: sin contarlas aquí, el recolector borraría la imagen de
    // portada de cualquier página por considerarla no usada.
    {
        let mut stmt = ws.conn.prepare(
            "SELECT cover_value FROM pages
             WHERE cover_kind = 'attachment' AND cover_value IS NOT NULL
               AND deleted_at IS NULL",
        )?;
        let covers = stmt.query_map([], |r| r.get::<_, String>(0))?;
        for cover in covers {
            *referenced.entry(cover?).or_insert(0) += 1;
        }
    }

    // Filas de adjuntos registradas.
    let rows: Vec<(String, String, i64)> = {
        let mut stmt = ws
            .conn
            .prepare("SELECT id, mime, size_bytes FROM attachments WHERE deleted_at IS NULL")?;
        let mapped = stmt.query_map([], |r| Ok((r.get(0)?, r.get(1)?, r.get(2)?)))?;
        mapped.collect::<std::result::Result<Vec<_>, _>>()?
    };

    let mut unreferenced = 0i64;
    let mut bytes_freed = 0i64;
    let mut known_files: HashSet<String> = HashSet::new();
    let now = now_iso();

    for (id, mime, size) in &rows {
        let file_name = format!("{}.{}", id, ext_for_mime(mime));
        let count = referenced.get(id).copied().unwrap_or(0);
        if count == 0 {
            unreferenced += 1;
            bytes_freed += size;
            if !dry_run {
                let path = ws.attachments_dir().join(&file_name);
                if path.exists() {
                    std::fs::remove_file(&path)?;
                }
                // Tombstone: la fila se conserva para poder replicar la
                // eliminación cuando exista sincronización.
                ws.conn.execute(
                    "UPDATE attachments SET deleted_at = ?1, ref_count = 0, updated_at = ?1,
                     version = version + 1 WHERE id = ?2",
                    params![now, id],
                )?;
            }
        } else {
            known_files.insert(file_name);
            if !dry_run {
                ws.conn.execute(
                    "UPDATE attachments SET ref_count = ?1, updated_at = ?2 WHERE id = ?3",
                    params![count, now, id],
                )?;
            }
        }
    }

    // Archivos presentes en la carpeta que ninguna fila reconoce: se informan
    // pero NUNCA se borran automáticamente (podrían venir de una copia a
    // medias y borrarlos sería destruir datos del usuario).
    let mut orphan_files = 0i64;
    if ws.attachments_dir().exists() {
        for entry in std::fs::read_dir(ws.attachments_dir())? {
            let entry = entry?;
            if !entry.path().is_file() {
                continue;
            }
            let name = entry.file_name().to_string_lossy().into_owned();
            let id = name.split('.').next().unwrap_or_default().to_string();
            let registered: Option<i64> = ws
                .conn
                .query_row("SELECT 1 FROM attachments WHERE id = ?1", [&id], |r| {
                    r.get(0)
                })
                .optional()?;
            if registered.is_none() {
                orphan_files += 1;
            }
        }
    }

    Ok(CleanupReport {
        unreferenced,
        bytes_freed,
        orphan_files,
        applied: !dry_run,
    })
}
