# Project Context

## 1. Project Overview

**PortPurge** is a lightweight, cross-platform **desktop utility** that helps developers monitor active TCP/UDP network ports, identify which processes own them, and terminate (purge) those processes with a single click.

- **Why it exists:** Developers frequently encounter "port already in use" errors during local development. PortPurge provides a fast visual dashboard instead of manually running `netstat`, `lsof`, or `taskkill`.
- **Target users:** Software developers debugging local port conflicts on Windows, macOS, or Linux.
- **Current maturity:** Early-stage **v0.1.0** — functional core features, minimal test coverage, monolithic UI in a single React component.
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
| **Tauri plugins** | opener, single-instance, updater, process | `src-tauri/src/lib.rs`, `src-tauri/capabilities/default.json` |
| **IPC client** | `@tauri-apps/api` `invoke()` | `src/App.tsx` |
| **Package manager** | npm | `package-lock.json`, `package.json` scripts |
| **Database** | None | — |
| **ORM** | None | — |
| **Auth** | None (OS-level permissions only) | — |
| **HTTP API** | None | — |
| **State management** | React `useState` / `useCallback` / `useEffect` only | `src/App.tsx` |
| **Validation** | TypeScript types + Rust `u32` for PID | `src/App.tsx`, `src-tauri/src/sys/mod.rs` |
| **Testing** | Rust `#[test]` only (1 integration test) | `src-tauri/src/lib.rs` |
| **CI/CD** | GitHub Actions + `tauri-apps/tauri-action` | `.github/workflows/release.yml` |
| **Deployment** | Desktop installers via `tauri build`; auto-updater via GitHub Releases | `tauri.conf.json`, `release.yml` |

**Not present:** ESLint, Prettier, Vitest/Jest, Playwright, Docker, database drivers, web frameworks (Express, etc.).

---

## 3. Project Structure

```
PortPurge-System/
├── ai/                          # AI assistant documentation (this folder)
├── .github/workflows/
│   └── release.yml              # Multi-platform release on v* tags
├── .vscode/
│   └── extensions.json          # Recommends Tauri + rust-analyzer extensions
├── public/
│   └── tauri.svg                # Static asset
├── src/                         # React frontend (webview UI)
│   ├── main.tsx                 # React entry point
│   ├── App.tsx                  # Entire application UI + IPC client (~570 lines)
│   ├── index.css                # Tailwind import + custom animations
│   └── vite-env.d.ts            # Vite type references
├── src-tauri/                   # Rust backend (Tauri native layer)
│   ├── src/
│   │   ├── main.rs              # Binary entry → portpurge_lib::run()
│   │   ├── lib.rs               # Tauri builder, IPC commands, tray, plugins
│   │   └── sys/
│   │       ├── mod.rs           # PortInfo, PortPurgeError, platform re-exports
│   │       ├── windows.rs       # netstat, tasklist, taskkill
│   │       └── unix.rs          # lsof, kill -9
│   ├── capabilities/
│   │   └── default.json         # Tauri v2 permission capabilities
│   ├── Cargo.toml               # Rust dependencies
│   ├── Cargo.lock
│   ├── build.rs                 # tauri_build::build()
│   └── tauri.conf.json          # App config, bundle, updater
├── index.html                   # Vite HTML shell
├── package.json                 # npm scripts and frontend deps
├── vite.config.ts               # Vite dev server (port 1420)
├── tsconfig.json                # TypeScript config (app source)
├── tsconfig.node.json           # TypeScript config (Vite config)
└── README.md                    # Human-facing project documentation
```

**Absent folders (by design or not yet created):**
- No `src/components/`, `src/pages/`, `src/hooks/` — all UI is in `App.tsx`
- No `routes/`, `controllers/`, `services/` — no HTTP backend
- No frontend `tests/` directory
- No `src-tauri/icons/` in repo (referenced by `tauri.conf.json` but missing)

**Generated / gitignored (do not document contents):** `node_modules/`, `dist/`, `src-tauri/target/`.

---

## 4. Core Features

### 4.1 Real-Time Port Monitoring

- **Purpose:** Display active TCP listeners and UDP binds with port, protocol, PID, and process name.
- **User behavior:** Dashboard auto-refreshes every 3 seconds (toggleable); manual refresh available.
- **Flow:** `App.tsx` → `invoke("get_active_ports")` → `lib.rs` → `sys::get_active_ports()` → OS shell command → parse → `PortInfo[]`.
- **Important files:** `src/App.tsx` (polling), `src-tauri/src/sys/windows.rs`, `src-tauri/src/sys/unix.rs`.
- **Note:** README claims localhost-only scanning; **code does not filter by address** — see Section 14.

