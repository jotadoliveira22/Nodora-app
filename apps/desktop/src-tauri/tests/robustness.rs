//! Pruebas de robustez y seguridad exigidas por docs/NODORA_SPEC.md §12 y
//! docs/THREAT_MODEL.md: migración desde base antigua, inyección SQL, path
//! traversal, entradas inválidas, contrato de serialización IPC y contenido
//! multilingüe de extremo a extremo.

use nodora_desktop_lib::{
    attachments, backup, db, dbview, error::NodoraError, export, pages, registry::Registry, search,
    workspace,
};
use std::path::Path;
use tempfile::TempDir;

const DEVICE: &str = "22222222-2222-4222-8222-222222222222";

fn ws(dir: &Path) -> workspace::OpenWorkspace {
    workspace::create_workspace(&dir.join("w"), "Robustez", None, DEVICE).unwrap()
}

fn doc(text: &str) -> String {
    serde_json::json!({
        "type": "doc",
        "content": [{
            "type": "paragraph", "attrs": {"blockId": "b-1"},
            "content": [{"type": "text", "text": text}]
        }]
    })
    .to_string()
}

// ---- Migración desde una base antigua (spec §12) -------------------------

#[test]
fn migrates_database_created_before_migrations_existed() {
    // Simula un workspace de una versión anterior: archivo SQLite sin la
    // tabla schema_migrations. Debe migrarse a la versión actual sin perder
    // el archivo ni fallar.
    let tmp = TempDir::new().unwrap();
    let db_path = tmp.path().join("legacy.db");
    {
        let conn = rusqlite::Connection::open(&db_path).unwrap();
        conn.execute_batch("CREATE TABLE legado (id TEXT PRIMARY KEY, dato TEXT);")
            .unwrap();
        conn.execute("INSERT INTO legado VALUES ('1','conservado')", [])
            .unwrap();
    }
    let conn = db::open_with_migrations(&db_path, db::WORKSPACE_MIGRATIONS).unwrap();
    // Se compara con la última migración embebida, no con un número fijo: así
    // añadir una migración no obliga a retocar esta prueba.
    let ultima = db::WORKSPACE_MIGRATIONS
        .iter()
        .map(|m| m.version)
        .max()
        .unwrap();
    assert_eq!(db::schema_version(&conn).unwrap(), ultima);
    // Los datos preexistentes siguen ahí (la migración es aditiva).
    let dato: String = conn
        .query_row("SELECT dato FROM legado WHERE id='1'", [], |r| r.get(0))
        .unwrap();
    assert_eq!(dato, "conservado");
    // Y las tablas nuevas existen.
    let n: i64 = conn
        .query_row(
            "SELECT COUNT(*) FROM sqlite_master WHERE type='table'
             AND name IN ('pages','workspaces','sync_operations','attachments')",
            [],
            |r| r.get(0),
        )
        .unwrap();
    assert_eq!(n, 4);
}

#[test]
fn migration_failure_rolls_back_and_leaves_db_usable() {
    let tmp = TempDir::new().unwrap();
    let db_path = tmp.path().join("bad.db");
    let bad = [db::Migration {
        version: 1,
        name: "rota",
        sql: "CREATE TABLE ok (id TEXT); ESTO NO ES SQL VALIDO;",
    }];
    let mut conn = rusqlite::Connection::open(&db_path).unwrap();
    let res = db::migrate(&mut conn, &bad);
    assert!(matches!(res, Err(NodoraError::MigrationFailed(_))));
    // Rollback: la tabla parcial no quedó, y la base sigue abriéndose.
    let n: i64 = conn
        .query_row(
            "SELECT COUNT(*) FROM sqlite_master WHERE name='ok'",
            [],
            |r| r.get(0),
        )
        .unwrap();
    assert_eq!(n, 0, "la migración fallida debe revertirse por completo");
    let version: i64 = conn
        .query_row(
            "SELECT COALESCE(MAX(version),0) FROM schema_migrations",
            [],
            |r| r.get(0),
        )
        .unwrap();
    assert_eq!(version, 0);
}

// ---- Inyección SQL (THREAT_MODEL T4) --------------------------------------

