# Architecture Decisions

Architecture Decision Records (ADRs) for PortPurge-System.

Decisions are inferred from codebase evidence unless otherwise noted. Reasoning marked **(inferred)** was not explicitly documented in commit messages or README.

---

## ADR-001

**Decision:**
Use Tauri v2 as the desktop application shell instead of Electron or a browser-only web app.

**Reason:**
Tauri provides a lightweight native Rust backend with a webview frontend, enabling direct OS command execution (`netstat`, `lsof`, `taskkill`) without a separate server process. Identified in `src-tauri/Cargo.toml` (tauri v2) and `src-tauri/tauri.conf.json`.

**Tradeoffs:**
- (+) Small binary size compared to Electron
- (+) Rust backend with direct `std::process::Command` access
- (+) Official plugin ecosystem (updater, tray, single-instance)
- (-) Requires Rust toolchain for development
- (-) Platform-specific code needed for Windows vs Unix

**Affected Files:**
- `src-tauri/Cargo.toml`
- `src-tauri/tauri.conf.json`
- `src-tauri/src/lib.rs`
- `package.json` (`@tauri-apps/api`, `@tauri-apps/cli`)

**Status:** Accepted

---

## ADR-002

**Decision:**
Use Tauri IPC commands (`invoke`) instead of an HTTP REST API for frontend-backend communication.

**Reason:**
The app is a single desktop process. IPC is the native Tauri pattern — no network port, no CORS, no serialization overhead of HTTP. Commands registered via `invoke_handler` in `lib.rs`.

**Tradeoffs:**
- (+) Simpler architecture for a desktop utility
- (+) Type-safe command registration in Rust
- (+) No server startup or port binding for the API layer
- (-) Not callable from external tools without Tauri bindings
- (-) Contract changes require coordinated Rust + TypeScript updates

**Affected Files:**
- `src-tauri/src/lib.rs` (`get_active_ports`, `kill_process_by_pid`)
- `src/App.tsx` (`invoke` calls)

**Status:** Accepted

---

## ADR-003

**Decision:**
Use OS shell commands (`netstat`, `tasklist`, `taskkill`, `lsof`, `kill`) for port scanning and process termination instead of native OS APIs or third-party libraries.

**Reason:**
Shell commands are universally available on target platforms and produce human-readable output that can be parsed without linking platform-specific system libraries. **(inferred):** Chosen for simplicity and zero additional native dependencies.

**Tradeoffs:**
- (+) No extra Cargo dependencies for system introspection
- (+) Commands match what developers already use manually
- (-) Parsing is fragile — output format varies by OS version/locale
- (-) Spawns child processes on every scan (3-second polling)
- (-) Less precise than native APIs (e.g., `GetExtendedTcpTable` on Windows)

**Affected Files:**
- `src-tauri/src/sys/windows.rs`
- `src-tauri/src/sys/unix.rs`

**Status:** Accepted

---

## ADR-004

**Decision:**
Use `#[cfg(target_os)]` conditional compilation with separate `windows.rs` and `unix.rs` modules behind a unified `sys` API.

**Reason:**
Port scanning and kill commands differ fundamentally between Windows and Unix. Compile-time platform selection avoids runtime branching and keeps each implementation focused.

**Tradeoffs:**
- (+) Clean separation — each file handles one platform family
- (+) Shared types (`PortInfo`, `PortPurgeError`) in `mod.rs`
- (-) Every behavior change requires editing two files
- (-) No shared test fixtures across platforms

**Affected Files:**
- `src-tauri/src/sys/mod.rs`
- `src-tauri/src/sys/windows.rs`
- `src-tauri/src/sys/unix.rs`

**Status:** Accepted

---

## ADR-005

**Decision:**
Implement the entire React UI in a single `App.tsx` file with local hook state — no router, no global state library, no component directory.

**Reason:**
The app is a single-screen dashboard utility. **(inferred):** Monolithic structure chosen for speed of development at v0.1.0 scale (~570 lines).

**Tradeoffs:**
- (+) Zero routing/state library overhead
- (+) All UI logic in one place — easy to grep
- (-) File is growing large; harder to maintain as features are added
- (-) No component isolation for testing

**Affected Files:**
- `src/App.tsx`
- `src/main.tsx`

**Status:** Accepted

---

## ADR-006

**Decision:**
Use optimistic UI updates for process kill — immediately remove the row from the table, then rollback on IPC error.

**Reason:**
Documented in README as "Snappy UX." Provides instant feedback while `taskkill`/`kill` executes. Rollback restores previous state if OS denies the operation.