### 4.2 Search and Protocol Filtering

- **Purpose:** Narrow the port table by port number, PID, process name, or protocol.
- **User behavior:** Text search + ALL/TCP/UDP filter pills.
- **Flow:** Client-side filter on `ports` state in `App.tsx` (`filteredPorts`).
- **Important files:** `src/App.tsx` lines 201–213.

### 4.3 Process Kill (Purge)

- **Purpose:** Terminate a process owning a port.
- **User behavior:** Click Kill → Confirm → row disappears optimistically; rollback + error toast on failure.
- **Flow:** `invoke("kill_process_by_pid", { pid })` → `sys::kill_process_by_pid()` → `taskkill` (Windows) or `kill -9` (Unix).
- **Important files:** `src/App.tsx` (`killProcess`), `src-tauri/src/sys/windows.rs`, `src-tauri/src/sys/unix.rs`.

### 4.4 Toast Notifications

- **Purpose:** Feedback for refresh, kill success/failure, and updater events.
- **User behavior:** Toasts appear bottom-right, auto-dismiss after 4 seconds.
- **Important files:** `src/App.tsx` (`showToast`, `removeToast`, toast container).

### 4.5 In-App Updater

- **Purpose:** Check for new versions on startup and install from GitHub Releases.
- **User behavior:** Modal shows version comparison and release notes; Install Update downloads and relaunches.
- **Flow:** `@tauri-apps/plugin-updater` `check()` → modal → `downloadAndInstall()` → `@tauri-apps/plugin-process` `relaunch()`.
- **Important files:** `src/App.tsx`, `src-tauri/tauri.conf.json` (updater endpoint + pubkey), `src-tauri/src/lib.rs` (plugin init).

### 4.6 System Tray and Desktop Lifecycle (Rust-only)

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
  → checkForUpdates() after 1.5s delay
```

### 5.2 Port Polling Loop

```
App.tsx useEffect (3s interval, if autoRefresh && !killingPid)
  → fetchPorts()
  → invoke("get_active_ports")
  → lib.rs::get_active_ports()
  → sys::get_active_ports() [platform-specific]
  → setPorts(activePorts)
```

### 5.3 Kill Flow

```
User clicks Kill → setConfirmPid(pid)
User clicks Confirm → killProcess(pid, port)
  → Optimistic: remove all rows matching pid from ports state
  → invoke("kill_process_by_pid", { pid })
  → On success: success toast
  → On error: rollback ports state, error toast (Access Denied message if applicable)
  → finally: fetchPorts() to resync
```

### 5.4 Error Handling

- **Rust:** `PortPurgeError` enum → `Display` impl → converted to `String` in `lib.rs` via `.map_err(|e| e.to_string())`.
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
│   (src/App.tsx)         │
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
| `App.tsx` | UI, local state, polling, optimistic updates, updater UI |
| `lib.rs` | Tauri app lifecycle, IPC command registration, tray, plugins |
| `sys/mod.rs` | Shared types, platform dispatch via `#[cfg]` |
| `sys/windows.rs` / `sys/unix.rs` | OS command execution and output parsing |

### Design Patterns

- **Command-Query separation:** Read (`get_active_ports`) vs write (`kill_process_by_pid`) IPC commands.
- **Strategy pattern:** Platform-specific `sys` implementations selected at compile time.
- **Optimistic UI:** Kill removes row immediately, rolls back on failure.

### Strengths

- Small, inspectable codebase (~26 tracked files).
- Clear platform abstraction boundary in `sys/`.
- Windows performance optimization: single `tasklist` call builds PID→name map per scan cycle.

### Weaknesses

- Entire UI in one 570-line file — hard to maintain as features grow.
- Shell-command parsing is fragile (output format changes across OS versions).
- No unit tests for parsing logic; one live integration test only.
- README/code mismatch on localhost filtering.

---

## 7. Database and Data Models

No database or persistent data model was clearly identified from the codebase.

All data is ephemeral and in-memory:

### `PortInfo` (Rust — `src-tauri/src/sys/mod.rs`)

```rust
pub struct PortInfo {
    pub port: u16,
    pub protocol: String,      // "TCP" or "UDP"
    pub pid: u32,
    pub process_name: String,
}
```

Serde attribute: `#[serde(rename_all = "camelCase")]` — serializes `process_name` as `processName` in JSON.

### `PortInfo` (TypeScript — `src/App.tsx`)

