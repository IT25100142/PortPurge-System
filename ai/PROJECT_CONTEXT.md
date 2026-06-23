# Project Context

## 1. Project Overview

**PortPurge** is a lightweight, cross-platform **desktop utility** that helps developers monitor active TCP/UDP network ports, identify which processes own them, and terminate (purge) those processes with a single click.

- **Why it exists:** Developers frequently encounter "port already in use" errors during local development. PortPurge provides a fast visual dashboard instead of manually running `netstat`, `lsof`, or `taskkill`.
- **Target users:** Software developers debugging local port conflicts on Windows, macOS, or Linux.
- **Current maturity:** Early-stage **v0.1.0** — functional core features, expanded Rust test suite (parser fixtures + shared helpers), UI split into focused React components with state/orchestration in `App.tsx`.
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
| **Tauri** | v2 | `src-tauri/Cargo.toml`, `src-tauri/tauri.conf.json` |
| **Rust** | Edition 2021 | `src-tauri/Cargo.toml` |
| **Serde / serde_json** | v1 | `src-tauri/Cargo.toml` — IPC serialization |
| **thiserror** | v2 | `src-tauri/Cargo.toml` — `PortPurgeError` derive |
| **Tauri plugins** | opener, single-instance, updater, process | `src-tauri/src/lib.rs`, `src-tauri/capabilities/default.json` |
| **IPC client** | `@tauri-apps/api` `invoke()`, `getVersion()` | `src/App.tsx` |
| **Package manager** | npm | `package-lock.json`, `package.json` scripts |
| **Database** | None | — |
| **ORM** | None | — |
| **Auth** | None (OS-level permissions only) | — |
| **HTTP API** | None | — |
| **State management** | React `useState` / `useCallback` / `useEffect` only | `src/App.tsx` |
| **Validation** | TypeScript types + Rust `u32` for PID | `src/App.tsx`, `src-tauri/src/sys/mod.rs` |
| **Testing** | Rust `#[test]` — 18 on Windows / 25 on Unix (platform `#[cfg]` gates `unix.rs` tests) | `src-tauri/src/**/*.rs` |
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
│   ├── App.tsx                  # App shell, state, IPC, updater orchestration (~348 lines)
│   ├── types.ts                 # Shared TS interfaces (PortInfo, Toast, etc.)
│   ├── components/              # Presentational UI components
│   │   ├── PortTable.tsx        # Port list table + empty states
│   │   ├── SearchFilters.tsx    # Search input + protocol pills
│   │   ├── MetricsBar.tsx       # TCP/UDP/total counts
│   │   ├── KillConfirmModal.tsx # Kill confirmation dialog
│   │   ├── UpdateModal.tsx      # In-app updater modal
│   │   ├── ToastContainer.tsx   # Toast notifications
│   │   └── EmptyState.tsx       # No-ports / no-results / permission states
│   ├── index.css                # Tailwind v4 @theme tokens + glass utilities + animations
│   └── vite-env.d.ts            # Vite type references
├── src-tauri/                   # Rust backend (Tauri native layer)
│   ├── src/
│   │   ├── main.rs              # Binary entry → portpurge_lib::run()
│   │   ├── lib.rs               # Tauri builder, IPC commands, tray, plugins
│   │   └── sys/
│   │       ├── mod.rs           # Protocol, PortInfo, PortPurgeError, dedupe, localhost helpers
│   │       ├── windows.rs       # netstat parser, tasklist, taskkill (spawn_blocking)
│   │       └── unix.rs          # lsof parser, kill -9 (spawn_blocking)
│   ├── icons/                   # App bundle icons (png, icns, ico, platform sets)
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
- No frontend `tests/` directory

**Generated / gitignored (do not document contents):** `node_modules/`, `dist/`, `src-tauri/target/`.

---

## 4. Core Features

### 4.1 Real-Time Port Monitoring

- **Purpose:** Display active TCP listeners and UDP binds on **localhost only** (`127.0.0.1`, `::1`, `localhost`) with port, protocol, PID, and process name.
- **User behavior:** Dashboard auto-refreshes every 3 seconds (toggleable); manual refresh shows success toast and "Updated" timestamp.
- **Flow:** `App.tsx` → `invoke("get_active_ports")` → `lib.rs` → `sys::get_active_ports()` → `spawn_blocking` shell command → parse with localhost filter → `dedupe_and_sort_ports()` → `PortInfo[]`.
- **Important files:** `src/App.tsx` (polling), `src-tauri/src/sys/mod.rs` (`is_localhost_address`, `host_from_addr_port`, `dedupe_and_sort_ports`), `src-tauri/src/sys/windows.rs`, `src-tauri/src/sys/unix.rs`.
- **Localhost filter:** Implemented in both platform parsers via `is_localhost_address()` — rejects `0.0.0.0`, `*`, `[::]`, and LAN addresses. Identified in: `sys/mod.rs`, `sys/windows.rs`, `sys/unix.rs`.

