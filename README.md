# PortPurge

A lightweight, cross-platform desktop utility for developers who are tired of fighting **"port already in use"** errors. PortPurge scans localhost-bound TCP/UDP ports, shows which process owns each one, lets you inspect deep process details before killing, and purges stubborn processes in one click.

Built with **Tauri v2**, **React 19**, **TypeScript**, and **Tailwind CSS v4**.

---

## Features

### v0.4.0 — Purge Ledger

- **Persistent action history** — Every kill attempt (success or failure) is recorded in a Rust-backed JSON ledger stored in the app data directory.
- **Last 100 entries** — Newest-first audit trail with automatic truncation; survives app restarts.
- **UI and tray sync** — Kills from the dashboard, group batch flow, and system tray all route through `ledger::kill_and_record` — one source of truth.
- **Live drawer updates** — The History side panel hydrates on launch and receives real-time `ledger-updated` Tauri events when tray kills occur in the background.
- **Rich entry metadata** — Each record captures process name, PID, port, protocol, kill source (UI / Tray / Group), timestamp, and error message on failure.

### v0.3.0 — Native Power

- **Native system tray** — Close the window and PortPurge keeps running in the background. Left-click the tray icon to show or hide the dashboard; right-click for quick actions.
- **Dynamic tray icons** — Tray icon color reflects localhost port load: normal (&lt;10 ports), amber (10–19), red (20+).
- **Tray quick-kill** — Up to five recently seen ports appear in the tray menu for one-click termination without opening the main window.
- **Smart process grouping** — Toggle **Group by Process** to collapse rows that share a process name into expandable groups with port and PID counts.
- **Batch group kill** — Terminate every unique PID in a group at once, with a confirmation modal and optimistic UI rollback on failure.
- **Zero-dependency fuzzy search** — Find ports instantly with an ordered-subsequence matcher — no search library, no network calls, pure client-side filtering.

### Port monitoring

- **Localhost-only scanning** — Surfaces ports bound to `127.0.0.1`, `::1`, and `localhost` (TCP listeners and UDP sockets).
- **Concurrent, non-blocking I/O** — OS shell commands run inside `spawn_blocking` so the UI stays responsive during scans.
- **Auto-refresh** — Polls every 3 seconds with a manual refresh option and last-updated timestamp.
- **Protocol filters** — Narrow results with ALL / TCP / UDP pills alongside fuzzy search.
- **Live metrics** — TCP, UDP, and total port counts at a glance.

### Sorting and deep inspection

- **Column sorting** — Click any table header (Protocol, Port, PID, Process Name) to sort ascending or descending in flat or grouped views.
- **Deep process inspection** — Inspect any row to view executable path, command line, memory usage, owning user, and start time before deciding to kill.
- **Graceful permission handling** — When OS ACLs block sensitive fields, the inspect modal returns partial data with a clear warning instead of failing silently.
- **Kill from inspect** — Jump from the details modal straight into the existing kill confirmation flow.

### Desktop integration

- **Optimistic kill updates** — Terminated rows disappear immediately; failures roll back with actionable toasts.
- **Glass-panel UI** — Dark, minimal "Circuit Purge" design system built on Tailwind `@theme` tokens.
- **Minimize-to-tray** — Close hides to the tray instead of quitting.
- **Single-instance lock** — A second launch focuses the existing window.
- **In-app updater** — Checks GitHub Releases on startup and installs updates with one click.

---

## Tech Stack

| Layer | Technologies |
|-------|----------------|
| **Frontend** | React 19, Vite 7, TypeScript, Tailwind CSS v4, Lucide React |
| **Frontend utilities** | Pure helpers in `src/utils/` — fuzzy search, grouping, sorting, ledger formatting (no React, no IPC) |
| **Backend** | Rust (Tauri v2), `serde` / `thiserror`, platform parsers in `src-tauri/src/sys/` |
| **Ledger** | Custom JSON append-log in `src-tauri/src/ledger/mod.rs` — `kill_and_record`, atomic disk writes |
| **Tray** | Isolated Rust module at `src-tauri/src/tray/mod.rs` — fully decoupled from React |
| **IPC** | `get_active_ports`, `get_process_details`, `kill_process_by_pid`, `get_ledger_entries`, `clear_ledger_entries` |
| **Events** | `ledger-updated` — pushed to React when a kill is recorded (UI or tray) |
| **OS tools** | Windows: `netstat`, `tasklist`, `taskkill`, PowerShell CIM · Unix: `lsof`, `ps`, `kill` |
| **Quality (local)** | ESLint, Prettier, `cargo clippy`, `cargo fmt` via npm scripts |

