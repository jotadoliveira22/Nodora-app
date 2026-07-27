//! Prueba de aceptación del MVP.
//!
//! Recorre en una sola historia los criterios de éxito de
//! `docs/NODORA_SPEC.md` §16 que son verificables sin interfaz gráfica: una
//! consultora gestiona un cliente real, cierra la aplicación, la reabre,
//! busca, enlaza, adjunta, exporta, respalda y restaura.
//!
//! Los criterios 1 (instalar en Windows) y 14 (trabajar sin internet) se
//! verifican fuera de aquí: el primero con el artefacto NSIS de CI, el
//! segundo porque el código no contiene ninguna capacidad de red (la CSP
//! prohíbe orígenes remotos y el binario no declara permisos HTTP).

use nodora_desktop_lib::{
    attachments, backup, dbview, export, pages, registry::Registry, search, workspace,
};
use tempfile::TempDir;

const DEVICE: &str = "33333333-3333-4333-8333-333333333333";

const PNG_1PX: &[u8] = &[
    0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0x00, 0x00, 0x00, 0x0D, 0x49, 0x48, 0x44,
    0x52, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01, 0x08, 0x06, 0x00, 0x00, 0x00, 0x1F,
    0x15, 0xC4, 0x89, 0x00, 0x00, 0x00, 0x0D, 0x49, 0x44, 0x41, 0x54, 0x78, 0x9C, 0x62, 0x00,
    0x01, 0x00, 0x00, 0x05, 0x00, 0x01, 0x0D, 0x0A, 0x2D, 0xB4, 0x00, 0x00, 0x00, 0x00, 0x49,
    0x45, 0x4E, 0x44, 0xAE, 0x42, 0x60, 0x82,
];

fn paragraph(text: &str, block: &str) -> serde_json::Value {
    serde_json::json!({
        "type": "paragraph", "attrs": {"blockId": block},
        "content": [{"type": "text", "text": text}]
    })
}

