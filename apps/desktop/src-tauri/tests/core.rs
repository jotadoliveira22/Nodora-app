//! Tests de integración del núcleo (sin runtime de Tauri).
//! Cubren la matriz crítica de docs/NODORA_SPEC.md §12.

use nodora_desktop_lib::{
    attachments, backup, db, dbview, error::NodoraError, export, pages, registry::Registry, search,
    workspace,
};
use std::path::Path;
use tempfile::TempDir;

const DEVICE: &str = "11111111-1111-4111-8111-111111111111";

fn ws(dir: &Path) -> workspace::OpenWorkspace {
    workspace::create_workspace(&dir.join("w"), "Pruebas", Some("🧪"), DEVICE).unwrap()
}

fn doc(text: &str) -> String {
    serde_json::json!({
        "type": "doc",
        "content": [
            {"type": "paragraph", "attrs": {"blockId": "b-1"},
             "content": [{"type": "text", "text": text}]}
        ]
    })
    .to_string()
}

// ---- Workspace + migraciones -------------------------------------------------

#[test]
fn create_and_reopen_workspace() {
    let tmp = TempDir::new().unwrap();
    let w = ws(tmp.path());
    let info = w.info().unwrap();
    assert_eq!(info.name, "Pruebas");
    let path = w.path.clone();
    drop(w);
    let w2 = workspace::open_workspace(&path, DEVICE).unwrap();
    // La página de bienvenida existe y sobrevive a la reapertura.
    let all = pages::list_pages(&w2.conn).unwrap();
    assert_eq!(all.len(), 1);
    assert_eq!(all[0].title, "Bienvenida");
}

#[test]
fn migrations_are_idempotent_and_checksummed() {
    let tmp = TempDir::new().unwrap();
    let db_path = tmp.path().join("m.db");
    let c1 = db::open_with_migrations(&db_path, db::WORKSPACE_MIGRATIONS).unwrap();
    drop(c1);
    // Reabrir no re-aplica nada y verifica checksums.
    let c2 = db::open_with_migrations(&db_path, db::WORKSPACE_MIGRATIONS).unwrap();
    let ultima = db::WORKSPACE_MIGRATIONS
        .iter()
        .map(|m| m.version)
        .max()
        .unwrap();
    assert_eq!(db::schema_version(&c2).unwrap(), ultima);
    drop(c2);
    // Checksum manipulado -> se niega a abrir.
    let c = rusqlite::Connection::open(&db_path).unwrap();
    c.execute(
        "UPDATE schema_migrations SET checksum = 'malo' WHERE version = 1",
        [],
    )
    .unwrap();
    drop(c);
    let res = db::open_with_migrations(&db_path, db::WORKSPACE_MIGRATIONS);
    assert!(matches!(res, Err(NodoraError::MigrationFailed(_))));
}

#[test]
fn refuses_newer_schema() {
    let tmp = TempDir::new().unwrap();
    let db_path = tmp.path().join("n.db");
    let c = db::open_with_migrations(&db_path, db::WORKSPACE_MIGRATIONS).unwrap();
    c.execute(
        "INSERT INTO schema_migrations (version, name, applied_at, checksum) VALUES (999,'future','x','y')",
        [],
    )
    .unwrap();
    drop(c);
    let res = db::open_with_migrations(&db_path, db::WORKSPACE_MIGRATIONS);
    assert!(matches!(res, Err(NodoraError::SchemaTooNew)));
}

// ---- Páginas -------------------------------------------------------------------

