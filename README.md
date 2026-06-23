# PortPurge

A lightweight, cross-platform desktop utility for developers who are tired of fighting **"port already in use"** errors. PortPurge scans localhost-bound TCP/UDP ports, shows which process owns each one, lets you inspect deep process details before killing, and purges stubborn processes in one click.

Built with **Tauri v2**, **React 19**, **TypeScript**, and **Tailwind CSS v4**.

---

## Features

### Port monitoring

- **Localhost-only scanning** — Surfaces ports bound to `127.0.0.1`, `::1`, and `localhost` (TCP listeners and UDP sockets).
- **Concurrent, non-blocking I/O** — OS shell commands run inside `spawn_blocking` so the UI stays responsive during scans.
- **Auto-refresh** — Polls every 3 seconds with a manual refresh option and last-updated timestamp.
- **Search and protocol filters** — Filter by port, PID, process name, or protocol (ALL / TCP / UDP).
- **Live metrics** — TCP, UDP, and total port counts at a glance.

### v0.2.0 — Sorting and deep inspection

- **Column sorting** — Click any table header (Protocol, Port, PID, Process Name) to sort ascending or descending. Sorting is client-side and local to the table.
- **Deep process inspection** — Inspect any row to view executable path, command line, memory usage, owning user, and start time before deciding to kill.
- **Graceful permission handling** — When OS ACLs block sensitive fields, the inspect modal returns partial data with a clear warning instead of failing silently.
- **Kill from inspect** — Jump from the details modal straight into the existing kill confirmation flow.

### UX and desktop integration

- **Optimistic kill updates** — Terminated rows disappear immediately; failures roll back with actionable toasts.
- **Glass-panel UI** — Dark, minimal "Circuit Purge" design system built on Tailwind `@theme` tokens.
- **System tray** — Left-click toggles the window; right-click menu: Show / Quit.
- **Minimize-to-tray** — Close hides to the tray instead of quitting.
- **Single-instance lock** — A second launch focuses the existing window.
- **In-app updater** — Checks GitHub Releases on startup and installs updates with one click.

---

## Tech Stack

| Layer | Technologies |
|-------|----------------|
| **Frontend** | React 19, Vite 7, TypeScript, Tailwind CSS v4, Lucide React |
| **Backend** | Rust (Tauri v2), `serde` / `thiserror`, platform parsers in `src-tauri/src/sys/` |
| **IPC** | `get_active_ports`, `get_process_details`, `kill_process_by_pid` |
| **OS tools** | Windows: `netstat`, `tasklist`, `taskkill`, PowerShell CIM · Unix: `lsof`, `ps`, `kill` |
| **Quality (local)** | ESLint, Prettier, `cargo clippy`, `cargo fmt` via npm scripts |

---

## Architecture

```
┌──────────────────────────────────────────────────────────────┐
│                     React Frontend                           │
│  App.tsx (state, IPC, polling) + src/components/*            │
└────────────────────────────┬─────────────────────────────────┘
                             │  Tauri IPC
                             ▼
┌──────────────────────────────────────────────────────────────┐
│                Tauri Rust Backend (lib.rs)                   │
│           IPC commands · tray · plugins · lifecycle          │
└────────────────────────────┬─────────────────────────────────┘
                             │
              ┌──────────────┴──────────────┐
              ▼                             ▼
┌─────────────────────────┐     ┌─────────────────────────┐
│  Windows (windows.rs)   │     │    Unix (unix.rs)       │
│  netstat · tasklist     │     │    lsof · ps · kill     │
│  taskkill · PowerShell  │     │    readlink / lsof exe  │
│  spawn_blocking I/O     │     │    spawn_blocking I/O   │
└─────────────────────────┘     └─────────────────────────┘
```

| Path | Role |
|------|------|
| `src/App.tsx` | Orchestration: state, IPC, polling, kill and inspect flows |
| `src/components/PortTable.tsx` | Sortable port table with Inspect and Kill actions |
| `src/components/ProcessDetailsModal.tsx` | Deep process inspection modal |
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

See repository license file for details.
