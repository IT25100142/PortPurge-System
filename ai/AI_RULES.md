# AI Rules

Permanent operational rules for AI coding agents working on PortPurge-System.

**Read `ai/PROJECT_CONTEXT.md` before making any changes.** It is the source of truth for architecture, file paths, IPC contracts, and known issues.

---

## Hard Rules

1. **Do not guess blindly.** If behavior is unclear, inspect source files or state uncertainty explicitly.
2. **Minimal diffs only.** Change the smallest correct surface area. Never rewrite large files unnecessarily.
3. **Never commit secrets.** Do not add, expose, or document `updater.key`, signing private keys, or CI secret values.
4. **No HTTP API assumptions.** This is a Tauri v2 desktop app. Backend is Rust IPC (`invoke()`), not REST.
5. **No database without explicit request.** There is no SQL/ORM layer. Allowed persistence: Purge Ledger (`purge-ledger.json` in `ledger/mod.rs`) and Smart Protect config (`config.json` in `config/mod.rs`) — do not add SQLite, ORM, or other storage unless asked.
6. **Sync both platform modules.** Port-scan and kill behavior must update `src-tauri/src/sys/windows.rs` AND `src-tauri/src/sys/unix.rs`, or shared logic in `sys/mod.rs`.
7. **Register IPC commands.** Every new `#[tauri::command]` must be added to `invoke_handler` in `lib.rs`.
8. **Preserve folder structure.** Do not reorganize the project layout without explicit request.
9. **No new dependencies without justification.** Prefer existing Tauri plugins and stdlib over new crates/packages.
10. **Never modify meta-documentation** (`ai/PROJECT_CONTEXT.md`, this file) unless explicitly asked.

---

## Frontend Architecture (`src/`)

PortPurge uses a **component-driven React UI**. `App.tsx` is the orchestration shell only — not a dumping ground for new UI.

### Where code belongs

| Concern | Location | Allowed in `App.tsx` |
|---------|----------|----------------------|
| New UI (tables, modals, panels, empty states) | `src/components/` | **No** — create or extend a component |
| Shared TypeScript interfaces | `src/types.ts` | **No** — import from `types.ts` |
| Pure logic (search, grouping, sorting, transforms) | `src/utils/` | **No** — keep components thin; no React or IPC in utils |
| React state, IPC calls, polling, kill/updater logic | `src/App.tsx` | **Yes** |
| Global theme tokens and utilities | `src/index.css` (`@theme`, `@utility`) | **No** — use existing tokens in components |
| Static images | `public/illustrations/*.webp` | Reference by path only |

### `src/utils/` — pure frontend logic

PortPurge keeps **non-UI logic out of components and `App.tsx`**. Utilities in `src/utils/` are plain TypeScript modules with **no React imports, no hooks, and no `invoke()` calls**.

| Module | Responsibility |
|--------|----------------|
| `fuzzySearch.ts` | Ordered-subsequence fuzzy port search (`filterPortsByFuzzyQuery`) |
| `groupPorts.ts` | Process-name grouping (`groupByProcessName` → `PortGroup[]`) |
| `sortPorts.ts` | Flat and grouped table sorting (`sortFlatPorts`, `sortGroupedPorts`) |
| `formatLedger.ts` | Ledger display helpers (`formatRelativeTime`, `formatKillSource`) — no IPC |
| `isProcessProtected.ts` | Smart Protect name normalization + denylist check (`normalizeProcessName`, `isProcessProtected`) — mirrors Rust `config/mod.rs` |

**Do not** embed fuzzy matching, grouping algorithms, sort comparators, ledger formatting, or Smart Protect matching inside components or `App.tsx`. Add or extend a file under `src/utils/` and import it.

### Existing components

`PortTable`, `PortTableRow`, `PortGroupRow`, `SearchFilters`, `MetricsBar`, `EmptyState`, `KillConfirmModal`, `KillGroupConfirmModal`, `ProcessDetailsModal`, `LedgerDrawer`, `UpdateModal`, `ToastContainer`.

