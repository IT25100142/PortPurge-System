# AI Rules

Permanent operational rules for AI coding agents working on PortPurge-System.

**Read `ai/PROJECT_CONTEXT.md` before making any changes.** It is the source of truth for architecture, file paths, IPC contracts, and known issues.

---

## Hard Rules

1. **Do not guess blindly.** If behavior is unclear, inspect source files or state uncertainty explicitly.
2. **Minimal diffs only.** Change the smallest correct surface area. Never rewrite large files unnecessarily.
3. **Never commit secrets.** Do not add, expose, or document `updater.key`, signing private keys, or CI secret values.
4. **No HTTP API assumptions.** This is a Tauri v2 desktop app. Backend is Rust IPC (`invoke()`), not REST.
5. **No database without explicit request.** There is no persistence layer. Do not add SQLite, ORM, or migrations unless asked.
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
| React state, IPC calls, polling, kill/updater logic | `src/App.tsx` | **Yes** |
| Global theme tokens and utilities | `src/index.css` (`@theme`, `@utility`) | **No** — use existing tokens in components |
| Static images | `public/illustrations/*.webp` | Reference by path only |

### Existing components

`PortTable`, `SearchFilters`, `MetricsBar`, `EmptyState`, `KillConfirmModal`, `UpdateModal`, `ToastContainer`.

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

---

## Backend Architecture (`src-tauri/`)

PortPurge uses a **thin IPC layer** (`lib.rs`) over a **platform `sys/` module** that runs blocking OS shell commands.

### Layer responsibilities

| Layer | Responsibility |
|-------|----------------|
| `lib.rs` | Tauri builder, plugin init, tray, window events, `#[tauri::command]` registration |
| `sys/mod.rs` | Shared types (`Protocol`, `PortInfo`, `PortPurgeError`), localhost helpers, dedupe, platform re-exports |
| `sys/windows.rs` | `netstat` / `tasklist` / `taskkill` parsing and execution |
| `sys/unix.rs` | `lsof` / `kill` parsing and execution |

Command handlers in `lib.rs` must remain thin — delegate to `sys/`. Do not put OS parsing or shell commands in `lib.rs` or `App.tsx`.

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

Configured in `lib.rs` — do not remove or reorder without explicit request:

- System tray (show / quit menu, left-click toggle)
- Single-instance plugin (second launch focuses existing window)
- Close-to-tray (`CloseRequested` → hide, `prevent_close`)

---

## Architecture Preservation

| Principle | Enforcement |
|-----------|-------------|
| IPC-only backend | All frontend→backend calls use `invoke()` |
| Component-driven UI | Presentational UI in `src/components/`; orchestration in `App.tsx` |
| Platform abstraction | OS logic in `sys/`, not in `lib.rs` or React |
| `spawn_blocking` for shell I/O | Never block the async runtime with `Command` |
| Command-query separation | Read (`get_active_ports`) vs write (`kill_process_by_pid`) |
| Optimistic UI on kill | Preserve rollback pattern in `killProcess` unless explicitly changing UX |
| Desktop lifecycle in Rust | Tray, single-instance, close-to-tray stay in `lib.rs` |

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
| `sys/mod.rs` | 9 | Shared helpers, serde, `Protocol`, dedupe |
| `sys/windows.rs` | 8 | `parse_netstat_line` fixtures, `throughput_baseline` |
| `sys/unix.rs` | 7 | `parse_lsof_line` fixtures — **Unix targets only** |
| `lib.rs` | 1 | Live OS integration (`test_get_active_ports`) |

**18 tests on Windows; 25 on Unix/macOS/Linux.** Parser tests in `unix.rs` compile only on non-Windows targets.

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
| `src-tauri/src/lib.rs` | **High** | IPC registration, tray, plugins, window events |
| `src/App.tsx` | **Medium** | Orchestration only — avoid unrelated bulk edits |
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
3. Wire state/callbacks in App.tsx (minimal diff)
4. Use glass-panel / @theme tokens — no new design systems
5. npm run build && npm run lint
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