#[test]
fn page_crud_and_tree() {
    let tmp = TempDir::new().unwrap();
    let mut w = ws(tmp.path());
    let a = pages::create_page(&w.conn, &w.ctx, None, "A", None).unwrap();
    let b = pages::create_page(&w.conn, &w.ctx, Some(&a.id), "B", None).unwrap();
    let c = pages::create_page(&w.conn, &w.ctx, Some(&b.id), "C", None).unwrap();

    // Ciclo prohibido: mover A dentro de C.
    let res = pages::move_page(&w.conn, &w.ctx, &a.id, Some(&c.id), None);
    assert!(matches!(res, Err(NodoraError::CycleDetected)));

    // Mover C a la raíz.
    pages::move_page(&w.conn, &w.ctx, &c.id, None, None).unwrap();
    let all = pages::list_pages(&w.conn).unwrap();
    let c_row = all.iter().find(|p| p.id == c.id).unwrap();
    assert!(c_row.parent_page_id.is_none());

    // Renombrar actualiza título y búsqueda.
    pages::rename_page(&w.conn, &w.ctx, &c.id, "Cactus").unwrap();
    let hits = search::search(&w.conn, "cactus", false, true, 10).unwrap();
    assert_eq!(hits.len(), 1);

    // Archivar el subárbol de A oculta a B.
    pages::archive_page(&mut w.conn, &w.ctx, &a.id).unwrap();
    let visible = pages::list_pages(&w.conn).unwrap();
    assert!(!visible.iter().any(|p| p.id == a.id || p.id == b.id));
    let archived = pages::list_archived(&w.conn).unwrap();
    assert!(archived.iter().any(|p| p.id == a.id));

    // Restaurar.
    pages::restore_page(&mut w.conn, &w.ctx, &a.id).unwrap();
    let visible = pages::list_pages(&w.conn).unwrap();
    assert!(visible.iter().any(|p| p.id == b.id));

    // Eliminación definitiva: tombstone + sin resultados de búsqueda.
    let n = pages::delete_page_permanently(&mut w.conn, &w.ctx, &a.id).unwrap();
    assert_eq!(n, 2); // A y B
    assert!(matches!(
        pages::get_page(&w.conn, &a.id),
        Err(NodoraError::PageNotFound)
    ));
    let hits = search::search(&w.conn, "B", false, false, 10).unwrap();
    assert!(hits.is_empty() || hits.iter().all(|h| h.page_id != b.id));
}

#[test]
fn save_content_persists_and_locks_versions() {
    let tmp = TempDir::new().unwrap();
    let mut w = ws(tmp.path());
    let p = pages::create_page(&w.conn, &w.ctx, None, "Notas", None).unwrap();

    let r1 =
        pages::save_page_content(&mut w.conn, &w.ctx, &p.id, &doc("hola uno"), p.version).unwrap();
    // Guardado repetido con versión vieja -> conflicto (no corrompe).
    let res = pages::save_page_content(&mut w.conn, &w.ctx, &p.id, &doc("pisado"), p.version);
    assert!(matches!(res, Err(NodoraError::VersionConflict)));
    // Dos guardados consecutivos correctos.
    let r2 =
        pages::save_page_content(&mut w.conn, &w.ctx, &p.id, &doc("hola dos"), r1.version).unwrap();
    assert_eq!(r2.version, r1.version + 1);

    // Reabrir el workspace conserva el último contenido.
    let path = w.path.clone();
    drop(w);
    let w2 = workspace::open_workspace(&path, DEVICE).unwrap();
    let detail = pages::get_page(&w2.conn, &p.id).unwrap();
    assert!(detail.content_json.contains("hola dos"));
}

#[test]
fn renaming_returns_the_new_version_so_autosave_does_not_conflict() {
    // Regresión: renombrar (o cambiar el icono) incrementa la versión de la
    // página. Si el llamador no adopta la versión devuelta, el siguiente
    // guardado de contenido choca con un VERSION_CONFLICT espurio y el
    // usuario pierde lo que acababa de escribir.
    let tmp = TempDir::new().unwrap();
    let mut w = ws(tmp.path());
    let p = pages::create_page(&w.conn, &w.ctx, None, "", None).unwrap();

    let after_rename = pages::rename_page(&w.conn, &w.ctx, &p.id, "Cliente Aurora").unwrap();
    assert_eq!(after_rename.version, p.version + 1);
    // Con la versión devuelta, el guardado pasa.
    let saved = pages::save_page_content(
        &mut w.conn,
        &w.ctx,
        &p.id,
        &doc("notas"),
        after_rename.version,
    )
    .unwrap();
    assert_eq!(saved.version, after_rename.version + 1);

    // El icono se comporta igual.
    let after_icon = pages::set_page_icon(&w.conn, &w.ctx, &p.id, Some("📌")).unwrap();
    assert_eq!(after_icon.version, saved.version + 1);
    pages::save_page_content(
        &mut w.conn,
        &w.ctx,
        &p.id,
        &doc("más notas"),
        after_icon.version,
    )
    .unwrap();

    // Y usar la versión anterior sigue siendo un conflicto legítimo.
    assert!(matches!(
        pages::save_page_content(&mut w.conn, &w.ctx, &p.id, &doc("obsoleto"), p.version),
        Err(NodoraError::VersionConflict)
    ));
    let detail = pages::get_page(&w.conn, &p.id).unwrap();
    assert!(detail.content_json.contains("más notas"));
    assert_eq!(detail.title, "Cliente Aurora");
}