---

## Architecture

```
┌──────────────────────────────────────────────────────────────┐
│                     React Frontend                           │
│  App.tsx (orchestration) · components/ · utils/ (pure TS)    │
│  LedgerDrawer · listen("ledger-updated")                     │
└────────────────────────────┬─────────────────────────────────┘
                             │  Tauri IPC + events
                             ▼
┌──────────────────────────────────────────────────────────────┐
│                Tauri Rust Backend (lib.rs)                   │
│           IPC commands · plugins · window lifecycle            │
└──────────────┬─────────────────────────────┬───────────────┘
               │                             │
               ▼                             ▼
┌──────────────────────────┐     ┌─────────────────────────────┐
│  ledger/mod.rs           │     │  sys/ (windows.rs · unix.rs) │
│  kill_and_record · JSON  │     │  port scan · kill · inspect  │
│  purge-ledger.json       │     │  spawn_blocking shell I/O    │
└──────────────┬───────────┘     └─────────────────────────────┘
               │
               ▼
┌──────────────────────────┐
│  tray/mod.rs (Rust-only) │
│  icon states · quick-kill│
│  routes kills via ledger │
└──────────────────────────┘
```

| Path | Role |
|------|------|
| `src/App.tsx` | Orchestration: state, IPC, polling, kill and inspect flows, ledger hydration and event listener |
| `src/utils/` | Pure logic — fuzzy search, port grouping, table sorting, ledger time formatting |
| `src/components/LedgerDrawer.tsx` | Sliding History panel — purge ledger audit trail |
| `src/components/PortTable.tsx` | Sortable port table with flat and grouped views |
| `src/components/ProcessDetailsModal.tsx` | Deep process inspection modal |
| `src-tauri/src/ledger/mod.rs` | Purge Ledger persistence, `kill_and_record`, `ledger-updated` emit |
| `src-tauri/src/tray/mod.rs` | System tray icon, menu, port-count states, quick-kill via ledger |
| `src-tauri/src/sys/mod.rs` | Shared types (`PortInfo`, `ProcessDetails`), localhost filter |
| `src-tauri/src/sys/windows.rs` | Windows port scan, kill, and CIM process inspection |
| `src-tauri/src/sys/unix.rs` | Unix port scan, kill, and `ps`-based process inspection |

---

## Prerequisites

- **Node.js** v24+ recommended
- **Rust (Cargo)** v1.84+ recommended
- **Platform tools (runtime):**
  - **Windows** — `netstat`, `tasklist`, `taskkill`, PowerShell (built-in)
  - **macOS / Linux** — `lsof`, `ps` (standard on most systems)

---

## Local Development

### Install dependencies

```bash
git clone <repository-url>
cd PortPurge-System
npm install
```

### Run in development

```bash
npm run tauri dev
```

Starts the Vite dev server (port `1420`) and opens the Tauri window.

### Optional environment

For remote or mobile Tauri development, copy `.env.example` to `.env` and set `TAURI_DEV_HOST` if needed.

---

## Commands

| Command | Description |
|---------|-------------|
| `npm run tauri dev` | Development mode with hot reload |
| `npm run build` | TypeScript check + Vite production build |
| `npm run tauri build` | Desktop installer → `src-tauri/target/release/bundle/` |
| `npm run lint` | ESLint (frontend) + `cargo clippy` (backend) |
| `npm run format` | Prettier (frontend) + `cargo fmt` (backend) |
| `cargo test --manifest-path src-tauri/Cargo.toml` | Parser fixture tests + live OS integration test |

---

## Administrative Access

PortPurge reads network sockets and can terminate processes. Some system-owned or elevated processes require higher privileges:

- **Windows** — Run as Administrator to inspect or kill processes owned by other users or services.
- **macOS / Linux** — Use `sudo` when inspecting or purging root-owned processes.

When inspection is blocked by the OS, PortPurge returns available fields and flags `permissionsLimited` in the UI.

---

## Security Notes

- **PID validation** — The backend accepts `pid` as a Rust `u32` over Tauri IPC. It is formatted as a decimal integer in all OS commands; no user-controlled strings are passed to a shell.
- **Command lines may contain secrets** — The inspect modal warns users that argv strings can include sensitive data.

---

## License

[MIT](LICENSE) © Sankalpa K M C P
