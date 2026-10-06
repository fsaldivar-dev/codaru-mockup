# Codaru native services for Tauri 2

This Rust crate supplies document dialogs and the existing Codaru agent socket
to an editor embedded in a containing Tauri application. It creates **no window,
webview, child application, or Node.js process**, and stores no design document.
The containing frontend remains responsible for revisions, transactions, selection,
undo/redo, rendering, and interpreting agent operations.

## Add to an existing host

Version `0.4.0` is distributed through the repository's `v0.4.0` tag and a
self-contained `.crate` source archive. It is not published on crates.io.
In the host's `src-tauri/Cargo.toml`, pin the Git tag:

```toml
[dependencies]
tauri-plugin-codaru = { git = "https://github.com/fsaldivar-dev/codaru-mockup", tag = "v0.4.0" }
```

Cargo finds the `tauri-plugin-codaru` package inside the repository. No dependency
on the example app or its `target` directory is required. For local development,
or after extracting the `.crate` archive, use the corresponding package directory:

```toml
[dependencies]
tauri-plugin-codaru = { path = "../path/to/tauri-plugin-codaru-0.4.0" }
```

Register the plugin on the existing Tauri builder:

```rust
tauri::Builder::default()
    .plugin(tauri_plugin_codaru::init())
    .run(tauri::generate_context!())
    .expect("Unable to run the host");
```

No replacement of the host's window setup or invoke handler is needed. The example
in this repository uses exactly this registration.

For a host-specific socket or to disable the CLI:

```rust
let plugin = tauri_plugin_codaru::Builder::new()
    .agent_enabled(true)
    .socket_path("/Users/me/.local/share/my-host/codaru.sock")
    .build();
// Register with the existing builder's .plugin(plugin).
```

`agent_enabled(false)` preserves native dialogs while `agent_poll` and
`agent_respond` reject with `CLI_DISABLED`. The path defaults to
`~/.local/share/codaru-mockup/agent.sock`, or `CODARU_AGENT_SOCKET` when set.
An explicit builder path takes precedence over that environment variable. Each
simultaneously running host needs its own private socket directory. A startup
socket error is reported through the two agent commands and does not prevent the
containing application from opening.

On Windows, Unix-socket commands reject with `UNSUPPORTED_PLATFORM`; the plugin
still initializes so the embedded editor and document dialogs can operate. The
socket implementation is tested on macOS. Other platforms require their own
integration checks; this crate does not implement a Windows named-pipe transport
or mobile integration.

## Minimum capability for the host

Create a capability in the host's `src-tauri/capabilities/`:

```json
{
  "identifier": "codaru-main",
  "local": true,
  "windows": ["main"],
  "permissions": [
    "codaru:allow-agent-poll",
    "codaru:allow-agent-respond",
    "codaru:allow-save-document",
    "codaru:allow-open-document"
  ]
}
```

Replace `main` only if the containing window has a different label. Grant no remote
URL access. Hosts that explicitly select capability identifiers in `tauri.conf.json`
must add `codaru-main` to that existing selection. Otherwise Tauri discovers the
capability file automatically. The example does not require general filesystem,
shell, window creation, or Tauri core default permissions.

The crate's `build.rs` generates the four command allow/deny permissions. Its
`codaru:default` set contains these same four permissions; the example lists them
individually to keep its granted surface visible.

## Parent-injected invoke contract

The containing frontend supplies its existing `invoke` function to the embedded
editor. Calls use the plugin namespace:

| Command | Arguments | Successful result |
| --- | --- | --- |
| `plugin:codaru\|agent_poll` | none | `null` or `{ id, command, params }` |
| `plugin:codaru\|agent_respond` | `{ id, response }` | `null` / void |
| `plugin:codaru\|save_document` | `{ content, filename, extension }` | selected path or `null` on cancel |
| `plugin:codaru\|open_document` | none | document text or `null` on cancel |

