#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_codaru::init())
        .run(tauri::generate_context!())
        .expect("No se pudo iniciar Codaru Mockup");
}