Add a **new file** under `src/components/` for new UI surfaces. Do not grow `App.tsx` with large JSX blocks, inline modals, or copy-pasted markup.

### Styling rules (Tailwind v4)

Use the established design system in `src/index.css`:

- **Theme tokens:** `surface-base`, `text-primary`, `accent-primary`, `accent-secondary` (via `@theme`).
- **Utilities:** `glass-panel`, `glass-panel-inset`, `glass-control`, `btn-primary`, `text-label`, `ambient-orb`.
- **Palette:** dark theme, indigo/violet gradients, glassmorphism — match existing components.

**Do not** introduce raw hex backgrounds like `bg-[#070b14]` when a `@theme` token or `glass-*` utility already exists.

**Do not** introduce UI component libraries (MUI, shadcn, Chakra) without explicit request.

### State and routing

- State is local React hooks (`useState`, `useCallback`, `useEffect`) in `App.tsx` only.
- Do not add Redux, Zustand, React Query, or custom `src/hooks/` without explicit request.
- There is no router. Do not add `react-router` unless explicitly requested.

### Version display

App version in the UI comes from `getVersion()` (`@tauri-apps/api/app`) at runtime — sourced from `tauri.conf.json`. **Do not hardcode version strings** in React components.

### Smart Protect UI guardrails (v0.5.0+)

**All kill-related UI and batch-kill logic MUST respect the `protectedProcessNames` list** hydrated in `App.tsx` via `get_protected_process_names`.

| Rule | Enforcement |
|------|-------------|
| Name matching | Use `isProcessProtected(processName, protectedProcessNames)` from `src/utils/isProcessProtected.ts` — never duplicate normalization inline |
| Row / group kill buttons | Disable Kill / Kill All when `isProcessProtected` is true; show Shield icon + `SMART_PROTECT_KILL_TITLE` tooltip |
| Inspect | **Always allowed** for protected processes — inspection is read-only |
| Batch kill (`killProcessGroup`) | Filter out protected PIDs before `invoke`; abort with warning if all protected; report skip count in toast |
| Props drilling | Pass `protectedProcessNames` from `App.tsx` → `PortTable` → `PortTableRow` / `PortGroupRow`; also `ProcessDetailsModal` |
| Backend is authoritative | UI guardrails are preventive; `kill_and_record` still enforces via `ConfigState::is_protected` |

**Do not** add kill buttons or tray-equivalent flows that bypass `isProcessProtected` checks on the frontend.

---

## Backend Architecture (`src-tauri/`)

PortPurge uses a **thin IPC layer** (`lib.rs`) over a **platform `sys/` module** that runs blocking OS shell commands.

### Layer responsibilities

| Layer | Responsibility |
|-------|----------------|
| `lib.rs` | Tauri builder, plugin init, window events, `#[tauri::command]` registration |
| `config/mod.rs` | Smart Protect `config.json` persistence, `normalize_process_name`, `ConfigState::is_protected`, `get_protected_process_names` IPC |
| `ledger/mod.rs` | Purge Ledger JSON persistence, `kill_and_record` (Smart Protect pre-check), `append`, `ledger-updated` emit — **single kill audit path** |
| `tray/mod.rs` | System tray icon, menu, port-count icon states, quick-kill slots, independent 3s poll loop — **fully decoupled from React** |
| `sys/mod.rs` | Shared types (`Protocol`, `PortInfo`, `ProcessDetails`, `PortPurgeError`), localhost helpers, dedupe, platform re-exports |
| `sys/windows.rs` | `netstat` / `tasklist` / `taskkill` parsing and execution |
| `sys/unix.rs` | `lsof` / `kill` parsing and execution |

Command handlers in `lib.rs` must remain thin — delegate kills to `ledger::kill_and_record`, reads/writes to `sys/`, `ledger/`, or `config/`. Do not put OS parsing or shell commands in `lib.rs` or `App.tsx`.

### Kill routing — `kill_and_record` is mandatory (v0.4.0+)

**All process termination must route through `ledger::kill_and_record(app, KillContext)`** — never call `sys::kill_process_by_pid` directly from `lib.rs`, `tray/mod.rs`, `App.tsx`, or any new code path. `kill_and_record` checks `ConfigState::is_protected` before invoking the OS kill.

