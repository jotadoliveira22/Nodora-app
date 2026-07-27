//! Comandos IPC. Capa fina: valida/deserializa y delega en los módulos de
//! dominio. El frontend solo conoce estos comandos (docs/ARCHITECTURE.md).

use std::path::PathBuf;

use base64::Engine;
use tauri::{AppHandle, Manager, State};

use crate::attachments::{self, AttachmentInfo, CleanupReport};
use crate::backup::{self, BackupSummary};
use crate::dbview::{
    self, ConversionReport, DatabaseDetail, DatabaseProperty, RecordFilter, RecordRow, RecordSort,
};
use crate::error::{NodoraError, Result};
use crate::export;
use crate::pages::{self, BacklinkItem, Crumb, PageDetail, PageSummary, SaveResult};
use crate::registry::KnownWorkspace;
use crate::search::{self, SearchResultItem};
use crate::state::AppState;
use crate::workspace::{self, WorkspaceInfo};

fn allow_attachments_scope(app: &AppHandle, ws: &workspace::OpenWorkspace) {
    // Habilita el protocolo asset SOLO para la carpeta de adjuntos del
    // workspace abierto (docs/SECURITY_ARCHITECTURE.md).
    let dir = ws.attachments_dir();
    if let Err(e) = app.asset_protocol_scope().allow_directory(&dir, false) {
        tracing::error!(error = %e, "no se pudo habilitar el scope de adjuntos");
    }
}

// ---- Aplicación / workspaces -------------------------------------------------

#[tauri::command]
pub fn list_known_workspaces(state: State<'_, AppState>) -> Result<Vec<KnownWorkspace>> {
    state.with_registry(|r| r.list())
}

#[tauri::command]
pub fn create_workspace(
    app: AppHandle,
    state: State<'_, AppState>,
    name: String,
    icon: Option<String>,
    parent_dir: Option<String>,
) -> Result<WorkspaceInfo> {
    let parent = match parent_dir {
        Some(p) => export::ensure_safe_dir(&p)?,
        None => crate::registry::Registry::default_workspaces_dir(&state.data_dir),
    };
    // Carpeta única derivada del nombre.
    let base: String = name
        .trim()
        .chars()
        .map(|c| {
            if c.is_alphanumeric() {
                c.to_ascii_lowercase()
            } else {
                '-'
            }
        })
        .collect::<String>()
        .trim_matches('-')
        .chars()
        .take(40)
        .collect();
    let base = if base.is_empty() {
        "espacio".to_string()
    } else {
        base
    };
    let mut dir = parent.join(&base);
    let mut n = 1;
    while dir.join(workspace::DB_FILE).exists()
        || (dir.exists()
            && dir
                .read_dir()
                .map(|mut d| d.next().is_some())
                .unwrap_or(false))
    {
        dir = parent.join(format!("{base}-{n}"));
        n += 1;
    }
    let device_id = state.with_registry(|r| Ok(r.device_id.clone()))?;
    let ws = workspace::create_workspace(&dir, &name, icon.as_deref(), &device_id)?;
    let info = ws.info()?;
    state.with_registry(|r| r.remember(&info.id, &info.name, &ws.path))?;
    allow_attachments_scope(&app, &ws);
    *state
        .workspace
        .lock()
        .map_err(|_| NodoraError::Internal("lock".into()))? = Some(ws);
    Ok(info)
}

#[tauri::command]
pub fn open_workspace(
    app: AppHandle,
    state: State<'_, AppState>,
    path: String,
) -> Result<WorkspaceInfo> {
    let dir = export::ensure_safe_dir(&path)?;
    let device_id = state.with_registry(|r| Ok(r.device_id.clone()))?;
    let ws = workspace::open_workspace(&dir, &device_id)?;
    let info = ws.info()?;
    state.with_registry(|r| r.remember(&info.id, &info.name, &ws.path))?;
    allow_attachments_scope(&app, &ws);
    *state
        .workspace
        .lock()
        .map_err(|_| NodoraError::Internal("lock".into()))? = Some(ws);
    Ok(info)
}

#[tauri::command]
pub fn open_last_workspace(
    app: AppHandle,
    state: State<'_, AppState>,
) -> Result<Option<WorkspaceInfo>> {
    let last = state.with_registry(|r| r.last_opened())?;
    match last {
        None => Ok(None),
        Some(k) => match open_workspace(app, state, k.path.clone()) {
            Ok(info) => Ok(Some(info)),
            Err(NodoraError::WorkspaceNotFound) => Ok(None),
            Err(e) => Err(e),
        },
    }
}

#[tauri::command]
pub fn current_workspace(state: State<'_, AppState>) -> Result<Option<WorkspaceInfo>> {
    let guard = state
        .workspace
        .lock()
        .map_err(|_| NodoraError::Internal("lock".into()))?;
    match guard.as_ref() {
        None => Ok(None),
        Some(ws) => Ok(Some(ws.info()?)),
    }
}

