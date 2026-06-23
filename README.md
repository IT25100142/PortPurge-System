# PortPurge

A lightweight, cross-platform desktop utility for developers who are tired of fighting **"port already in use"** errors. PortPurge scans localhost-bound TCP/UDP ports, shows which process owns each one, lets you inspect deep process details before killing, and purges stubborn processes in one click.

Built with **Tauri v2**, **React 19**, **TypeScript**, and **Tailwind CSS v4**.

---

## Features

### Port monitoring

- **Localhost-only scanning** — Surfaces ports bound to `127.0.0.1`, `::1`, and `localhost` (TCP listeners and UDP sockets).
- **Concurrent, non-blocking I/O** — OS shell commands run inside `spawn_blocking` so the UI stays responsive during scans.
- **Auto-refresh** — Polls every 3 seconds with a manual refresh option and last-updated timestamp.
- **Fuzzy search and protocol filters** — Filter by port, PID, process name, or protocol (ALL / TCP / UDP).
- **Group by process** — Collapse rows sharing a process name; batch-kill all PIDs in a group.
- **Live metrics** — TCP, UDP, and total port counts at a glance.

### Sorting and deep inspection

- **Column sorting** — Click any table header (Protocol, Port, PID, Process Name) to sort ascending or descending in flat or grouped views.
- **Deep process inspection** — Inspect any row to view executable path, command line, memory usage, owning user, and start time before deciding to kill.
- **Graceful permission handling** — When OS ACLs block sensitive fields, the inspect modal returns partial data with a clear warning instead of failing silently.
- **Kill from inspect** — Jump from the details modal straight into the existing kill confirmation flow.

### v0.5.0 — Smart Protect (Safe Mode)

- **Protected process denylist** — A persistent `config.json` in the app data directory lists process names that cannot be terminated from the UI, system tray, or batch kill flows.
- **Backend enforcement** — All kills still route through `ledger::kill_and_record`, which checks the denylist **before** calling the OS kill command. Blocked attempts return a `ProtectedProcess` error and are logged to the Purge Ledger (`success: false`).
- **UI guardrails** — Protected rows show a Shield badge, reduced opacity, and disabled Kill buttons. Group kill skips protected PIDs and reports how many were skipped.
- **Tray parity** — Quick-kill menu slots are disabled for protected processes; the backend still blocks any bypass attempt.

#### Editing your protection list

| Item | Detail |
|------|--------|
| **File** | `config.json` in the PortPurge app data directory (same folder as `purge-ledger.json`) |
| **Windows** | `%APPDATA%\com.portpurge.app\config.json` |
| **macOS** | `~/Library/Application Support/com.portpurge.app/config.json` |
| **Linux** | `~/.local/share/com.portpurge.app/config.json` |

Example:

```json
{
  "protectedProcessNames": [
    "svchost.exe",
    "explorer.exe",
    "launchd"
  ]
}
```

**Matching rules** (applied on both backend and frontend):

1. Trim whitespace
2. Compare case-insensitively (lowercase)
3. Strip a trailing `.exe` before comparing (`node.exe` matches `node`)
4. Empty names and `Unknown` are never treated as protected

**Default seeds** (written automatically on first launch if the file is missing):

| OS | Default protected names |
|----|-------------------------|
| **Windows** | `System`, `smss.exe`, `csrss.exe`, `wininit.exe`, `services.exe`, `lsass.exe`, `svchost.exe`, `explorer.exe` |
| **macOS** | `launchd`, `kernel_task`, `WindowServer`, `loginwindow`, `syspolicyd` |
| **Linux** | `systemd`, `systemd-journal`, `sshd` |

Restart PortPurge after editing `config.json` (hot-reload is not supported in v0.5.0). There is no in-app Settings UI — edit the JSON file directly.

### v0.4.0 — Purge Ledger (action history)

- **Persistent audit trail** — Every kill attempt (success or failure) is recorded in a Rust-backed JSON append-log (`purge-ledger.json` in the app data directory), capped at the last **100** entries.
- **Unified kill routing** — All terminations from the dashboard, group kill, and system tray flow through `ledger::kill_and_record` so nothing is lost.
- **History drawer** — Open **History** from the header to view a sliding side panel with process name, PID, port, protocol, source, relative timestamp, and success/failure status.
- **Live UI sync** — The backend emits a `ledger-updated` Tauri event after each kill; the drawer prepends new entries without a manual refresh.
- **Tray + UI parity** — Tray quick-kills are logged with `source: tray` even though they skip the React confirmation modal.
- **Clear history** — Remove all ledger entries from the drawer footer (persists to disk via `clear_ledger_entries` IPC).