### 4.2 Search and Protocol Filtering

- **Purpose:** Narrow the port table by port number, PID, process name, or protocol.
- **User behavior:** Text search + ALL/TCP/UDP filter pills.
- **Flow:** Client-side filter on `ports` state in `App.tsx` (`filteredPorts`); UI in `SearchFilters.tsx`.
- **Important files:** `src/App.tsx`, `src/components/SearchFilters.tsx`.

### 4.3 Process Kill (Purge)

- **Purpose:** Terminate a process owning a port.
- **User behavior:** Click Kill → `KillConfirmModal` → Confirm → row disappears optimistically; rollback + error toast on failure.
- **Flow:** `invoke("kill_process_by_pid", { pid })` → `sys::kill_process_by_pid()` via `spawn_blocking` → `taskkill` (Windows) or `kill -9` (Unix).
- **Important files:** `src/App.tsx` (`killProcess`, `killTarget` state), `src/components/KillConfirmModal.tsx`, `src-tauri/src/sys/windows.rs`, `src-tauri/src/sys/unix.rs`.

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

- **Purpose:** Run quietly in background; prevent duplicate instances.
- **User behavior:** Close button hides to tray; left-click tray toggles window; right-click menu: Show / Quit. Second launch focuses existing window.
- **Flow:** Configured entirely in `src-tauri/src/lib.rs` — not visible in React.
- **Plugins:** `tauri-plugin-single-instance`, Tauri tray API.

---

## 5. Application Flow

### 5.1 Startup

```
main.rs → lib.rs::run()
  → Register plugins (opener, single-instance, updater, process)
  → setup(): build system tray
  → Load webview (dev: http://localhost:1420, prod: ../dist)
  → main.tsx → App.tsx mounts
  → fetchPorts() on mount
  → getVersion() → setAppVersion (Tauri only)
  → checkForUpdates() after 1.5s delay
```

### 5.2 Port Polling Loop

```
App.tsx useEffect (3s interval, if autoRefresh && !killingPid)
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

### 5.4 Error Handling

- **Rust:** `PortPurgeError` enum with `thiserror::Error` → `Display` impl → converted to `String` in `lib.rs` via `.map_err(|e| e.to_string())`.
- **Frontend:** Errors caught in try/catch → `showToast(String(err), "error")`.
- **Access denied:** Mapped from OS stderr patterns ("Access is denied", "Permission denied", etc.).

### 5.5 Request Lifecycle (IPC)

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
            │ kill_process_by_pid
            ▼
┌─────────────────────────┐
│   Tauri Rust Backend    │
│   (src-tauri/src/lib.rs)│
│   Commands, tray, plugins│
└───────────┬─────────────┘
            │
   ┌────────┴────────┐
   ▼                 ▼
┌──────────┐   ┌──────────┐
│ windows  │   │ unix     │
│ .rs      │   │ .rs      │
└────┬─────┘   └────┬─────┘
     │              │
     ▼              ▼
 netstat/taskkill  lsof/kill
```

### Separation of Concerns

| Layer | Responsibility |
|-------|----------------|
| `App.tsx` | State orchestration, polling, IPC calls, optimistic kill, updater logic, runtime version via `getVersion()` |
| `src/components/*` | Presentational UI (table, modals, toasts, filters, metrics) |
| `src/types.ts` | Shared TypeScript interfaces for IPC data shapes |
| `lib.rs` | Tauri app lifecycle, IPC command registration, tray, plugins |
| `sys/mod.rs` | `Protocol`, shared types, localhost helpers, dedupe, platform dispatch via `#[cfg]` |
| `sys/windows.rs` / `sys/unix.rs` | OS command execution, output parsing, localhost filtering; blocking shell I/O via `spawn_blocking` |

### Design Patterns

- **Command-Query separation:** Read (`get_active_ports`) vs write (`kill_process_by_pid`) IPC commands.
- **Strategy pattern:** Platform-specific `sys` implementations selected at compile time.
- **Optimistic UI:** Kill removes row immediately, rolls back on failure.
- **Blocking work off async runtime:** `get_active_ports` and `kill_process_by_pid` in `sys/` wrap `std::process::Command` in `tauri::async_runtime::spawn_blocking` so shell I/O does not block the Tauri async executor.

