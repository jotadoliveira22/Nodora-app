//! Apertura de SQLite y migraciones versionadas con checksum
//! (docs/MIGRATION_STRATEGY.md).

use std::path::Path;
use std::time::Duration;

use rusqlite::Connection;
use sha2::{Digest, Sha256};

use crate::error::{NodoraError, Result};
use crate::ids::now_iso;

pub struct Migration {
    pub version: i64,
    pub name: &'static str,
    pub sql: &'static str,
}

pub const WORKSPACE_MIGRATIONS: &[Migration] = &[Migration {
    version: 1,
    name: "init",
    sql: include_str!("../../../../migrations/workspace/001_init.sql"),
}];

pub const APP_MIGRATIONS: &[Migration] = &[Migration {
    version: 1,
    name: "init",
    sql: include_str!("../../../../migrations/app/001_init.sql"),
}];

pub fn sha256_hex(bytes: &[u8]) -> String {
    let mut hasher = Sha256::new();
    hasher.update(bytes);
    let out = hasher.finalize();
    out.iter().map(|b| format!("{b:02x}")).collect()
}

/// Abre una conexión con los PRAGMA de docs/DATA_MODEL.md y aplica las
/// migraciones pendientes. Si el archivo pertenece a una versión más nueva o
/// una migración aplicada no coincide con la embebida, se niega a abrir.
pub fn open_with_migrations(path: &Path, migrations: &[Migration]) -> Result<Connection> {
    let mut conn = Connection::open(path)?;
    // journal_mode devuelve una fila: hay que consultarla, no ejecutarla.
    let _mode: String = conn.query_row("PRAGMA journal_mode=WAL", [], |r| r.get(0))?;
    conn.pragma_update(None, "foreign_keys", "ON")?;
    conn.pragma_update(None, "synchronous", "NORMAL")?;
    conn.busy_timeout(Duration::from_millis(5000))?;
    migrate(&mut conn, migrations)?;
    Ok(conn)
}

pub fn migrate(conn: &mut Connection, migrations: &[Migration]) -> Result<()> {
    conn.execute_batch(
        "CREATE TABLE IF NOT EXISTS schema_migrations (
           version INTEGER PRIMARY KEY,
           name TEXT NOT NULL,
           applied_at TEXT NOT NULL,
           checksum TEXT NOT NULL
         );",
    )?;
    let current: i64 = conn.query_row(
        "SELECT COALESCE(MAX(version),0) FROM schema_migrations",
        [],
        |r| r.get(0),
    )?;
    let max_known = migrations.iter().map(|m| m.version).max().unwrap_or(0);
    if current > max_known {
        return Err(NodoraError::SchemaTooNew);
    }
    // Verifica que las migraciones ya aplicadas no hayan cambiado.
    for m in migrations.iter().filter(|m| m.version <= current) {
        let stored: Option<String> = conn
            .query_row(
                "SELECT checksum FROM schema_migrations WHERE version = ?1",
                [m.version],
                |r| r.get(0),
            )
            .map(Some)
            .or_else(|e| match e {
                rusqlite::Error::QueryReturnedNoRows => Ok(None),
                other => Err(other),
            })?;
        match stored {
            None => {
                return Err(NodoraError::MigrationFailed(format!(
                    "falta el registro de la migración {}",
                    m.version
                )))
            }
            Some(cs) if cs != sha256_hex(m.sql.as_bytes()) => {
                return Err(NodoraError::MigrationFailed(format!(
                    "checksum de la migración {} no coincide",
                    m.version
                )))
            }
            _ => {}
        }
    }
    // Aplica las pendientes, cada una en su propia transacción.
    let mut pending: Vec<&Migration> = migrations.iter().filter(|m| m.version > current).collect();
    pending.sort_by_key(|m| m.version);
    for m in pending {
        let tx = conn.transaction()?;
        tx.execute_batch(m.sql)
            .map_err(|e| NodoraError::MigrationFailed(format!("migración {}: {e}", m.version)))?;
        tx.execute(
            "INSERT INTO schema_migrations (version, name, applied_at, checksum) VALUES (?1, ?2, ?3, ?4)",
            rusqlite::params![m.version, m.name, now_iso(), sha256_hex(m.sql.as_bytes())],
        )?;
        tx.commit()?;
        tracing::info!(version = m.version, name = m.name, "migración aplicada");
    }
    Ok(())
}

pub fn schema_version(conn: &Connection) -> Result<i64> {
    Ok(conn.query_row(
        "SELECT COALESCE(MAX(version),0) FROM schema_migrations",
        [],
        |r| r.get(0),
    )?)
}

/// Comprobación rápida de integridad al abrir (docs/THREAT_MODEL.md T10).
pub fn quick_check(conn: &Connection) -> Result<()> {
    let res: String = conn.query_row("PRAGMA quick_check", [], |r| r.get(0))?;
    if res == "ok" {
        Ok(())
    } else {
        Err(NodoraError::MigrationFailed(format!("integridad: {res}")))
    }
}

/// Comprobación completa (usada al validar respaldos).
pub fn integrity_check(conn: &Connection) -> Result<()> {
    let res: String = conn.query_row("PRAGMA integrity_check", [], |r| r.get(0))?;
    if res == "ok" {
        Ok(())
    } else {
        Err(NodoraError::BackupInvalid(format!("integridad: {res}")))
    }
}
