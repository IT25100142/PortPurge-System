# Project Context

## 1. Project Overview

**PortPurge** is a lightweight, cross-platform **desktop utility** that helps developers monitor active TCP/UDP network ports, identify which processes own them, and terminate (purge) those processes with a single click.

- **Why it exists:** Developers frequently encounter "port already in use" errors during local development. PortPurge provides a fast visual dashboard instead of manually running `netstat`, `lsof`, or `taskkill`.
- **Target users:** Software developers debugging local port conflicts on Windows, macOS, or Linux.
- **Current maturity:** Early-stage **v0.1.0** in manifests (`package.json`, `Cargo.toml`, `tauri.conf.json`); README documents **v0.2.0** feature set (sorting, deep inspection). Functional core plus expanded Rust test suite, component-driven UI with orchestration in `App.tsx`.
- **Recent capabilities:** Client-side column sorting (flat + grouped views), fuzzy search, process-name grouping with expandable rows and batch group kill, deep process inspection modal (`get_process_details` IPC), kill-from-inspect flow, dynamic system tray with quick-kill menu slots and port-count icon states.
- **Project type:** Tauri v2 desktop application (native shell + webview UI). **Not** a web server, SPA deployment, or mobile app.
- **Core domain purpose:** Local port monitoring and process termination via OS-level shell commands.

Identified in: `README.md`, `package.json`, `src/App.tsx`, `src-tauri/Cargo.toml`.

---

## 2. Tech Stack

| Technology | Version / Details | Where Identified |
|------------|-------------------|------------------|
| **React** | ^19.1.0 | `package.json` |
| **TypeScript** | ~5.8.3, strict mode | `package.json`, `tsconfig.json` |
| **Vite** | ^7.0.4 | `package.json`, `vite.config.ts` |
| **Tailwind CSS** | v4.3.0 via `@tailwindcss/vite` | `package.json`, `src/index.css` |
| **Lucide React** | ^1.16.0 (icons) | `package.json`, `src/App.tsx` |
| **Tauri** | v2 (`tray-icon`, `image-png` features) | `src-tauri/Cargo.toml`, `src-tauri/tauri.conf.json` |
| **Rust** | Edition 2021 | `src-tauri/Cargo.toml` |
| **Serde / serde_json** | v1 | `src-tauri/Cargo.toml` — IPC serialization |
| **thiserror** | v2 | `src-tauri/Cargo.toml` — `PortPurgeError` derive |
| **Tauri plugins** | opener, single-instance, updater, process | `src-tauri/src/lib.rs`, `src-tauri/capabilities/default.json` |
| **IPC client** | `@tauri-apps/api` `invoke()`, `getVersion()`; commands: `get_active_ports`, `get_process_details`, `kill_process_by_pid` | `src/App.tsx`, `src/components/ProcessDetailsModal.tsx` |
| **Package manager** | npm | `package-lock.json`, `package.json` scripts |
| **Database** | None | — |
| **ORM** | None | — |
| **Auth** | None (OS-level permissions only) | — |
| **HTTP API** | None | — |
| **State management** | React `useState` / `useCallback` / `useEffect` only | `src/App.tsx` |
| **Validation** | TypeScript types + Rust `u32` for PID | `src/App.tsx`, `src-tauri/src/sys/mod.rs` |
| **Testing** | Rust `#[test]` — **27 on Windows** / **38 on Unix** (platform `#[cfg]` gates `unix.rs` tests; includes 5 `tray` tests) | `src-tauri/src/**/*.rs` |
| **Linting** | ESLint 9 + typescript-eslint + Prettier (frontend); `cargo clippy` + `cargo fmt` (backend via npm scripts) | `eslint.config.js`, `.prettierrc`, `package.json` |
| **CI/CD** | GitHub Actions + `tauri-apps/tauri-action`; `cargo test` before build (no `npm run lint` in CI) | `.github/workflows/release.yml` |
| **Deployment** | Desktop installers via `tauri build`; auto-updater via GitHub Releases | `tauri.conf.json`, `release.yml` |

**Not present:** Vitest/Jest, Playwright, Docker, database drivers, web frameworks (Express, etc.). **Present but not in CI:** ESLint, Prettier, `cargo clippy`, `cargo fmt` (via `npm run lint` / `npm run format`).

---

## 3. Project Structure

```
PortPurge-System/
├── ai/                          # AI assistant documentation
│   ├── PROJECT_CONTEXT.md       # This file
│   ├── AI_RULES.md              # Operational rules for AI agents
│   ├── ARCHITECTURE_DECISIONS.md
│   └── PROMPT_PATTERNS.md
├── .github/workflows/
│   └── release.yml              # Multi-platform release on v* tags
├── .vscode/
│   └── extensions.json          # Recommends Tauri + rust-analyzer extensions
├── public/
│   ├── tauri.svg                # Favicon (referenced by index.html)
│   ├── vite.svg                 # Static asset
│   └── illustrations/           # WebP empty-state / toast artwork
│       ├── empty-ports.webp
│       ├── no-results.webp
│       └── permission-denied.webp
├── src/                         # React frontend (webview UI)
│   ├── main.tsx                 # React entry point
│   ├── App.tsx                  # App shell, state, IPC, inspect/kill/group-kill/updater orchestration (~442 lines)
│   ├── types.ts                 # Shared TS interfaces (PortInfo, PortGroup, ProcessDetails, Toast, etc.)
│   ├── utils/                   # Pure frontend helpers (no React)
│   │   ├── fuzzySearch.ts       # Ordered-subsequence fuzzy port search
│   │   ├── groupPorts.ts        # groupByProcessName → PortGroup[]
│   │   └── sortPorts.ts         # Flat + grouped table sorting
│   ├── components/              # Presentational UI components
│   │   ├── PortTable.tsx        # Sortable table shell; flat vs grouped view
│   │   ├── PortTableRow.tsx     # Single port row (flat view)
│   │   ├── PortGroupRow.tsx     # Expandable process group row + nested port rows
│   │   ├── SearchFilters.tsx    # Fuzzy search + protocol pills + group-by toggle
│   │   ├── MetricsBar.tsx       # TCP/UDP/total counts
│   │   ├── ProcessDetailsModal.tsx # Deep process inspection modal
│   │   ├── KillConfirmModal.tsx # Single-port kill confirmation
│   │   ├── KillGroupConfirmModal.tsx # Batch kill all PIDs in a process group
│   │   ├── UpdateModal.tsx      # In-app updater modal
│   │   ├── ToastContainer.tsx   # Toast notifications
│   │   └── EmptyState.tsx       # No-ports / no-results / permission states
│   ├── index.css                # Tailwind v4 @theme tokens + glass utilities + animations
│   └── vite-env.d.ts            # Vite type references
├── src-tauri/                   # Rust backend (Tauri native layer)
│   ├── src/
│   │   ├── main.rs              # Binary entry → portpurge_lib::run()
│   │   ├── lib.rs               # Tauri builder, IPC commands, plugins, window events
│   │   ├── tray/
│   │   │   └── mod.rs           # System tray icon, menu, port poll, quick-kill slots
│   │   └── sys/
│   │       ├── mod.rs           # Protocol, PortInfo, ProcessDetails, PortPurgeError, dedupe, localhost helpers
│   │       ├── windows.rs       # netstat/tasklist/taskkill + PowerShell CIM inspect (spawn_blocking)
│   │       └── unix.rs          # lsof/kill + ps inspect + exe resolution (spawn_blocking)
│   ├── icons/                   # App bundle icons + tray state icons (tray-normal/amber/red.png)
│   ├── capabilities/
│   │   └── default.json         # Tauri v2 permission capabilities
│   ├── Cargo.toml               # Rust dependencies
│   ├── Cargo.lock
│   ├── build.rs                 # tauri_build::build()
│   └── tauri.conf.json          # App config, bundle, updater
├── .env.example                 # Documents optional TAURI_DEV_HOST
├── eslint.config.js             # ESLint flat config (TS/TSX, React hooks)
├── .prettierrc                  # Prettier formatting rules
├── .prettierignore              # Prettier exclusions (dist, node_modules, target)
├── index.html                   # Vite HTML shell
├── package.json                 # npm scripts and frontend deps
├── vite.config.ts               # Vite dev server (port 1420)
├── tsconfig.json                # TypeScript config (app source)
├── tsconfig.node.json           # TypeScript config (Vite config)
└── README.md                    # Human-facing project documentation
```