#[test]
fn una_consultora_gestiona_un_cliente_de_principio_a_fin() {
    let home = TempDir::new().unwrap();
    let app_dir = home.path().join("appdata");
    let registry = Registry::open(&app_dir).unwrap();

    // --- Criterio 2: crear un espacio de trabajo -------------------------
    let ws_dir = home.path().join("mi-consultora");
    let ws = workspace::create_workspace(&ws_dir, "Mi Consultora", Some("🗂️"), &registry.device_id)
        .unwrap();
    registry.remember(&ws.info().unwrap().id, "Mi Consultora", &ws_dir).unwrap();
    assert_eq!(ws.info().unwrap().name, "Mi Consultora");
    assert!(ws_dir.join("nodora.db").exists());
    assert!(ws_dir.join("attachments").exists());

    let mut ws = ws;

    // --- Criterio 3: crear y organizar páginas ---------------------------
    let cliente = pages::create_page(&ws.conn, &ws.ctx, None, "Cliente Aurora", Some("🏢")).unwrap();
    let reuniones =
        pages::create_page(&ws.conn, &ws.ctx, Some(&cliente.id), "Reuniones", None).unwrap();
    let acta = pages::create_page(&ws.conn, &ws.ctx, Some(&reuniones.id), "Acta 12/03", None)
        .unwrap();
    let procesos = pages::create_page(&ws.conn, &ws.ctx, None, "Procesos internos", None).unwrap();

    // Se reorganiza: los procesos pasan a colgar del cliente.
    pages::move_page(&ws.conn, &ws.ctx, &procesos.id, Some(&cliente.id), None).unwrap();
    let ruta = pages::breadcrumbs(&ws.conn, &acta.id).unwrap();
    assert_eq!(
        ruta.iter().map(|c| c.title.as_str()).collect::<Vec<_>>(),
        vec!["Cliente Aurora", "Reuniones", "Acta 12/03"]
    );

    // --- Criterio 4: escribir contenido mediante bloques ------------------
    let contenido = serde_json::json!({
        "type": "doc",
        "content": [
            {"type": "heading", "attrs": {"level": 2, "blockId": "h-1"},
             "content": [{"type": "text", "text": "Acuerdos"}]},
            paragraph("El cliente aprueba el presupuesto de auditoría.", "p-1"),
            {"type": "taskList", "attrs": {"blockId": "t-1"}, "content": [
                {"type": "taskItem", "attrs": {"checked": false},
                 "content": [{"type": "paragraph",
                              "content": [{"type": "text", "text": "Enviar contrato"}]}]}
            ]},
            {"type": "callout", "attrs": {"emoji": "⚠️", "blockId": "c-1"},
             "content": [{"type": "paragraph",
                          "content": [{"type": "text", "text": "Plazo improrrogable"}]}]}
        ]
    });
    let guardado =
        pages::save_page_content(&mut ws.conn, &ws.ctx, &acta.id, &contenido.to_string(), acta.version)
            .unwrap();

    // --- Criterio 10: adjuntar una imagen local ---------------------------
    let logo = attachments::import_bytes(&ws, PNG_1PX, "logo-aurora.png").unwrap();
    let con_imagen = serde_json::json!({
        "type": "doc",
        "content": [
            paragraph("El cliente aprueba el presupuesto de auditoría.", "p-1"),
            {"type": "image", "attrs": {"attachmentId": logo.id, "blockId": "i-1"}}
        ]
    });
    let guardado = pages::save_page_content(
        &mut ws.conn,
        &ws.ctx,
        &acta.id,
        &con_imagen.to_string(),
        guardado.version,
    )
    .unwrap();
    assert!(attachments::verify(&ws, &logo.id).unwrap());

    // --- Criterio 9: enlaces internos y backlinks -------------------------
    let con_enlace = serde_json::json!({
        "type": "doc",
        "content": [
            {"type": "paragraph", "attrs": {"blockId": "p-2"}, "content": [
                {"type": "text", "text": "Según "},
                {"type": "pageLink", "attrs": {"pageId": procesos.id}}
            ]}
        ]
    });
    pages::save_page_content(&mut ws.conn, &ws.ctx, &acta.id, &con_enlace.to_string(), guardado.version)
        .unwrap();
    let backlinks = pages::backlinks(&ws.conn, &procesos.id).unwrap();
    assert_eq!(backlinks.len(), 1);
    assert_eq!(backlinks[0].title, "Acta 12/03");

    // --- Criterio 7: crear una base de datos sencilla ---------------------
    let db = dbview::create_database(&mut ws.conn, &ws.ctx, Some(&cliente.id), "Facturas").unwrap();
    let importe = dbview::add_property(&ws.conn, &db.id, "Importe", "number").unwrap();
    let estado = dbview::add_property(&ws.conn, &db.id, "Estado", "select").unwrap();
    let vence = dbview::add_property(&ws.conn, &db.id, "Vencimiento", "date").unwrap();

    for (titulo, eur, dia) in
        [("F-2026-001", 1500.0, "2026-08-01"), ("F-2026-002", 2300.5, "2026-09-15")]
    {
        let rec = dbview::create_record(&ws.conn, &ws.ctx, &db.id).unwrap();
        pages::rename_page(&ws.conn, &ws.ctx, &rec, titulo).unwrap();
        dbview::set_record_value(
            &ws.conn,
            &ws.ctx,
            &rec,
            &importe.id,
            Some(&serde_json::json!({ "number": eur }).to_string()),
        )
        .unwrap();
        dbview::set_record_value(
            &ws.conn,
            &ws.ctx,
            &rec,
            &vence.id,
            Some(&serde_json::json!({ "date": { "start": dia, "end": null } }).to_string()),
        )
        .unwrap();
    }
    let _ = estado;

    let orden = dbview::RecordSort { property_id: Some(importe.id.clone()), direction: "desc".into() };
    let filas = dbview::list_records(&ws.conn, &db.id, Some(&orden), &[]).unwrap();
    assert_eq!(filas.len(), 2);
    assert_eq!(filas[0].title, "F-2026-002", "el orden descendente por importe manda");

    // --- Criterios 5 y 6: cerrar y reabrir sin perder nada ----------------
    let ws_path = ws.path.clone();
    drop(ws);
    let mut ws = workspace::open_workspace(&ws_path, &registry.device_id).unwrap();

    let acta_tras_reabrir = pages::get_page(&ws.conn, &acta.id).unwrap();
    assert!(acta_tras_reabrir.content_json.contains(&procesos.id));
    assert_eq!(pages::backlinks(&ws.conn, &procesos.id).unwrap().len(), 1);
    assert_eq!(dbview::list_records(&ws.conn, &db.id, None, &[]).unwrap().len(), 2);
    assert!(attachments::verify(&ws, &logo.id).unwrap());

    // --- Criterio 8: buscar contenido -------------------------------------
    let hits = search::search(&ws.conn, "auditoria", false, false, 10).unwrap();
    assert!(
        hits.is_empty(),
        "el texto se sustituyó por el enlace: la búsqueda refleja el contenido actual"
    );
    let hits = search::search(&ws.conn, "Aurora", false, false, 10).unwrap();
    assert_eq!(hits.len(), 1);
    assert_eq!(hits[0].title, "Cliente Aurora");
    let hits = search::search(&ws.conn, "factura", false, false, 10).unwrap();
    assert!(!hits.is_empty(), "la base de datos también es buscable por su título");

    // --- Criterio 11: exportar información --------------------------------
    let export_dir = home.path().join("exportacion");
    let ficheros = export::export_page_markdown(&ws, &cliente.id, &export_dir, true).unwrap();
    assert!(ficheros.len() >= 4, "el subárbol completo se exporta: {ficheros:?}");
    let json = home.path().join("exportacion/todo.json");
    export::export_workspace_json(&ws, &json).unwrap();
    let parsed: serde_json::Value =
        serde_json::from_str(&std::fs::read_to_string(&json).unwrap()).unwrap();
    assert_eq!(parsed["formatVersion"], 1);
    assert!(parsed["databaseProperties"].as_array().unwrap().len() >= 4);

    // --- Criterio 12: crear un respaldo ------------------------------------
    let zip = backup::create_backup(&ws, &home.path().join("respaldos")).unwrap();
    let resumen = backup::validate_backup(&zip).unwrap();
    assert_eq!(resumen.workspace_name, "Mi Consultora");
    assert_eq!(resumen.attachment_count, 1);

    // --- Criterio 15: recuperarse de errores razonables ---------------------
    // Un guardado con versión obsoleta se rechaza sin tocar el contenido.
    let antes = pages::get_page(&ws.conn, &acta.id).unwrap();
    let _ = pages::save_page_content(&mut ws.conn, &ws.ctx, &acta.id, "{\"type\":\"doc\"}", 1);
    // Un documento inválido tampoco entra.
    let _ = pages::save_page_content(
        &mut ws.conn,
        &ws.ctx,
        &acta.id,
        r#"{"type":"doc","content":[{"type":"script"}]}"#,
        antes.version,
    );
    let despues = pages::get_page(&ws.conn, &acta.id).unwrap();
    assert_eq!(antes.content_json, despues.content_json, "los rechazos no alteran el contenido");
    assert_eq!(antes.version, despues.version);

    // Archivar y restaurar devuelve el subárbol intacto.
    pages::archive_page(&mut ws.conn, &ws.ctx, &cliente.id).unwrap();
    let visibles = pages::list_pages(&ws.conn).unwrap();
    for oculta in [&cliente.id, &reuniones.id, &acta.id, &procesos.id] {
        assert!(
            !visibles.iter().any(|p| &p.id == oculta),
            "archivar el cliente debe ocultar todo su subárbol"
        );
    }
    // La página de bienvenida, que no cuelga del cliente, sigue visible.
    assert!(visibles.iter().any(|p| p.title == "Bienvenida"));
    pages::restore_page(&mut ws.conn, &ws.ctx, &cliente.id).unwrap();
    assert_eq!(pages::breadcrumbs(&ws.conn, &acta.id).unwrap().len(), 3);

    // --- Criterio 13: restaurar el respaldo --------------------------------
    let restaurado =
        backup::restore_backup(&registry, &zip, &home.path().join("restaurados")).unwrap();
    let copia = workspace::open_workspace(&restaurado, &registry.device_id).unwrap();

    // El espacio restaurado es independiente y está completo.
    assert_ne!(restaurado, ws_path);
    assert_eq!(copia.info().unwrap().name, "Mi Consultora");
    let acta_copia = pages::get_page(&copia.conn, &acta.id).unwrap();
    assert_eq!(acta_copia.content_json, acta_tras_reabrir.content_json);
    assert_eq!(pages::backlinks(&copia.conn, &procesos.id).unwrap().len(), 1);
    assert_eq!(dbview::list_records(&copia.conn, &db.id, None, &[]).unwrap().len(), 2);
    assert!(attachments::verify(&copia, &logo.id).unwrap());
    assert_eq!(search::search(&copia.conn, "Aurora", false, false, 10).unwrap().len(), 1);

    // Y el espacio original sigue intacto tras la restauración.
    assert!(ws_path.join("nodora.db").exists());
    assert_eq!(pages::get_page(&ws.conn, &acta.id).unwrap().id, acta.id);
}

