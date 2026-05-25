# PortPurge 💀

PortPurge is a lightweight, polished, cross-platform desktop utility built with **Tauri v2**, **React**, **TypeScript**, and **Tailwind CSS v4**. It allows developers to monitor active network ports bound on localhost, view which processes are running on them, and purge (kill) them with a single click.

---

## Key Features

*   **Real-time Port Monitoring**: Scans active TCP/UDP ports bound to localhost on a fast, 3-second polling interval.
*   **High Performance**: Designed to avoid CPU spikes during fast polling by mapping running processes in $O(N)$ once per cycle instead of querying per port.
*   **Snappy UX (Optimistic Updates)**: Instantly hides terminated ports from the list, with automatic rollback and toast warning if permission constraints (e.g. Access Denied) prevent the process from closing.
*   **System Tray Integration**: Quietly runs in the system tray with left-click toggles and context menu options ("Show PortPurge" and "Quit").
*   **Minimize-to-Tray**: Intercepts close requested window events (`X` button) to hide the app in the system tray instead of fully terminating.
*   **Single-Instance Lock**: Prevents running multiple duplicate instances concurrently. Launching a second instance automatically focuses and restores the already running window.
*   **Clean Error Classification**: Gracefully maps OS shell error signals to user-friendly messages (such as warning to run as administrator under permission constraints).

---

## Tech Stack

*   **Frontend**: React (Vite, TypeScript), Tailwind CSS v4, Lucide React (Icons).
*   **Backend**: Rust (Tauri v2 Core, Platform Command Parsers).
*   **Communication**: Tauri IPC invoking platform-specific Rust commands.

---

## System Architecture

```
                       ┌─────────────────────────┐
                       │     React Frontend      │
                       │     (App.tsx Dashboard) │
                       └────────────┬────────────┘
                                    │
                         Tauri IPC  │  (get_active_ports / kill_process_by_pid)
                                    ▼
                       ┌─────────────────────────┐
                       │   Tauri Rust Backend    │
                       │   (src-tauri/src/lib.rs)│
                       └────────────┬────────────┘
                                    │
                       ┌────────────┴────────────┐
                       ▼                         ▼
         ┌──────────────────────────┐      ┌──────────────────────────┐
         │     Windows Module       │      │       Unix Module        │
         │   (sys/windows.rs)       │      │     (sys/unix.rs)        │
         ├──────────────────────────┤      ├──────────────────────────┤
         │ netstat -ano & tasklist  │      │ lsof -i -P -n & kill -9  │
         └──────────────────────────┘      └──────────────────────────┘
```

---

## Getting Started

### Prerequisites

Ensure you have Node.js and Rust installed on your machine.
*   **Node.js**: `v24` or later is recommended.
*   **Rust (Cargo)**: `v1.84` or later is recommended.

### Installation

1.  Clone or navigate to the project directory:
    ```bash
    cd portpurge
    ```
2.  Install frontend dependencies:
    ```bash
    npm install
    ```

---

## Commands Reference

### Development Mode
Launch the application locally in development mode:
```bash
npm run tauri dev
```

### Run Unit Tests
Run backend Rust test suites (verifies port-to-process parsing functions):
```bash
cargo test --manifest-path src-tauri/Cargo.toml -- --nocapture
```

### Frontend Build
Compile the client application and Tailwind CSS styles for production checks:
```bash
npm run build
```

### Package Production Bundle
Build and pack the production-ready installation binary for your OS:
```bash
npm run tauri build
```
*(The compiled installer will be saved under `src-tauri/target/release/bundle/`)*

---

## Administrative Access

Because PortPurge queries network sockets and kills running processes, some processes (e.g., system services) require administrative/sudo rights.
*   **Windows**: Run PortPurge as Administrator to terminate processes owned by other services or users.
*   **macOS / Linux**: Start PortPurge with elevated rights (`sudo`) if you need to purge ports bound by root-level processes.