**Absent folders (by design or not yet created):**
- No `src/pages/`, `src/hooks/` — routing and custom hooks not used
- No `routes/`, `controllers/`, `services/` — no HTTP backend
- No frontend `tests/` directory (`src/utils/` holds pure TS helpers, not a test suite)

**Generated / gitignored (do not document contents):** `node_modules/`, `dist/`, `src-tauri/target/`.

---

## 4. Core Features

### 4.1 Real-Time Port Monitoring

- **Purpose:** Display active TCP listeners and UDP binds on **localhost only** (`127.0.0.1`, `::1`, `localhost`) with port, protocol, PID, and process name.
- **User behavior:** Dashboard auto-refreshes every 3 seconds (toggleable); manual refresh shows success toast and "Updated" timestamp.
- **Flow:** `App.tsx` → `invoke("get_active_ports")` → `lib.rs` → `sys::get_active_ports()` → `spawn_blocking` shell command → parse with localhost filter → `dedupe_and_sort_ports()` → `PortInfo[]`.
- **Important files:** `src/App.tsx` (polling), `src-tauri/src/sys/mod.rs` (`is_localhost_address`, `host_from_addr_port`, `dedupe_and_sort_ports`), `src-tauri/src/sys/windows.rs`, `src-tauri/src/sys/unix.rs`.
- **Localhost filter:** Implemented in both platform parsers via `is_localhost_address()` — rejects `0.0.0.0`, `*`, `[::]`, and LAN addresses. Identified in: `sys/mod.rs`, `sys/windows.rs`, `sys/unix.rs`.

### 4.2 Search, Fuzzy Match, and Protocol Filtering

- **Purpose:** Narrow the port table by port number, PID, process name, or protocol using fuzzy matching; optionally group rows by process name.
- **User behavior:** Fuzzy search input (ordered-subsequence match on `processName:port:pid:protocol`); ALL/TCP/UDP filter pills; **Group by Process** toggle in `SearchFilters.tsx`.
- **Flow:** `filterPortsByFuzzyQuery()` in `src/utils/fuzzySearch.ts` → protocol filter in `App.tsx` `useMemo` → optional `groupByProcessName()` in `src/utils/groupPorts.ts`.
- **Important files:** `src/App.tsx`, `src/components/SearchFilters.tsx`, `src/utils/fuzzySearch.ts`, `src/utils/groupPorts.ts`.

### 4.3 Process Kill (Purge)

- **Purpose:** Terminate a process owning a port (single row) or all unique PIDs in a process group.
- **User behavior:** Click Kill → `KillConfirmModal` → Confirm → row disappears optimistically; rollback + error toast on failure. In grouped view, **Kill Group** → `KillGroupConfirmModal` → sequential `kill_process_by_pid` per unique PID.
- **Flow:** `invoke("kill_process_by_pid", { pid })` → `sys::kill_process_by_pid()` via `spawn_blocking` → `taskkill` (Windows) or `kill -9` (Unix). Group kill loops PIDs in `App.tsx` `killProcessGroup()`.
- **Important files:** `src/App.tsx` (`killProcess`, `killProcessGroup`, `killTarget`, `killGroupTarget`), `src/components/KillConfirmModal.tsx`, `src/components/KillGroupConfirmModal.tsx`, `src-tauri/src/sys/windows.rs`, `src-tauri/src/sys/unix.rs`.

### 4.4 Toast Notifications

- **Purpose:** Feedback for refresh, kill success/failure, and updater events.
- **User behavior:** Toasts appear bottom-right, auto-dismiss after 4 seconds.
- **Important files:** `src/App.tsx` (`showToast`, `removeToast`), `src/components/ToastContainer.tsx`.

### 4.5 In-App Updater

- **Purpose:** Check for new versions on startup and install from GitHub Releases.
- **User behavior:** Modal shows version comparison and release notes; Install Update downloads and relaunches. Current app version read at runtime via Tauri `getVersion()` API.
- **Flow:** `@tauri-apps/plugin-updater` `check()` → modal → `downloadAndInstall()` → `@tauri-apps/plugin-process` `relaunch()`.
- **Important files:** `src/App.tsx` (`getVersion`, `appVersion` state), `src/components/UpdateModal.tsx` (`currentVersion` prop), `src-tauri/tauri.conf.json` (version source for `getVersion()`), `src-tauri/src/lib.rs` (plugin init).

### 4.6 Metrics and Empty States

- **Purpose:** Show TCP/UDP/total port counts; guide users when no ports match filters or none are listening.
- **User behavior:** `MetricsBar` shows live counts; `EmptyState` variants for no ports, no search results.
- **Important files:** `src/components/MetricsBar.tsx`, `src/components/EmptyState.tsx`, `src/components/PortTable.tsx`.

### 4.7 System Tray and Desktop Lifecycle (Rust-only)

- **Purpose:** Run quietly in background; prevent duplicate instances; quick-kill recent ports from tray menu; visual port-load indicator on tray icon.
- **User behavior:** Close button hides to tray; left-click tray toggles window show/hide; right-click menu shows up to **5 kill slots** for the most recently seen localhost ports, then Show / Quit. Second launch focuses existing window.
- **Tray icon states** (by active localhost port count): normal (&lt;10), amber (10–19), red (≥20). Icons: `src-tauri/icons/tray-normal.png`, `tray-amber.png`, `tray-red.png`.
- **Tray kill:** Menu items call `sys::kill_process_by_pid` directly — **no** `KillConfirmModal` (errors logged via `eprintln!`, not React toasts).
- **Independent polling:** `tray/mod.rs` runs its own 3-second poll loop calling `sys::get_active_ports()` in parallel with React polling in `App.tsx`.
- **Flow:** `lib.rs` → `tray::init()` in setup; window close/minimize-to-tray in `lib.rs` `on_window_event`; single-instance focus in plugin callback.
- **Important files:** `src-tauri/src/tray/mod.rs`, `src-tauri/src/lib.rs`.
- **Plugins:** `tauri-plugin-single-instance`, Tauri tray API (`tray-icon`, `image-png` features in `Cargo.toml`).

### 4.8 Column Sorting

- **Purpose:** Sort the port table by protocol, port, PID, or process name — in flat view or within/between process groups.
- **User behavior:** Click any table header to sort ascending; click again to toggle descending. In grouped view, **Process Name** header sorts at group level; other columns sort child rows within each group.
- **Flow:** `TableSortConfig` (`level`: `group` | `child`) in `PortTable.tsx` → `sortFlatPorts()` / `sortGroupedPorts()` in `src/utils/sortPorts.ts`.
- **Important files:** `src/components/PortTable.tsx`, `src/utils/sortPorts.ts`, `src/types.ts` (`TableSortConfig`, `SortLevel`).

### 4.9 Process Inspection (Deep Details)

- **Purpose:** View extended process metadata before killing — executable path, command line, memory, user, start time.
- **User behavior:** Click Inspect on a row → `ProcessDetailsModal` loads details; optional Kill opens existing `KillConfirmModal`.
- **Flow:** `invoke("get_process_details", { pid })` → `sys::get_process_details()` via `spawn_blocking` → Windows: PowerShell CIM JSON; Unix: `ps` + platform exe path (`readlink` Linux, `lsof` macOS).
- **Partial data:** When OS ACLs block sensitive fields, backend sets `permissionsLimited: true`; modal shows available fields and a warning.
- **Important files:** `src/App.tsx` (`inspectTarget`), `src/components/ProcessDetailsModal.tsx`, `src/types.ts` (`ProcessDetails`), `src-tauri/src/sys/windows.rs`, `src-tauri/src/sys/unix.rs`.