#[test]
fn uncommitted_transaction_is_invisible_after_reopen() {
    // Simula cierre inesperado: cambios sin commit no persisten y la base
    // sigue siendo utilizable.
    let tmp = TempDir::new().unwrap();
    let mut w = ws(tmp.path());
    let p = pages::create_page(&w.conn, &w.ctx, None, "Crash", None).unwrap();
    {
        let tx = w.conn.transaction().unwrap();
        tx.execute(
            "UPDATE pages SET title = 'no debería verse' WHERE id = ?1",
            [&p.id],
        )
        .unwrap();
        // drop sin commit = rollback (equivalente a proceso muerto).
    }
    let path = w.path.clone();
    drop(w);
    let w2 = workspace::open_workspace(&path, DEVICE).unwrap();
    let detail = pages::get_page(&w2.conn, &p.id).unwrap();
    assert_eq!(detail.title, "Crash");
}

#[test]
fn duplicate_page_copies_subtree() {
    let tmp = TempDir::new().unwrap();
    let mut w = ws(tmp.path());
    let a = pages::create_page(&w.conn, &w.ctx, None, "Original", None).unwrap();
    let _b = pages::create_page(&w.conn, &w.ctx, Some(&a.id), "Hija", None).unwrap();
    pages::save_page_content(&mut w.conn, &w.ctx, &a.id, &doc("contenido raíz"), 1).unwrap();

    let copy_id = pages::duplicate_page(&mut w.conn, &w.ctx, &a.id).unwrap();
    let copy = pages::get_page(&w.conn, &copy_id).unwrap();
    assert_eq!(copy.title, "Original (copia)");
    assert!(copy.content_json.contains("contenido raíz"));
    let children: i64 = w
        .conn
        .query_row(
            "SELECT COUNT(*) FROM pages WHERE parent_page_id = ?1 AND deleted_at IS NULL",
            [&copy_id],
            |r| r.get(0),
        )
        .unwrap();
    assert_eq!(children, 1);
}

// ---- Enlaces y backlinks -----------------------------------------------------------

#[test]
fn links_and_backlinks_reconcile() {
    let tmp = TempDir::new().unwrap();
    let mut w = ws(tmp.path());
    let target = pages::create_page(&w.conn, &w.ctx, None, "Destino", None).unwrap();
    let source = pages::create_page(&w.conn, &w.ctx, None, "Fuente", None).unwrap();

    let with_link = serde_json::json!({
        "type": "doc",
        "content": [
            {"type": "paragraph", "attrs": {"blockId": "blk-a"},
             "content": [
               {"type": "text", "text": "ver "},
               {"type": "pageLink", "attrs": {"pageId": target.id}}
             ]}
        ]
    })
    .to_string();
    pages::save_page_content(&mut w.conn, &w.ctx, &source.id, &with_link, 1).unwrap();
    let bl = pages::backlinks(&w.conn, &target.id).unwrap();
    assert_eq!(bl.len(), 1);
    assert_eq!(bl[0].source_page_id, source.id);
    assert_eq!(bl[0].block_id, "blk-a");

    // Quitar el enlace lo elimina de backlinks (reconciliación).
    pages::save_page_content(&mut w.conn, &w.ctx, &source.id, &doc("sin enlaces"), 2).unwrap();
    let bl = pages::backlinks(&w.conn, &target.id).unwrap();
    assert!(bl.is_empty());
}

// ---- Búsqueda -------------------------------------------------------------------

#[test]
fn search_unicode_and_snippets() {
    let tmp = TempDir::new().unwrap();
    let mut w = ws(tmp.path());
    let p = pages::create_page(&w.conn, &w.ctx, None, "Recetas", None).unwrap();
    pages::save_page_content(
        &mut w.conn,
        &w.ctx,
        &p.id,
        &doc("Tortilla española con cebolla y pimientos 🌶️"),
        1,
    )
    .unwrap();
    // Sin tilde encuentra con tilde (remove_diacritics).
    let hits = search::search(&w.conn, "espanola", false, false, 10).unwrap();
    assert_eq!(hits.len(), 1);
    assert!(hits[0].snippet.contains("«"));
    // Prefijo.
    let hits = search::search(&w.conn, "cebo", false, false, 10).unwrap();
    assert_eq!(hits.len(), 1);
    // Sintaxis FTS no inyectable.
    let res = search::search(&w.conn, "\"cebolla OR NEAR(", false, false, 10);
    assert!(res.is_ok());
}