**Tradeoffs:**
- (+) Perceived performance — UI feels instant
- (+) Rollback + toast on failure is user-friendly
- (-) Removes all rows matching PID, not just the targeted port
- (-) Brief inconsistency if kill succeeds but resync shows different state

**Affected Files:**
- `src/App.tsx` (`killProcess` function, lines 128–156)

**Status:** Accepted

---

## ADR-007

**Decision:**
Implement minimize-to-tray, system tray menu, and single-instance lock via Tauri plugins and tray API in Rust — not in the React frontend.

**Reason:**
Desktop lifecycle events (close button, tray click, duplicate launch) are OS-level concerns best handled in the native layer. Uses `tauri-plugin-single-instance` and Tauri tray APIs.

**Tradeoffs:**
- (+) Works even when webview is hidden
- (+) Standard desktop app behavior users expect
- (-) Logic is invisible in React — developers must know to look in `lib.rs`
- (-) Tray behavior differs slightly across platforms

**Affected Files:**
- `src-tauri/src/lib.rs` (setup, `on_window_event`, single-instance plugin)
- `src-tauri/Cargo.toml` (`tauri` tray-icon feature, `tauri-plugin-single-instance`)

**Status:** Accepted

---

## ADR-008

**Decision:**
Use `tauri-plugin-updater` with GitHub Releases (`latest.json`) for in-app auto-updates.

**Reason:**
Tauri provides a built-in signed update mechanism. GitHub Releases is the project's distribution channel (per `tauri.conf.json` endpoint and `.github/workflows/release.yml`).

**Tradeoffs:**
- (+) Users get updates without manual download
- (+) Signed artifacts prevent tampering (pubkey in config)
- (-) Requires CI signing secrets (`TAURI_SIGNING_PRIVATE_KEY`)
- (-) Updater check on every startup (1.5s delay in `App.tsx`)
- (-) Tied to GitHub infrastructure

**Affected Files:**
- `src-tauri/tauri.conf.json` (`plugins.updater`)
- `src-tauri/src/lib.rs` (updater plugin init)
- `src/App.tsx` (update modal, download, relaunch)
- `.github/workflows/release.yml`
- `src-tauri/capabilities/default.json` (`updater:default`)

**Status:** Accepted

---

## ADR-009

**Decision:**
On Windows, build a single PID→process-name map via one `tasklist` call per scan cycle instead of querying per port.

**Reason:**
README explicitly documents this as an O(N) performance optimization to avoid CPU spikes during 3-second polling. `get_process_map()` in `windows.rs` runs once; `netstat` output references PIDs from the map.

**Tradeoffs:**
- (+) One `tasklist` call regardless of port count
- (+) Lower CPU usage during fast polling
- (-) `tasklist` output can be large on systems with many processes
- (-) Stale name if process exits between `tasklist` and `netstat` parse

**Affected Files:**
- `src-tauri/src/sys/windows.rs` (`get_process_map`, `get_active_ports`)

**Status:** Accepted

---

## ADR-010

**Decision:**
Publish draft GitHub Releases on `v*` tag push using a multi-platform CI matrix (macOS, Ubuntu, Windows).

**Reason:**
`release.yml` triggers on version tags, builds all three platforms in parallel, and sets `releaseDraft: true` for manual review before publishing.

**Tradeoffs:**
- (+) Consistent cross-platform builds from one tag
- (+) Draft releases allow review before going public
- (-) No test or lint gates in CI — only build
- (-) Requires signing secrets configured in GitHub repo settings
- (-) Ubuntu build needs apt packages for webkit2gtk

**Affected Files:**
- `.github/workflows/release.yml`

**Status:** Accepted

---

## Pending / Undocumented Decisions

The following choices exist in code but lack clear documented intent. Treat as **Pending** until confirmed by maintainers.

### ADR-P01: No localhost address filtering

**Observation:** README claims localhost-only ports; `sys/windows.rs` and `sys/unix.rs` do not filter by bind address.

**Status:** Pending — needs product decision

### ADR-P02: SIGKILL on Unix (`kill -9`)

**Observation:** Unix kill uses `kill -9` (forceful) with no graceful `SIGTERM` attempt first.

**Status:** Pending — may be intentional for a dev utility

### ADR-P03: Serde camelCase vs TypeScript snake_case

**Observation:** Rust `PortInfo` uses `#[serde(rename_all = "camelCase")]` but TypeScript interface uses `process_name`.

**Status:** Pending — verify runtime behavior
