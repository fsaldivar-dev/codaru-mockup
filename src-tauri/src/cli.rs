// Share the transport source without linking the CLI to the plugin's Tauri API.
#[path = "../../packages/tauri-plugin-codaru/src/agent_transport.rs"]
mod agent_transport;
#[cfg(test)]
#[path = "../../packages/tauri-plugin-codaru/src/bridge.rs"]
mod bridge;

#[path = "../../packages/tauri-plugin-codaru/src/export_content.rs"]
mod export_content;

use agent_transport::{AgentError, Result, MAX_REQUEST_BYTES};
use serde_json::{json, Map, Value};
use std::io::{Read, Write};
use std::path::{Path, PathBuf};

const HELP: &str = "codaru — local JSON CLI for the running Codaru Mockup app

Usage: codaru [--socket PATH] COMMAND [OPTIONS]

  context [--scope SCOPE] [--depth N] [--page ID]  Read selection, frame, page, or workspace
  schema                                  Discover commands and operation schema
  comments [--id ID]                       Read threads or exact context of one anchor
  catalog [--kind KIND] [--kit KIT] [--query TEXT]
  locale [CODE|source]                    Inspect or change the preview language (no document edit)
  apply --file PATH|- [--dry-run]           Apply one atomic operation batch
  select [ID ...] [--ids ID,ID]             Select IDs; no IDs clears selection
  undo                                    Undo one editor transaction
  redo                                    Redo one editor transaction
  export [--format json|html|svg|png|assets|aru] [--frame ID | --ids ID,ID | --resource ID] [--page ID]
         [--platform ios|android|all] [--name NAME] [--width N] [--padding N] [--scale N] [--output PATH]
  lint [--frame ID] [--page ID]             Review contrast, targets and consistency
  find --query TEXT [--frame ID] [--page ID] [--type TYPE] [--limit N]
  versions [--compare ID]                   List saved versions; compare one with the design
  --help                                  Show this help without opening the app