For example:

```ts
const request = await invoke('plugin:codaru|agent_poll');
if (request) {
  // handleEditorCommand is supplied by the containing editor.
  const response = await handleEditorCommand(request.command, request.params);
  await invoke('plugin:codaru|agent_respond', { id: request.id, response });
}
```

Poll only while the editor is mounted and ready to handle commands. Use one poller
for each plugin instance, process one command at a time, and handle rejected
invocations (including a disabled/unavailable bridge). There is one in-flight
editor command, up to eight local connections, and a 20-second response deadline.
The frontend's JSON response passes unchanged to the CLI. A timed-out write may
have applied; clients must read context before retrying it.

`save_document` opens a native dialog: `filename` is a plain suggested filename,
not a path. It accepts JSON, SVG, and HTML and at most 64 MB of UTF-8 content.
`open_document` opens a JSON chooser and bounds the actual read to 20 MB. The user
chooses all filesystem destinations/sources; the frontend cannot pass an arbitrary
path to either command. Document validation stays in the editor.

A same-origin iframe separates CSS, DOM, and JavaScript globals for embedding.
Invoke calls should originate in the containing parent and be passed through its
adapter. This arrangement assumes trusted, bundled editor code and is **not a
security boundary against hostile same-origin JavaScript**. Tauri capabilities
apply to the containing window/webview; they are not permissions for an individual
DOM iframe. See [Tauri capabilities](https://v2.tauri.app/security/capabilities/)
and [plugin development](https://v2.tauri.app/develop/plugins/).

## Shared CLI and verification

The standalone CLI remains in the repository's example app and is not bundled
inside this library's source archive. The example CLI includes this crate's
`src/agent_transport.rs` by Rust's `#[path]` mechanism.
Its tests also include the bridge module this way. This keeps a single transport
implementation without linking the command-line executable to the plugin API.
The CLI protocol, arguments, JSON stdout, and private socket rules are unchanged:
0700 directory, 0600 socket, safe stale-socket handling, bounded I/O, 20 MB request
limit, and a 64 MB response limit.

From the repository root:

```sh
TAURI_CONFIG='{"bundle":{"resources":[]}}' cargo test --manifest-path src-tauri/Cargo.toml -p tauri-plugin-codaru --lib
TAURI_CONFIG='{"bundle":{"resources":[]}}' cargo test --manifest-path src-tauri/Cargo.toml --bin codaru
TAURI_CONFIG='{"bundle":{"resources":[]}}' cargo check --manifest-path src-tauri/Cargo.toml --bins
```

These commands test/check Rust without launching or bundling the editor. The
resource override skips the example app's bundle resources for these CLI-only
checks. The plugin contains no bundle resource mapping and does not require the
CLI executable to be shipped by every host.

Plugin source size, CLI executable size, and the incremental size added to an
existing native host are different measurements. Measure the final host build;
this crate makes no fixed-size promise for Tauri or its system webview.

## Source archive and license

The `.crate` archive contains the Rust sources, plugin build script, Tauri command
permissions and their schema, this README, and the BSD-3-Clause license. It excludes
the frontend, example app, compiled executables, `target` and `gen` directories.
Cargo may add its normalized manifest, original manifest, lockfile, and package
metadata while generating the archive.

To verify an extracted archive independently of this repository:

```sh
tar -xzf tauri-plugin-codaru-0.4.0.crate
cd tauri-plugin-codaru-0.4.0
cargo check --lib
cargo test --lib
```

The normal Rust/Tauri desktop prerequisites and registry dependencies must be
available; the archive is source distribution, not a vendored dependency bundle.
To reuse an existing compilation cache, pass `--target-dir /path/to/existing/target`
to these commands. The library's build does not read the example app's bundle
configuration or require `TAURI_CONFIG` overrides.

Copyright (c) 2026, fsaldivar-dev. Released under [BSD-3-Clause](LICENSE).