#[test]
fn el_espacio_es_portatil_entre_carpetas() {
    // Criterio implícito de «tus datos son tuyos»: copiar la carpeta a otro
    // sitio y abrirla desde allí debe funcionar sin más.
    let home = TempDir::new().unwrap();
    let origen = home.path().join("origen");
    let mut ws = workspace::create_workspace(&origen, "Portátil", None, DEVICE).unwrap();
    let p = pages::create_page(&ws.conn, &ws.ctx, None, "Nota", None).unwrap();
    pages::save_page_content(
        &mut ws.conn,
        &ws.ctx,
        &p.id,
        &serde_json::json!({"type": "doc", "content": [paragraph("contenido portátil", "b-1")]})
            .to_string(),
        p.version,
    )
    .unwrap();
    attachments::import_bytes(&ws, PNG_1PX, "img.png").unwrap();
    drop(ws);

    // Copia manual de la carpeta, como haría el usuario con el explorador.
    let destino = home.path().join("copiado");
    std::fs::create_dir_all(destino.join("attachments")).unwrap();
    for entrada in std::fs::read_dir(&origen).unwrap() {
        let entrada = entrada.unwrap();
        if entrada.path().is_file() {
            std::fs::copy(entrada.path(), destino.join(entrada.file_name())).unwrap();
        }
    }
    for entrada in std::fs::read_dir(origen.join("attachments")).unwrap() {
        let entrada = entrada.unwrap();
        std::fs::copy(entrada.path(), destino.join("attachments").join(entrada.file_name()))
            .unwrap();
    }

    let copia = workspace::open_workspace(&destino, DEVICE).unwrap();
    assert_eq!(pages::get_page(&copia.conn, &p.id).unwrap().title, "Nota");
    assert_eq!(search::search(&copia.conn, "portátil", false, false, 5).unwrap().len(), 1);
}