```typescript
interface PortInfo {
  port: number;
  protocol: string;
  pid: number;
  process_name: string;  // Note: may mismatch serde camelCase output — see Section 14
}
```

### `PortPurgeError` (Rust — `src-tauri/src/sys/mod.rs`)

```rust
pub enum PortPurgeError {
    AccessDenied,
    ProcessNotFound,
    CommandError(String),
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
| `src/App.tsx` | Full dashboard UI, state, IPC, updater | `@tauri-apps/api`, updater/process plugins, lucide-react |
| `src/index.css` | Tailwind v4 import, `animate-slide-in` keyframes | Tailwind |
| `index.html` | HTML shell, mounts `#root` | Vite |

### Rust Backend

| File | Purpose | Dependencies |
|------|---------|--------------|
| `src-tauri/src/main.rs` | Binary entry, Windows subsystem attribute | `portpurge_lib` |
| `src-tauri/src/lib.rs` | Tauri builder, IPC commands, tray, plugins, test | `sys`, tauri, plugins |
| `src-tauri/src/sys/mod.rs` | Shared types, platform re-exports | serde |
| `src-tauri/src/sys/windows.rs` | Windows port scan + kill via netstat/tasklist/taskkill | std::process::Command |
| `src-tauri/src/sys/unix.rs` | Unix port scan + kill via lsof/kill | std::process::Command |
| `src-tauri/build.rs` | Tauri build hook | tauri-build |
| `src-tauri/tauri.conf.json` | App ID, window, bundle, updater config | — |
| `src-tauri/capabilities/default.json` | Plugin permissions for main window | — |

### Config

| File | Purpose |
|------|---------|
| `vite.config.ts` | Dev server port 1420, HMR, ignore `src-tauri/` in watch |
| `package.json` | npm scripts, frontend dependencies |
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

**Embedded in config (public, not secret):**
- Updater public key in `src-tauri/tauri.conf.json` → `plugins.updater.pubkey`

**Missing:** No `.env.example` file exists. Consider adding one documenting only `TAURI_DEV_HOST`.

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

Note: `README.md` says `cd portpurge` — the actual repo folder name is `PortPurge-System`.

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

**Warning:** `src-tauri/icons/` is referenced in `tauri.conf.json` but **missing from the repo** — production builds may fail until icons are added.

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
| Build fails on icons | Missing `src-tauri/icons/` | Add required icon files per `tauri.conf.json` |
| Kill fails with Access Denied | Insufficient OS privileges | Run as admin/sudo |

---

## 12. Development Workflow

### Where to Add Features

| Change Type | Location |
|-------------|----------|
| New UI / dashboard feature | `src/App.tsx` or new files under `src/components/` |
| New backend capability | `#[tauri::command]` in `src-tauri/src/lib.rs` + implementation in `sys/` |
| Platform-specific logic | `src-tauri/src/sys/windows.rs` AND `src-tauri/src/sys/unix.rs` |
| New Tauri plugin | `Cargo.toml` + `lib.rs` plugin init + `capabilities/default.json` permissions |
| Styling | Tailwind classes in components; global animations in `src/index.css` |
| Release / updater config | `src-tauri/tauri.conf.json`, `.github/workflows/release.yml` |

### Coding Conventions

- **Rust:** snake_case for functions/variables; `#[cfg(target_os)]` for platform code.
- **TypeScript:** camelCase for variables/functions; PascalCase for components; interfaces for data shapes.
- **IPC:** Command names use snake_case (`get_active_ports`, `kill_process_by_pid`).
- **UI:** Dark theme, glassmorphism (`backdrop-blur-xl`), indigo/violet gradients — follow patterns in `App.tsx`.

### Version Bumping

Sync version across:
- `package.json` → `"version"`
- `src-tauri/tauri.conf.json` → `"version"`
- `src-tauri/Cargo.toml` → `version`
- `src/App.tsx` → hardcoded `v0.1.0` in header and update modal

### Safest AI Editing Practices

1. Read `ai/PROJECT_CONTEXT.md` and `ai/AI_RULES.md` before editing.
2. Make minimal, focused diffs.
3. Never assume HTTP API or database exists.
4. Update both Windows and Unix `sys/` modules for platform behavior changes.
5. Register new commands in `invoke_handler` after adding `#[tauri::command]`.
6. Run `npm run build` and `cargo test` before considering work complete.

---

## 13. Testing and Quality

### Test Frameworks

| Area | Framework | Status |
|------|-----------|--------|
| Rust backend | `cargo test` | 1 test in `lib.rs` |
| Frontend | None | No Vitest/Jest/Playwright |

