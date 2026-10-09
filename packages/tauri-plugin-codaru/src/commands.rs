use crate::{AgentRequest, AgentState};
use std::io::Read;

const MAX_DOCUMENT_BYTES: usize = 20_000_000;

#[tauri::command]
pub(crate) fn agent_poll(state: tauri::State<'_, AgentState>) -> Result<Option<AgentRequest>, String> {
    Ok(state.bridge()?.poll())
}

#[tauri::command]
pub(crate) fn agent_respond(
    id: String,
    response: serde_json::Value,
    state: tauri::State<'_, AgentState>,
) -> Result<(), String> {
    state.bridge()?.respond(&id, response)
}

fn validate_save(content: &str, filename: &str, extension: &str) -> Result<(), String> {
    if !["json", "svg", "html", "png", "zip", "aru"].contains(&extension) {
        return Err("Formato no admitido".into());
    }
    // This is a suggested dialog name, never a path provided by the frontend.
    if filename.is_empty() || filename.len() > 255 || filename.chars().any(|c| c.is_control() || c == '/' || c == '\\') {
        return Err("El nombre sugerido debe ser un nombre de archivo, no una ruta".into());
    }
    if content.len() > crate::agent_transport::MAX_RESPONSE_BYTES {
        return Err("La exportación supera 64 MB".into());
    }
    Ok(())
}

#[tauri::command]
pub(crate) async fn save_document(content: String, filename: String, extension: String, encoding: Option<String>) -> Result<Option<String>, String> {
    validate_save(&content, &filename, &extension)?;
    if ["png", "zip"].contains(&extension.as_str()) && encoding.as_deref() != Some("base64") { return Err("PNG/ZIP necesitan contenido base64".into()); }
    let bytes = crate::export_content::decode(&content, encoding.as_deref())?;
    let selected = rfd::AsyncFileDialog::new()
        .set_file_name(&filename)
        .add_filter("Documento", &[&extension])
        .save_file()
        .await;
    if let Some(file) = selected {
        std::fs::write(file.path(), bytes).map_err(|e| e.to_string())?;
        Ok(Some(file.path().to_string_lossy().into_owned()))
    } else {
        Ok(None)
    }
}

fn read_document(path: &std::path::Path) -> Result<String, String> {
    let file = std::fs::File::open(path).map_err(|e| e.to_string())?;
    if !file.metadata().map_err(|e| e.to_string())?.is_file() {
        return Err("Selecciona un archivo de proyecto".into());
    }
    let mut bytes = Vec::new();
    file.take(MAX_DOCUMENT_BYTES as u64 + 1).read_to_end(&mut bytes).map_err(|e| e.to_string())?;
    if bytes.len() > MAX_DOCUMENT_BYTES { return Err("El archivo supera 20 MB".into()); }
    String::from_utf8(bytes).map_err(|_| "El documento no contiene texto UTF-8 válido".into())
}

#[tauri::command]
pub(crate) async fn open_document() -> Result<Option<String>, String> {
    let selected = rfd::AsyncFileDialog::new()
        .add_filter("Proyecto Codaru", &["json"])
        .pick_file()
        .await;
    selected.map(|file| read_document(file.path())).transpose()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn save_accepts_only_supported_formats_and_plain_dialog_names() {
        assert!(validate_save("{}", "Proyecto personal.json", "json").is_ok());
        assert!(validate_save("<svg/>", "Vista.svg", "svg").is_ok());
        for filename in ["", "../outside.json", "/tmp/project.json", "x\\project.json", "line\nname.json"] {
            assert!(validate_save("{}", filename, "json").is_err());
        }
        assert!(validate_save("", "file.exe", "exe").is_err());
    }

    #[test]
    fn local_document_read_is_bounded_and_utf8_checked() {
        let path = std::env::temp_dir().join(format!("codaru-plugin-document-{}.json", std::process::id()));
        std::fs::write(&path, "{\"name\":\"Prueba\"}").unwrap();
        assert_eq!(read_document(&path).unwrap(), "{\"name\":\"Prueba\"}");
        std::fs::write(&path, [0xff, 0xfe]).unwrap();
        assert!(read_document(&path).unwrap_err().contains("UTF-8"));
        std::fs::File::create(&path).unwrap().set_len(MAX_DOCUMENT_BYTES as u64 + 1).unwrap();
        assert!(read_document(&path).unwrap_err().contains("20 MB"));
        std::fs::remove_file(path).unwrap();
    }
}
