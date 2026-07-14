use serde::ser::SerializeStruct;
use serde::{Serialize, Serializer};

/// Error de dominio con código estable en la frontera IPC.
/// Los mensajes nunca incluyen contenido de documentos del usuario
/// (docs/SECURITY_ARCHITECTURE.md).
#[derive(Debug, thiserror::Error)]
pub enum NodoraError {
    #[error("El espacio de trabajo no existe o no está abierto")]
    WorkspaceNotFound,
    #[error("La página no existe")]
    PageNotFound,
    #[error("El contenido cambió desde la última carga; recarga la página")]
    VersionConflict,
    #[error("Entrada inválida: {0}")]
    InvalidInput(String),
    #[error("Documento inválido: {0}")]
    InvalidDocument(String),
    #[error("La operación crearía un ciclo en el árbol de páginas")]
    CycleDetected,
    #[error("La base de datos interna no existe")]
    DatabaseNotFound,
    #[error("La propiedad no existe")]
    PropertyNotFound,
    #[error("Conversión de tipo no segura: {0}")]
    UnsafeTypeConversion(String),
    #[error("El adjunto no existe o su archivo falta")]
    AttachmentNotFound,
    #[error("El archivo supera el tamaño máximo permitido")]
    AttachmentTooLarge,
    #[error("Tipo de archivo no permitido")]
    AttachmentTypeForbidden,
    #[error("El respaldo no es válido: {0}")]
    BackupInvalid(String),
    #[error("Ruta no permitida")]
    PathNotAllowed,
    #[error("Fallo de migración: {0}")]
    MigrationFailed(String),
    #[error("El espacio fue creado por una versión más nueva de Nodora; actualiza la aplicación")]
    SchemaTooNew,
    #[error("Error de almacenamiento local")]
    Storage(#[from] rusqlite::Error),
    #[error("Error de entrada/salida")]
    Io(#[from] std::io::Error),
    #[error("Error interno: {0}")]
    Internal(String),
}

impl NodoraError {
    pub fn code(&self) -> &'static str {
        match self {
            Self::WorkspaceNotFound => "WORKSPACE_NOT_FOUND",
            Self::PageNotFound => "PAGE_NOT_FOUND",
            Self::VersionConflict => "VERSION_CONFLICT",
            Self::InvalidInput(_) => "INVALID_INPUT",
            Self::InvalidDocument(_) => "INVALID_DOCUMENT",
            Self::CycleDetected => "CYCLE_DETECTED",
            Self::DatabaseNotFound => "DATABASE_NOT_FOUND",
            Self::PropertyNotFound => "PROPERTY_NOT_FOUND",
            Self::UnsafeTypeConversion(_) => "UNSAFE_TYPE_CONVERSION",
            Self::AttachmentNotFound => "ATTACHMENT_NOT_FOUND",
            Self::AttachmentTooLarge => "ATTACHMENT_TOO_LARGE",
            Self::AttachmentTypeForbidden => "ATTACHMENT_TYPE_FORBIDDEN",
            Self::BackupInvalid(_) => "BACKUP_INVALID",
            Self::PathNotAllowed => "PATH_NOT_ALLOWED",
            Self::MigrationFailed(_) => "MIGRATION_FAILED",
            Self::SchemaTooNew => "SCHEMA_TOO_NEW",
            Self::Storage(_) => "STORAGE_ERROR",
            Self::Io(_) => "STORAGE_ERROR",
            Self::Internal(_) => "INTERNAL",
        }
    }
}

impl Serialize for NodoraError {
    fn serialize<S: Serializer>(&self, serializer: S) -> std::result::Result<S::Ok, S::Error> {
        // Los errores de infraestructura no exponen detalles internos al frontend.
        let message = match self {
            Self::Storage(e) => {
                tracing::error!(code = self.code(), error = %e, "storage error");
                "Error de almacenamiento local".to_string()
            }
            Self::Io(e) => {
                tracing::error!(code = self.code(), error = %e, "io error");
                "Error de entrada/salida".to_string()
            }
            other => other.to_string(),
        };
        let mut st = serializer.serialize_struct("ApiError", 2)?;
        st.serialize_field("code", self.code())?;
        st.serialize_field("message", &message)?;
        st.end()
    }
}

pub type Result<T> = std::result::Result<T, NodoraError>;