#[test]
fn sql_injection_attempts_are_inert() {
    let tmp = TempDir::new().unwrap();
    let mut w = ws(tmp.path());
    let evil = "'; DROP TABLE pages; --";

    // En títulos.
    let p = pages::create_page(&w.conn, &w.ctx, None, evil, None).unwrap();
    assert_eq!(pages::get_page(&w.conn, &p.id).unwrap().title, evil);

    // En contenido.
    pages::save_page_content(&mut w.conn, &w.ctx, &p.id, &doc(evil), p.version).unwrap();

    // En la consulta de búsqueda (FTS5 tiene su propia sintaxis).
    for probe in [
        evil,
        "\" OR 1=1 --",
        "NEAR(a b, 10)",
        "pages_fts MATCH 'x'",
        "*",
        "(((",
    ] {
        let res = search::search(&w.conn, probe, false, false, 10);
        assert!(
            res.is_ok(),
            "la consulta {probe:?} no debe romper la búsqueda"
        );
    }

    // En el buscador de páginas enlazables (LIKE con escape).
    for probe in [evil, "100%", "a_b", "\\"] {
        assert!(pages::linkable_pages(&w.conn, probe, 10).is_ok());
    }

    // La tabla sigue existiendo y la página también.
    let n: i64 = w
        .conn
        .query_row("SELECT COUNT(*) FROM pages", [], |r| r.get(0))
        .unwrap();
    assert!(n >= 2);
}

// ---- Path traversal (THREAT_MODEL T7) --------------------------------------

#[test]
fn relative_and_traversal_paths_are_rejected() {
    for evil in [
        "../../etc/passwd",
        "..\\..\\Windows\\System32",
        "relativo/salida.md",
        "",
        "./x",
    ] {
        assert!(
            matches!(
                export::ensure_safe_dir(evil),
                Err(NodoraError::PathNotAllowed)
            ),
            "la ruta {evil:?} debía rechazarse"
        );
    }
    // Una ruta absoluta sí se admite (el diálogo nativo las produce). Lo que
    // cuenta como absoluta depende de la plataforma: en Windows "/tmp/x" no
    // lo es, porque carece de unidad.
    let absolute = if cfg!(windows) {
        "C:\\Users\\nodora\\destino"
    } else {
        "/tmp/destino"
    };
    assert!(
        export::ensure_safe_dir(absolute).is_ok(),
        "una ruta absoluta de la plataforma debe admitirse: {absolute}"
    );
    // Y en Windows tampoco valen las rutas sin unidad ni las relativas de unidad.
    if cfg!(windows) {
        for evil in ["/tmp/destino", "C:destino"] {
            assert!(
                matches!(
                    export::ensure_safe_dir(evil),
                    Err(NodoraError::PathNotAllowed)
                ),
                "la ruta {evil:?} debía rechazarse en Windows"
            );
        }
    }
}