### 4.10 Process Grouping (Grouped Table View)

- **Purpose:** Collapse multiple ports sharing a process name into expandable group rows; kill all PIDs in a group at once.
- **User behavior:** Toggle **Group by Process** in `SearchFilters` → `PortGroupRow` shows summary (port count, PID count) → expand to see nested `PortTableRow` children → **Kill Group** opens `KillGroupConfirmModal`.
- **Flow:** `groupByProcessName(filteredPorts)` → `displayGroups` in `App.tsx` → `PortTable` renders `PortGroupRow` or flat `PortTableRow` based on `groupByProcess`.
- **Group identity:** `PortGroup.groupKey` = lowercase trimmed `processName`; empty names normalize to `"Unknown"`.
- **Important files:** `src/utils/groupPorts.ts`, `src/components/PortGroupRow.tsx`, `src/components/KillGroupConfirmModal.tsx`, `src/types.ts` (`PortGroup`).

---

## 5. Application Flow

### 5.1 Startup

```
main.rs → lib.rs::run()
  → Register plugins (opener, single-instance, updater, process)
  → setup(): tray::init() — tray icon, menu, poll loop
  → Load webview (dev: http://localhost:1420, prod: ../dist)
  → main.tsx → App.tsx mounts
  → fetchPorts() on mount
  → getVersion() → setAppVersion (Tauri only)
  → checkForUpdates() after 1.5s delay
```

### 5.2 Port Polling Loop

```
App.tsx useEffect (3s interval, if autoRefresh && !killingPid && !isKillingGroup)
  → fetchPorts()
  → invoke("get_active_ports")
  → lib.rs::get_active_ports()
  → sys::get_active_ports() [platform-specific, via spawn_blocking]
  → setPorts(activePorts)
```

### 5.3 Kill Flow

```
User clicks Kill → setKillTarget(portInfo)
User clicks Confirm → killProcess(pid, port)
  → Optimistic: remove all rows matching pid from ports state
  → invoke("kill_process_by_pid", { pid })
  → On success: success toast
  → On error: rollback ports state, error toast (Access Denied message if applicable)
  → finally: fetchPorts() to resync
```

### 5.4 Group Kill Flow

```
User enables Group by Process → clicks Kill Group on PortGroupRow
  → setKillGroupTarget(PortGroup)
User confirms in KillGroupConfirmModal → killProcessGroup(group)
  → Optimistic: remove all rows whose pid is in group.uniquePids
  → For each pid in group.uniquePids: invoke("kill_process_by_pid", { pid }) sequentially
  → On full success: success toast
  → On partial success: warning toast with failed PIDs; rows not fully rolled back
  → On total failure: rollback ports state; error toast (Access Denied if applicable)
  → fetchPorts() to resync
```

### 5.5 Inspect Flow

```
User clicks Inspect → setInspectTarget(portInfo)
ProcessDetailsModal mounts → invoke("get_process_details", { pid })
  → sys::get_process_details() [platform-specific, via spawn_blocking]
  → Display ProcessDetails (or error / permissionsLimited warning)
User clicks Kill in modal → onRequestKill(portInfo) → setKillTarget → KillConfirmModal flow (§5.3)
User closes modal → setInspectTarget(null)
```

### 5.6 Tray Poll and Quick-Kill Flow

```
tray::init() → spawn_poll_loop (every 3s)
  → refresh_tray_ports()
  → sys::get_active_ports() [same platform path as §5.2]
  → Update icon state (normal/amber/red by port count)
  → Populate up to 5 kill menu slots (most recently seen ports)

User right-clicks tray → selects "Kill :PORT — …"
  → handle_tray_kill(slot_index) → sys::kill_process_by_pid(pid)
  → No React modal; errors → eprintln!
```

### 5.7 Error Handling

- **Rust:** `PortPurgeError` enum with `thiserror::Error` → `Display` impl → converted to `String` in `lib.rs` via `.map_err(|e| e.to_string())`.
- **Frontend:** Errors caught in try/catch → `showToast(String(err), "error")`.
- **Access denied:** Mapped from OS stderr patterns ("Access is denied", "Permission denied", etc.).

### 5.8 Request Lifecycle (IPC)

There is no HTTP request lifecycle. Tauri IPC is synchronous from the frontend's perspective (`await invoke(...)`), handled by registered `#[tauri::command]` functions in Rust.

---

## 6. Architecture Explanation

### High-Level Architecture

```
┌─────────────────────────┐
│   React Frontend        │
│   App.tsx + components  │
└───────────┬─────────────┘
            │ Tauri IPC
            │ get_active_ports
            │ get_process_details
            │ kill_process_by_pid
            ▼
┌─────────────────────────┐
│   Tauri Rust Backend    │
│   lib.rs — IPC, plugins │
└───────────┬─────────────┘
            │
   ┌────────┼────────┐
   ▼        ▼        ▼
┌──────┐ ┌──────┐ ┌──────────┐
│ tray │ │ win  │ │ unix     │
│ .rs  │ │ .rs  │ │ .rs      │
└──┬───┘ └──┬───┘ └────┬─────┘
   │        │          │
   │        ▼          ▼
   │   netstat/taskkill  lsof/kill
   │   PowerShell CIM    ps + exe path
   └─► get_active_ports (3s poll) + tray quick-kill
```

### Separation of Concerns

| Layer | Responsibility |
|-------|----------------|
| `App.tsx` | State orchestration, polling, IPC calls, optimistic kill (single + group), inspect/kill modals, updater logic, runtime version via `getVersion()` |
| `src/components/*` | Presentational UI (sortable/grouped table rows, inspect/kill modals, toasts, filters, metrics) |
| `src/utils/*` | Pure TS helpers: fuzzy search, port grouping, table sort — no React, no IPC |
| `src/types.ts` | Shared TypeScript interfaces for IPC data shapes and table view models |
| `lib.rs` | Tauri app lifecycle, IPC command registration, plugins, minimize-to-tray window event |
| `tray/mod.rs` | Tray icon/menu, port-count icon states, 5 quick-kill slots, independent 3s poll loop |
| `sys/mod.rs` | `Protocol`, shared types, localhost helpers, dedupe, platform dispatch via `#[cfg]` |
| `sys/windows.rs` / `sys/unix.rs` | Port scan, kill, and process inspection; localhost filtering; blocking shell I/O via `spawn_blocking` |

### Design Patterns

- **Command-Query separation:** Read commands (`get_active_ports`, `get_process_details`) vs write (`kill_process_by_pid`) IPC commands.
- **Strategy pattern:** Platform-specific `sys` implementations selected at compile time.
- **Optimistic UI:** Kill removes row immediately, rolls back on failure.
- **Blocking work off async runtime:** `get_active_ports`, `get_process_details`, and `kill_process_by_pid` in `sys/` wrap `std::process::Command` in `tauri::async_runtime::spawn_blocking` so shell I/O does not block the Tauri async executor.

### Strengths

- Small, inspectable codebase with clear `sys/` platform boundary.
- Localhost-only filtering centralized in `is_localhost_address()` / `host_from_addr_port()`.
- Deduplication prefers known process names over `"Unknown"` (`dedupe_and_sort_ports`).
- Windows performance optimization: single `tasklist` call builds PID→name map per scan cycle.
- Tray module isolated from React; quick-kill and icon-state logic unit-tested in `tray/mod.rs`.
- Parser fixture tests for `netstat`, `lsof`, PowerShell process JSON, and `ps` output.
- UI decomposed into focused components and `src/utils/` helpers; `App.tsx` handles orchestration only.
- Graceful partial inspection when OS ACLs limit sensitive fields (`permissionsLimited`).
- `cargo test` passes; `Protocol` implements `Display` for logging and integration test output.

