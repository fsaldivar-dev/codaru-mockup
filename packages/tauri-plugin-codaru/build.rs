const COMMANDS: &[&str] = &[
    "agent_poll",
    "agent_respond",
    "save_document",
    "open_document",
];

fn main() {
    tauri_plugin::Builder::new(COMMANDS).build();
}
