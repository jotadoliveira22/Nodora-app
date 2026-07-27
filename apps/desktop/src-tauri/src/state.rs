//! Estado global gestionado por Tauri: registro de la app y workspace abierto.

use std::path::PathBuf;
use std::sync::Mutex;

use crate::error::{NodoraError, Result};
use crate::registry::Registry;
use crate::workspace::OpenWorkspace;

pub struct AppState {
    pub registry: Mutex<Registry>,
    pub workspace: Mutex<Option<OpenWorkspace>>,
    pub data_dir: PathBuf,
}

impl AppState {
    pub fn with_registry<T>(&self, f: impl FnOnce(&Registry) -> Result<T>) -> Result<T> {
        let guard = self
            .registry
            .lock()
            .map_err(|_| NodoraError::Internal("lock registro".into()))?;
        f(&guard)
    }

    pub fn with_ws<T>(&self, f: impl FnOnce(&OpenWorkspace) -> Result<T>) -> Result<T> {
        let guard = self
            .workspace
            .lock()
            .map_err(|_| NodoraError::Internal("lock workspace".into()))?;
        let ws = guard.as_ref().ok_or(NodoraError::WorkspaceNotFound)?;
        f(ws)
    }

    pub fn with_ws_mut<T>(&self, f: impl FnOnce(&mut OpenWorkspace) -> Result<T>) -> Result<T> {
        let mut guard = self
            .workspace
            .lock()
            .map_err(|_| NodoraError::Internal("lock workspace".into()))?;
        let ws = guard.as_mut().ok_or(NodoraError::WorkspaceNotFound)?;
        f(ws)
    }
}