### Weaknesses

- Shell-command parsing remains fragile (output format changes across OS versions).
- `unix.rs` parser tests only run on non-Windows targets (`#[cfg(not(target_os = "windows"))]`).
- No frontend tests; no Vitest/Jest/Playwright.
- Lint/format tooling exists locally but is **not enforced in CI** (`release.yml` runs `cargo test` only).
- **Dual polling:** React (`App.tsx`) and tray (`tray/mod.rs`) each poll `get_active_ports` every 3s when active — duplicate OS shell work when window is open.
- **Tray kill has no confirmation** — accidental kills possible from right-click menu.
- **Partial group kill:** `killProcessGroup()` does not roll back on partial success — UI may be out of sync until next refresh.

---

## 7. Database and Data Models

No database or persistent data model was clearly identified from the codebase.

All data is ephemeral and in-memory:

### `Protocol` (Rust — `src-tauri/src/sys/mod.rs`)

```rust
pub enum Protocol {
    Tcp,
    Udp,
    Other(String),  // serializes as raw OS string
}
```

Serializes to JSON as `"TCP"` / `"UDP"` (or the raw string for `Other`). Parsed from OS output via `Protocol::parse_known()`. Implements `std::fmt::Display` (delegates to `as_str()`).

### `PortInfo` (Rust — `src-tauri/src/sys/mod.rs`)

```rust
pub struct PortInfo {
    pub port: u16,
    pub protocol: Protocol,
    pub pid: u32,
    pub process_name: String,
}
```

Serde attribute: `#[serde(rename_all = "camelCase")]` — serializes `process_name` as `processName` in JSON.

### `PortInfo` (TypeScript — `src/types.ts`)

```typescript
export interface PortInfo {
  port: number;
  protocol: string;
  pid: number;
  processName: string;  // matches serde camelCase output
}
```

### `PortGroup` and table view types (TypeScript — `src/types.ts`)

```typescript
export type PortGroupKey = string;  // lowercase trimmed processName

export interface PortGroup {
  groupKey: PortGroupKey;
  processName: string;
  ports: PortInfo[];
  portCount: number;
  pidCount: number;
  uniquePids: number[];
}

export type SortLevel = "group" | "child";

export interface TableSortConfig {
  level: SortLevel;
  key: keyof PortInfo;
  direction: "asc" | "desc";
}
```

`PortGroup` is a **frontend-only** aggregate — not serialized over IPC. Built client-side by `groupByProcessName()` in `src/utils/groupPorts.ts`.

### `ProcessDetails` (Rust — `src-tauri/src/sys/mod.rs`)

```rust
pub struct ProcessDetails {
    pub pid: u32,
    pub process_name: String,
    pub executable_path: Option<String>,
    pub command_line: Option<String>,
    pub memory_bytes: Option<u64>,
    pub user: Option<String>,
    pub started_at: Option<String>,
    pub permissions_limited: bool,
}
```

Serde attribute: `#[serde(rename_all = "camelCase")]`. When `permissions_limited` is `true`, sensitive fields may be `None` due to OS ACL / elevation limits.

### `ProcessDetails` (TypeScript — `src/types.ts`)

```typescript
export interface ProcessDetails {
  pid: number;
  processName: string;
  executablePath: string | null;
  commandLine: string | null;
  memoryBytes: number | null;
  user: string | null;
  startedAt: string | null;
  permissionsLimited: boolean;
}
```

### Shared Rust helpers (`src-tauri/src/sys/mod.rs`)

| Function / type | Purpose |
|-----------------|---------|
| `ParsedPort` | Intermediate parse result (Windows) before process name lookup |
| `host_from_addr_port()` | Extract host from `127.0.0.1:8080` or `[::1]:3000` |
| `is_localhost_address()` | Loopback check (`127.0.0.1`, `::1`, `localhost`) |
| `dedupe_and_sort_ports()` | Dedupe by `(port, protocol)`, prefer known names, sort ascending |

### `PortPurgeError` (Rust — `src-tauri/src/sys/mod.rs`)

```rust
#[derive(Debug, Clone, Serialize, Deserialize, thiserror::Error)]
pub enum PortPurgeError {
    #[error("Access Denied. Try running with admin/sudo privileges.")]
    AccessDenied,
    #[error("Process not found (it may have already exited).")]
    ProcessNotFound,
    #[error("Command error: {0}")]
    CommandError(String),
    #[error("Unknown error: {0}")]
    Unknown(String),
}
```

No migrations, no ORM, no file-based persistence.

---

## 8. API Routes and Endpoints

**No HTTP API exists.** Backend communication uses **Tauri IPC commands** registered in `src-tauri/src/lib.rs`.

### `get_active_ports`

| Property | Value |
|----------|-------|
| **Type** | Tauri command (async) |
| **Frontend call** | `invoke<PortInfo[]>("get_active_ports")` |
| **Rust handler** | `lib.rs` → `sys::get_active_ports()` |
| **Request** | None |
| **Response** | `PortInfo[]` on success |
| **Error** | `String` (display message from `PortPurgeError`) |
| **Auth** | None (OS permissions apply at shell command level) |
| **Related files** | `src/App.tsx`, `src-tauri/src/lib.rs`, `src-tauri/src/sys/*.rs` |

### `kill_process_by_pid`

| Property | Value |
|----------|-------|
| **Type** | Tauri command (async) |
| **Frontend call** | `invoke("kill_process_by_pid", { pid })` |
| **Rust handler** | `lib.rs` → `sys::kill_process_by_pid(pid)` |
| **Request** | `{ pid: number }` (u32) |
| **Response** | `()` (empty success) |
| **Error** | `String` |
| **Auth** | None (admin/sudo may be required by OS) |
| **Related files** | `src/App.tsx`, `src-tauri/src/lib.rs`, `src-tauri/src/sys/*.rs` |

### `get_process_details`

| Property | Value |
|----------|-------|
| **Type** | Tauri command (async) |
| **Frontend call** | `invoke<ProcessDetails>("get_process_details", { pid })` |
| **Rust handler** | `lib.rs` → `sys::get_process_details(pid)` |
| **Request** | `{ pid: number }` (u32) |
| **Response** | `ProcessDetails` on success |
| **Error** | `String` (display message from `PortPurgeError`) |
| **Auth** | None (admin/sudo may be required for full field access) |
| **Platform implementation** | Windows: PowerShell CIM → JSON parse; Unix: `ps` + `readlink` (Linux) or `lsof` (macOS) for executable path |
| **Related files** | `src/components/ProcessDetailsModal.tsx`, `src/types.ts`, `src-tauri/src/lib.rs`, `src-tauri/src/sys/windows.rs`, `src-tauri/src/sys/unix.rs` |

### External HTTP (updater only)

The app fetches update metadata from GitHub Releases (not an app-owned API):

```
https://github.com/IT25100142/PortPurge-System/releases/latest/download/latest.json
```

Configured in `src-tauri/tauri.conf.json` → `plugins.updater.endpoints`.

---

## 9. Important Components, Modules, and Services

### Frontend