#[tauri::command]
pub fn close_workspace(state: State<'_, AppState>) -> Result<()> {
    *state
        .workspace
        .lock()
        .map_err(|_| NodoraError::Internal("lock".into()))? = None;
    Ok(())
}

#[tauri::command]
pub fn forget_workspace(state: State<'_, AppState>, path: String) -> Result<()> {
    state.with_registry(|r| r.forget(&PathBuf::from(path)))
}

#[tauri::command]
pub fn rename_workspace(state: State<'_, AppState>, name: String) -> Result<()> {
    let info = state.with_ws(|ws| {
        workspace::rename_workspace(ws, &name)?;
        ws.info()
    })?;
    state.with_registry(|r| r.remember(&info.id, &info.name, &PathBuf::from(&info.path)))
}

#[tauri::command]
pub fn set_workspace_icon(state: State<'_, AppState>, icon: Option<String>) -> Result<()> {
    state.with_ws(|ws| workspace::set_workspace_icon(ws, icon.as_deref()))
}

#[tauri::command]
pub fn get_app_setting(state: State<'_, AppState>, key: String) -> Result<Option<String>> {
    state.with_registry(|r| r.get_setting(&key))
}

#[tauri::command]
pub fn set_app_setting(state: State<'_, AppState>, key: String, value: String) -> Result<()> {
    state.with_registry(|r| r.set_setting(&key, &value))
}

// ---- Páginas -------------------------------------------------------------------

#[tauri::command]
pub fn create_page(
    state: State<'_, AppState>,
    parent_page_id: Option<String>,
    title: String,
    icon: Option<String>,
) -> Result<PageDetail> {
    state.with_ws(|ws| {
        pages::create_page(
            &ws.conn,
            &ws.ctx,
            parent_page_id.as_deref(),
            &title,
            icon.as_deref(),
        )
    })
}

#[tauri::command]
pub fn get_page(state: State<'_, AppState>, id: String) -> Result<PageDetail> {
    state.with_ws(|ws| pages::get_page(&ws.conn, &id))
}

#[tauri::command]
pub fn list_pages(state: State<'_, AppState>) -> Result<Vec<PageSummary>> {
    state.with_ws(|ws| pages::list_pages(&ws.conn))
}

#[tauri::command]
pub fn list_archived_pages(state: State<'_, AppState>) -> Result<Vec<PageSummary>> {
    state.with_ws(|ws| pages::list_archived(&ws.conn))
}

#[tauri::command]
pub fn rename_page(state: State<'_, AppState>, id: String, title: String) -> Result<SaveResult> {
    state.with_ws(|ws| pages::rename_page(&ws.conn, &ws.ctx, &id, &title))
}

#[tauri::command]
pub fn set_page_icon(
    state: State<'_, AppState>,
    id: String,
    icon: Option<String>,
) -> Result<SaveResult> {
    state.with_ws(|ws| pages::set_page_icon(&ws.conn, &ws.ctx, &id, icon.as_deref()))
}

#[tauri::command]
pub fn save_page_content(
    state: State<'_, AppState>,
    id: String,
    content_json: String,
    base_version: i64,
) -> Result<SaveResult> {
    state.with_ws_mut(|ws| {
        let ctx = ws.ctx.clone();
        pages::save_page_content(&mut ws.conn, &ctx, &id, &content_json, base_version)
    })
}

#[tauri::command]
pub fn move_page(
    state: State<'_, AppState>,
    id: String,
    new_parent_id: Option<String>,
    after_id: Option<String>,
) -> Result<()> {
    state.with_ws(|ws| {
        pages::move_page(
            &ws.conn,
            &ws.ctx,
            &id,
            new_parent_id.as_deref(),
            after_id.as_deref(),
        )
    })
}

#[tauri::command]
pub fn duplicate_page(state: State<'_, AppState>, id: String) -> Result<String> {
    state.with_ws_mut(|ws| {
        let ctx = ws.ctx.clone();
        pages::duplicate_page(&mut ws.conn, &ctx, &id)
    })
}

#[tauri::command]
pub fn archive_page(state: State<'_, AppState>, id: String) -> Result<()> {
    state.with_ws_mut(|ws| {
        let ctx = ws.ctx.clone();
        pages::archive_page(&mut ws.conn, &ctx, &id)
    })
}

#[tauri::command]
pub fn restore_page(state: State<'_, AppState>, id: String) -> Result<()> {
    state.with_ws_mut(|ws| {
        let ctx = ws.ctx.clone();
        pages::restore_page(&mut ws.conn, &ctx, &id)
    })
}