### UX and desktop integration

- **Optimistic kill updates** — Terminated rows disappear immediately; failures roll back with actionable toasts.
- **Glass-panel UI** — Dark, minimal design system built on Tailwind `@theme` tokens.
- **System tray** — Left-click toggles the window; right-click menu shows up to **5 quick-kill slots** for recent localhost ports, then Show / Quit. Tray icon reflects port load (normal / amber / red).
- **Minimize-to-tray** — Close hides to the tray instead of quitting.
- **Single-instance lock** — A second launch focuses the existing window.
- **In-app updater** — Checks GitHub Releases on startup and installs updates with one click.

---

## Tech Stack

| Layer | Technologies |
|-------|----------------|
| **Frontend** | React 19, Vite 7, TypeScript, Tailwind CSS v4, Lucide React |
| **Backend** | Rust (Tauri v2), `serde` / `serde_json` / `thiserror`, platform parsers in `src-tauri/src/sys/` |
| **Persistence** | `config.json` (Smart Protect denylist) + `purge-ledger.json` (kill history) in app data dir — no database |
| **IPC** | `get_active_ports`, `get_process_details`, `kill_process_by_pid`, `get_ledger_entries`, `clear_ledger_entries`, `get_protected_process_names` |
| **Events** | `ledger-updated` (Rust → React, payload: `LedgerEntry`) |
| **OS tools** | Windows: `netstat`, `tasklist`, `taskkill`, PowerShell CIM · Unix: `lsof`, `ps`, `kill` |
| **Quality (local)** | ESLint, Prettier, `cargo clippy`, `cargo fmt` via npm scripts |

---

## Architecture

```
┌──────────────────────────────────────────────────────────────┐
│                     React Frontend                           │
│  App.tsx (state, IPC, polling, ledger + protect config)      │
│  LedgerDrawer · PortTable · modals · isProcessProtected      │
└────────────────────────────┬─────────────────────────────────┘
                             │  Tauri IPC + events
                             ▼
┌──────────────────────────────────────────────────────────────┐
│                Tauri Rust Backend (lib.rs)                   │
│        IPC commands · config · ledger · tray · plugins       │
└────────────────────────────┬─────────────────────────────────┘
                             │
         ┌───────────────────┼───────────────────┐
         ▼                   ▼                   ▼
┌──────────────┐ ┌─────────────────┐ ┌───────────────┐ ┌─────────────────┐
│ config/mod.rs│ │  ledger/mod.rs  │ │  tray/mod.rs  │ │  sys/ (win/unix)│
│ Smart Protect│ │  kill_and_record│ │  quick-kill   │ │  port scan/kill │
│ config.json  │ │  ledger persist │ │  tray poll    │ │  inspect parsers│
└──────┬───────┘ └────────┬────────┘ └───────┬───────┘ └─────────────────┘
       │                  │                    │
       └──── is_protected ─┴── kill_and_record ┘
              (all kills route here; protected blocked + logged)
```

| Path | Role |
|------|------|
| `src/App.tsx` | Orchestration: state, IPC, polling, kill flows, `protectedProcessNames` hydrate, ledger + `ledger-updated` |
| `src/utils/isProcessProtected.ts` | Mirrors Rust name normalization; used by rows, groups, modals, batch kill |
| `src-tauri/src/config/mod.rs` | `config.json` I/O, OS-critical default seeds, `is_protected` gate |
| `src/components/LedgerDrawer.tsx` | Sliding History panel; clear ledger |
| `src/utils/formatLedger.ts` | Relative time and kill-source display helpers |
| `src/components/PortTable.tsx` | Sortable port table with Inspect and Kill actions |
| `src-tauri/src/ledger/mod.rs` | Purge Ledger persistence, `kill_and_record`, `ledger-updated` emit |
| `src-tauri/src/tray/mod.rs` | Tray icon/menu, quick-kill slots, routes kills through ledger |
| `src-tauri/src/sys/mod.rs` | Shared types (`PortInfo`, `ProcessDetails`), localhost filter |

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
- **Kill history is persisted locally** — The Purge Ledger stores process names, PIDs, ports, and error messages on disk in the app data directory.

---

## License

See repository license file for details.