| File | Purpose | Dependencies |
|------|---------|--------------|
| `src/main.tsx` | React bootstrap with StrictMode | `react`, `react-dom`, `App`, `index.css` |
| `src/App.tsx` | State, IPC, polling, single/group kill, inspect/updater orchestration, `getVersion()` for badge | `@tauri-apps/api` (core + app), updater/process plugins, components, `types`, `utils` |
| `src/types.ts` | `PortInfo`, `PortGroup`, `ProcessDetails`, `TableSortConfig`, `Toast`, `DownloadProgress` | — |
| `src/utils/fuzzySearch.ts` | `filterPortsByFuzzyQuery`, ordered-subsequence match | `types` |
| `src/utils/groupPorts.ts` | `groupByProcessName` → `PortGroup[]` | `types` |
| `src/utils/sortPorts.ts` | `sortFlatPorts`, `sortGroupedPorts`, `comparePorts` | `types` |
| `src/components/PortTable.tsx` | Table shell: sort state, flat vs grouped rendering, empty states | `PortTableRow`, `PortGroupRow`, `EmptyState`, `sortPorts`, lucide-react |
| `src/components/PortTableRow.tsx` | Single port row with Inspect/Kill actions | `types`, lucide-react |
| `src/components/PortGroupRow.tsx` | Expandable group header + nested port rows; Kill Group action | `PortTableRow`, `types`, lucide-react |
| `src/components/SearchFilters.tsx` | Fuzzy search input, group-by toggle, ALL/TCP/UDP pills | — |
| `src/components/MetricsBar.tsx` | Total/TCP/UDP count badges | — |
| `src/components/ProcessDetailsModal.tsx` | Deep process inspection; fetches `get_process_details`; kill-from-inspect | `@tauri-apps/api/core`, `types` |
| `src/components/KillConfirmModal.tsx` | Single-port kill confirmation overlay | `types` |
| `src/components/KillGroupConfirmModal.tsx` | Batch kill confirmation for all PIDs in a `PortGroup` | `types` |
| `src/components/UpdateModal.tsx` | Updater version/download UI; receives `currentVersion` from parent | `@tauri-apps/plugin-updater` types |
| `src/components/ToastContainer.tsx` | Toast stack (bottom-right) | `types` |
| `src/components/EmptyState.tsx` | No-ports / no-results / permission empty states | `public/illustrations/*.webp` |
| `src/index.css` | Tailwind v4 `@theme` tokens, glass utilities, animations | Tailwind |
| `index.html` | HTML shell, mounts `#root`, favicon `/tauri.svg` | Vite |

### Rust Backend

| File | Purpose | Dependencies |
|------|---------|--------------|
| `src-tauri/src/main.rs` | Binary entry, Windows subsystem attribute | `portpurge_lib` |
| `src-tauri/src/lib.rs` | Tauri builder, IPC commands, plugins, window minimize-to-tray, test | `sys`, `tray`, tauri, plugins |
| `src-tauri/src/tray/mod.rs` | Tray icon states, 5 kill menu slots, `refresh_tray_ports` poll loop, tray kill handler | `sys`, tauri tray/menu APIs |
| `src-tauri/src/sys/mod.rs` | `Protocol`, `PortInfo`, `ProcessDetails`, shared types, localhost helpers, dedupe, platform re-exports | serde, thiserror |
| `src-tauri/src/sys/windows.rs` | `parse_netstat_line`, port scan/kill, PowerShell CIM process inspect (`spawn_blocking`) | std::process::Command, tauri async runtime |
| `src-tauri/src/sys/unix.rs` | `parse_lsof_line`, port scan/kill, `ps` process inspect + exe resolution (`spawn_blocking`) | std::process::Command, tauri async runtime |
| `src-tauri/build.rs` | Tauri build hook | tauri-build |
| `src-tauri/tauri.conf.json` | App ID, window, bundle, updater config | — |
| `src-tauri/capabilities/default.json` | Plugin permissions for main window | — |

### Config

| File | Purpose |
|------|---------|
| `vite.config.ts` | Dev server port 1420, HMR, ignore `src-tauri/` in watch |
| `eslint.config.js` | ESLint 9 flat config for `src/**/*.ts(x)` |
| `.prettierrc` / `.prettierignore` | Code formatting scope and rules |
| `package.json` | npm scripts, frontend dependencies, lint/format scripts |
| `tsconfig.json` | Strict TypeScript for `src/` |
| `.github/workflows/release.yml` | CI release on `v*` tags |

---

## 10. Environment Variables and Configuration

| Variable | Purpose | Required | Example Safe Value | Where Used |
|----------|---------|----------|-------------------|------------|
| `TAURI_DEV_HOST` | Bind Vite dev server and HMR to a specific host (remote/mobile dev) | No | `192.168.1.10` | `vite.config.ts` |
| `GITHUB_TOKEN` | Publish GitHub Releases from CI | CI only | `[REDACTED]` — auto-provided by Actions | `.github/workflows/release.yml` |
| `TAURI_SIGNING_PRIVATE_KEY` | Sign update artifacts for Tauri updater | CI only | `[REDACTED]` | `.github/workflows/release.yml` |
| `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` | Password for signing private key | CI only | `[REDACTED]` | `.github/workflows/release.yml` |

**Local signing keys (gitignored, never commit):**
- `updater.key` — private signing key
- `updater.key.pub` — public key counterpart

**`.env.example` (committed):** Documents optional `TAURI_DEV_HOST` for remote/mobile Tauri dev. Copy to `.env` if needed.

**Embedded in config (public, not secret):**
- Updater public key in `src-tauri/tauri.conf.json` → `plugins.updater.pubkey`

**Note:** `.env` is gitignored; only `.env.example` is tracked.

---

## 11. Setup and Installation

### Prerequisites

- **Node.js:** v24+ recommended (`README.md`)
- **Rust / Cargo:** v1.84+ recommended (`README.md`)
- **Platform tools (runtime):**
  - Windows: `netstat`, `tasklist`, `taskkill` (built-in); **PowerShell** (built-in) for process inspection via CIM
  - macOS/Linux: `lsof` (must be installed; standard on macOS/Linux); **`ps`** for process inspection; Linux uses **`readlink`** for executable path, macOS uses **`lsof`** for executable path

### Install

```bash
cd PortPurge-System
npm install
```

Optional: copy `.env.example` to `.env` and set `TAURI_DEV_HOST` for remote dev (see `README.md`).

Note: `package.json` name is `portpurge`; repo folder is `PortPurge-System`.

### Local Development

```bash
npm run tauri dev
```

This runs `npm run dev` (Vite on port 1420) then launches the Tauri window.

### Frontend-Only Build (no native bundle)

```bash
npm run build
```

Runs `tsc && vite build` → output in `dist/`.

### Production Desktop Bundle

```bash
npm run tauri build
```

Output: `src-tauri/target/release/bundle/`

Icons are present under `src-tauri/icons/` (referenced by `tauri.conf.json` bundle config).

### Run Tests

```bash
cargo test --manifest-path src-tauri/Cargo.toml -- --nocapture
```

### Administrative Access

- **Windows:** Run as Administrator to kill processes owned by other users/services.
- **macOS/Linux:** Use `sudo` for root-owned processes.

### Common Setup Issues

| Issue | Cause | Fix |
|-------|-------|-----|
| Port 1420 in use | Another process on Vite port | Stop conflicting process or change port in `vite.config.ts` and `tauri.conf.json` |
| `lsof: command not found` | Missing on minimal Linux | Install `lsof` package |
| Inspect shows limited fields | OS ACL / insufficient elevation | Run as admin/sudo; UI sets `permissionsLimited` |
| Kill fails with Access Denied | Insufficient OS privileges | Run as admin/sudo |

---

## 12. Development Workflow

### Where to Add Features

| Change Type | Location |
|-------------|----------|
| New UI / dashboard feature | `src/components/` for presentational UI; state/IPC in `src/App.tsx` |
| Pure frontend logic (search, group, sort) | `src/utils/` — keep React-free; import from components/`App.tsx` |
| Shared TS types | `src/types.ts` |
| New backend capability | `#[tauri::command]` in `src-tauri/src/lib.rs` + implementation in `sys/` |
| Shared port logic (both platforms) | `src-tauri/src/sys/mod.rs` |
| Platform-specific logic | `src-tauri/src/sys/windows.rs` AND `src-tauri/src/sys/unix.rs` |
| Tray behavior (menu, icon states, quick-kill) | `src-tauri/src/tray/mod.rs` |
| New Tauri plugin | `Cargo.toml` + `lib.rs` plugin init + `capabilities/default.json` permissions |
| Styling | Tailwind classes in components; global animations in `src/index.css` |
| Release / updater config | `src-tauri/tauri.conf.json`, `.github/workflows/release.yml` |