#[tauri::command]
pub fn delete_page_permanently(state: State<'_, AppState>, id: String) -> Result<usize> {
    state.with_ws_mut(|ws| {
        let ctx = ws.ctx.clone();
        pages::delete_page_permanently(&mut ws.conn, &ctx, &id)
    })
}

#[tauri::command]
pub fn get_backlinks(state: State<'_, AppState>, id: String) -> Result<Vec<BacklinkItem>> {
    state.with_ws(|ws| pages::backlinks(&ws.conn, &id))
}

#[tauri::command]
pub fn get_breadcrumbs(state: State<'_, AppState>, id: String) -> Result<Vec<Crumb>> {
    state.with_ws(|ws| pages::breadcrumbs(&ws.conn, &id))
}

#[tauri::command]
pub fn add_favorite(state: State<'_, AppState>, id: String) -> Result<()> {
    state.with_ws(|ws| pages::add_favorite(&ws.conn, &ws.ctx, &id))
}

#[tauri::command]
pub fn remove_favorite(state: State<'_, AppState>, id: String) -> Result<()> {
    state.with_ws(|ws| pages::remove_favorite(&ws.conn, &id))
}

#[tauri::command]
pub fn list_favorites(state: State<'_, AppState>) -> Result<Vec<PageSummary>> {
    state.with_ws(|ws| pages::list_favorites(&ws.conn))
}

#[tauri::command]
pub fn is_favorite(state: State<'_, AppState>, id: String) -> Result<bool> {
    state.with_ws(|ws| pages::is_favorite(&ws.conn, &id))
}

#[tauri::command]
pub fn touch_recent(state: State<'_, AppState>, id: String) -> Result<()> {
    state.with_ws(|ws| pages::touch_recent(&ws.conn, &id))
}

#[tauri::command]
pub fn list_recents(state: State<'_, AppState>, limit: Option<i64>) -> Result<Vec<PageSummary>> {
    state.with_ws(|ws| pages::list_recents(&ws.conn, limit.unwrap_or(12)))
}

#[tauri::command]
pub fn linkable_pages(
    state: State<'_, AppState>,
    query: String,
    limit: Option<i64>,
) -> Result<Vec<PageSummary>> {
    state.with_ws(|ws| pages::linkable_pages(&ws.conn, &query, limit.unwrap_or(20)))
}

// ---- Búsqueda --------------------------------------------------------------------

#[tauri::command]
pub fn search_pages(
    state: State<'_, AppState>,
    query: String,
    include_archived: Option<bool>,
    titles_only: Option<bool>,
    limit: Option<i64>,
) -> Result<Vec<SearchResultItem>> {
    state.with_ws(|ws| {
        search::search(
            &ws.conn,
            &query,
            include_archived.unwrap_or(false),
            titles_only.unwrap_or(false),
            limit.unwrap_or(30),
        )
    })
}

// ---- Bases de datos ----------------------------------------------------------------

#[tauri::command]
pub fn create_database(
    state: State<'_, AppState>,
    parent_page_id: Option<String>,
    title: String,
) -> Result<DatabaseDetail> {
    state.with_ws_mut(|ws| {
        let ctx = ws.ctx.clone();
        dbview::create_database(&mut ws.conn, &ctx, parent_page_id.as_deref(), &title)
    })
}

#[tauri::command]
pub fn get_database_by_page(state: State<'_, AppState>, page_id: String) -> Result<DatabaseDetail> {
    state.with_ws(|ws| dbview::database_by_page(&ws.conn, &page_id))
}

#[tauri::command]
pub fn add_property(
    state: State<'_, AppState>,
    database_id: String,
    name: String,
    prop_type: String,
) -> Result<DatabaseProperty> {
    state.with_ws(|ws| dbview::add_property(&ws.conn, &database_id, &name, &prop_type))
}

#[tauri::command]
pub fn rename_property(
    state: State<'_, AppState>,
    property_id: String,
    name: String,
) -> Result<()> {
    state.with_ws(|ws| dbview::rename_property(&ws.conn, &property_id, &name))
}

#[tauri::command]
pub fn set_property_hidden(
    state: State<'_, AppState>,
    property_id: String,
    hidden: bool,
) -> Result<()> {
    state.with_ws(|ws| dbview::set_property_hidden(&ws.conn, &property_id, hidden))
}

#[tauri::command]
pub fn set_property_config(
    state: State<'_, AppState>,
    property_id: String,
    config_json: String,
) -> Result<()> {
    state.with_ws(|ws| dbview::set_property_config(&ws.conn, &property_id, &config_json))
}

#[tauri::command]
pub fn delete_property(state: State<'_, AppState>, property_id: String) -> Result<()> {
    state.with_ws_mut(|ws| dbview::delete_property(&mut ws.conn, &property_id))
}

