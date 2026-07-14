use chrono::{SecondsFormat, Utc};

/// UUID v4 en formato canónico (identidad estable de toda entidad, ADR/spec §7).
pub fn new_id() -> String {
    uuid::Uuid::new_v4().to_string()
}

/// Timestamp ISO-8601 UTC con milisegundos (convención de docs/DATA_MODEL.md).
pub fn now_iso() -> String {
    Utc::now().to_rfc3339_opts(SecondsFormat::Millis, true)
}

pub fn is_uuid_like(s: &str) -> bool {
    uuid::Uuid::parse_str(s).is_ok()
}