### Coding Conventions

- **Rust:** snake_case for functions/variables; `#[cfg(target_os)]` for platform code.
- **TypeScript:** camelCase for variables/functions; PascalCase for components; interfaces for data shapes.
- **IPC:** Command names use snake_case (`get_active_ports`, `kill_process_by_pid`, `get_process_details`).
- **UI:** Dark theme via `@theme` tokens in `index.css` (`surface-base`, `accent-primary`), glass utilities (`glass-panel`, `glass-control`), indigo/violet gradients — follow patterns in existing components.

### Version Bumping

Sync version across (UI reads version at runtime from `tauri.conf.json` via `getVersion()` — no hardcoded badge strings):
- `package.json` → `"version"`
- `src-tauri/tauri.conf.json` → `"version"`
- `src-tauri/Cargo.toml` → `version`

### Lint and Format Commands

```bash
npm run lint              # eslint . + cargo clippy (all targets)
npm run lint:frontend     # eslint only
npm run lint:backend      # cargo clippy only
npm run format            # prettier (frontend) + cargo fmt (backend)
```

### Safest AI Editing Practices

1. Read `ai/PROJECT_CONTEXT.md` and `ai/AI_RULES.md` before editing.
2. Make minimal, focused diffs.
3. Never assume HTTP API or database exists.
4. Update both Windows and Unix `sys/` modules for platform behavior changes (including inspection: PowerShell JSON on Windows, `ps` + exe resolution on Unix).
5. Register new commands in `invoke_handler` after adding `#[tauri::command]`.
6. Sync `ProcessDetails` / `PortInfo` shapes in `src/types.ts` when Rust serde models change.
7. Run `npm run build`, `cargo test`, and `npm run lint` before considering work complete.
8. Keep blocking shell I/O inside `spawn_blocking` in `sys/` — do not call `Command::output()` directly on the async executor.

---

## 13. Testing and Quality

### Test Frameworks

| Area | Framework | Status |
|------|-----------|--------|
| Rust backend | `cargo test` | **27 tests on Windows**; **38 on Unix/macOS/Linux** (adds 11 `unix.rs` + 5 `tray` tests) |
| Frontend | None | No Vitest/Jest/Playwright |

### Existing Tests

| Location | Count (platform) | Coverage |
|----------|------------------|----------|
| `src-tauri/src/sys/mod.rs` | 10 (all) | `dedupe_and_sort_ports`, `is_localhost_address`, `host_from_addr_port`, serde camelCase (`PortInfo`, `ProcessDetails`), `Protocol` serialization + `Display`, error display strings |
| `src-tauri/src/sys/windows.rs` | 11 (Windows only) | `parse_netstat_line` fixtures, `parse_windows_process_json` fixtures (full details, `permissionsLimited`, invalid JSON), `throughput_baseline` |
| `src-tauri/src/sys/unix.rs` | 11 (Unix only) | `parse_lsof_line` fixtures, `parse_ps_details_line`, `parse_lsof_exe_output` |
| `src-tauri/src/tray/mod.rs` | 5 (all) | `update_first_seen`, `select_top_recent_ports`, `icon_state_for_port_count`, `format_kill_label` |
| `src-tauri/src/lib.rs` | 1 (all) | `test_get_active_ports` — live OS integration against real `sys::get_active_ports()` |

**Status:** `cargo test --manifest-path src-tauri/Cargo.toml` passes (verified on Windows: **27 passed**). Unix-only tests are compiled and run only on non-Windows targets.

### Linting and Formatting

- **ESLint 9** flat config (`eslint.config.js`): `typescript-eslint`, `react-hooks`, `react-refresh`, `eslint-config-prettier`. Ignores `dist`, `node_modules`, `src-tauri`.
- **Prettier** (`.prettierrc`, `.prettierignore`): formats `src/**/*.{ts,tsx,css}` and root `*.{html,json,ts}`; ignores `dist`, `node_modules`, `src-tauri/target`.
- **Rust:** `cargo clippy` and `cargo fmt` invoked via `npm run lint:backend` / `npm run format:backend`. No committed `rustfmt.toml` or `clippy.toml` — uses toolchain defaults. Clippy may emit warnings (e.g. `needless_borrows_for_generic_args` in `sys/unix.rs` as of last inspection).
- **TypeScript:** `strict: true`, `noUnusedLocals`, `noUnusedParameters` in `tsconfig.json`. Type-check via `tsc` in `npm run build`.

### CI Quality Gates

`.github/workflows/release.yml` runs `cargo test --manifest-path src-tauri/Cargo.toml` on all platforms before `tauri-apps/tauri-action` build/publish. Triggered on `v*` tag push only. **Does not run** `npm run lint`, `npm run build`, or `cargo clippy` in CI.

### Test Commands

```bash
npm run build                                                          # TypeScript check + Vite build
npm run lint                                                           # ESLint + cargo clippy
npm run format                                                         # Prettier + cargo fmt
cargo test --manifest-path src-tauri/Cargo.toml -- --nocapture         # Rust tests
npm run tauri dev                                                      # Manual smoke test
```

### Missing Tests

- Frontend component tests (including grouped view, `KillGroupConfirmModal`, sortable `PortTable`).
- Unit tests for `src/utils/fuzzySearch.ts`, `groupPorts.ts`, `sortPorts.ts` (currently untested).
- IPC contract tests (Rust ↔ TypeScript field naming for `ProcessDetails`).
- Kill flow error handling tests.
- `get_process_details` error paths and `permissionsLimited` UI behavior (optional).
- Tray quick-kill flow (no confirmation modal); tray poll loop integration tests.

---

## 14. Known Issues, TODOs, and Incomplete Parts

**No `TODO`, `FIXME`, or `HACK` comments** were found in source files (`.rs`, `.tsx`, `.ts`).

### Documented Gaps and Issues

| Issue | File(s) | Details |
|-------|---------|---------|
| `console.error` | `App.tsx` line ~134 | Updater failure logged only when `!import.meta.env.DEV` |
| Optimistic kill by PID | `App.tsx` | Removes all rows sharing the same PID, not just the targeted port row |
| Partial group kill rollback | `App.tsx` `killProcessGroup()` | On partial success, failed PIDs are not restored; only total failure rolls back |
| Tray kill without confirmation | `tray/mod.rs` | Right-click tray menu kills by PID with no modal; errors only via `eprintln!` |
| Dual port polling | `App.tsx` + `tray/mod.rs` | Both poll `get_active_ports` every 3s — redundant shell commands when app is running |
| SIGKILL on Unix | `sys/unix.rs` | Uses `kill -9` with no graceful shutdown attempt |
| Clippy warnings | `sys/unix.rs` (and possibly others) | `cargo clippy` passes with warnings (e.g. `needless_borrows_for_generic_args`) |
| Version label mismatch | `README.md` vs manifests | README headings describe **v0.2.0** features; `package.json`, `Cargo.toml`, and `tauri.conf.json` still **0.1.0** |
| Command-line sensitivity | `ProcessDetailsModal.tsx` ~line 194 | Inspect modal warns command lines may contain sensitive arguments |
| No LICENSE file | repo root | Usage terms unclear |
| README missing grouping/fuzzy docs | `README.md` | Code has group-by-process, fuzzy search, and group kill; README still documents basic search/filters only |
| Lint/format not in CI | `.github/workflows/release.yml` | `npm run lint` and `npm run build` not gated before release |

### Resolved Since Prior Documentation