```rust
// CORRECT — IPC and tray both use kill_and_record
ledger::kill_and_record(&app, KillContext {
    pid,
    port,
    protocol,
    process_name,
    source: KillSource::Tray, // or Ui, Group, Inspect
}).await?;
```

```rust
// FORBIDDEN — bypasses audit log and ledger-updated event
sys::kill_process_by_pid(pid).await?;
```

`sys::kill_process_by_pid` is only called **inside** `ledger::kill_and_record`. The `kill_process_by_pid` IPC command in `lib.rs` builds a `KillContext` and delegates to `kill_and_record`.

**Tray logic stays in `tray/mod.rs`.** Tray kills use `ledger::kill_and_record` with `KillSource::Tray` — they do **not** go through React modals or toasts, but they **do** emit `ledger-updated` for the History drawer.

### `spawn_blocking` is mandatory for shell I/O

All blocking `std::process::Command` work **must** run inside `tauri::async_runtime::spawn_blocking`.

```rust
// CORRECT — existing pattern in sys/windows.rs and sys/unix.rs
pub async fn get_active_ports() -> Result<Vec<PortInfo>, PortPurgeError> {
    tauri::async_runtime::spawn_blocking(|| {
        // Command::new("netstat") or Command::new("lsof") here
        Ok(dedupe_and_sort_ports(ports))
    })
    .await
    .map_err(|e| PortPurgeError::Unknown(e.to_string()))?
}
```

**Forbidden:** calling `Command::new(...).output()` (or `.status()`) directly in an `async fn` on the Tauri async runtime thread. This blocks the executor and can stall the webview.

Apply the same rule to `kill_process_by_pid` and any future OS interop.

### Platform compilation

- Windows: `#[cfg(target_os = "windows")]` in `sys/mod.rs` → `windows.rs`
- Unix (macOS/Linux): `#[cfg(not(target_os = "windows"))]` → `unix.rs`

### Localhost filtering

Port scanning **already filters to localhost** via `is_localhost_address()` in `sys/mod.rs`. Do not remove this filter or document "all interfaces" behavior unless explicitly requested.

### Desktop lifecycle (Rust-only)

Configured in `lib.rs` (window events, plugin wiring) and `tray/mod.rs` (tray behavior) — do not remove or reorder without explicit request:

- System tray in `tray/mod.rs` — dynamic icon states, up to 5 quick-kill menu slots, left-click toggle, Show / Quit menu
- Single-instance plugin (second launch focuses existing window)
- Close-to-tray (`CloseRequested` → hide, `prevent_close`)

Tray polling runs independently of React's 3-second poll in `App.tsx`. Both call `sys::get_active_ports()` — do not merge them into a shared React-driven loop.

---

## Architecture Preservation

| Principle | Enforcement |
|-----------|-------------|
| IPC-only backend | All frontend→backend calls use `invoke()` |
| Component-driven UI | Presentational UI in `src/components/`; orchestration in `App.tsx` |
| Pure frontend logic in `src/utils/` | Fuzzy search, grouping, sorting, ledger formatting — no React, no IPC in utils |
| Tray isolated from React | Tray icon, menu, poll, and quick-kill live in `tray/mod.rs` only |
| Kill audit via ledger | All kills through `ledger::kill_and_record` — never direct `sys::kill_process_by_pid` outside ledger |
| Smart Protect respected | UI uses `isProcessProtected`; backend uses `config::ConfigState::is_protected` inside `kill_and_record` |
| Platform abstraction | OS logic in `sys/`, not in `lib.rs`, `tray/mod.rs`, or React |
| `spawn_blocking` for shell I/O | Never block the async runtime with `Command` |
| Command-query separation | Read (`get_active_ports`) vs write (`kill_process_by_pid`) |
| Optimistic UI on kill | Preserve rollback pattern in `killProcess` unless explicitly changing UX |
| Desktop lifecycle in Rust | Tray (`tray/mod.rs`), single-instance, close-to-tray stay in Rust |

---