#[test]
fn backup_with_traversal_entries_is_rejected() {
    // Zip-slip: un respaldo manipulado que intenta escribir fuera del destino.
    let tmp = TempDir::new().unwrap();
    let evil_zip = tmp.path().join("malicioso.zip");
    {
        use std::io::Write;
        let f = std::fs::File::create(&evil_zip).unwrap();
        let mut z = zip::ZipWriter::new(f);
        let opts = zip::write::SimpleFileOptions::default();
        z.start_file("manifest.json", opts).unwrap();
        z.write_all(br#"{"formatVersion":1,"schemaVersion":1,"workspaceId":"x","workspaceName":"x","createdAt":"x","pageCount":0,"attachmentCount":0,"files":[]}"#).unwrap();
        z.start_file("../../fuera.txt", opts).unwrap();
        z.write_all(b"payload").unwrap();
        z.finish().unwrap();
    }
    let res = backup::validate_backup(&evil_zip);
    assert!(
        matches!(res, Err(NodoraError::BackupInvalid(_))),
        "zip-slip debe rechazarse"
    );
    assert!(!tmp.path().join("fuera.txt").exists());
}

// ---- Entradas inválidas (spec §12 "importación inválida") -------------------

#[test]
fn invalid_documents_are_rejected_without_corrupting_state() {
    let tmp = TempDir::new().unwrap();
    let mut w = ws(tmp.path());
    let p = pages::create_page(&w.conn, &w.ctx, None, "Sana", None).unwrap();
    let good = doc("contenido bueno");
    let v = pages::save_page_content(&mut w.conn, &w.ctx, &p.id, &good, p.version)
        .unwrap()
        .version;

    let invalid = [
        "no es json",
        "{}",
        r#"{"type":"otra-cosa","content":[]}"#,
        r#"{"type":"doc","content":{"no":"lista"}}"#,
        r#"{"type":"doc","content":[{"type":"iframe"}]}"#,
        r#"{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"x","marks":[{"type":"link","attrs":{"href":"javascript:alert(1)"}}]}]}]}"#,
        r#"{"type":"doc","content":[{"type":"image","attrs":{"attachmentId":"../../etc/passwd"}}]}"#,
        r#"{"type":"doc","content":[{"type":"pageLink","attrs":{"pageId":"no-es-uuid"}}]}"#,
    ];
    for bad in invalid {
        let res = pages::save_page_content(&mut w.conn, &w.ctx, &p.id, bad, v);
        assert!(
            matches!(res, Err(NodoraError::InvalidDocument(_))),
            "el documento {bad:?} debía rechazarse"
        );
    }
    // El contenido bueno sigue intacto y la versión no avanzó.
    let detail = pages::get_page(&w.conn, &p.id).unwrap();
    assert!(detail.content_json.contains("contenido bueno"));
    assert_eq!(detail.version, v);
}

#[test]
fn invalid_record_values_are_rejected() {
    let tmp = TempDir::new().unwrap();
    let mut w = ws(tmp.path());
    let d = dbview::create_database(&mut w.conn, &w.ctx, None, "Datos").unwrap();
    let fecha = dbview::add_property(&w.conn, &d.id, "Fecha", "date").unwrap();
    let rec = dbview::create_record(&w.conn, &w.ctx, &d.id).unwrap();

    for bad in [
        r#"{"date":{"start":"ayer"}}"#,
        r#"{"text":"x"}"#,
        "{}",
        "no json",
    ] {
        assert!(
            dbview::set_record_value(&w.conn, &w.ctx, &rec, &fecha.id, Some(bad)).is_err(),
            "valor {bad:?} debía rechazarse"
        );
    }
    // Uno válido sí entra.
    dbview::set_record_value(
        &w.conn,
        &w.ctx,
        &rec,
        &fecha.id,
        Some(r#"{"date":{"start":"2026-07-14"}}"#),
    )
    .unwrap();
    let rows = dbview::list_records(&w.conn, &d.id, None, &[]).unwrap();
    assert!(rows[0]
        .values
        .get(&fecha.id)
        .unwrap()
        .contains("2026-07-14"));
}

// ---- Operaciones repetidas / idempotencia (spec §12) ------------------------

#[test]
fn repeated_operations_are_safe() {
    let tmp = TempDir::new().unwrap();
    let mut w = ws(tmp.path());
    let p = pages::create_page(&w.conn, &w.ctx, None, "Repetida", None).unwrap();

    // Favorito dos veces: una sola fila.
    pages::add_favorite(&w.conn, &w.ctx, &p.id).unwrap();
    pages::add_favorite(&w.conn, &w.ctx, &p.id).unwrap();
    assert_eq!(pages::list_favorites(&w.conn).unwrap().len(), 1);
    // Quitar dos veces: sin error.
    pages::remove_favorite(&w.conn, &p.id).unwrap();
    pages::remove_favorite(&w.conn, &p.id).unwrap();

    // Archivar dos veces y restaurar dos veces.
    pages::archive_page(&mut w.conn, &w.ctx, &p.id).unwrap();
    pages::archive_page(&mut w.conn, &w.ctx, &p.id).unwrap();
    pages::restore_page(&mut w.conn, &w.ctx, &p.id).unwrap();
    pages::restore_page(&mut w.conn, &w.ctx, &p.id).unwrap();
    assert!(pages::get_page(&w.conn, &p.id)
        .unwrap()
        .archived_at
        .is_none());

    // Visitar repetidamente: una sola fila en recientes.
    for _ in 0..5 {
        pages::touch_recent(&w.conn, &p.id).unwrap();
    }
    assert_eq!(pages::list_recents(&w.conn, 10).unwrap().len(), 1);

    // Eliminar definitivamente dos veces: la segunda dice "no existe".
    pages::delete_page_permanently(&mut w.conn, &w.ctx, &p.id).unwrap();
    assert!(matches!(
        pages::delete_page_permanently(&mut w.conn, &w.ctx, &p.id),
        Err(NodoraError::PageNotFound)
    ));
}

// ---- Contrato de serialización IPC (camelCase, docs/ARCHITECTURE.md) --------

#[test]
fn ipc_dtos_serialize_in_camel_case() {
    let tmp = TempDir::new().unwrap();
    let mut w = ws(tmp.path());
    let p = pages::create_page(&w.conn, &w.ctx, None, "Contrato", None).unwrap();

    let detail = serde_json::to_value(&p).unwrap();
    for key in [
        "id",
        "parentPageId",
        "contentJson",
        "archivedAt",
        "databaseId",
        "updatedAt",
    ] {
        assert!(detail.get(key).is_some(), "PageDetail debe exponer {key}");
    }
    assert!(
        detail.get("parent_page_id").is_none(),
        "no debe filtrarse snake_case"
    );

    let summaries = serde_json::to_value(pages::list_pages(&w.conn).unwrap()).unwrap();
    let first = &summaries[0];
    for key in ["hasChildren", "parentPageId", "databaseId", "archivedAt"] {
        assert!(first.get(key).is_some(), "PageSummary debe exponer {key}");
    }

    let d = dbview::create_database(&mut w.conn, &w.ctx, None, "Tabla").unwrap();
    let dbjson = serde_json::to_value(&d).unwrap();
    assert!(dbjson.get("pageId").is_some());
    let prop = &dbjson["properties"][0];
    assert!(prop.get("configJson").is_some());
    assert_eq!(
        prop["type"], "title",
        "el campo se serializa como `type`, no `propType`"
    );

    // El error de la frontera IPC lleva code + message estables.
    let err = serde_json::to_value(NodoraError::VersionConflict).unwrap();
    assert_eq!(err["code"], "VERSION_CONFLICT");
    assert!(err["message"].as_str().unwrap().len() > 0);

    // Los errores de infraestructura no filtran detalles internos.
    let storage =
        serde_json::to_value(NodoraError::Storage(rusqlite::Error::QueryReturnedNoRows)).unwrap();
    assert_eq!(storage["code"], "STORAGE_ERROR");
    assert_eq!(storage["message"], "Error de almacenamiento local");
}

// ---- Contenido multilingüe de extremo a extremo (spec §12) ------------------

#[test]
fn multilingual_content_survives_save_search_export_and_backup() {
    let tmp = TempDir::new().unwrap();
    let mut w = ws(tmp.path());
    let titulo = "Título: 日本語 · Ελληνικά · العربية · emoji 🚀🌍";
    let cuerpo = "Señor ñandú — «citas» … 中文测试 · Ελλάδα · مرحبا · 🎉 fin";
    let p = pages::create_page(&w.conn, &w.ctx, None, titulo, Some("🌍")).unwrap();
    pages::save_page_content(&mut w.conn, &w.ctx, &p.id, &doc(cuerpo), p.version).unwrap();

    // Búsqueda en varios alfabetos.
    for probe in ["日本語", "Ελλάδα", "مرحبا", "nandu", "ñandú", "中文"] {
        let hits = search::search(&w.conn, probe, false, false, 10).unwrap();
        assert!(!hits.is_empty(), "no se encontró {probe:?}");
    }

    // Export a Markdown conserva el texto exacto.
    let dest = tmp.path().join("md");
    let files = export::export_page_markdown(&w, &p.id, &dest, false).unwrap();
    let md = std::fs::read_to_string(&files[0]).unwrap();
    assert!(md.contains(titulo));
    assert!(md.contains(cuerpo));

    // Export JSON también.
    let json_file = tmp.path().join("ws.json");
    export::export_workspace_json(&w, &json_file).unwrap();
    let raw = std::fs::read_to_string(&json_file).unwrap();
    let parsed: serde_json::Value = serde_json::from_str(&raw).unwrap();
    let found = parsed["pages"]
        .as_array()
        .unwrap()
        .iter()
        .any(|p| p["title"].as_str() == Some(titulo));
    assert!(found, "el título multilingüe debe estar en el export JSON");

    // Respaldo y restauración conservan todo.
    let zip = backup::create_backup(&w, &tmp.path().join("bk")).unwrap();
    let reg = Registry::open(&tmp.path().join("appdata")).unwrap();
    let restored = backup::restore_backup(&reg, &zip, &tmp.path().join("rest")).unwrap();
    let w2 = workspace::open_workspace(&restored, &reg.device_id).unwrap();
    let detail = pages::get_page(&w2.conn, &p.id).unwrap();
    assert_eq!(detail.title, titulo);
    assert_eq!(detail.icon.as_deref(), Some("🌍"));
    assert!(
        detail.content_json.contains(cuerpo),
        "el cuerpo multilingüe debe restaurarse íntegro"
    );
    let hits = search::search(&w2.conn, "中文", false, false, 10).unwrap();
    assert_eq!(
        hits.len(),
        1,
        "el índice FTS se restaura junto con los datos"
    );
}

// ---- Adjuntos: límites y tipos (THREAT_MODEL T6) ----------------------------

#[test]
fn attachment_limits_and_type_sniffing() {
    let tmp = TempDir::new().unwrap();
    let w = ws(tmp.path());

    // Un archivo que se llama .png pero no lo es: se rechaza por contenido.
    let res = attachments::import_bytes(&w, b"<html><script>alert(1)</script>", "falso.png");
    assert!(matches!(res, Err(NodoraError::AttachmentTypeForbidden)));

    // Un ejecutable disfrazado tampoco entra.
    let res = attachments::import_bytes(&w, b"MZ\x90\x00ejecutable", "imagen.jpg");
    assert!(matches!(res, Err(NodoraError::AttachmentTypeForbidden)));

    // Y un archivo demasiado grande se rechaza antes de escribir a disco.
    let huge = vec![0u8; attachments::MAX_ATTACHMENT_BYTES + 1];
    assert!(matches!(
        attachments::import_bytes(&w, &huge, "grande.png"),
        Err(NodoraError::AttachmentTooLarge)
    ));
    let count = std::fs::read_dir(w.attachments_dir()).unwrap().count();
    assert_eq!(count, 0, "ningún archivo rechazado debe quedar en disco");
}

// ---- Integridad estructural del árbol ----------------------------------------

#[test]
fn tree_invariants_hold_under_stress() {
    let tmp = TempDir::new().unwrap();
    let mut w = ws(tmp.path());
    // Cadena profunda a -> b -> c -> ... (30 niveles)
    let mut parent: Option<String> = None;
    let mut chain = Vec::new();
    for i in 0..30 {
        let p =
            pages::create_page(&w.conn, &w.ctx, parent.as_deref(), &format!("N{i}"), None).unwrap();
        parent = Some(p.id.clone());
        chain.push(p.id);
    }
    // Breadcrumbs completos y en orden.
    let crumbs = pages::breadcrumbs(&w.conn, chain.last().unwrap()).unwrap();
    assert_eq!(crumbs.len(), 30);
    assert_eq!(crumbs[0].title, "N0");

    // Mover un ancestro dentro de su descendiente debe fallar en cada nivel.
    for (i, ancestor) in chain.iter().enumerate().take(5) {
        for descendant in chain.iter().skip(i + 1).take(5) {
            assert!(matches!(
                pages::move_page(&w.conn, &w.ctx, ancestor, Some(descendant), None),
                Err(NodoraError::CycleDetected)
            ));
        }
    }

    // Archivar la raíz archiva los 30; restaurar los devuelve.
    pages::archive_page(&mut w.conn, &w.ctx, &chain[0]).unwrap();
    assert!(pages::list_pages(&w.conn)
        .unwrap()
        .iter()
        .all(|p| !chain.contains(&p.id)));
    pages::restore_page(&mut w.conn, &w.ctx, &chain[0]).unwrap();
    let visibles = pages::list_pages(&w.conn).unwrap();
    assert_eq!(
        chain
            .iter()
            .filter(|id| visibles.iter().any(|p| &p.id == *id))
            .count(),
        30
    );

    // Eliminar la raíz elimina el subárbol completo.
    let n = pages::delete_page_permanently(&mut w.conn, &w.ctx, &chain[0]).unwrap();
    assert_eq!(n, 30);
}

// ---- Recolección de adjuntos sin referencias (deuda D1) ---------------------

const PNG_A: &[u8] = &[
    0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0x00, 0x00, 0x00, 0x0D, 0x49, 0x48, 0x44, 0x52,
    0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01, 0x08, 0x06, 0x00, 0x00, 0x00, 0x1F, 0x15, 0xC4,
    0x89, 0x00, 0x00, 0x00, 0x0D, 0x49, 0x44, 0x41, 0x54, 0x78, 0x9C, 0x62, 0x00, 0x01, 0x00, 0x00,
    0x05, 0x00, 0x01, 0x0D, 0x0A, 0x2D, 0xB4, 0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4E, 0x44, 0xAE,
    0x42, 0x60, 0x82,
];

/// Un GIF mínimo válido: sirve como segundo adjunto con hash distinto.
const GIF_B: &[u8] = b"GIF89a\x01\x00\x01\x00\x80\x00\x00\x00\x00\x00\xff\xff\xff\x21\xf9\x04\x01\x00\x00\x00\x00\x2c\x00\x00\x00\x00\x01\x00\x01\x00\x00\x02\x02\x44\x01\x00\x3b";

fn doc_con_imagen(attachment_id: &str) -> String {
    serde_json::json!({
        "type": "doc",
        "content": [{"type": "image", "attrs": {"attachmentId": attachment_id, "blockId": "i-1"}}]
    })
    .to_string()
}

#[test]
fn unreferenced_attachments_are_collected_but_referenced_ones_survive() {
    let tmp = TempDir::new().unwrap();
    let mut w = ws(tmp.path());
    let page = pages::create_page(&w.conn, &w.ctx, None, "Con imagen", None).unwrap();

    let usada = attachments::import_bytes(&w, PNG_A, "usada.png").unwrap();
    let huerfana = attachments::import_bytes(&w, GIF_B, "huerfana.gif").unwrap();
    assert_ne!(usada.id, huerfana.id);

    pages::save_page_content(
        &mut w.conn,
        &w.ctx,
        &page.id,
        &doc_con_imagen(&usada.id),
        page.version,
    )
    .unwrap();

    // En seco: informa pero no borra nada.
    let informe = attachments::collect_unreferenced(&w, true).unwrap();
    assert_eq!(informe.unreferenced, 1);
    assert!(informe.bytes_freed > 0);
    assert!(!informe.applied);
    assert!(
        attachments::resolve_path(&w, &huerfana.id).is_ok(),
        "en seco no se borra"
    );

    // Aplicado: se va la huérfana y se queda la usada.
    let informe = attachments::collect_unreferenced(&w, false).unwrap();
    assert!(informe.applied);
    assert_eq!(informe.unreferenced, 1);
    assert!(
        attachments::verify(&w, &usada.id).unwrap(),
        "la referenciada debe sobrevivir"
    );
    assert!(matches!(
        attachments::get_info(&w, &huerfana.id),
        Err(NodoraError::AttachmentNotFound)
    ));

    // Repetir es inocuo.
    let otra_vez = attachments::collect_unreferenced(&w, false).unwrap();
    assert_eq!(otra_vez.unreferenced, 0);
    assert!(attachments::verify(&w, &usada.id).unwrap());
}

#[test]
fn cleanup_never_deletes_files_it_does_not_know() {
    // Un archivo suelto en attachments/ (p. ej. de una copia a medias) se
    // informa como huérfano pero jamás se borra automáticamente.
    let tmp = TempDir::new().unwrap();
    let w = ws(tmp.path());
    let ajeno = w.attachments_dir().join("archivo-ajeno.png");
    std::fs::write(&ajeno, PNG_A).unwrap();

    let informe = attachments::collect_unreferenced(&w, false).unwrap();
    assert_eq!(informe.orphan_files, 1);
    assert!(
        ajeno.exists(),
        "un archivo no registrado nunca se borra solo"
    );
}

#[test]
fn cleanup_keeps_attachments_when_a_document_is_corrupt() {
    // Si un documento no se puede analizar, sus referencias son desconocidas:
    // el recolector debe pecar de conservador y no borrar.
    let tmp = TempDir::new().unwrap();
    let w = ws(tmp.path());
    let att = attachments::import_bytes(&w, PNG_A, "referida.png").unwrap();
    let page = pages::create_page(&w.conn, &w.ctx, None, "Rara", None).unwrap();

    // Se corrompe el contenido saltándose la validación (simula daño externo).
    w.conn
        .execute(
            "UPDATE pages SET content_json = ?1 WHERE id = ?2",
            rusqlite::params!["{ esto no es json", page.id],
        )
        .unwrap();

    let informe = attachments::collect_unreferenced(&w, true).unwrap();
    // El adjunto aparece como no referenciado, pero el usuario decide: en seco
    // no se toca nada y el archivo sigue disponible.
    assert!(!informe.applied);
    assert!(attachments::verify(&w, &att.id).unwrap());
}

// ---- Eliminación de espacios de trabajo ----------------------------------

#[test]
fn deleting_a_workspace_removes_its_folder_and_only_its_folder() {
    let tmp = TempDir::new().unwrap();
    let w = ws(tmp.path());
    let dir = w.path.clone();
    // Un archivo del usuario fuera del espacio, como vecino de carpeta.
    let vecino = tmp.path().join("documento-del-usuario.txt");
    std::fs::write(&vecino, b"no es de Nodora").unwrap();
    drop(w);

    workspace::delete_workspace_folder(&dir).unwrap();

    assert!(!dir.exists(), "la carpeta del espacio se elimina");
    assert!(vecino.exists(), "nada fuera del espacio se toca");
}

#[test]
fn deleting_refuses_folders_that_are_not_nodora_workspaces() {
    let tmp = TempDir::new().unwrap();

    // Caso 1: carpeta con documentos del usuario, sin nodora.db.
    let ajena = tmp.path().join("mis-fotos");
    std::fs::create_dir_all(&ajena).unwrap();
    std::fs::write(ajena.join("foto.png"), b"datos").unwrap();
    assert!(matches!(
        workspace::delete_workspace_folder(&ajena),
        Err(NodoraError::WorkspaceNotFound)
    ));
    assert!(ajena.join("foto.png").exists(), "no se borra nada");

    // Caso 2: un archivo que se llama nodora.db pero no lo es.
    let falsa = tmp.path().join("falsa");
    std::fs::create_dir_all(&falsa).unwrap();
    std::fs::write(falsa.join("nodora.db"), b"esto no es una base SQLite").unwrap();
    std::fs::write(falsa.join("importante.txt"), b"datos").unwrap();
    assert!(matches!(
        workspace::delete_workspace_folder(&falsa),
        Err(NodoraError::WorkspaceNotFound)
    ));
    assert!(falsa.join("importante.txt").exists());

    // Caso 3: una base SQLite válida que no es de Nodora.
    let otra = tmp.path().join("otra-app");
    std::fs::create_dir_all(&otra).unwrap();
    let conn = rusqlite::Connection::open(otra.join("nodora.db")).unwrap();
    conn.execute("CREATE TABLE cosas (id INTEGER)", []).unwrap();
    drop(conn);
    assert!(matches!(
        workspace::delete_workspace_folder(&otra),
        Err(NodoraError::WorkspaceNotFound)
    ));
    assert!(otra.exists());

    // Caso 4: una ruta que no existe.
    assert!(matches!(
        workspace::delete_workspace_folder(&tmp.path().join("no-existe")),
        Err(NodoraError::WorkspaceNotFound)
    ));
}

#[test]
fn workspace_stats_report_what_would_be_lost() {
    let tmp = TempDir::new().unwrap();
    let w = ws(tmp.path());
    pages::create_page(&w.conn, &w.ctx, None, "Contrato", None).unwrap();
    attachments::import_bytes(&w, PNG_A, "imagen.png").unwrap();
    let dir = w.path.clone();
    drop(w);

    let stats = workspace::workspace_stats(&dir).unwrap();
    // La página de bienvenida más la creada aquí.
    assert_eq!(stats.page_count, 2);
    assert_eq!(stats.attachment_count, 1);
    assert!(
        stats.bytes_on_disk > 0,
        "el tamaño en disco debe ser real, no cero"
    );

    // Sobre una carpeta que no es un espacio, informar tampoco está permitido.
    assert!(matches!(
        workspace::workspace_stats(&tmp.path().join("no-existe")),
        Err(NodoraError::WorkspaceNotFound)
    ));
}

#[test]
fn forgetting_a_workspace_leaves_the_data_untouched() {
    // «Quitar de la lista» es la acción reversible: la carpeta sigue ahí y el
    // espacio se puede volver a abrir con «Abrir carpeta…».
    let tmp = TempDir::new().unwrap();
    let w = ws(tmp.path());
    let dir = w.path.clone();
    drop(w);
    let reg = Registry::open(&tmp.path().join("app")).unwrap();
    reg.remember("ws-1", "Robustez", &dir).unwrap();
    assert_eq!(reg.list().unwrap().len(), 1);

    reg.forget(&dir).unwrap();

    assert!(reg.list().unwrap().is_empty(), "sale del registro");
    assert!(dir.join("nodora.db").exists(), "los datos siguen en disco");
    workspace::open_workspace(&dir, DEVICE).unwrap();
}

// ---- Portada de página (migración 002) -----------------------------------

#[test]
fn cover_rejects_values_that_would_leave_a_broken_page() {
    let tmp = TempDir::new().unwrap();
    let w = ws(tmp.path());
    let page = pages::create_page(&w.conn, &w.ctx, None, "Con portada", None).unwrap();

    // Color inexistente.
    assert!(matches!(
        pages::set_page_cover(&w.conn, &w.ctx, &page.id, Some("color"), Some("dorado")),
        Err(NodoraError::InvalidInput(_))
    ));
    // Tipo desconocido.
    assert!(matches!(
        pages::set_page_cover(&w.conn, &w.ctx, &page.id, Some("url"), Some("http://x")),
        Err(NodoraError::InvalidInput(_))
    ));
    // Adjunto que no existe: la portada quedaría rota para siempre.
    assert!(matches!(
        pages::set_page_cover(
            &w.conn,
            &w.ctx,
            &page.id,
            Some("attachment"),
            Some("no-existe")
        ),
        Err(NodoraError::AttachmentNotFound)
    ));
    // Nada de lo anterior deja rastro.
    let detalle = pages::get_page(&w.conn, &page.id).unwrap();
    assert_eq!(detalle.cover_kind, None);
    assert_eq!(detalle.cover_value, None);

    // Un preset válido sí se guarda, y quitarla limpia también el valor.
    pages::set_page_cover(&w.conn, &w.ctx, &page.id, Some("color"), Some("salvia")).unwrap();
    let detalle = pages::get_page(&w.conn, &page.id).unwrap();
    assert_eq!(detalle.cover_kind.as_deref(), Some("color"));
    assert_eq!(detalle.cover_value.as_deref(), Some("salvia"));

    pages::set_page_cover(&w.conn, &w.ctx, &page.id, None, Some("salvia")).unwrap();
    let detalle = pages::get_page(&w.conn, &page.id).unwrap();
    assert_eq!(detalle.cover_kind, None);
    assert_eq!(
        detalle.cover_value, None,
        "quitar la portada no puede dejar el valor huérfano"
    );
}

#[test]
fn cover_attachments_survive_the_collector() {
    // La portada no está en el documento de la página. Si el recolector solo
    // mirase los documentos, borraría la imagen de portada de todas ellas.
    let tmp = TempDir::new().unwrap();
    let w = ws(tmp.path());
    let att = attachments::import_bytes(&w, PNG_A, "portada.png").unwrap();
    let page = pages::create_page(&w.conn, &w.ctx, None, "Con portada", None).unwrap();
    pages::set_page_cover(&w.conn, &w.ctx, &page.id, Some("attachment"), Some(&att.id)).unwrap();

    let informe = attachments::collect_unreferenced(&w, false).unwrap();

    assert_eq!(informe.unreferenced, 0, "la portada está en uso");
    assert!(attachments::verify(&w, &att.id).unwrap());

    // Y al quitarla, deja de estarlo: la referencia se recalcula de verdad.
    pages::set_page_cover(&w.conn, &w.ctx, &page.id, None, None).unwrap();
    let informe = attachments::collect_unreferenced(&w, true).unwrap();
    assert_eq!(informe.unreferenced, 1);
}

#[test]
fn workspace_created_before_covers_migrates_and_keeps_its_pages() {
    // Una base v1 real: se crea con la migración 001 y se abre con las dos.
    let tmp = TempDir::new().unwrap();
    let dir = tmp.path().join("antiguo");
    std::fs::create_dir_all(&dir).unwrap();
    let solo_init = &db::WORKSPACE_MIGRATIONS[..1];
    {
        let mut conn = rusqlite::Connection::open(dir.join("nodora.db")).unwrap();
        db::migrate(&mut conn, solo_init).unwrap();
        let now = "2026-01-01T00:00:00Z";
        conn.execute(
            "INSERT INTO users (id, name, kind, created_at, updated_at)
             VALUES ('u1','Propietario','local_owner',?1,?1)",
            [now],
        )
        .unwrap();
        conn.execute(
            "INSERT INTO devices (id, name, platform, last_seen_at, created_at, updated_at)
             VALUES (?1,'Equipo','linux',?2,?2,?2)",
            rusqlite::params![DEVICE, now],
        )
        .unwrap();
        conn.execute(
            "INSERT INTO workspaces (id, name, created_at, updated_at, created_by, updated_by, device_id)
             VALUES ('w1','Antiguo',?1,?1,'u1','u1',?2)",
            rusqlite::params![now, DEVICE],
        )
        .unwrap();
        conn.execute(
            "INSERT INTO pages (id, workspace_id, title, position, created_at, updated_at,
                                created_by, updated_by, device_id)
             VALUES ('p1','w1','Escrita antes de las portadas','a0',?1,?1,'u1','u1',?2)",
            rusqlite::params![now, DEVICE],
        )
        .unwrap();
    }

    let w = workspace::open_workspace(&dir, DEVICE).unwrap();

    let detalle = pages::get_page(&w.conn, "p1").unwrap();
    assert_eq!(detalle.title, "Escrita antes de las portadas");
    assert_eq!(
        detalle.cover_kind, None,
        "sin portada es el estado correcto"
    );
    // Y la página ya admite portada tras migrar.
    pages::set_page_cover(&w.conn, &w.ctx, "p1", Some("color"), Some("tinta")).unwrap();
    assert_eq!(
        pages::get_page(&w.conn, "p1")
            .unwrap()
            .cover_value
            .as_deref(),
        Some("tinta")
    );
}
