//! Puente de verificación entre el catálogo de plantillas (TypeScript) y el
//! backend que tendrá que guardarlas.
//!
//! El fixture lo genera `packages/shared/test/templates.test.ts`. Aquí se
//! valida con el validador real y se guarda cada documento en una página de
//! verdad: si una plantilla produjese un documento inválido, la compilación
//! falla en vez de fallar al usuario al pulsar la plantilla.

use nodora_desktop_lib::{pages, search, validate, workspace};
use serde_json::Value;
use tempfile::TempDir;

const DEVICE: &str = "44444444-4444-4444-8444-444444444444";

fn fixture() -> Vec<Value> {
    let raw = include_str!("../../../../packages/shared/templates.fixture.json");
    serde_json::from_str(raw).expect("templates.fixture.json debe ser JSON válido")
}

#[test]
fn every_template_document_is_valid() {
    let plantillas = fixture();
    assert!(
        plantillas.len() >= 15,
        "el catálogo no debería encogerse sin querer"
    );

    for t in &plantillas {
        let id = t["id"].as_str().unwrap();
        let doc = t["doc"].to_string();
        let proyeccion = validate::validate_and_project(&doc)
            .unwrap_or_else(|e| panic!("la plantilla «{id}» genera un documento inválido: {e}"));
        // Ninguna plantilla trae adjuntos ni enlaces: se rellenan al usarla.
        assert!(
            proyeccion.attachments.is_empty(),
            "{id} no debe traer adjuntos"
        );
        assert!(proyeccion.links.is_empty(), "{id} no debe traer enlaces");
    }
}

#[test]
fn templates_can_be_saved_and_found_by_search() {
    // Guardar de verdad ejercita la transacción completa: contenido, índice
    // FTS y proyección de enlaces.
    let tmp = TempDir::new().unwrap();
    let mut w =
        workspace::create_workspace(&tmp.path().join("w"), "Plantillas", None, DEVICE).unwrap();

    for t in fixture() {
        let id = t["id"].as_str().unwrap();
        let titulo = t["title"].as_str().unwrap().trim();
        let doc = t["doc"].to_string();
        let page = pages::create_page(&w.conn, &w.ctx, None, titulo, None).unwrap();
        pages::save_page_content(&mut w.conn, &w.ctx, &page.id, &doc, page.version)
            .unwrap_or_else(|e| panic!("la plantilla «{id}» no se puede guardar: {e}"));

        let leida = pages::get_page(&w.conn, &page.id).unwrap();
        let original: Value = serde_json::from_str(&doc).unwrap();
        let guardada: Value = serde_json::from_str(&leida.content_json).unwrap();
        assert_eq!(original, guardada, "«{id}» debe guardarse tal cual");
    }

    // Y el contenido de las plantillas es indexable: buscar un término que
    // solo aparece en una de ellas la encuentra.
    let hits = search::search(&w.conn, "acuerdos", false, false, 20).unwrap();
    assert!(
        !hits.is_empty(),
        "el contenido de las plantillas debe entrar en el índice de búsqueda"
    );
}