## Dependency Policy

### Allowed without discussion

- Patch/minor updates to existing dependencies in `package.json` or `Cargo.toml`.
- Official Tauri plugins from the `tauri-apps` organization.

### Requires justification

- Any **new** npm package or Cargo crate not already in the project.
- Replacing shell commands with native OS APIs.

### Already present — use, do not re-add

- **ESLint 9** (`eslint.config.js`), **Prettier** (`.prettierrc`), **cargo clippy**, **cargo fmt** — run via `npm run lint` / `npm run format`. Do not add duplicate lint tooling unless asked.

### Forbidden unless explicitly requested

- Web server frameworks (Express, Fastify, Axum HTTP server).
- Database drivers or ORMs.
- Authentication libraries (JWT, OAuth).
- Electron or alternative desktop frameworks.
- UI component libraries (MUI, shadcn, Chakra).

---

## Testing and Verification

| Change Type | Required Verification |
|-------------|----------------------|
| Rust (`sys/`, `lib.rs`) | `cargo test --manifest-path src-tauri/Cargo.toml -- --nocapture` |
| TypeScript (`src/`) | `npm run build` |
| Any substantive change | `npm run lint` (local; not enforced in CI) |
| IPC contract changes | Rust tests + manual `npm run tauri dev` smoke test |
| Config / bundle changes | `npm run tauri build` (if icons available) or `npm run build` minimum |

### Rust test suite (exists — use it)

| Location | Count | Notes |
|----------|-------|-------|
| `config/mod.rs` | 5 | `normalize_process_name`, `is_protected`, default seeds |
| `sys/mod.rs` | 10 | Shared helpers, serde, `Protocol`, dedupe, `ProtectedProcess` display |
| `sys/windows.rs` | 11 | `parse_netstat_line` fixtures, process JSON fixtures |
| `sys/unix.rs` | 11 | `parse_lsof_line` fixtures — **Unix targets only** |
| `tray/mod.rs` | 5 | Tray port selection, icon states, label formatting |
| `lib.rs` | 1 | Live OS integration (`test_get_active_ports`) |

**32 tests on Windows; 43 on Unix/macOS/Linux.** Parser tests in `unix.rs` compile only on non-Windows targets.

When changing `parse_netstat_line` or `parse_lsof_line`, **update fixture tests in the same file**.

**No frontend test harness exists.** Do not add Vitest/Jest unless explicitly requested.

---

## Naming Conventions

| Layer | Convention | Example |
|-------|------------|---------|
| Rust functions/variables | snake_case | `get_active_ports`, `process_name` |
| Rust types | PascalCase | `PortInfo`, `Protocol`, `PortPurgeError` |
| Tauri IPC commands | snake_case | `kill_process_by_pid` |
| Serde JSON output | camelCase (via `rename_all`) | `processName` |
| TypeScript variables | camelCase | `fetchPorts`, `searchQuery` |
| React components | PascalCase | `PortTable`, `EmptyState` |
| TypeScript interfaces | PascalCase in `src/types.ts` | `PortInfo`, `Toast` |

Keep Rust `PortInfo` serde output aligned with `src/types.ts` on any IPC shape change.

---

## Protected Files and Systems

| Path | Risk | Why Protected |
|------|------|---------------|
| `src-tauri/tauri.conf.json` | **Critical** | App ID, bundle, updater endpoint/pubkey — breaks build/release |
| `src-tauri/capabilities/default.json` | **Critical** | Tauri v2 permission model |
| `.github/workflows/release.yml` | **Critical** | Multi-platform release pipeline |
| `updater.key` / signing secrets | **Critical** | Never commit or expose |
| `src-tauri/src/sys/windows.rs` | **High** | Fragile `netstat`/`tasklist` parsing + `spawn_blocking` shell I/O |
| `src-tauri/src/sys/unix.rs` | **High** | Fragile `lsof` parsing + `spawn_blocking` shell I/O |
| `src-tauri/src/lib.rs` | **High** | IPC registration, plugins, window events — tray/ledger wiring only |
| `src-tauri/src/config/mod.rs` | **High** | Smart Protect `config.json`, normalization, `is_protected` gate |
| `src-tauri/src/ledger/mod.rs` | **High** | Purge Ledger persistence, `kill_and_record`, `ledger-updated` emit |
| `src-tauri/src/tray/mod.rs` | **High** | Tray icon states, menu, quick-kill via `kill_and_record`, independent poll loop |
| `src/App.tsx` | **Medium** | Orchestration only — avoid unrelated bulk edits |
| `src/utils/` | **Medium** | Pure TS helpers — no React or IPC |
| `src/components/` | **Medium** | Edit the specific component for UI changes |
| `src/types.ts` | **Medium** | Shared IPC interfaces |
| `src/index.css` | **Medium** | Global `@theme` tokens and utilities |
| `vite.config.ts` | **Medium** | Port 1420 must match `tauri.conf.json` dev URL |