### Strengths

- Small, inspectable codebase with clear `sys/` platform boundary.
- Localhost-only filtering centralized in `is_localhost_address()` / `host_from_addr_port()`.
- Deduplication prefers known process names over `"Unknown"` (`dedupe_and_sort_ports`).
- Windows performance optimization: single `tasklist` call builds PID→name map per scan cycle.
- Parser fixture tests for both `netstat` and `lsof` output.
- UI decomposed into focused components; `App.tsx` handles orchestration only.
- `cargo test` passes; `Protocol` implements `Display` for logging and integration test output.

### Weaknesses

- Shell-command parsing remains fragile (output format changes across OS versions).
- `unix.rs` parser tests only run on non-Windows targets (`#[cfg(not(target_os = "windows"))]`).
- No frontend tests; no Vitest/Jest/Playwright.
- Lint/format tooling exists locally but is **not enforced in CI** (`release.yml` runs `cargo test` only).

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
| `src/App.tsx` | State, IPC, polling, kill/updater orchestration, `getVersion()` for badge | `@tauri-apps/api` (core + app), updater/process plugins, components, `types` |
| `src/types.ts` | `PortInfo`, `Toast`, `DownloadProgress` interfaces | — |
| `src/components/PortTable.tsx` | Port table, kill buttons, loading shimmer | `EmptyState`, lucide-react |
| `src/components/SearchFilters.tsx` | Search input + ALL/TCP/UDP pills | — |
| `src/components/MetricsBar.tsx` | Total/TCP/UDP count badges | — |
| `src/components/KillConfirmModal.tsx` | Kill confirmation overlay | `types` |
| `src/components/UpdateModal.tsx` | Updater version/download UI; receives `currentVersion` from parent | `@tauri-apps/plugin-updater` types |
| `src/components/ToastContainer.tsx` | Toast stack (bottom-right) | `types` |
| `src/components/EmptyState.tsx` | No-ports / no-results / permission empty states | `public/illustrations/*.webp` |
| `src/index.css` | Tailwind v4 `@theme` tokens, glass utilities, animations | Tailwind |
| `index.html` | HTML shell, mounts `#root`, favicon `/tauri.svg` | Vite |

### Rust Backend

| File | Purpose | Dependencies |
|------|---------|--------------|
| `src-tauri/src/main.rs` | Binary entry, Windows subsystem attribute | `portpurge_lib` |
| `src-tauri/src/lib.rs` | Tauri builder, IPC commands, tray, plugins, test | `sys`, tauri, plugins |
| `src-tauri/src/sys/mod.rs` | Protocol, shared types, localhost helpers, dedupe, platform re-exports | serde, thiserror |
| `src-tauri/src/sys/windows.rs` | `parse_netstat_line`, port scan + kill via netstat/tasklist/taskkill (`spawn_blocking`) | std::process::Command, tauri async runtime |
| `src-tauri/src/sys/unix.rs` | `parse_lsof_line`, port scan + kill via lsof/kill (`spawn_blocking`) | std::process::Command, tauri async runtime |
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
  - Windows: `netstat`, `tasklist`, `taskkill` (built-in)
  - macOS/Linux: `lsof` (must be installed; standard on macOS/Linux)

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
| Kill fails with Access Denied | Insufficient OS privileges | Run as admin/sudo |

---

## 12. Development Workflow

### Where to Add Features

| Change Type | Location |
|-------------|----------|
| New UI / dashboard feature | `src/components/` for presentational UI; state/IPC in `src/App.tsx` |
| Shared TS types | `src/types.ts` |
| New backend capability | `#[tauri::command]` in `src-tauri/src/lib.rs` + implementation in `sys/` |
| Shared port logic (both platforms) | `src-tauri/src/sys/mod.rs` |
| Platform-specific logic | `src-tauri/src/sys/windows.rs` AND `src-tauri/src/sys/unix.rs` |
| New Tauri plugin | `Cargo.toml` + `lib.rs` plugin init + `capabilities/default.json` permissions |
| Styling | Tailwind classes in components; global animations in `src/index.css` |
| Release / updater config | `src-tauri/tauri.conf.json`, `.github/workflows/release.yml` |

### Coding Conventions