| Former issue | Status |
|--------------|--------|
| README localhost claim vs code | **Resolved** — `is_localhost_address()` filters in both platform parsers |
| Missing `src-tauri/icons/` | **Resolved** — `src-tauri/icons/` present with full icon set |
| Missing `.env.example` | **Resolved** — `.env.example` committed |
| Serde/TS `processName` mismatch | **Resolved** — `src/types.ts` uses `processName` |
| Missing favicon | **Resolved** — `index.html` points to `/tauri.svg` |
| No CI tests | **Resolved** — `cargo test` step added to `release.yml` |
| No parser unit tests | **Resolved** — fixture tests in `windows.rs`, `unix.rs`, `mod.rs` |
| Monolithic 570-line `App.tsx` | **Partially resolved** — split into 11 components + `src/utils/` (~442 lines in `App.tsx`) |
| Hardcoded UI version strings | **Resolved** — `getVersion()` from `@tauri-apps/api/app`; `UpdateModal` receives `currentVersion` prop |
| No ESLint / Prettier / clippy | **Resolved** — `eslint.config.js`, `.prettierrc`, `npm run lint` / `npm run format` scripts |
| `Protocol` compile error / missing `Display` | **Resolved** — `impl Display for Protocol` in `sys/mod.rs`; `cargo test` passes |
| Missing `public/illustrations/` | **Resolved** — three `.webp` files under `public/illustrations/` |
| `ai/AI_RULES.md` monolithic UI rule | **Resolved** — updated to component-based frontend guidance |
| README architecture diagram stale | **Resolved** — `README.md` updated with component diagram and inspect flow |

---

## 15. Security and Privacy Notes

### Process Termination Risk

PortPurge can kill arbitrary processes by PID. This is inherently dangerous. Users must understand they are terminating real OS processes. Admin/sudo may be required for protected processes.

**Tray quick-kill** (`tray/mod.rs`) bypasses the React `KillConfirmModal` — a single right-click menu selection terminates the process immediately.

**Group kill** (`killProcessGroup` in `App.tsx`) can terminate multiple PIDs in one confirmation — still uses the same destructive `kill_process_by_pid` IPC per PID.

### No Application-Level Auth

There is no user authentication. Security relies entirely on:
- OS-level permissions for the running user
- Tauri capability permissions in `capabilities/default.json`

### Tauri Capabilities

`default.json` grants: `core:default`, `opener:default`, `updater:default`, `process:allow-restart`. Review before adding new permissions.

### Content Security Policy

`tauri.conf.json` sets `"csp": null` — no CSP restriction on webview content. Acceptable for a local-only app with no external content loading, but worth reviewing if external URLs are embedded.

### Updater Trust Model

Updates are verified via embedded public key (`plugins.updater.pubkey` in `tauri.conf.json`). Private signing keys must never be committed (gitignored as `updater.key`).

### Input Validation

- `pid` is typed as `u32` in Rust — no shell injection risk for current commands.
- **Caution:** If future commands accept string arguments, validate carefully before passing to `Command`.

### Sensitive Data

- No user accounts, passwords, or PII stored.
- Port/process data is ephemeral and never persisted by the app.
- **Process inspection** may display **command lines / argv** that can contain secrets (API keys, tokens). `ProcessDetailsModal.tsx` warns users; treat inspect output as sensitive in screenshots and logs.

### Dependency Risks

Standard npm and Cargo dependencies. No automated vulnerability scanning configured in CI. Review is needed for production hardening.

---

## 16. AI Assistant Instructions

### Files Requiring Caution

| File | Why |
|------|-----|
| `src-tauri/tauri.conf.json` | Breaks build, bundle, updater if misconfigured |
| `src-tauri/capabilities/default.json` | Changes app permission model |
| `.github/workflows/release.yml` | Breaks release pipeline |
| `src-tauri/src/sys/*.rs` | Fragile OS output parsing |
| `src-tauri/src/tray/mod.rs` | Tray kill without confirmation; poll loop + mutex state; icon/menu updates |
| `updater.key` / signing secrets | Never read, commit, or expose |

### Architecture Rules

- This is a **Tauri desktop app** — never add Express, FastAPI, or REST API layers unless explicitly requested.
- Backend logic belongs in Rust (`src-tauri/`), not in Node.js.
- Platform-specific code must use the `sys/` module pattern with `#[cfg(target_os)]`.

### Forbidden Risky Behavior

- Committing secrets or signing keys.
- Rewriting `App.tsx` or component files entirely without explicit request.
- Changing `netstat`/`lsof` parsing without updating fixture tests in the same module.
- Modifying only one platform module when behavior should be cross-platform (prefer shared logic in `mod.rs` for localhost filtering, dedupe).
- Adding database/ORM without explicit request.
- Removing tray, single-instance, or minimize-to-tray without explicit request.
- Changing tray kill-slot count or poll interval without updating `tray/mod.rs` tests.

### Safe Modification Patterns

- **New IPC command:** Add handler in `lib.rs` → implement in `sys/` (both platform modules for inspection) → register in `invoke_handler` → sync `src/types.ts` → call from `App.tsx` or relevant component.
- **UI change:** Edit targeted component in `src/components/` or pure logic in `src/utils/`; state/IPC in `App.tsx`; match existing Tailwind `@theme` / glass patterns.
- **Version bump:** Update all version locations listed in Section 12.

### Testing Expectations

- Run `cargo test` after Rust changes.
- Run `npm run build` after TypeScript changes.
- Run `npm run lint` before considering work complete (local; not in CI).
- Manually smoke-test with `npm run tauri dev` for UI/IPC changes.

### Common Pitfalls

- Forgetting shared helpers in `sys/mod.rs` when changing localhost or dedupe behavior.
- Forgetting to update both `windows.rs` and `unix.rs` when changing inspection logic (PowerShell JSON vs `ps` + exe resolution).
- Assuming all 38 Rust tests run on every OS — `unix.rs` tests are `#[cfg(not(target_os = "windows"))]`; Windows runs **27**.
- Adding UI assets under wrong path — illustrations live in `public/illustrations/*.webp`.
- Calling `std::process::Command` directly in async `sys` functions — use `tauri::async_runtime::spawn_blocking` (existing pattern in both platform modules).
- Adding table sort/group/search logic inline in components — prefer `src/utils/` (existing pattern).
- **`ai/AI_RULES.md` drift:** Omits `ProcessDetailsModal`, `KillGroupConfirmModal`, `PortGroupRow`, `PortTableRow`, `src/utils/*`; tray logic now in `tray/mod.rs` — follow-up sync recommended.

---

## 17. Suggested Improvements

### High Priority

| Issue | Why It Matters | First Step | Related Files |
|-------|----------------|------------|---------------|
| No frontend tests | UI regressions undetected | Add Vitest for key components | `src/components/` |
| CI lacks lint/build gates | TS/clippy issues could reach release | Add `npm run build` and `npm run lint` to `release.yml` | `.github/workflows/release.yml` |

### Medium Priority

| Issue | Why It Matters | First Step | Related Files |
|-------|----------------|------------|---------------|
| Version label mismatch (README v0.2.0 vs manifests 0.1.0) | Confusing release state for users and CI | Bump all version fields to 0.2.0 if release intended, or tone down README heading | `package.json`, `Cargo.toml`, `tauri.conf.json`, `README.md` |
| Clippy warnings in `sys/` | Noise may hide real issues | Run `cargo clippy --fix` or address warnings | `sys/unix.rs`, `sys/windows.rs` |
| `ai/AI_RULES.md` component/IPC/utils drift | AI agents may miss new components, `src/utils/`, and `tray/mod.rs` split | Sync AI_RULES with current frontend + tray layout | `ai/AI_RULES.md` |
| README missing grouping/fuzzy docs | Users unaware of group-by and fuzzy search | Document in README Features section | `README.md` |

### Low Priority

