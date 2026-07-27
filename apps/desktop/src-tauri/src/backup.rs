//! Respaldos: ZIP con snapshot consistente de la base (VACUUM INTO),
//! adjuntos y manifiesto con hashes. La restauración valida TODO antes de
//! escribir y nunca sobreescribe un workspace existente
//! (docs/USER_FLOWS.md F10, docs/THREAT_MODEL.md T9).

use std::io::{Read, Write};
use std::path::{Path, PathBuf};

use serde::{Deserialize, Serialize};
use zip::write::SimpleFileOptions;

use crate::db::{self, sha256_hex};
use crate::error::{NodoraError, Result};
use crate::ids::now_iso;
use crate::registry::Registry;
use crate::workspace::{self, OpenWorkspace};

pub const BACKUP_FORMAT_VERSION: i64 = 1;

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ManifestFile {
    pub name: String,
    pub sha256: String,
    pub size: u64,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Manifest {
    pub format_version: i64,
    pub schema_version: i64,
    pub workspace_id: String,
    pub workspace_name: String,
    pub created_at: String,
    pub page_count: i64,
    pub attachment_count: i64,
    pub files: Vec<ManifestFile>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BackupSummary {
    pub format_version: i64,
    pub schema_version: i64,
    pub workspace_name: String,
    pub created_at: String,
    pub page_count: i64,
    pub attachment_count: i64,
}

/// Crea un respaldo en `dest_dir` y devuelve la ruta del ZIP.
pub fn create_backup(ws: &OpenWorkspace, dest_dir: &Path) -> Result<PathBuf> {
    std::fs::create_dir_all(dest_dir)?;
    let stamp = chrono::Utc::now().format("%Y%m%d-%H%M%S");
    let info = ws.info()?;
    let zip_path = dest_dir.join(format!(
        "nodora-backup-{}-{stamp}.zip",
        sanitize_component(&info.name)
    ));

    // Snapshot consistente de la base (WAL incluido) via VACUUM INTO.
    let tmp_db = std::env::temp_dir().join(format!("nodora-vacuum-{}.db", uuid::Uuid::new_v4()));
    ws.conn
        .execute("VACUUM INTO ?1", [tmp_db.to_string_lossy()])
        .map_err(NodoraError::Storage)?;

    let result = (|| -> Result<PathBuf> {
        let mut files: Vec<ManifestFile> = Vec::new();
        let db_bytes = std::fs::read(&tmp_db)?;
        files.push(ManifestFile {
            name: "nodora.db".into(),
            sha256: sha256_hex(&db_bytes),
            size: db_bytes.len() as u64,
        });

        // Adjuntos presentes en disco.
        let mut attachment_entries: Vec<(String, Vec<u8>)> = Vec::new();
        let att_dir = ws.attachments_dir();
        if att_dir.exists() {
            let mut names: Vec<_> = std::fs::read_dir(&att_dir)?
                .filter_map(|e| e.ok())
                .filter(|e| e.path().is_file())
                .map(|e| e.file_name().to_string_lossy().into_owned())
                .collect();
            names.sort();
            for name in names {
                let bytes = std::fs::read(att_dir.join(&name))?;
                files.push(ManifestFile {
                    name: format!("attachments/{name}"),
                    sha256: sha256_hex(&bytes),
                    size: bytes.len() as u64,
                });
                attachment_entries.push((name, bytes));
            }
        }

        let page_count: i64 = ws.conn.query_row(
            "SELECT COUNT(*) FROM pages WHERE deleted_at IS NULL",
            [],
            |r| r.get(0),
        )?;
        let manifest = Manifest {
            format_version: BACKUP_FORMAT_VERSION,
            schema_version: db::schema_version(&ws.conn)?,
            workspace_id: ws.ctx.workspace_id.clone(),
            workspace_name: info.name.clone(),
            created_at: now_iso(),
            page_count,
            attachment_count: attachment_entries.len() as i64,
            files,
        };

        let file = std::fs::File::create(&zip_path)?;
        let mut zipw = zip::ZipWriter::new(file);
        let opts =
            SimpleFileOptions::default().compression_method(zip::CompressionMethod::Deflated);
        zipw.start_file("manifest.json", opts)
            .map_err(|e| NodoraError::Internal(format!("zip: {e}")))?;
        zipw.write_all(
            serde_json::to_string_pretty(&manifest)
                .map_err(|e| NodoraError::Internal(format!("manifest: {e}")))?
                .as_bytes(),
        )?;
        zipw.start_file("nodora.db", opts)
            .map_err(|e| NodoraError::Internal(format!("zip: {e}")))?;
        zipw.write_all(&db_bytes)?;
        for (name, bytes) in &attachment_entries {
            zipw.start_file(format!("attachments/{name}"), opts)
                .map_err(|e| NodoraError::Internal(format!("zip: {e}")))?;
            zipw.write_all(bytes)?;
        }
        zipw.finish()
            .map_err(|e| NodoraError::Internal(format!("zip: {e}")))?;
        Ok(zip_path.clone())
    })();

    let _ = std::fs::remove_file(&tmp_db);
    result
}

fn sanitize_component(name: &str) -> String {
    let s: String = name
        .chars()
        .map(|c| {
            if c.is_alphanumeric() || c == '-' || c == '_' {
                c
            } else {
                '-'
            }
        })
        .collect();
    let trimmed = s.trim_matches('-');
    if trimmed.is_empty() {
        "workspace".into()
    } else {
        trimmed.chars().take(40).collect()
    }
}

fn read_zip_entry(archive: &mut zip::ZipArchive<std::fs::File>, name: &str) -> Result<Vec<u8>> {
    let mut entry = archive
        .by_name(name)
        .map_err(|_| NodoraError::BackupInvalid(format!("falta {name}")))?;
    let mut buf = Vec::new();
    entry.read_to_end(&mut buf)?;
    Ok(buf)
}

fn entry_name_is_safe(name: &str) -> bool {
    // Anti zip-slip: sin rutas absolutas, sin '..', separadores normales.
    !name.starts_with('/')
        && !name.contains("..")
        && !name.contains('\\')
        && (name == "manifest.json"
            || name == "nodora.db"
            || (name.starts_with("attachments/") && name.len() > "attachments/".len()))
}

/// Valida un ZIP de respaldo por completo (manifiesto, hashes, integridad
/// SQLite y versión de schema) SIN tocar ningún dato existente.
pub fn validate_backup(zip_path: &Path) -> Result<BackupSummary> {
    let file = std::fs::File::open(zip_path)
        .map_err(|_| NodoraError::BackupInvalid("no se puede abrir el archivo".into()))?;
    let mut archive = zip::ZipArchive::new(file)
        .map_err(|_| NodoraError::BackupInvalid("no es un ZIP válido".into()))?;

    for i in 0..archive.len() {
        let entry = archive
            .by_index(i)
            .map_err(|_| NodoraError::BackupInvalid("entrada ilegible".into()))?;
        if !entry_name_is_safe(entry.name()) {
            return Err(NodoraError::BackupInvalid(format!(
                "entrada no permitida: {}",
                entry.name()
            )));
        }
    }

    let manifest_bytes = read_zip_entry(&mut archive, "manifest.json")?;
    let manifest: Manifest = serde_json::from_slice(&manifest_bytes)
        .map_err(|_| NodoraError::BackupInvalid("manifiesto ilegible".into()))?;
    if manifest.format_version > BACKUP_FORMAT_VERSION {
        return Err(NodoraError::BackupInvalid(
            "el respaldo fue creado por una versión más nueva de Nodora".into(),
        ));
    }
    let max_schema = db::WORKSPACE_MIGRATIONS
        .iter()
        .map(|m| m.version)
        .max()
        .unwrap_or(0);
    if manifest.schema_version > max_schema {
        return Err(NodoraError::BackupInvalid(
            "el respaldo requiere una versión más nueva de Nodora".into(),
        ));
    }

    // Verifica hash y tamaño de cada archivo declarado.
    for f in &manifest.files {
        let bytes = read_zip_entry(&mut archive, &f.name)?;
        if bytes.len() as u64 != f.size || sha256_hex(&bytes) != f.sha256 {
            return Err(NodoraError::BackupInvalid(format!(
                "hash no coincide: {}",
                f.name
            )));
        }
    }

    // Integridad real de la base: se extrae a temporal y se comprueba.
    let db_bytes = read_zip_entry(&mut archive, "nodora.db")?;
    let tmp = std::env::temp_dir().join(format!("nodora-validate-{}.db", uuid::Uuid::new_v4()));
    std::fs::write(&tmp, &db_bytes)?;
    let check = (|| -> Result<()> {
        let conn = rusqlite::Connection::open(&tmp)?;
        db::integrity_check(&conn)?;
        // Debe contener exactamente las tablas esperadas de Nodora.
        let n: i64 = conn.query_row(
            "SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name IN ('workspaces','pages')",
            [],
            |r| r.get(0),
        )?;
        if n != 2 {
            return Err(NodoraError::BackupInvalid(
                "no es una base de Nodora".into(),
            ));
        }
        Ok(())
    })();
    let _ = std::fs::remove_file(&tmp);
    check?;

    Ok(BackupSummary {
        format_version: manifest.format_version,
        schema_version: manifest.schema_version,
        workspace_name: manifest.workspace_name,
        created_at: manifest.created_at,
        page_count: manifest.page_count,
        attachment_count: manifest.attachment_count,
    })
}

/// Restaura un respaldo como workspace NUEVO bajo `dest_parent` y lo
/// registra. Devuelve la ruta del workspace restaurado.
pub fn restore_backup(registry: &Registry, zip_path: &Path, dest_parent: &Path) -> Result<PathBuf> {
    let summary = validate_backup(zip_path)?;

    let base = format!("{}-restaurado", sanitize_component(&summary.workspace_name));
    let mut target = dest_parent.join(&base);
    let mut n = 1;
    while target.exists() {
        target = dest_parent.join(format!("{base}-{n}"));
        n += 1;
    }
    std::fs::create_dir_all(&target)?;
    std::fs::create_dir_all(target.join(workspace::ATTACHMENTS_DIR))?;
    std::fs::create_dir_all(target.join(workspace::BACKUPS_DIR))?;

    let file = std::fs::File::open(zip_path)?;
    let mut archive = zip::ZipArchive::new(file)
        .map_err(|_| NodoraError::BackupInvalid("no es un ZIP válido".into()))?;
    for i in 0..archive.len() {
        let mut entry = archive
            .by_index(i)
            .map_err(|_| NodoraError::BackupInvalid("entrada ilegible".into()))?;
        let name = entry.name().to_string();
        if name == "manifest.json" || !entry_name_is_safe(&name) {
            continue;
        }
        let out_path = target.join(&name);
        if let Some(parent) = out_path.parent() {
            std::fs::create_dir_all(parent)?;
        }
        let mut out = std::fs::File::create(&out_path)?;
        std::io::copy(&mut entry, &mut out)?;
    }

    // Verificación final: el workspace restaurado abre y migra correctamente.
    let ws = workspace::open_workspace(&target, &registry.device_id)?;
    let info = ws.info()?;
    registry.remember(&info.id, &info.name, &target)?;
    Ok(target)
}