### Existing Test

`test_get_active_ports` in `src-tauri/src/lib.rs`:
- Integration-style: calls live `sys::get_active_ports()` against the real OS.
- Asserts `Ok` result; prints up to 15 ports.
- **Not** a unit test of parsing logic with fixtures.

### Linting and Formatting

- **TypeScript:** `strict: true`, `noUnusedLocals`, `noUnusedParameters` in `tsconfig.json`. Type-check via `tsc` in `npm run build`.
- **No ESLint, Prettier, Biome** configured.
- **No Rust clippy or rustfmt** config files.

### CI Quality Gates

`.github/workflows/release.yml` builds and publishes on `v*` tag push only. **No test or lint steps in CI.**

### Test Commands

```bash
npm run build                                                          # TypeScript check + Vite build
cargo test --manifest-path src-tauri/Cargo.toml -- --nocapture         # Rust tests
npm run tauri dev                                                      # Manual smoke test
```

### Missing Tests

- Parser unit tests for `netstat` / `lsof` output (with fixture strings).
- Frontend component tests.
- IPC contract tests.
- Kill flow error handling tests.

---

## 14. Known Issues, TODOs, and Incomplete Parts

**No `TODO`, `FIXME`, or `HACK` comments** were found in source files.

### Documented Gaps and Issues

| Issue | File(s) | Details |
|-------|---------|---------|
| README localhost claim | `README.md` vs `sys/windows.rs`, `sys/unix.rs` | README says ports "bound on localhost"; code lists **all** TCP listeners and UDP binds with no `127.0.0.1` / `::1` filter |
| README folder name | `README.md` | Says `cd portpurge`; repo is `PortPurge-System` |
| README test description | `README.md` vs `lib.rs` | README says "parsing unit tests"; actual test is live OS integration |
| Missing icons | `tauri.conf.json` | References `src-tauri/icons/*` but directory not in repo |
| Missing favicon | `index.html` | References `/vite.svg`; `public/` only has `tauri.svg` |
| Placeholder metadata | `Cargo.toml`, `index.html` | Authors `["you"]`; HTML title "Tauri + React + Typescript" |
| Serde/TS field naming | `sys/mod.rs`, `App.tsx` | Rust uses `#[serde(rename_all = "camelCase")]` → JSON `processName`; TS interface uses `process_name` — **needs human confirmation** whether this works at runtime |
| `console.error` | `App.tsx` line 116 | Updater failure logged to console |
| Optimistic kill by PID | `App.tsx` | Removes all rows sharing the same PID, not just the targeted port row |
| SIGKILL on Unix | `sys/unix.rs` | Uses `kill -9` with no graceful shutdown attempt |
| No `.env.example` | — | Only `TAURI_DEV_HOST` is used; undocumented for new contributors |
| Version hardcoded in UI | `App.tsx` | `v0.1.0` in header and update modal not read from `package.json` |

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
- Rewriting `App.tsx` entirely without explicit request.
- Changing `netstat`/`lsof` parsing without fixture-based tests.
- Modifying only one platform module when behavior should be cross-platform.
- Adding database/ORM without explicit request.
- Removing tray, single-instance, or minimize-to-tray without explicit request.

### Safe Modification Patterns

- **New IPC command:** Add handler in `lib.rs` → implement in `sys/` → register in `invoke_handler` → call from `App.tsx`.
- **UI change:** Edit targeted section in `App.tsx`; match existing Tailwind patterns.
- **Version bump:** Update all version locations listed in Section 12.

### Testing Expectations

- Run `cargo test` after Rust changes.
- Run `npm run build` after TypeScript changes.
- Manually smoke-test with `npm run tauri dev` for UI/IPC changes.

### Common Pitfalls

- Assuming localhost filtering exists (it does not in code).
- Forgetting to update both `windows.rs` and `unix.rs`.
- Mismatching serde field names between Rust and TypeScript.
- Missing icon files causing `tauri build` failure.

---

## 17. Suggested Improvements

### High Priority

| Issue | Why It Matters | First Step | Related Files |
|-------|----------------|------------|---------------|
| Missing `src-tauri/icons/` | `tauri build` likely fails | Generate/add Tauri default icons | `tauri.conf.json` |
| README localhost mismatch | Misleading docs / user expectations | Decide: add filter in `sys/` or fix README | `README.md`, `sys/*.rs` |
| Serde/TS field naming | Process names may not display correctly | Verify runtime JSON shape; align Rust or TS | `sys/mod.rs`, `App.tsx` |
| No CI tests | Regressions ship to releases | Add `cargo test` step to workflow | `.github/workflows/release.yml` |

