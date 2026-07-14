//! Nodora — backend de escritorio (Tauri 2).
//! Módulos de dominio testeables sin runtime de Tauri; los comandos IPC son
//! una capa fina sobre ellos (docs/ARCHITECTURE.md).

pub mod attachments;
pub mod backup;
pub mod commands;
pub mod db;
pub mod dbview;
pub mod error;
pub mod export;
pub mod ids;
pub mod ordering;
pub mod pages;
pub mod registry;
pub mod search;
pub mod state;
pub mod validate;
pub mod workspace;

use std::sync::Mutex;

use tauri::Manager;

use crate::registry::Registry;
use crate::state::AppState;

fn init_logging(data_dir: &std::path::Path) {
    let logs = data_dir.join("logs");
    let _ = std::fs::create_dir_all(&logs);
    let appender = tracing_appender::rolling::daily(logs, "nodora.log");
    // Nota: sin contenido de documentos en logs (docs/THREAT_MODEL.md).
    let subscriber = tracing_subscriber::fmt()
        .with_writer(appender)
        .with_ansi(false)
        .with_max_level(tracing::Level::INFO)
        .finish();
    let _ = tracing::subscriber::set_global_default(subscriber);
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .setup(|app| {
            let data_dir = app.path().app_data_dir()?;
            std::fs::create_dir_all(&data_dir)?;
            init_logging(&data_dir);
            let registry = Registry::open(&data_dir).map_err(|e| e.to_string())?;
            app.manage(AppState {
                registry: Mutex::new(registry),
                workspace: Mutex::new(None),
                data_dir,
            });
            tracing::info!("Nodora iniciada");
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::list_known_workspaces,
            commands::create_workspace,
            commands::open_workspace,
            commands::open_last_workspace,
            commands::current_workspace,
            commands::close_workspace,
            commands::forget_workspace,
            commands::rename_workspace,
            commands::set_workspace_icon,
            commands::get_app_setting,
            commands::set_app_setting,
            commands::create_page,
            commands::get_page,
            commands::list_pages,
            commands::list_archived_pages,
            commands::rename_page,
            commands::set_page_icon,
            commands::save_page_content,
            commands::move_page,
            commands::duplicate_page,
            commands::archive_page,
            commands::restore_page,
            commands::delete_page_permanently,
            commands::get_backlinks,
            commands::get_breadcrumbs,
            commands::add_favorite,
            commands::remove_favorite,
            commands::list_favorites,
            commands::is_favorite,
            commands::touch_recent,
            commands::list_recents,
            commands::linkable_pages,
            commands::search_pages,
            commands::create_database,
            commands::get_database_by_page,
            commands::add_property,
            commands::rename_property,
            commands::set_property_hidden,
            commands::set_property_config,
            commands::delete_property,
            commands::change_property_type,
            commands::create_record,
            commands::list_records,
            commands::set_record_value,
            commands::import_attachment_from_path,
            commands::import_attachment_base64,
            commands::resolve_attachment,
            commands::verify_attachment,
            commands::export_page_markdown,
            commands::export_workspace_json,
            commands::create_backup,
            commands::validate_backup,
            commands::restore_backup,
        ])
        .run(tauri::generate_context!())
        .expect("error al iniciar Nodora");
}