- **Rust:** snake_case for functions/variables; `#[cfg(target_os)]` for platform code.
- **TypeScript:** camelCase for variables/functions; PascalCase for components; interfaces for data shapes.
- **IPC:** Command names use snake_case (`get_active_ports`, `kill_process_by_pid`).
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
4. Update both Windows and Unix `sys/` modules for platform behavior changes.
5. Register new commands in `invoke_handler` after adding `#[tauri::command]`.
6. Run `npm run build`, `cargo test`, and `npm run lint` before considering work complete.
7. Keep blocking shell I/O inside `spawn_blocking` in `sys/` — do not call `Command::output()` directly on the async executor.

---

## 13. Testing and Quality

### Test Frameworks

| Area | Framework | Status |
|------|-----------|--------|
| Rust backend | `cargo test` | 18 tests on Windows; 25 on Unix/macOS/Linux (includes 7 `unix.rs` parser tests) |
| Frontend | None | No Vitest/Jest/Playwright |

### Existing Tests

| Location | Count (platform) | Coverage |
|----------|------------------|----------|
| `src-tauri/src/sys/mod.rs` | 9 (all) | `dedupe_and_sort_ports`, `is_localhost_address`, `host_from_addr_port`, serde camelCase, `Protocol` serialization + `Display`, error display strings |
| `src-tauri/src/sys/windows.rs` | 8 (Windows only) | `parse_netstat_line` fixtures (localhost, reject LAN/wildcard/malformed), `throughput_baseline` |
| `src-tauri/src/sys/unix.rs` | 7 (Unix only) | `parse_lsof_line` fixtures (localhost, reject wildcard/LAN/non-listening) |
| `src-tauri/src/lib.rs` | 1 (all) | `test_get_active_ports` — live OS integration against real `sys::get_active_ports()` |

**Status:** `cargo test --manifest-path src-tauri/Cargo.toml` passes (verified on Windows: 18 passed). Unix-only tests are compiled and run only on non-Windows targets.

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

- Frontend component tests.
- IPC contract tests (Rust ↔ TypeScript field naming).
- Kill flow error handling tests.

---

## 14. Known Issues, TODOs, and Incomplete Parts

**No `TODO`, `FIXME`, or `HACK` comments** were found in source files (`.rs`, `.tsx`, `.ts`).

### Documented Gaps and Issues

| Issue | File(s) | Details |
|-------|---------|---------|
| `console.error` | `App.tsx` line ~124 | Updater failure logged only when `!import.meta.env.DEV` |
| Optimistic kill by PID | `App.tsx` | Removes all rows sharing the same PID, not just the targeted port row |
| SIGKILL on Unix | `sys/unix.rs` | Uses `kill -9` with no graceful shutdown attempt |
| Clippy warnings | `sys/unix.rs` (and possibly others) | `cargo clippy` passes with warnings (e.g. `needless_borrows_for_generic_args`) |
| No LICENSE file | repo root | Usage terms unclear |
| README architecture diagram | `README.md` | Still shows monolithic `App.tsx Dashboard` — components not reflected |
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
| Monolithic 570-line `App.tsx` | **Partially resolved** — split into 7 components (~348 lines in `App.tsx`) |
| Hardcoded UI version strings | **Resolved** — `getVersion()` from `@tauri-apps/api/app`; `UpdateModal` receives `currentVersion` prop |
| No ESLint / Prettier / clippy | **Resolved** — `eslint.config.js`, `.prettierrc`, `npm run lint` / `npm run format` scripts |
| `Protocol` compile error / missing `Display` | **Resolved** — `impl Display for Protocol` in `sys/mod.rs`; `cargo test` passes |
| Missing `public/illustrations/` | **Resolved** — three `.webp` files under `public/illustrations/` |
| `ai/AI_RULES.md` monolithic UI rule | **Resolved** — updated to component-based frontend guidance |

---

## 15. Security and Privacy Notes

### Process Termination Risk

PortPurge can kill arbitrary processes by PID. This is inherently dangerous. Users must understand they are terminating real OS processes. Admin/sudo may be required for protected processes.

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

### Safe Modification Patterns

- **New IPC command:** Add handler in `lib.rs` → implement in `sys/` → register in `invoke_handler` → call from `App.tsx`.
- **UI change:** Edit targeted component in `src/components/` or state logic in `App.tsx`; match existing Tailwind `@theme` / glass patterns.
- **Version bump:** Update all version locations listed in Section 12.

### Testing Expectations

- Run `cargo test` after Rust changes.
- Run `npm run build` after TypeScript changes.
- Run `npm run lint` before considering work complete (local; not in CI).
- Manually smoke-test with `npm run tauri dev` for UI/IPC changes.

### Common Pitfalls