#[tauri::command]
pub fn change_property_type(
    state: State<'_, AppState>,
    property_id: String,
    new_type: String,
    dry_run: Option<bool>,
) -> Result<ConversionReport> {
    state.with_ws_mut(|ws| {
        dbview::change_property_type(
            &mut ws.conn,
            &property_id,
            &new_type,
            dry_run.unwrap_or(false),
        )
    })
}

#[tauri::command]
pub fn create_record(state: State<'_, AppState>, database_id: String) -> Result<String> {
    state.with_ws(|ws| dbview::create_record(&ws.conn, &ws.ctx, &database_id))
}

#[tauri::command]
pub fn list_records(
    state: State<'_, AppState>,
    database_id: String,
    sort: Option<RecordSort>,
    filters: Option<Vec<RecordFilter>>,
) -> Result<Vec<RecordRow>> {
    state.with_ws(|ws| {
        dbview::list_records(
            &ws.conn,
            &database_id,
            sort.as_ref(),
            &filters.unwrap_or_default(),
        )
    })
}

#[tauri::command]
pub fn set_record_value(
    state: State<'_, AppState>,
    record_page_id: String,
    property_id: String,
    value_json: Option<String>,
) -> Result<()> {
    state.with_ws(|ws| {
        dbview::set_record_value(
            &ws.conn,
            &ws.ctx,
            &record_page_id,
            &property_id,
            value_json.as_deref(),
        )
    })
}

// ---- Adjuntos --------------------------------------------------------------------

#[tauri::command]
pub fn import_attachment_from_path(
    state: State<'_, AppState>,
    path: String,
) -> Result<AttachmentInfo> {
    state.with_ws(|ws| attachments::import_from_path(ws, &path))
}

#[tauri::command]
pub fn import_attachment_base64(
    state: State<'_, AppState>,
    name: String,
    data_base64: String,
) -> Result<AttachmentInfo> {
    let bytes = base64::engine::general_purpose::STANDARD
        .decode(data_base64.as_bytes())
        .map_err(|_| NodoraError::InvalidInput("base64 inválido".into()))?;
    state.with_ws(|ws| attachments::import_bytes(ws, &bytes, &name))
}

#[tauri::command]
pub fn resolve_attachment(state: State<'_, AppState>, id: String) -> Result<String> {
    state.with_ws(|ws| {
        Ok(attachments::resolve_path(ws, &id)?
            .to_string_lossy()
            .into_owned())
    })
}

#[tauri::command]
pub fn verify_attachment(state: State<'_, AppState>, id: String) -> Result<bool> {
    state.with_ws(|ws| attachments::verify(ws, &id))
}

/// Libera los adjuntos que ninguna página referencia ya. Con `dry_run` solo
/// informa de cuánto se recuperaría.
#[tauri::command]
pub fn collect_unreferenced_attachments(
    state: State<'_, AppState>,
    dry_run: Option<bool>,
) -> Result<CleanupReport> {
    state.with_ws(|ws| attachments::collect_unreferenced(ws, dry_run.unwrap_or(true)))
}

// ---- Exportación y respaldos ---------------------------------------------------------

#[tauri::command]
pub fn export_page_markdown(
    state: State<'_, AppState>,
    page_id: String,
    dest_dir: String,
    include_subpages: bool,
) -> Result<Vec<String>> {
    let dir = export::ensure_safe_dir(&dest_dir)?;
    state.with_ws(|ws| export::export_page_markdown(ws, &page_id, &dir, include_subpages))
}

#[tauri::command]
pub fn export_workspace_json(state: State<'_, AppState>, dest_file: String) -> Result<()> {
    let file = export::ensure_safe_dir(&dest_file)?;
    state.with_ws(|ws| export::export_workspace_json(ws, &file))
}

#[tauri::command]
pub fn create_backup(state: State<'_, AppState>, dest_dir: Option<String>) -> Result<String> {
    state.with_ws(|ws| {
        let dir = match &dest_dir {
            Some(d) => export::ensure_safe_dir(d)?,
            None => ws.path.join(workspace::BACKUPS_DIR),
        };
        Ok(backup::create_backup(ws, &dir)?
            .to_string_lossy()
            .into_owned())
    })
}

#[tauri::command]
pub fn validate_backup(state: State<'_, AppState>, zip_path: String) -> Result<BackupSummary> {
    let _ = &state; // la validación no necesita workspace abierto
    backup::validate_backup(&PathBuf::from(zip_path))
}

#[tauri::command]
pub fn restore_backup(
    state: State<'_, AppState>,
    zip_path: String,
    dest_parent: Option<String>,
) -> Result<String> {
    let parent = match dest_parent {
        Some(p) => export::ensure_safe_dir(&p)?,
        None => crate::registry::Registry::default_workspaces_dir(&state.data_dir),
    };
    state.with_registry(|r| {
        Ok(
            backup::restore_backup(r, &PathBuf::from(&zip_path), &parent)?
                .to_string_lossy()
                .into_owned(),
        )
    })
}