#[test]
fn search_excludes_archived_unless_asked() {
    let tmp = TempDir::new().unwrap();
    let mut w = ws(tmp.path());
    let p = pages::create_page(&w.conn, &w.ctx, None, "Congelada", None).unwrap();
    pages::archive_page(&mut w.conn, &w.ctx, &p.id).unwrap();
    assert!(search::search(&w.conn, "congelada", false, false, 10)
        .unwrap()
        .is_empty());
    assert_eq!(
        search::search(&w.conn, "congelada", true, false, 10)
            .unwrap()
            .len(),
        1
    );
}

// ---- Bases de datos ----------------------------------------------------------------

#[test]
fn database_records_and_sorting() {
    let tmp = TempDir::new().unwrap();
    let mut w = ws(tmp.path());
    let d = dbview::create_database(&mut w.conn, &w.ctx, None, "Clientes").unwrap();
    assert_eq!(d.properties.len(), 1);
    assert_eq!(d.properties[0].prop_type, "title");

    let estado = dbview::add_property(&w.conn, &d.id, "Estado", "select").unwrap();
    let horas = dbview::add_property(&w.conn, &d.id, "Horas", "number").unwrap();

    let r1 = dbview::create_record(&w.conn, &w.ctx, &d.id).unwrap();
    let r2 = dbview::create_record(&w.conn, &w.ctx, &d.id).unwrap();
    pages::rename_page(&w.conn, &w.ctx, &r1, "Acme").unwrap();
    pages::rename_page(&w.conn, &w.ctx, &r2, "Zeta").unwrap();
    dbview::set_record_value(&w.conn, &w.ctx, &r1, &horas.id, Some(r#"{"number": 10}"#)).unwrap();
    dbview::set_record_value(&w.conn, &w.ctx, &r2, &horas.id, Some(r#"{"number": 3}"#)).unwrap();

    // Valor inválido rechazado.
    let bad = dbview::set_record_value(&w.conn, &w.ctx, &r1, &horas.id, Some(r#"{"number": "x"}"#));
    assert!(bad.is_err());
    let _ = estado;

    // Orden por número asc.
    let sort = dbview::RecordSort {
        property_id: Some(horas.id.clone()),
        direction: "asc".into(),
    };
    let rows = dbview::list_records(&w.conn, &d.id, Some(&sort), &[]).unwrap();
    assert_eq!(rows[0].title, "Zeta");

    // Filtro numérico.
    let f = dbview::RecordFilter {
        property_id: horas.id.clone(),
        operator: "gt".into(),
        value_json: Some("5".into()),
    };
    let rows = dbview::list_records(&w.conn, &d.id, None, &[f]).unwrap();
    assert_eq!(rows.len(), 1);
    assert_eq!(rows[0].title, "Acme");

    // El registro se abre como página.
    let rec_page = pages::get_page(&w.conn, &r1).unwrap();
    assert_eq!(rec_page.kind, "record");
}

#[test]
fn property_type_conversion_text_to_select() {
    let tmp = TempDir::new().unwrap();
    let mut w = ws(tmp.path());
    let d = dbview::create_database(&mut w.conn, &w.ctx, None, "Tareas").unwrap();
    let tag = dbview::add_property(&w.conn, &d.id, "Etiqueta", "text").unwrap();
    let r1 = dbview::create_record(&w.conn, &w.ctx, &d.id).unwrap();
    let r2 = dbview::create_record(&w.conn, &w.ctx, &d.id).unwrap();
    dbview::set_record_value(&w.conn, &w.ctx, &r1, &tag.id, Some(r#"{"text":"urgente"}"#)).unwrap();
    dbview::set_record_value(&w.conn, &w.ctx, &r2, &tag.id, Some(r#"{"text":"urgente"}"#)).unwrap();

    // dry run no aplica.
    let rep = dbview::change_property_type(&mut w.conn, &tag.id, "select", true).unwrap();
    assert_eq!(rep.convertible, 2);
    assert!(!rep.applied);

    let rep = dbview::change_property_type(&mut w.conn, &tag.id, "select", false).unwrap();
    assert!(rep.applied);
    let d2 = dbview::get_database(&w.conn, &d.id).unwrap();
    let p = d2.properties.iter().find(|p| p.id == tag.id).unwrap();
    assert_eq!(p.prop_type, "select");
    // Ambos registros comparten la misma opción.
    let cfg: serde_json::Value = serde_json::from_str(&p.config_json).unwrap();
    assert_eq!(cfg["options"].as_array().unwrap().len(), 1);

    // Conversión no soportada -> error UNSAFE.
    let res = dbview::change_property_type(&mut w.conn, &tag.id, "checkbox", false);
    assert!(matches!(res, Err(NodoraError::UnsafeTypeConversion(_))));
}

// ---- Adjuntos -------------------------------------------------------------------

const PNG_1PX: &[u8] = &[
    0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0x00, 0x00, 0x00, 0x0D, 0x49, 0x48, 0x44, 0x52,
    0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01, 0x08, 0x06, 0x00, 0x00, 0x00, 0x1F, 0x15, 0xC4,
    0x89, 0x00, 0x00, 0x00, 0x0D, 0x49, 0x44, 0x41, 0x54, 0x78, 0x9C, 0x62, 0x00, 0x01, 0x00, 0x00,
    0x05, 0x00, 0x01, 0x0D, 0x0A, 0x2D, 0xB4, 0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4E, 0x44, 0xAE,
    0x42, 0x60, 0x82,
];

#[test]
fn attachments_dedup_and_verify() {
    let tmp = TempDir::new().unwrap();
    let w = ws(tmp.path());
    let a1 = attachments::import_bytes(&w, PNG_1PX, "pixel.png").unwrap();
    let a2 = attachments::import_bytes(&w, PNG_1PX, "pixel-copia.png").unwrap();
    assert_eq!(a1.id, a2.id, "mismo hash debe deduplicar");
    assert!(attachments::verify(&w, &a1.id).unwrap());
    let path = attachments::resolve_path(&w, &a1.id).unwrap();
    assert!(path.exists());

    // Archivo faltante -> error recuperable, no pánico.
    std::fs::remove_file(&path).unwrap();
    assert!(matches!(
        attachments::resolve_path(&w, &a1.id),
        Err(NodoraError::AttachmentNotFound)
    ));
    assert!(!attachments::verify(&w, &a1.id).unwrap());

    // Tipo no permitido.
    let res = attachments::import_bytes(&w, b"#!/bin/sh\necho hola", "script.sh");
    assert!(matches!(res, Err(NodoraError::AttachmentTypeForbidden)));
}

// ---- Exportación -----------------------------------------------------------------

#[test]
fn export_markdown_and_json() {
    let tmp = TempDir::new().unwrap();
    let mut w = ws(tmp.path());
    let p = pages::create_page(&w.conn, &w.ctx, None, "Guía", None).unwrap();
    let child = pages::create_page(&w.conn, &w.ctx, Some(&p.id), "Anexo", None).unwrap();
    let content = serde_json::json!({
        "type": "doc",
        "content": [
            {"type": "heading", "attrs": {"level": 2, "blockId": "h1"},
             "content": [{"type": "text", "text": "Sección"}]},
            {"type": "paragraph", "attrs": {"blockId": "p1"},
             "content": [{"type": "text", "text": "negrita", "marks": [{"type": "bold"}]}]},
            {"type": "taskList", "attrs": {"blockId": "t1"}, "content": [
                {"type": "taskItem", "attrs": {"checked": true},
                 "content": [{"type": "paragraph", "content": [{"type": "text", "text": "hecho"}]}]}
            ]}
        ]
    })
    .to_string();
    pages::save_page_content(&mut w.conn, &w.ctx, &p.id, &content, 1).unwrap();
    let _ = child;

    let dest = tmp.path().join("export");
    let files = export::export_page_markdown(&w, &p.id, &dest, true).unwrap();
    assert_eq!(files.len(), 2);
    let md = std::fs::read_to_string(&files[0]).unwrap();
    assert!(md.contains("## Sección"));
    assert!(md.contains("**negrita**"));
    assert!(md.contains("- [x] hecho"));

    let json_file = tmp.path().join("export/workspace.json");
    export::export_workspace_json(&w, &json_file).unwrap();
    let parsed: serde_json::Value =
        serde_json::from_str(&std::fs::read_to_string(&json_file).unwrap()).unwrap();
    assert_eq!(parsed["formatVersion"], 1);
    assert!(parsed["pages"].as_array().unwrap().len() >= 3);
}

// ---- Respaldos -------------------------------------------------------------------

#[test]
fn backup_create_validate_restore() {
    let tmp = TempDir::new().unwrap();
    let mut w = ws(tmp.path());
    let p = pages::create_page(&w.conn, &w.ctx, None, "Importante", None).unwrap();
    pages::save_page_content(&mut w.conn, &w.ctx, &p.id, &doc("contenido vital"), 1).unwrap();
    attachments::import_bytes(&w, PNG_1PX, "pixel.png").unwrap();

    let dest = tmp.path().join("backups");
    let zip = backup::create_backup(&w, &dest).unwrap();
    let summary = backup::validate_backup(&zip).unwrap();
    assert_eq!(summary.workspace_name, "Pruebas");
    assert_eq!(summary.attachment_count, 1);
    assert!(summary.page_count >= 2);

    // Restaurar como workspace nuevo.
    let app_dir = tmp.path().join("appdata");
    let reg = Registry::open(&app_dir).unwrap();
    let restored = backup::restore_backup(&reg, &zip, &tmp.path().join("restored")).unwrap();
    let w2 = workspace::open_workspace(&restored, &reg.device_id).unwrap();
    let detail = pages::get_page(&w2.conn, &p.id).unwrap();
    assert!(detail.content_json.contains("contenido vital"));
    // La restauración nunca pisa: segunda restauración crea otra carpeta.
    let restored2 = backup::restore_backup(&reg, &zip, &tmp.path().join("restored")).unwrap();
    assert_ne!(restored, restored2);
}

#[test]
fn corrupt_backup_is_rejected_without_touching_data() {
    let tmp = TempDir::new().unwrap();
    let w = ws(tmp.path());
    let dest = tmp.path().join("backups");
    let zip = backup::create_backup(&w, &dest).unwrap();

    // Corromper bytes del zip (dentro del contenido de la base).
    let mut bytes = std::fs::read(&zip).unwrap();
    let mid = bytes.len() / 2;
    bytes[mid] ^= 0xFF;
    bytes[mid + 1] ^= 0xFF;
    let bad = dest.join("corrupto.zip");
    std::fs::write(&bad, &bytes).unwrap();
    let res = backup::validate_backup(&bad);
    assert!(res.is_err(), "un backup corrupto debe rechazarse");

    // Un zip que no es de Nodora también.
    let not_backup = dest.join("otro.zip");
    let f = std::fs::File::create(&not_backup).unwrap();
    let mut zw = zip::ZipWriter::new(f);
    use std::io::Write;
    zw.start_file("hola.txt", zip::write::SimpleFileOptions::default())
        .unwrap();
    zw.write_all(b"hola").unwrap();
    zw.finish().unwrap();
    assert!(backup::validate_backup(&not_backup).is_err());
}

// ---- Volumen --------------------------------------------------------------------

#[test]
fn thousands_of_pages_stay_responsive() {
    let tmp = TempDir::new().unwrap();
    let w = ws(tmp.path());
    let t0 = std::time::Instant::now();
    for i in 0..2000 {
        pages::create_page(&w.conn, &w.ctx, None, &format!("Página {i}"), None).unwrap();
    }
    let created = t0.elapsed();
    let t1 = std::time::Instant::now();
    let all = pages::list_pages(&w.conn).unwrap();
    assert_eq!(all.len(), 2001);
    let listed = t1.elapsed();
    let t2 = std::time::Instant::now();
    let hits = search::search(&w.conn, "Página", false, false, 30).unwrap();
    assert_eq!(hits.len(), 30);
    let searched = t2.elapsed();
    // Cotas laxas para CI; el objetivo es detectar regresiones brutales.
    assert!(
        created.as_secs() < 60,
        "crear 2000 páginas tardó {created:?}"
    );
    assert!(listed.as_millis() < 2000, "listar tardó {listed:?}");
    assert!(searched.as_millis() < 1000, "buscar tardó {searched:?}");
}

#[test]
fn page_with_thousands_of_blocks_saves_and_projects() {
    let tmp = TempDir::new().unwrap();
    let mut w = ws(tmp.path());
    let p = pages::create_page(&w.conn, &w.ctx, None, "Enorme", None).unwrap();
    let blocks: Vec<serde_json::Value> = (0..3000)
        .map(|i| {
            serde_json::json!({
                "type": "paragraph", "attrs": {"blockId": format!("b-{i}")},
                "content": [{"type": "text", "text": format!("línea {i} con texto adicional")}]
            })
        })
        .collect();
    let big = serde_json::json!({"type": "doc", "content": blocks}).to_string();
    let t0 = std::time::Instant::now();
    pages::save_page_content(&mut w.conn, &w.ctx, &p.id, &big, 1).unwrap();
    assert!(t0.elapsed().as_secs() < 10);
    let hits = search::search(&w.conn, "línea", false, false, 5).unwrap();
    assert_eq!(hits[0].page_id, p.id);
}
