# Phase 0 — Pre-hardening baseline

**Status:** COMPLETE (documentation baseline established; no hardening applied)  
**Date:** 2026-07-26  
**Host OS:** Microsoft Windows 11 Home 10.0.26200 (64-bit)  
**Project:** PortPurge v0.6.0  

## 1. Environment and recovery references

| Item | Value |
|---|---|
| Original baseline commit (HEAD at recovery) | `2d58e41e6df0266d75f157818aa5921ecb4a4cc8` (`2d58e41 fix: clean up summon focus frames`) |
| Branch | `release-hardening` (created from baseline HEAD) |
| Recovery tag | `pre-hardening-backup` → `2d58e41e6df0266d75f157818aa5921ecb4a4cc8` |
| Branch / tag match | Verified equal (both point at original baseline) |
| Pre-setup working tree | Clean (`nothing to commit, working tree clean` on `master`) |
| Node.js | v22.22.0 |
| npm | 11.6.2 |
| rustc | 1.96.0 (ac68faa20 2026-05-25) |
| cargo | 1.96.0 (30a34c682 2026-05-25) |
| rustfmt | 1.9.0-stable |
| clippy | 0.1.96 |
| Rust toolchain | `stable-x86_64-pc-windows-msvc` (Cargo initially absent from default PATH; invoked via `%USERPROFILE%\.cargo\bin` + toolchain `bin`) |

### Git cleanliness and reference verification

1. Safety preflight confirmed a clean working tree before creating recovery references.
2. Neither `release-hardening` nor `pre-hardening-backup` existed beforehand.
3. `git checkout -b release-hardening` and `git tag pre-hardening-backup` were created locally only (not pushed).
4. Tag remains on the **original pre-documentation** baseline commit `2d58e41…`. Documentation commits after this point must not move the tag.

## 2. Behaviour baseline (eight feature areas)

Evidence types used below:

- **Automated test** — Vitest / `cargo test` executed in this environment
- **Safe manual test** — Non-destructive host checks; disposable process only for termination
- **Static repository inspection** — Code/README/config review without claiming runtime pass
- **Not testable in this environment** — Requires packaged Tauri desktop session, tray, global hotkey, or signed updater install

### 2.1 Port scanning

| Field | Detail |
|---|---|
| Evidence type | Automated test + Safe manual test + Static repository inspection |
| Observed / intended behaviour | `get_active_ports` scans localhost-bound TCP (LISTENING) and UDP via Windows `netstat -ano` + `tasklist`; filters exact loopback hosts (`127.0.0.1`, `::1`, `localhost`); dedupes by `(port, protocol)` and sorts ascending. Frontend polls every 3s (`usePortPolling`). Wildcard binds (`0.0.0.0` / `::`) are excluded by design. |
| Automated | `cargo test`: 32 lib tests passed, including live `tests::test_get_active_ports`. Frontend: `usePortScanner`, `usePortPolling`, view-model/filter tests. |
| Safe manual | Host `netstat -ano` showed 6 loopback LISTENING sockets (sample includes `127.0.0.1:7341`, `127.0.0.1:9080`, `[::1]:49671`). |
| Runtime claim | **PASS on Windows** for live OS scan via `test_get_active_ports` (see §4). |

### 2.2 Process details

| Field | Detail |
|---|---|
| Evidence type | Automated test + Safe manual test + Static repository inspection |
| Observed / intended behaviour | `get_process_details(pid)` on Windows uses PowerShell CIM (`Win32_Process` + owner). Returns name, executable path, command line, memory, user, start time, and `permissionsLimited`. UI modal shows `N/A` for missing fields and maps vanished PIDs to an exited message. |
| Automated | Windows JSON parser tests in `sys/windows.rs`; camelCase serialization in `sys/mod.rs`. No live Rust IPC integration test for details. |
| Safe manual | Disposable `powershell.exe` PID 33420 inspected via CIM: name, `ExecutablePath`, and `CommandLine` populated. |
| Limitation | Full Tauri IPC path / modal UX not runtime-exercised (no desktop app launch). |

### 2.3 Manual termination