- Forgetting shared helpers in `sys/mod.rs` when changing localhost or dedupe behavior.
- Forgetting to update both `windows.rs` and `unix.rs` parser tests when changing parse logic.
- Assuming all 25 Rust tests run on every OS — `unix.rs` tests are `#[cfg(not(target_os = "windows"))]`.
- Adding UI assets under wrong path — illustrations live in `public/illustrations/*.webp`.
- Calling `std::process::Command` directly in async `sys` functions — use `tauri::async_runtime::spawn_blocking` (existing pattern in both platform modules).

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
| README architecture diagram stale | Shows monolithic `App.tsx` only | Update diagram to mention `src/components/` | `README.md` |
| Clippy warnings in `sys/` | Noise may hide real issues | Run `cargo clippy --fix` or address warnings | `sys/unix.rs`, `sys/windows.rs` |
| `ai/AI_RULES.md` lint guidance | AI agents may not know to run `npm run lint` | Add lint/format expectations to AI_RULES | `ai/AI_RULES.md` |

### Low Priority

| Issue | Why It Matters | First Step | Related Files |
|-------|----------------|------------|---------------|
| Missing LICENSE | Unclear usage terms | Add license file | repo root |
| Graceful kill on Unix | `kill -9` is abrupt | Try `kill` (SIGTERM) before SIGKILL | `sys/unix.rs` |

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

### Key Paths

| Concern | Path |
|---------|------|
| UI orchestration | `src/App.tsx` |
| UI components | `src/components/` |
| Shared TS types | `src/types.ts` |
| IPC handlers | `src-tauri/src/lib.rs` |
| Shared port logic | `src-tauri/src/sys/mod.rs` |
| Windows logic | `src-tauri/src/sys/windows.rs` |
| Unix logic | `src-tauri/src/sys/unix.rs` |
| App config | `src-tauri/tauri.conf.json` |
| Bundle icons | `src-tauri/icons/` |
| Permissions | `src-tauri/capabilities/default.json` |
| Dev env template | `.env.example` |
| CI release | `.github/workflows/release.yml` |
| AI docs | `ai/` |
| Illustrations | `public/illustrations/` |

### Common Workflows

**Add a new IPC command:**
1. Implement in `sys/mod.rs` (+ platform files)
2. Add `#[tauri::command]` in `lib.rs`
3. Register in `invoke_handler`
4. Call via `invoke()` in `App.tsx`

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
| **System tray** | OS notification area icon allowing background app access (configured in Rust, not React) |
| **Single-instance lock** | Prevents multiple copies of the app; second launch focuses existing window |
| **Minimize-to-tray** | Close button hides window to tray instead of quitting the app |
| **netstat** | Windows built-in command listing network connections (`netstat -ano`) |
| **lsof** | Unix "list open files" command used here to find network sockets (`lsof -i -P -n`) |
| **taskkill** | Windows command to terminate processes (`taskkill /F /PID`) |
| **Localhost filter** | Only ports bound to loopback (`127.0.0.1`, `::1`, `localhost`) are shown — enforced in platform parsers |
| **Protocol** | Rust enum (`Tcp`/`Udp`/`Other`) serializing to JSON strings for IPC |
| **dedupe_and_sort_ports** | Shared Rust helper that deduplicates by port+protocol and sorts results |
| **spawn_blocking** | Tauri async pattern used in `sys/` to run blocking `Command::output()` off the main async executor |
| **SIGKILL (`kill -9`)** | Forceful Unix signal that immediately terminates a process |

---

## 20. Final Notes

### Uncertainties (Need Human Review)

1. **SIGKILL vs graceful kill:** Is `kill -9` on Unix intentional for a dev utility, or should graceful `kill` be tried first?
2. **LICENSE:** No license file in repo root — usage/distribution terms undefined.

### Assumptions Made in This Document

- `lsof` is available on macOS/Linux target systems.
- Windows built-in tools (`netstat`, `tasklist`, `taskkill`) are available.
- Localhost filtering to `127.0.0.1` / `::1` / `localhost` is intentional product scope (matches README and code).
- The GitHub repo `IT25100142/PortPurge-System` is the canonical update source.
- App identifier `com.portpurge.app` is final.
- `cargo test` passes on the developer's current platform; full 25-test suite requires a non-Windows build for `unix.rs` coverage.
- App version displayed in UI is sourced from `tauri.conf.json` via Tauri `getVersion()`, not hardcoded in React.

### Recommended Future Documentation

- Add `CONTRIBUTING.md` with platform-specific dev notes.
- Sync `README.md` architecture diagram with component-based frontend.
- Add LICENSE file.