| Issue | Why It Matters | First Step | Related Files |
|-------|----------------|------------|---------------|
| Missing LICENSE | Unclear usage terms | Add license file | repo root |
| Graceful kill on Unix | `kill -9` is abrupt | Try `kill` (SIGTERM) before SIGKILL | `sys/unix.rs` |
| Dual port polling | Redundant `netstat`/`lsof` work; battery/CPU on laptops | Share port snapshot between tray and frontend, or pause tray poll when window focused | `tray/mod.rs`, `App.tsx` |
| Tray kill without confirmation | Accidental process termination | Add optional confirm or undo; document in README | `tray/mod.rs` |
| README tray docs incomplete | README lists basic tray only; not kill slots or icon states | Update README tray section | `README.md` |

---

## 18. Quick Reference

### Entry Points

| Layer | File |
|-------|------|
| HTML | `index.html` |
| React | `src/main.tsx` → `src/App.tsx` + `src/components/*` |
| Types | `src/types.ts` |
| Rust binary | `src-tauri/src/main.rs` → `src-tauri/src/lib.rs` |

### npm Scripts

| Command | Action |
|---------|--------|
| `npm run dev` | Vite dev server (port 1420) |
| `npm run build` | `tsc && vite build` |
| `npm run preview` | Preview production build |
| `npm run tauri dev` | Full desktop app in dev mode |
| `npm run tauri build` | Production desktop installer |
| `npm run lint` | ESLint (frontend) + cargo clippy (backend) |
| `npm run lint:frontend` | ESLint only |
| `npm run lint:backend` | cargo clippy only |
| `npm run format` | Prettier (frontend) + cargo fmt (backend) |

### IPC Commands

| Command | Args | Returns |
|---------|------|---------|
| `get_active_ports` | none | `PortInfo[]` |
| `kill_process_by_pid` | `{ pid: number }` | void |
| `get_process_details` | `{ pid: number }` | `ProcessDetails` |

### Key Paths

| Concern | Path |
|---------|------|
| UI orchestration | `src/App.tsx` |
| UI components | `src/components/` (incl. `PortGroupRow`, `KillGroupConfirmModal`, `ProcessDetailsModal`) |
| Frontend utilities | `src/utils/` (`fuzzySearch`, `groupPorts`, `sortPorts`) |
| Shared TS types | `src/types.ts` |
| IPC handlers | `src-tauri/src/lib.rs` |
| System tray | `src-tauri/src/tray/mod.rs` |
| Shared port logic | `src-tauri/src/sys/mod.rs` |
| Windows logic | `src-tauri/src/sys/windows.rs` |
| Unix logic | `src-tauri/src/sys/unix.rs` |
| App config | `src-tauri/tauri.conf.json` |
| Bundle icons | `src-tauri/icons/` (incl. `tray-normal.png`, `tray-amber.png`, `tray-red.png`) |
| Permissions | `src-tauri/capabilities/default.json` |
| Dev env template | `.env.example` |
| CI release | `.github/workflows/release.yml` |
| AI docs | `ai/` |
| Illustrations | `public/illustrations/` |

### Platform Runtime Tools (inspect + scan)

| OS | Tools |
|----|-------|
| Windows | `netstat`, `tasklist`, `taskkill`, **PowerShell** (CIM inspect) |
| macOS/Linux | `lsof`, **`ps`**; exe path via `lsof` (macOS) or `readlink` (Linux) |

### Common Workflows

**Add a new IPC command:**
1. Implement in `sys/mod.rs` (+ platform files for both OSes if inspection-related)
2. Add `ProcessDetails` or other types to `src/types.ts` if needed
3. Add `#[tauri::command]` in `lib.rs`
4. Register in `invoke_handler`
5. Call via `invoke()` in `App.tsx` or the relevant component

**Fix port parsing bug:**
1. Reproduce on target OS with `npm run tauri dev`
2. Fix parser in `sys/windows.rs` or `sys/unix.rs` (or shared helper in `mod.rs`)
3. Update fixture tests in the same file
4. Run `cargo test`

**Release a new version:**
1. Bump version in `package.json`, `Cargo.toml`, `tauri.conf.json` (UI picks up via `getVersion()`)
2. Tag `vX.Y.Z` and push
3. CI creates draft GitHub Release

---

## 19. Glossary

| Term | Definition |
|------|------------|
| **Port purge** | Terminating the process that owns a network port, freeing the port for reuse |
| **PID** | Process ID — numeric identifier assigned by the OS to a running process |
| **TCP listener** | A TCP socket in LISTEN state, accepting incoming connections on a port |
| **UDP bind** | A UDP socket bound to a port for sending/receiving datagrams |
| **Tauri IPC** | Inter-Process Communication between the React webview and Rust backend via `invoke()` |
| **Optimistic update** | UI change applied immediately before server/backend confirms success, with rollback on failure |
| **System tray** | OS notification area icon; left-click toggles window; right-click menu with quick-kill slots — implemented in `tray/mod.rs`, not React |
| **Tray icon state** | Visual indicator (normal/amber/red) based on localhost port count thresholds (10 / 20) |
| **Tray quick-kill** | Kill up to 5 most recently seen ports from tray menu without confirmation modal |
| **Single-instance lock** | Prevents multiple copies of the app; second launch focuses existing window |
| **Minimize-to-tray** | Close button hides window to tray instead of quitting the app |
| **netstat** | Windows built-in command listing network connections (`netstat -ano`) |
| **lsof** | Unix "list open files" command used here to find network sockets (`lsof -i -P -n`) |
| **taskkill** | Windows command to terminate processes (`taskkill /F /PID`) |
| **Localhost filter** | Only ports bound to loopback (`127.0.0.1`, `::1`, `localhost`) are shown — enforced in platform parsers |
| **Protocol** | Rust enum (`Tcp`/`Udp`/`Other`) serializing to JSON strings for IPC |
| **dedupe_and_sort_ports** | Shared Rust helper that deduplicates by port+protocol and sorts results |
| **spawn_blocking** | Tauri async pattern used in `sys/` to run blocking `Command::output()` off the main async executor |
| **ProcessDetails** | IPC model for deep process inspection (path, command line, memory, user, start time, `permissionsLimited`) |
| **PortGroup** | Frontend-only aggregate of ports sharing a process name; used for grouped table view and batch kill |
| **Fuzzy search** | Ordered-subsequence match in `filterPortsByFuzzyQuery()` — not full-text or Levenshtein |
| **permissionsLimited** | Flag when OS ACLs block sensitive inspect fields; UI shows partial data |
| **SIGKILL (`kill -9`)** | Forceful Unix signal that immediately terminates a process |

---

## 20. Final Notes

### Uncertainties (Need Human Review)

1. **SIGKILL vs graceful kill:** Is `kill -9` on Unix intentional for a dev utility, or should graceful `kill` be tried first?
2. **LICENSE:** No license file in repo root — usage/distribution terms undefined.
3. **Version label:** README describes v0.2.0 capabilities; manifests remain 0.1.0 — confirm intended release version before bumping.

### Assumptions Made in This Document

- `lsof` is available on macOS/Linux target systems.
- Windows built-in tools (`netstat`, `tasklist`, `taskkill`, PowerShell) are available.
- Unix inspection uses `ps`; Linux uses `readlink`, macOS uses `lsof` for executable path resolution.
- Localhost filtering to `127.0.0.1` / `::1` / `localhost` is intentional product scope (matches README and code).
- The GitHub repo `IT25100142/PortPurge-System` is the canonical update source.
- App identifier `com.portpurge.app` is final.
- `cargo test` passes on the developer's current platform; full **38-test** suite requires a non-Windows build for `unix.rs` coverage (**27 on Windows**).
- App version displayed in UI is sourced from `tauri.conf.json` via Tauri `getVersion()`, not hardcoded in React.

### Recommended Future Documentation

- Add `CONTRIBUTING.md` with platform-specific dev notes.
- Add LICENSE file.
- Sync `ai/AI_RULES.md` with current components (`KillGroupConfirmModal`, row components), `src/utils/`, and `tray/mod.rs`.