| Field | Detail |
|---|---|
| Evidence type | Automated test + Safe manual test + Static repository inspection |
| Observed / intended behaviour | UI confirms then calls `kill_process_by_pid` → `ledger::kill_and_record`. Windows kill is `taskkill /F /PID <u32>` (no `/T`). Optimistic UI removal with rollback on failure; group kills are sequential and skip frontend-known protected PIDs. |
| Automated | Frontend `useProcessTermination` and lifecycle integration tests (mocked IPC) — 111 Vitest tests passed overall. **No backend test executes real `taskkill`.** |
| Safe manual | Started disposable `powershell.exe -NoProfile -Command Start-Sleep -Seconds 120` (PID **33420**). `taskkill /F /PID 33420` → exit 0, `SUCCESS: The process with PID 33420 has been terminated.`, process gone. **Did not** invoke PortPurge `kill_and_record` / Smart Protect / ledger (requires Tauri app state). |
| Safety | Only the disposable test process was targeted. No system/protected/privileged processes were killed. |
| Runtime claim | **PASS on Windows** for the OS `taskkill /F` mechanism PortPurge uses; full in-app kill+ledger path remains untested at runtime. |

### 2.4 Smart Protect

| Field | Detail |
|---|---|
| Evidence type | Automated test + Static repository inspection |
| Observed / intended behaviour | Denylist in `config.json` (app data); seeded with OS defaults if missing. Matching: trim, lowercase, strip one trailing `.exe`; never protect blank/`Unknown`. Backend enforces inside `kill_and_record`; UI disables Kill on protected rows/groups/inspect; tray disables protected slots. |
| Windows defaults | `System`, `smss.exe`, `csrss.exe`, `wininit.exe`, `services.exe`, `lsass.exe`, `svchost.exe`, `explorer.exe` |
| Automated | Rust `config` normalization/match tests; frontend `isProcessProtected` + `useSmartProtect` tests. |
| Not performed | No attempt to terminate a real critical system process (explicitly out of scope). |
| Limitation | Backend protection checks caller-supplied `processName`, not a fresh PID→name resolution. Empty `[]` config is replaced with defaults on init. |

### 2.5 History persistence (Purge Ledger)

| Field | Detail |
|---|---|
| Evidence type | Automated test + Static repository inspection |
| Observed / intended behaviour | `purge-ledger.json` in app data; newest-first; max 100 entries; records success/failure including Smart Protect blocks; atomic temp-file rename; emits `ledger-updated`. Frontend drawer loads/listens/clears via IPC. |
| Automated | Frontend `usePurgeLedger` + `formatLedger` tests (mocked). **No Rust tests** for disk load/write/truncation/events. |
| Not testable here | Real disk persistence requires Tauri `AppHandle` / app-data path. |
| Runtime matrix | **PENDING** (no live ledger write observed). |

### 2.6 Tray menu

| Field | Detail |
|---|---|
| Evidence type | Automated test + Static repository inspection |
| Observed / intended behaviour | System tray with 5 quick-kill slots (refreshed every 3s), Show/Quit, left-click visibility toggle, close-to-tray. Icon Normal (&lt;10) / Amber (10–19) / Red (≥20). Tray kills skip React confirmation but use ledger source `Tray`. Protected slots disabled. |
| Automated | Pure helpers in `tray/mod.rs` (recency ordering, icon thresholds, label truncation). |
| Not testable here | Real tray construction, menu events, icon swap, and tray kill require a desktop Tauri session. |
| Runtime matrix | **PENDING**. |

### 2.7 Global shortcut (summon)

| Field | Detail |
|---|---|
| Evidence type | Automated test + Static repository inspection |
| Observed / intended behaviour | Registers `Alt+Shift+P` (Option+Shift+P on macOS). Unminimizes/shows/focuses main window and emits `window-summoned`; React focuses/selects search after one animation frame. Registration failure is logged and non-fatal. |
| Automated | Frontend `useWindowSummonFocus` tests. No Rust registration tests. |
| Not testable here | OS global hotkey capture and window focus require interactive desktop session. |
| Runtime matrix | **PENDING**. |

### 2.8 Update checking

| Field | Detail |
|---|---|
| Evidence type | Automated test + Static repository inspection |
| Observed / intended behaviour | Startup check (~1.5s) via `tauri-plugin-updater`; endpoint `https://github.com/IT25100142/PortPurge-System/releases/latest/download/latest.json`; signed artifacts; modal download/install then `relaunch`. Browser-only mode does not call updater. |
| Automated | Frontend `useAppUpdater` tests (mocked plugin). |
| Not testable here | Signature validation, download, and install require a packaged signed build; not exercised against production machine. |
| Runtime matrix | **PENDING**. |