Workflow:
  1. Open Codaru Mockup; context reads its current canvas and revision.
  2. Use catalog and schema to discover existing assets and supported operations.
  3. Write {\"expectedRevision\":\"REVISION\",\"operations\":[...]} to a JSON file.
  4. Run apply --file changes.json --dry-run, then apply --file changes.json.
  5. Use the returned context and revision for the next batch.

All commands except --help print JSON. Errors have ok:false and a nonzero exit.
The app must be running, including for schema; a closed app returns APP_NOT_RUNNING.
Requests are limited to 20 MB. A timed-out change may have applied: read context
before retrying. Export --output writes content locally and reports the file path.
HTML preserves approximate glass effects; SVG uses the editor's simplified fallback.
The bridge requires macOS or another Unix platform. No Node.js or MCP is needed.

Socket: ~/.local/share/codaru-mockup/agent.sock
Override with CODARU_AGENT_SOCKET for both app and CLI, or --socket for this CLI.
The containing directory must be private (0700) and the socket mode is 0600.
";

#[derive(Debug, PartialEq)]
struct Options { command: String, params: Map<String, Value>, file: Option<String>, output: Option<PathBuf>, socket: Option<PathBuf> }
fn invalid(message: impl Into<String>) -> AgentError { AgentError::new("INVALID_ARGUMENT", message) }
fn take_value(args: &[String], position: &mut usize, option: &str) -> Result<String> {
    *position += 1;
    args.get(*position).cloned().ok_or_else(|| invalid(format!("{} requires a value. Run codaru --help.", option)))
}
fn parse(args: &[String]) -> Result<Options> {
    let mut index = 0; let mut socket = None;
    if args.first().map(String::as_str) == Some("--socket") {
        socket = Some(PathBuf::from(take_value(args, &mut index, "--socket")?)); index += 1;
    }
    let command = args.get(index).ok_or_else(|| invalid("Choose a command. Run codaru --help."))?.clone(); index += 1;
    if !["schema", "context", "comments", "apply", "catalog", "select", "undo", "redo", "export", "lint", "find", "versions", "locale"].contains(&command.as_str()) { return Err(invalid(format!("Unknown command '{}'. Run codaru --help.", command))); }
    let mut options = Options { command, params: Map::new(), file: None, output: None, socket };
    let mut ids = Vec::new(); let mut seen = std::collections::HashSet::new();
    while index < args.len() {
        let arg = &args[index];
        if arg.starts_with("--") && !seen.insert(arg.clone()) { return Err(invalid(format!("{} was specified more than once.", arg))); }
        match (options.command.as_str(), arg.as_str()) {
            ("context", "--scope") => { options.params.insert("scope".into(), json!(take_value(args, &mut index, arg)?)); },
            ("comments", "--id") => { options.params.insert("id".into(), json!(take_value(args, &mut index, arg)?)); },
            ("context", "--depth") => {
                let depth = take_value(args, &mut index, arg)?.parse::<u32>().map_err(|_| invalid("--depth must be an integer from 0 to 4."))?;
                if depth > 4 { return Err(invalid("--depth must be an integer from 0 to 4.")); }
                options.params.insert("depth".into(), json!(depth));
            },
            ("catalog", "--kind" | "--kit" | "--query") => { options.params.insert(arg.trim_start_matches("--").into(), json!(take_value(args, &mut index, arg)?)); },
            ("locale", _) if !arg.starts_with('-') && !options.params.contains_key("locale") => {
                options.params.insert("locale".into(), if arg == "source" { Value::Null } else { json!(arg) });
            },
            ("apply", "--file") => { options.file = Some(take_value(args, &mut index, arg)?); },
            ("apply", "--dry-run") => { options.params.insert("dryRun".into(), json!(true)); },
            ("select" | "export", "--ids") => { ids.extend(take_value(args, &mut index, arg)?.split(',').filter(|id| !id.is_empty()).map(str::to_owned)); },
            ("select", _) if !arg.starts_with('-') => ids.push(arg.clone()),
            ("export", "--format") => {
                let format = take_value(args, &mut index, arg)?;
                if !["json", "html", "svg", "png", "assets", "aru"].contains(&format.as_str()) { return Err(invalid("--format must be json, html, svg, png, assets, or aru.")); }
                options.params.insert("format".into(), json!(format));
            },
            ("lint", "--frame") => { options.params.insert("frame".into(), json!(take_value(args, &mut index, arg)?)); },
            ("context" | "lint" | "export" | "find", "--page") => { options.params.insert("page".into(), json!(take_value(args, &mut index, arg)?)); },
            ("find", "--query" | "--frame" | "--type") => { options.params.insert(arg.trim_start_matches("--").into(), json!(take_value(args, &mut index, arg)?)); },
            ("find", "--limit") => {
                let limit = take_value(args, &mut index, arg)?.parse::<u32>().map_err(|_| invalid("--limit must be an integer from 1 to 200."))?;
                options.params.insert("limit".into(), json!(limit));
            },
            ("versions", "--compare") => { options.params.insert("compare".into(), json!(take_value(args, &mut index, arg)?)); },
            ("export", "--resource") => { options.params.insert("resource".into(), json!(take_value(args, &mut index, arg)?)); },
            ("export", "--node") => { ids.push(take_value(args, &mut index, arg)?); },
            ("export", "--platform" | "--name") => { options.params.insert(arg.trim_start_matches("--").into(), json!(take_value(args, &mut index, arg)?)); },
            ("export", "--scale" | "--width" | "--padding") => {
                let value = take_value(args, &mut index, arg)?.parse::<f64>().map_err(|_| invalid(format!("{} must be a number.", arg)))?;
                if !value.is_finite() { return Err(invalid("Export dimensions must be finite.")); }
                options.params.insert(arg.trim_start_matches("--").into(), json!(value));
            },
            ("export", "--frame") => { options.params.insert("frame".into(), json!(take_value(args, &mut index, arg)?)); },
            ("export", "--output") => { options.output = Some(PathBuf::from(take_value(args, &mut index, arg)?)); },
            _ => return Err(invalid(format!("Unexpected option '{}' for {}. Run codaru --help.", arg, options.command))),
        }
        index += 1;
    }
    if options.command == "apply" {
        if options.file.is_none() { return Err(invalid("apply requires --file PATH or --file - for stdin.")); }
        options.params.entry("dryRun").or_insert(json!(false));
    }
    if options.command == "select" { options.params.insert("ids".into(), json!(ids)); }
    if options.command == "export" {
        options.params.entry("format").or_insert(json!("json"));
        if !ids.is_empty() { if options.params.contains_key("frame") { return Err(invalid("Use --frame or --ids, not both.")); } options.params.insert("ids".into(), json!(ids)); }
        if options.params.contains_key("resource") && ["ids","frame","page"].iter().any(|key|options.params.contains_key(*key)) { return Err(invalid("Use --resource without --ids, --frame or --page.")); }
        if ["png", "assets"].contains(&options.params["format"].as_str().unwrap_or("")) && options.output.is_none() { return Err(invalid("PNG/asset exports require --output PATH to keep binary content out of the conversation.")); }
        if let Some(platform) = options.params.get("platform").and_then(Value::as_str) { if !["ios", "android", "all"].contains(&platform) { return Err(invalid("--platform must be ios, android, or all.")); } }
    }
    Ok(options)
}

fn apply_payload(reader: impl Read) -> Result<Map<String, Value>> {
    let mut bytes = Vec::new(); reader.take(MAX_REQUEST_BYTES as u64 + 1).read_to_end(&mut bytes).map_err(|e| AgentError::new("INPUT_UNAVAILABLE", e.to_string()))?;
    if bytes.len() > MAX_REQUEST_BYTES { return Err(AgentError::new("MESSAGE_TOO_LARGE", "The apply file exceeds 20 MB.")); }
    let value: Value = serde_json::from_slice(&bytes).map_err(|e| AgentError::new("INVALID_JSON", format!("The apply file is not valid JSON: {}", e)))?;
    let payload = value.as_object().ok_or_else(|| invalid("The apply file must be an object with expectedRevision and operations."))?;
    if payload.keys().any(|key| key != "expectedRevision" && key != "operations") { return Err(invalid("The apply file accepts only expectedRevision and operations. Pass --dry-run as a CLI option.")); }
    if payload.get("expectedRevision").and_then(Value::as_str).filter(|s| !s.is_empty()).is_none() || !payload.get("operations").is_some_and(Value::is_array) {
        return Err(invalid("The apply file requires a nonempty expectedRevision string and an operations array. Read context and schema first."));
    }
    Ok(payload.clone())
}

fn save_export(path: &Path, response: &mut Value) -> Result<()> {
    let content = response.get("content").and_then(Value::as_str).ok_or_else(|| AgentError::new("INVALID_RESPONSE", "The export response is missing its content string; no file was written."))?;
    let path = if path.is_absolute() { path.to_owned() } else { std::env::current_dir().map_err(|e| AgentError::new("OUTPUT_UNAVAILABLE", e.to_string()))?.join(path) };
    if path.file_name().is_none() { return Err(invalid("--output must name a file.")); }
    let bytes = export_content::decode(content, response.get("encoding").and_then(Value::as_str)).map_err(|message| AgentError::new("INVALID_RESPONSE", message))?;
    let temporary = path.with_file_name(format!(".codaru-export-{}-{}.tmp", std::process::id(), std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap_or_default().as_nanos()));
    let mut options = std::fs::OpenOptions::new(); options.write(true).create_new(true);
    #[cfg(unix)]
    { use std::os::unix::fs::OpenOptionsExt; options.mode(0o600); }
    let mut file = options.open(&temporary).map_err(|e| AgentError::new("OUTPUT_UNAVAILABLE", format!("Cannot write {}: {}", path.display(), e)))?;
    let saved = (|| { file.write_all(&bytes)?; file.sync_all()?; drop(file); std::fs::rename(&temporary, &path) })();
    if let Err(error) = saved { let _ = std::fs::remove_file(&temporary); return Err(AgentError::new("OUTPUT_UNAVAILABLE", format!("Cannot save {}: {}", path.display(), error))); }
    let size = bytes.len();
    let object = response.as_object_mut().unwrap(); object.remove("content"); object.insert("output".into(), json!(path)); object.insert("bytes".into(), json!(size));
    Ok(())
}

fn run(mut options: Options) -> Result<Value> {
    if let Some(path) = &options.file {
        let payload = if path == "-" { apply_payload(std::io::stdin().lock())? } else {
            apply_payload(std::fs::File::open(path).map_err(|e| AgentError::new("INPUT_UNAVAILABLE", format!("Cannot read {}: {}", path, e)))?)?
        };
        options.params.extend(payload);
    }
    let socket = match options.socket { Some(path) => path, None => agent_transport::socket_path()? };
    let mut response = agent_transport::request(&socket, &json!({"command": options.command, "params": options.params}))?;
    if response.get("ok") == Some(&Value::Bool(true)) {
        if let Some(path) = options.output { save_export(&path, &mut response)?; }
    } else if response.get("ok") != Some(&Value::Bool(false)) {
        return Err(AgentError::new("INVALID_RESPONSE", "The app response is missing its ok boolean."));
    }
    Ok(response)
}

fn main() {
    let args: Vec<String> = std::env::args().skip(1).collect();
    if args.is_empty() || args.iter().any(|arg| arg == "--help" || arg == "-h") { print!("{}", HELP); return; }
    let response = parse(&args).and_then(run).unwrap_or_else(|e| e.json());
    let success = response.get("ok") == Some(&Value::Bool(true));
    let result = writeln!(std::io::stdout().lock(), "{}", response);
    if !success || result.is_err() { std::process::exit(1); }
}

#[cfg(test)]
mod tests {
    use super::*;
    fn args(values: &[&str]) -> Vec<String> { values.iter().map(|s| s.to_string()).collect() }
    #[test]
    fn parses_locale_without_turning_preview_into_a_document_edit() {
        assert!(parse(&args(&["locale"])).unwrap().params.is_empty());
        assert_eq!(parse(&args(&["locale", "en-US"])).unwrap().params["locale"], "en-US");
        assert_eq!(parse(&args(&["locale", "source"])).unwrap().params["locale"], Value::Null);
        assert!(parse(&args(&["locale", "en", "es"])).is_err());
        assert!(parse(&args(&["locale", "--unknown"])).is_err());
    }
    #[test]
    fn parses_discovery_selection_and_apply_arguments() {
        assert_eq!(parse(&args(&["context"])).unwrap().params, Map::new());
        assert_eq!(parse(&args(&["context", "--scope", "frame", "--depth", "3"])).unwrap().params, json!({"scope":"frame","depth":3}).as_object().unwrap().clone());
        assert_eq!(parse(&args(&["select", "one", "--ids", "two,three"])).unwrap().params["ids"], json!(["one","two","three"]));
        assert_eq!(parse(&args(&["select"])).unwrap().params["ids"], json!([]));
        let apply = parse(&args(&["--socket", "/private/agent.sock", "apply", "--file", "-", "--dry-run"])).unwrap();
        assert_eq!(apply.file.as_deref(), Some("-")); assert_eq!(apply.params["dryRun"], true); assert_eq!(apply.socket.unwrap(), PathBuf::from("/private/agent.sock"));
        assert_eq!(parse(&args(&["export"])).unwrap().params["format"], "json");
        assert_eq!(parse(&args(&["lint", "--frame", "home"])).unwrap().params, json!({"frame":"home"}).as_object().unwrap().clone());
        assert!(parse(&args(&["lint"])).unwrap().params.is_empty());
        assert_eq!(parse(&args(&["catalog", "--kind", "component", "--kit", "glass", "--query", "card"])).unwrap().params, json!({"kind":"component","kit":"glass","query":"card"}).as_object().unwrap().clone());
        let export = parse(&args(&["export", "--format", "svg", "--frame", "screen-1", "--output", "preview.svg"])).unwrap();
        assert_eq!(export.params["frame"], "screen-1"); assert_eq!(export.params["format"], "svg"); assert_eq!(export.output.unwrap(), PathBuf::from("preview.svg"));
    }
    #[test]
    fn rejects_bad_arguments_and_apply_payloads() {
        for values in [&["apply"][..], &["context", "--depth", "-1"], &["context", "--depth", "5"], &["context", "--scope"], &["undo", "--file", "x"], &["export", "--format", "png"], &["shell"], &["context", "--depth", "1", "--depth", "2"]] { assert!(parse(&args(values)).is_err(), "{:?}", values); }
        assert!(apply_payload(&b"{\"expectedRevision\":\"r1\",\"operations\":[]}"[..]).is_ok());
        for input in ["null", "{}", "{\"expectedRevision\":\"\",\"operations\":[]}", "{\"expectedRevision\":\"r1\",\"operations\":{},\"bad\":true}", "broken"] { assert!(apply_payload(input.as_bytes()).is_err()); }
    }
    #[test]
    fn apply_input_is_bounded_before_parsing() {
        assert_eq!(apply_payload(std::io::repeat(b' ').take(MAX_REQUEST_BYTES as u64 + 1)).unwrap_err().code, "MESSAGE_TOO_LARGE");
    }
    #[test]
    fn parses_asset_targets_and_requires_a_binary_destination() {
        let export = parse(&args(&["export", "--format", "assets", "--ids", "art,star", "--platform", "ios", "--width", "120", "--padding", "4", "--name", "welcome", "--output", "welcome.zip"])).unwrap();
        assert_eq!(export.params["ids"], json!(["art", "star"]));
        assert_eq!(export.params["platform"], "ios"); assert_eq!(export.params["width"], 120.0); assert_eq!(export.params["padding"], 4.0);
        let aru = parse(&args(&["export", "--format", "aru", "--ids", "logo", "--output", "logo.aru"])).unwrap();
        assert_eq!(aru.params["format"], "aru"); assert_eq!(aru.params["ids"], json!(["logo"]));
        let png = parse(&args(&["export", "--format", "png", "--node", "art", "--scale", "2", "--output", "art.png"])).unwrap();
        assert_eq!(png.params["ids"], json!(["art"])); assert_eq!(png.params["scale"], 2.0);
        for values in [&["export", "--format", "assets"][..], &["export", "--format", "svg", "--ids", "art", "--frame", "f"], &["export", "--platform", "windows"], &["export", "--width", "NaN"]] { assert!(parse(&args(values)).is_err(), "{:?}", values); }
    }
    #[test]
    fn parses_resource_exports_without_mixing_document_targets() {
        let export = parse(&args(&["export", "--resource", "aru-id", "--format", "png", "--output", "asset.png"])).unwrap();
        assert_eq!(export.params["resource"], "aru-id");
        for values in [&["export", "--resource", "id", "--ids", "node"][..], &["export", "--resource", "id", "--frame", "f"], &["export", "--resource", "id", "--page", "p"]] { assert!(parse(&args(values)).is_err()); }
        assert_eq!(parse(&args(&["catalog", "--kind", "styles"])).unwrap().params["kind"], "styles");
    }
    #[test]
    fn binary_export_decodes_before_replacing_the_destination() {
        let path = std::env::temp_dir().join(format!("codaru-binary-export-test-{}.png", std::process::id()));
        let mut response = json!({"ok":true,"format":"png","encoding":"base64","content":"iVBORw0KGgo="});
        save_export(&path, &mut response).unwrap();
        let expected = [137,80,78,71,13,10,26,10];
        assert_eq!(std::fs::read(&path).unwrap(), expected);
        assert_eq!(response["bytes"], 8); assert!(response.get("content").is_none());
        assert!(save_export(&path, &mut json!({"encoding":"base64","content":"bad!"})).is_err());
        assert_eq!(std::fs::read(&path).unwrap(), expected);
        std::fs::remove_file(path).unwrap();
    }
    #[test]
    fn export_file_is_written_locally_without_content_in_stdout() {
        let path = std::env::temp_dir().join(format!("codaru-export-test-{}.svg", std::process::id()));
        let mut response = json!({"ok":true,"format":"svg","content":"<svg/>"});
        save_export(&path, &mut response).unwrap(); assert_eq!(std::fs::read_to_string(&path).unwrap(), "<svg/>");
        assert_eq!(response["bytes"], 6); assert!(response.get("content").is_none()); assert_eq!(response["output"], json!(path));
        assert!(save_export(&path, &mut json!({"ok":true})).is_err()); assert_eq!(std::fs::read_to_string(&path).unwrap(), "<svg/>");
        std::fs::remove_file(path).unwrap();
    }
}
