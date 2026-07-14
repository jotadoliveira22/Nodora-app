// Nodora — punto de entrada del binario de escritorio.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    nodora_desktop_lib::run()
}