## 3. Validation results

All required commands were executed. Failures were **not** fixed.

| # | Exact command | Exit code | Result | Summary | Classification |
|---|---|---|---|---|---|
| 1 | `npm install` | 0 | **PASS** | Completed in ~8s; 72 funding notices. Transiently removed `"peer": true` on one lockfile entry (`cssstyle`-related); **reverted** before commit to keep baseline docs-only (see §5). | Successful baseline evidence; lockfile drift noted and discarded |
| 2 | `npm run build` | 0 | **PASS** | `tsc && vite build` OK; client bundle ~251 kB JS / ~46 kB CSS gzipped. | Successful baseline evidence |
| 3 | `npm test` | 0 | **PASS** | Vitest: **15 files, 111 tests passed** (~1.8s). | Successful baseline evidence |
| 4 | `npm run lint:frontend` | 0 | **PASS** | `eslint .` clean (no reported issues). | Successful baseline evidence |
| 5 | `cargo fmt --check --manifest-path src-tauri/Cargo.toml` | 0 | **PASS** | Formatting check clean. | Successful baseline evidence |
| 6 | `cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets` | 0 | **PASS (with warnings)** | Finished successfully; **3 unique Clippy warnings** (duplicated for lib test target): `needless_borrows_for_generic_args` at `sys/windows.rs:77` and `:248`; `needless_borrow` at `tray/mod.rs:331`. | Successful baseline evidence; pre-existing style warnings (not treated as failure) |
| 7 | `cargo test --manifest-path src-tauri/Cargo.toml` | 0 | **PASS** | **32** lib unit tests passed (0 failed), including live `test_get_active_ports`; binary/doc suites empty. | Successful baseline evidence |

### Clippy warning detail (pre-existing; not fixed)

1. `src-tauri/src/sys/windows.rs:77` — `needless_borrows_for_generic_args` on `cmd.args(&["/FO", "CSV", "/NH"])`
2. `src-tauri/src/sys/windows.rs:248` — same lint on `taskkill` args
3. `src-tauri/src/tray/mod.rs:331` — `needless_borrow` on `&app`

## 4. Existing failures and environment limitations

### Existing repository failures

- **None observed as command failures.** All seven required validation commands exited 0.
- **Pre-existing Clippy warnings** (3 unique) — warnings only; exit code 0. Recorded above; not fixed in this step.

### Environment / tooling limitations

- Default shell PATH did not include `cargo`/`rustc` until `%USERPROFILE%\.cargo\bin` (and toolchain bin) were prepended. Toolchain is installed and functional once PATH is set.
- Full desktop features (tray UI, global shortcut, update install, ledger on-disk via app, in-app kill+Smart Protect IPC) were **not** runtime-tested: no interactive Tauri app session was launched for this baseline.
- macOS and Linux behaviour were **not** executed on this host.

### `npm install` lockfile note

`npm install` produced a one-line tracked drift in `package-lock.json` (removed `"peer": true` on a transitive `cssstyle` entry). Per scope (no intentional dependency changes; commit docs only), the file was restored to the baseline tree with `git checkout -- package-lock.json` after recording. **No lockfile change is included in the baseline commit.**

## 5. Platform test matrix

Only cells with **direct runtime evidence on this Windows host** are updated. Other platforms remain Pending. Non-pending cells link to evidence sections above.

| Platform | Scan | Kill | History | Tray | Shortcut | Updater |
|---|---|---|---|---|---|---|
| Windows | **PASS** ([§2.1](#21-port-scanning), [§3 cmd 7](#3-validation-results) live `test_get_active_ports`) | **PASS** ([§2.3](#23-manual-termination) disposable PID 33420 via `taskkill /F`; OS path only) | **PENDING** (ledger disk/IPC not runtime-exercised) | **PENDING** (no tray session) | **PENDING** (no hotkey session) | **PENDING** (no packaged updater run) |
| macOS | Pending | Pending | Pending | Pending | Pending | Pending |
| Linux | Pending | Pending | Pending | Pending | Pending | Pending |

## 6. Scope confirmation

- No security hardening, dependency upgrades, refactors, or product behaviour changes were applied.
- Recovery tag `pre-hardening-backup` remains on `2d58e41e6df0266d75f157818aa5921ecb4a4cc8`.
- Expected documentation-only change: this file under `docs/release-hardening/`.