---

## Forbidden Changes

- Force-pushing to `main`/`master`.
- Updating git config.
- Skipping git hooks (`--no-verify`) unless user explicitly requests.
- Committing `.env` files with secrets.
- Removing tray, single-instance, or close-to-tray without explicit request.
- Running `Command::output()` on the async runtime without `spawn_blocking`.
- Calling `sys::kill_process_by_pid` outside `ledger::kill_and_record`.
- Bypassing Smart Protect UI checks (disabled kill buttons must use `isProcessProtected`).
- Adding kill flows without passing/checking `protectedProcessNames`.
- Adding large JSX blocks or new UI surfaces directly in `App.tsx`.
- Duplicating TypeScript interfaces outside `src/types.ts`.
- Changing version in only one of `package.json`, `Cargo.toml`, `tauri.conf.json`.
- Modifying `Cargo.lock` or `package-lock.json` by hand (use `cargo` / `npm`).
- Documenting or reading contents of `node_modules/`, `dist/`, `target/`.

---

## Safe Refactor Strategy

1. **Read first:** `ai/PROJECT_CONTEXT.md` + files you will touch.
2. **Identify scope:** UI component, Rust `sys/`, IPC boundary, or config?
3. **Plan minimal diff:** List exact files and functions.
4. **Preserve contracts:** IPC command names, argument shapes, return types stay compatible unless migration is explicit.
5. **Edit incrementally:** One concern per change set.
6. **Verify:** Run applicable commands from Testing and Verification.
7. **Document:** Update `ai/PROJECT_CONTEXT.md` if behavior changes (when asked).

### Cross-boundary changes (new IPC command)

```
1. Define/update Rust types in sys/mod.rs
2. Implement in sys/windows.rs + sys/unix.rs (use spawn_blocking for Command)
3. Add parser fixture tests if output parsing changes
4. Add #[tauri::command] in lib.rs
5. Register in invoke_handler
6. Update TypeScript interface in src/types.ts
7. Call invoke() from App.tsx; pass data into components via props
8. cargo test && npm run build && npm run lint
```

### UI-only changes

```
1. Identify target component in src/components/
2. Add props/types in src/types.ts if needed
3. Put non-UI logic in src/utils/ (fuzzy, group, sort) — not in the component
4. Wire state/callbacks in App.tsx (minimal diff)
5. Use glass-panel / @theme tokens — no new design systems
6. npm run build && npm run lint
```

---

## Code Quality Expectations

- Match surrounding code style and indentation.
- Run `npm run lint` and `npm run format` when touching TS or Rust (tooling already exists).
- No unnecessary comments — code should be self-explanatory.
- No drive-by refactors in files unrelated to the task.
- No `console.log` in production paths (existing guarded `console.error` in updater catch at `App.tsx` ~line 124 — do not add more).
- Error messages remain user-friendly (follow `PortPurgeError` / toast patterns).
- Prefer `Result` and explicit error mapping in Rust over panics.

---

## Completion Checklist

Before marking any task complete:

- [ ] Changes are minimal and scoped to the request
- [ ] No secrets exposed in code or documentation
- [ ] New UI is in `src/components/`, not bloating `App.tsx`
- [ ] Pure logic is in `src/utils/`, not embedded in components
- [ ] Shared types live in `src/types.ts`
- [ ] Blocking shell I/O uses `spawn_blocking` in `sys/`
- [ ] Both platform modules updated (if `sys/` behavior changed)
- [ ] Parser fixture tests updated (if parsing changed)
- [ ] IPC commands registered (if new commands added)
- [ ] `npm run build` passes (if TypeScript changed)
- [ ] `cargo test --manifest-path src-tauri/Cargo.toml` passes (if Rust changed)
- [ ] `npm run lint` passes or warnings explained (if either layer changed)
- [ ] No unrelated files modified
- [ ] Version synced in `package.json`, `Cargo.toml`, `tauri.conf.json` (if version bumped)
- [ ] `ai/PROJECT_CONTEXT.md` updated if behavior changed (when asked)

---

## Anti-Scope-Creep Rules

- Do not collapse components back into a monolithic `App.tsx` unless asked.
- Do not add new UI component libraries unless asked.
- Do not add Vitest/Jest/Playwright unless asked.
- Do not add CI steps unless asked (CI currently runs `cargo test` only).
- Do not fix README inaccuracies unless asked.
- Do not replace `kill -9` with graceful kill unless asked.
- Do not remove localhost filtering unless explicitly requested.
- Do not "improve" the UI design while fixing a bug.

---

## Known AI Failure Modes

| Failure Mode | How It Happens | Prevention |
|--------------|----------------|------------|
| **Adding a web server** | Agent assumes "backend" means HTTP API | Read PROJECT_CONTEXT §1 and §8 |
| **Monolithic UI regression** | New modal/table added inline in `App.tsx` | Create `src/components/MyFeature.tsx` |
| **Logic in components** | Fuzzy/group/sort code added to `PortTable` or `App.tsx` | Add or extend `src/utils/*.ts` |
| **Tray logic in React** | Tray poll or kill wired through `invoke()` from frontend | Keep tray entirely in `tray/mod.rs`; kills via `kill_and_record` |
| **Bypassing Purge Ledger** | Direct `sys::kill_process_by_pid` in tray or lib.rs | Route all kills through `ledger::kill_and_record` |
| **Bypassing Smart Protect** | Kill button enabled for protected process; inline name matching | Use `isProcessProtected` from `src/utils/isProcessProtected.ts`; disable kill UI |
| **Blocking the async runtime** | `Command::output()` in `async fn` without `spawn_blocking` | Follow `sys/windows.rs` / `sys/unix.rs` pattern |
| **Editing only one platform** | Fix Windows parser, forget Unix | Update both `windows.rs` and `unix.rs` + tests |
| **Breaking IPC contract** | Rename command or change args without updating frontend | Grep command name; update `src/types.ts` |
| **Parser regression** | Change netstat/lsof parsing without fixture tests | Update `#[test]` in same module; run `cargo test` |
| **Large unrelated UI edits** | Refactor multiple components while fixing a small bug | Edit only the targeted component |
| **Forgetting invoke_handler** | Add `#[tauri::command]` but don't register | Grep `generate_handler` after adding commands |
| **Version drift** | Bump `package.json` only | Sync `package.json`, `Cargo.toml`, `tauri.conf.json` |
| **Hardcoded UI version** | Add `v0.1.0` string in React | Use `getVersion()` or pass `appVersion` prop |
| **Wrong styling approach** | Raw hex colors instead of `@theme` / `glass-*` | Read `src/index.css` and existing components |
| **Duplicate TS types** | Define `PortInfo` inside a component | Import from `src/types.ts` |
| **Committing secrets** | Include signing keys in config or docs | Only pubkey in `tauri.conf.json`; private keys gitignored |
| **Breaking tauri dev port** | Change Vite port without updating tauri.conf | Keep port 1420 in both `vite.config.ts` and `tauri.conf.json` |
| **Removing tray behavior** | Simplify `lib.rs` setup block | Tray/single-instance/close-to-tray are core features |
| **Assuming all tests run on Windows** | Expect 25 tests locally on Windows | `unix.rs` tests are `#[cfg(not(target_os = "windows"))]` |
