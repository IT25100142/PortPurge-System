# PortPurge 💀

PortPurge is a lightweight, polished, cross-platform **desktop utility** built with **Tauri v2**, **React**, **TypeScript**, and **Tailwind CSS v4**. It helps developers monitor TCP/UDP ports bound on localhost, see which processes own them, and purge (kill) those processes with a single click.

---

## Key Features

- **Real-time port monitoring** — Scans localhost-only TCP/UDP ports (`127.0.0.1`, `::1`, `localhost`) on a 3-second polling interval.
- **High performance** — Maps running processes once per scan cycle instead of querying per port.
- **Snappy UX (optimistic updates)** — Instantly hides terminated ports, with automatic rollback and toast warnings on permission errors.
- **Search and filters** — Filter by port, PID, process name, or protocol (ALL / TCP / UDP).
- **In-app updater** — Checks GitHub Releases on startup and installs updates with one click.
- **System tray integration** — Left-click toggles the window; context menu: Show / Quit.
- **Minimize-to-tray** — The close button hides to the tray instead of quitting.
- **Single-instance lock** — A second launch focuses the existing window.
- **Clean error classification** — Maps OS errors (e.g. Access Denied) to actionable messages.

---

## Tech Stack

| Layer | Technologies |
|-------|----------------|
| **Frontend** | React 19, Vite, TypeScript, Tailwind CSS v4 (`@theme` design tokens), Lucide React |
| **Backend** | Rust (Tauri v2), platform parsers in `src-tauri/src/sys/` |
| **Communication** | Tauri IPC (`get_active_ports`, `kill_process_by_pid`) |
| **Quality (local)** | ESLint, Prettier, `cargo clippy`, `cargo fmt` via npm scripts |

---

## System Architecture

```
┌─────────────────────────────────────────────────────────┐
│                   React Frontend                        │
│  App.tsx (state, IPC, polling) + src/components/*       │
│  types.ts · index.css (@theme / glass utilities)        │
└───────────────────────────┬─────────────────────────────┘
                            │  Tauri IPC
                            │  get_active_ports
                            │  kill_process_by_pid
                            ▼
┌─────────────────────────────────────────────────────────┐
│              Tauri Rust Backend (lib.rs)                │
│         IPC commands · tray · plugins · lifecycle       │
└───────────────────────────┬─────────────────────────────┘
                            │
              ┌─────────────┴─────────────┐
              ▼                           ▼
┌──────────────────────────┐   ┌──────────────────────────┐
│   Windows (windows.rs)   │   │     Unix (unix.rs)       │
│   netstat · tasklist     │   │     lsof · kill -9       │
│   taskkill               │   │                          │
│   spawn_blocking I/O     │   │   spawn_blocking I/O     │
└──────────────────────────┘   └──────────────────────────┘
```

Blocking OS shell commands run inside `tauri::async_runtime::spawn_blocking` so the webview stays responsive during scans and kills.

### Frontend layout

| Path | Role |
|------|------|
| `src/App.tsx` | Orchestration: state, IPC, polling, kill flow, updater |
| `src/components/` | UI: `PortTable`, `SearchFilters`, `MetricsBar`, modals, toasts, empty states |
| `src/types.ts` | Shared TypeScript interfaces (`PortInfo`, `Toast`, etc.) |
| `src/index.css` | Tailwind v4 `@theme` tokens and `glass-panel` utilities |

### Backend layout

| Path | Role |
|------|------|
| `src-tauri/src/lib.rs` | Tauri builder, IPC registration, tray, plugins |
| `src-tauri/src/sys/mod.rs` | Shared types, localhost filter, dedupe helpers |
| `src-tauri/src/sys/windows.rs` | `netstat` / `tasklist` / `taskkill` |
| `src-tauri/src/sys/unix.rs` | `lsof` / `kill` |

---

## Getting Started

### Prerequisites

- **Node.js** v24+ recommended
- **Rust (Cargo)** v1.84+ recommended
- **Platform tools (runtime):**
  - Windows: `netstat`, `tasklist`, `taskkill` (built-in)
  - macOS / Linux: `lsof` (standard on most systems)

### Installation

```bash
cd PortPurge-System
npm install
```

### Local development configuration

For remote or mobile Tauri development, copy `.env.example` to `.env` and set `TAURI_DEV_HOST` if needed:

```bash
# .env.example
# TAURI_DEV_HOST=192.168.1.10
```

---

## Commands Reference

### Development

```bash
npm run tauri dev
```

Runs the Vite dev server (port `1420`) and opens the Tauri window.

### Build

```bash
npm run build          # TypeScript check + Vite production build
npm run tauri build    # Desktop installer → src-tauri/target/release/bundle/
```

### Test

```bash
cargo test --manifest-path src-tauri/Cargo.toml -- --nocapture
```

Includes parser fixture tests (`netstat` / `lsof` output, localhost filtering, malformed lines) and a live OS integration test. **18 tests on Windows; 25 on Unix/macOS/Linux** (Unix-only parser tests are platform-gated).

### Lint and format

```bash
npm run lint           # ESLint (frontend) + cargo clippy (backend)
npm run lint:frontend  # ESLint only
npm run lint:backend   # cargo clippy only
npm run format         # Prettier (frontend) + cargo fmt (backend)
```

---

## Administrative Access

PortPurge queries network sockets and can terminate processes. Some system-owned processes require elevated privileges:

- **Windows** — Run as Administrator to kill processes owned by other users or services.
- **macOS / Linux** — Use `sudo` when purging ports bound by root-level processes.

---

## Project docs

Contributor and AI assistant documentation lives in `ai/`:

- `ai/PROJECT_CONTEXT.md` — architecture, IPC contracts, setup, known issues
- `ai/AI_RULES.md` — coding constraints for agents and contributors
