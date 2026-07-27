//! Guardarraíl del criterio 14 de `docs/NODORA_SPEC.md` §16: la aplicación
//! debe funcionar completamente sin internet.
//!
//! En lugar de afirmarlo, se verifica que el binario no tiene con qué salir a
//! la red: sin dependencias de cliente HTTP, sin permisos de red ni de shell
//! en las capacidades de Tauri, con una CSP que prohíbe orígenes remotos y
//! sin llamadas de red en el código del frontend. Si alguien añade una,
//! esta prueba falla y obliga a una decisión consciente (ADR).

use std::path::{Path, PathBuf};

fn crate_dir() -> PathBuf {
    PathBuf::from(env!("CARGO_MANIFEST_DIR"))
}

fn read(path: &Path) -> String {
    std::fs::read_to_string(path)
        .unwrap_or_else(|e| panic!("no se pudo leer {}: {e}", path.display()))
}

#[test]
fn el_backend_no_declara_dependencias_de_red() {
    let cargo = read(&crate_dir().join("Cargo.toml"));
    // Solo se mira la sección de dependencias de producción.
    let prod = cargo
        .split("[dev-dependencies]")
        .next()
        .expect("Cargo.toml sin secciones")
        .to_string();
    for prohibida in [
        "reqwest",
        "hyper",
        "ureq",
        "curl",
        "tokio-tungstenite",
        "tungstenite",
        "isahc",
        "surf",
        "tauri-plugin-http",
        "tauri-plugin-websocket",
        "tauri-plugin-updater",
    ] {
        assert!(
            !prod.contains(prohibida),
            "«{prohibida}» daría capacidad de red al binario; si es deliberado, \
             documenta un ADR y actualiza esta prueba"
        );
    }
}

#[test]
fn las_capacidades_no_conceden_red_ni_shell() {
    let caps = read(&crate_dir().join("capabilities/default.json"));
    let json: serde_json::Value = serde_json::from_str(&caps).expect("capabilities inválidas");
    let permisos: Vec<String> = json["permissions"]
        .as_array()
        .expect("permissions debe ser lista")
        .iter()
        .map(|p| p.as_str().unwrap_or_default().to_string())
        .collect();
    assert!(!permisos.is_empty());
    for permiso in &permisos {
        for prohibido in ["http", "shell", "websocket", "updater", "fs:"] {
            assert!(
                !permiso.contains(prohibido),
                "el permiso «{permiso}» abre una capacidad que el MVP no debe tener"
            );
        }
    }
}

#[test]
fn la_csp_prohibe_origenes_remotos() {
    let conf = read(&crate_dir().join("tauri.conf.json"));
    let json: serde_json::Value = serde_json::from_str(&conf).expect("tauri.conf.json inválido");
    let csp = json["app"]["security"]["csp"]
        .as_str()
        .expect("debe haber una CSP declarada");

    // Ninguna directiva puede abrir la puerta a orígenes remotos ni a eval.
    // Se admiten solo los orígenes locales del propio webview de Tauri
    // (asset:, ipc:, y sus equivalentes http://*.localhost).
    let sospechosos = ["https://", "*", "unsafe-eval", "data:script"];
    for remoto in sospechosos {
        assert!(
            !csp.contains(remoto),
            "la CSP no debe permitir «{remoto}»; CSP actual: {csp}"
        );
    }
    for token in csp.split_whitespace() {
        let origen = token.trim_end_matches(';');
        if origen.starts_with("http://") {
            assert!(
                origen.ends_with(".localhost"),
                "solo se admiten orígenes locales de Tauri, no «{origen}»"
            );
        }
    }
    // Y debe fijar explícitamente los orígenes propios.
    assert!(
        csp.contains("default-src 'self'"),
        "la CSP debe partir de default-src 'self'"
    );
    assert!(
        csp.contains("script-src 'self'"),
        "los scripts solo pueden venir de la app"
    );
    assert!(csp.contains("object-src 'none'"), "sin plugins incrustados");
}

#[test]
fn el_frontend_no_hace_llamadas_de_red() {
    // Se recorre el código del frontend y de los paquetes compartidos.
    let raices = [
        crate_dir().join("../src"),
        crate_dir().join("../../../packages/editor/src"),
        crate_dir().join("../../../packages/shared/src"),
    ];
    let patrones = [
        "fetch(",
        "XMLHttpRequest",
        "new WebSocket",
        "EventSource",
        "navigator.sendBeacon",
    ];

    let mut revisados = 0;
    for raiz in raices {
        if !raiz.exists() {
            continue;
        }
        let mut pila = vec![raiz];
        while let Some(dir) = pila.pop() {
            for entrada in std::fs::read_dir(&dir).expect("directorio ilegible") {
                let ruta = entrada.expect("entrada ilegible").path();
                if ruta.is_dir() {
                    pila.push(ruta);
                    continue;
                }
                let ext = ruta.extension().and_then(|e| e.to_str()).unwrap_or("");
                if !matches!(ext, "ts" | "tsx") {
                    continue;
                }
                let contenido = read(&ruta);
                revisados += 1;
                for patron in patrones {
                    assert!(
                        !contenido.contains(patron),
                        "«{patron}» aparece en {}: el MVP no debe hacer peticiones de red",
                        ruta.display()
                    );
                }
            }
        }
    }
    assert!(
        revisados > 10,
        "se esperaban más archivos de frontend revisados, hubo {revisados}"
    );
}