### Medium Priority

| Issue | Why It Matters | First Step | Related Files |
|-------|----------------|------------|---------------|
| Monolithic `App.tsx` | Hard to maintain | Extract table, toasts, update modal to components | `src/App.tsx` |
| No parser unit tests | OS output changes break silently | Add fixture-based tests for netstat/lsof parsing | `sys/windows.rs`, `sys/unix.rs` |
| No `.env.example` | Undocumented dev config | Add file with `TAURI_DEV_HOST` | repo root |
| No lint/format tooling | Inconsistent code quality | Add ESLint + rustfmt or clippy | repo root |

### Low Priority

| Issue | Why It Matters | First Step | Related Files |
|-------|----------------|------------|---------------|
| Generic `index.html` title | Unpolished UX | Set title to "PortPurge" | `index.html` |
| Hardcoded version in UI | Drift from package version | Read version from import or Tauri API | `App.tsx`, `package.json` |
| Missing LICENSE | Unclear usage terms | Add license file | repo root |
| Missing favicon | Broken icon reference | Add `vite.svg` or point to `tauri.svg` | `index.html`, `public/` |

---

## 18. Quick Reference

### Entry Points

| Layer | File |
|-------|------|
| HTML | `index.html` |
| React | `src/main.tsx` → `src/App.tsx` |
| Rust binary | `src-tauri/src/main.rs` → `src-tauri/src/lib.rs` |

### npm Scripts

| Command | Action |
|---------|--------|
| `npm run dev` | Vite dev server (port 1420) |
| `npm run build` | `tsc && vite build` |
| `npm run preview` | Preview production build |
| `npm run tauri dev` | Full desktop app in dev mode |
| `npm run tauri build` | Production desktop installer |

### IPC Commands

| Command | Args | Returns |
|---------|------|---------|
| `get_active_ports` | none | `PortInfo[]` |
| `kill_process_by_pid` | `{ pid: number }` | void |

### Key Paths

| Concern | Path |
|---------|------|
| UI | `src/App.tsx` |
| IPC handlers | `src-tauri/src/lib.rs` |
| Windows logic | `src-tauri/src/sys/windows.rs` |
| Unix logic | `src-tauri/src/sys/unix.rs` |
| Shared types | `src-tauri/src/sys/mod.rs` |
| App config | `src-tauri/tauri.conf.json` |
| Permissions | `src-tauri/capabilities/default.json` |
| CI release | `.github/workflows/release.yml` |
| AI docs | `ai/` |

### Common Workflows

**Add a new IPC command:**
1. Implement in `sys/mod.rs` (+ platform files)
2. Add `#[tauri::command]` in `lib.rs`
3. Register in `invoke_handler`
4. Call via `invoke()` in `App.tsx`

**Fix port parsing bug:**
1. Reproduce on target OS with `npm run tauri dev`
2. Fix parser in `sys/windows.rs` or `sys/unix.rs`
3. Run `cargo test`

**Release a new version:**
1. Bump version in `package.json`, `Cargo.toml`, `tauri.conf.json`, `App.tsx`
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
| **SIGKILL (`kill -9`)** | Forceful Unix signal that immediately terminates a process |

---

## 20. Final Notes

### Uncertainties (Need Human Review)

1. **Localhost filtering:** Is the README's localhost-only claim intentional product scope, or should `sys/` filter to `127.0.0.1` / `::1`?
2. **Serde field naming:** Does `process_name` in TypeScript correctly receive data when Rust serializes with `camelCase` (`processName`)? Verify at runtime.
3. **Missing icons:** Are `src-tauri/icons/` stored elsewhere, generated locally, or simply not yet committed?
4. **SIGKILL vs graceful kill:** Is `kill -9` on Unix intentional for a dev utility, or should graceful `kill` be tried first?

### Assumptions Made in This Document

- `lsof` is available on macOS/Linux target systems.
- Windows built-in tools (`netstat`, `tasklist`, `taskkill`) are available.
- The GitHub repo `IT25100142/PortPurge-System` is the canonical update source.
- App identifier `com.portpurge.app` is final.

### Recommended Future Documentation

- Add `CONTRIBUTING.md` with platform-specific dev notes.
- Add `.env.example` for `TAURI_DEV_HOST`.
- Sync `README.md` with actual behavior (localhost filter, test description, folder name).
- Add parser fixture documentation when unit tests are added.
