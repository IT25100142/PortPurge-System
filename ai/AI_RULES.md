# AI Rules

Permanent operational rules for AI coding agents working on PortPurge-System.

Read `ai/PROJECT_CONTEXT.md` before making any changes.

---

## Hard Rules

1. **Do not guess blindly.** If behavior is unclear, inspect source files or state uncertainty explicitly.
2. **Minimal diffs only.** Change the smallest correct surface area. Never rewrite large files unnecessarily.
3. **Never commit secrets.** Do not add, expose, or document `updater.key`, signing private keys, or CI secret values.
4. **No HTTP API assumptions.** This is a Tauri desktop app. Backend is Rust IPC, not REST.
5. **No database without explicit request.** There is no persistence layer. Do not add SQLite, ORM, or migrations unless asked.
6. **Sync both platform modules.** Changes to port scanning or kill behavior must update `src-tauri/src/sys/windows.rs` AND `src-tauri/src/sys/unix.rs` (or shared logic in `mod.rs`).
7. **Register IPC commands.** Every new `#[tauri::command]` must be added to `invoke_handler` in `lib.rs`.
8. **Preserve folder structure.** Do not reorganize the project layout without explicit request.
9. **No new dependencies without justification.** Prefer existing Tauri plugins and stdlib over new crates/packages.
10. **Never modify the plan file** or other meta-documentation unless explicitly asked.

---

## Editing Constraints

### Frontend (`src/`)

- The entire UI lives in `src/App.tsx`. Do not split into multiple component files unless explicitly requested.
- Match existing Tailwind v4 patterns: dark theme (`bg-[#070b14]`), glassmorphism, indigo/violet gradients.
- Do not introduce UI component libraries (MUI, shadcn, Chakra) without explicit request.
- State is local React hooks only — do not add Redux, Zustand, or React Query without explicit request.
- There is no router. Do not add `react-router` unless explicitly requested.

### Backend (`src-tauri/`)

- Command handlers in `lib.rs` should remain thin — delegate to `sys/`.
- Platform code uses `#[cfg(target_os = "windows")]` / `#[cfg(not(target_os = "windows"))]` in `sys/mod.rs`.
- Do not remove or reorder Tauri plugin initialization without explicit request.
- Do not remove system tray, minimize-to-tray, or single-instance behavior without explicit request.

### Configuration

- Changes to `tauri.conf.json` require understanding of bundle, updater, and window config.
- New Tauri plugins require updates to both `Cargo.toml` and `capabilities/default.json`.
- Do not change app identifier (`com.portpurge.app`) or updater pubkey without explicit request.

---

## Architecture Preservation

| Principle | Enforcement |
|-----------|-------------|
| IPC-only backend | All frontend→backend calls use `invoke()` |
| Platform abstraction | OS logic in `sys/`, not in `lib.rs` or `App.tsx` |
| Command-query separation | Read commands (`get_active_ports`) separate from write commands (`kill_process_by_pid`) |
| Optimistic UI on kill | Preserve rollback pattern in `killProcess` unless explicitly changing UX |
| Desktop lifecycle in Rust | Tray, single-instance, close-to-tray stay in `lib.rs` |

---

## Dependency Policy

### Allowed without discussion

- Patch/minor updates to existing dependencies in `package.json` or `Cargo.toml`.
- Official Tauri plugins from the `tauri-apps` organization.

### Requires justification

- Any new npm package or Cargo crate.
- Replacing shell commands with native OS APIs.
- Adding build tooling (ESLint, Prettier, Vitest, etc.).

### Forbidden unless explicitly requested

- Web server frameworks (Express, Fastify, Axum HTTP server).
- Database drivers or ORMs.
- Authentication libraries (JWT, OAuth).
- Electron or alternative desktop frameworks.

---

## Testing Requirements

| Change Type | Required Verification |
|-------------|----------------------|
| Rust (`sys/`, `lib.rs`) | `cargo test --manifest-path src-tauri/Cargo.toml -- --nocapture` |
| TypeScript (`src/`) | `npm run build` |
| IPC contract changes | Both Rust test + manual `npm run tauri dev` smoke test |
| Config changes | `npm run tauri build` (if icons available) or `npm run build` minimum |

**Note:** Only one Rust integration test exists. It hits the live OS. Parser changes should be verified manually on the target platform until fixture tests are added.

**No frontend test harness exists.** Do not add tests unless explicitly requested.

---

## Naming Conventions

| Layer | Convention | Example |
|-------|------------|---------|
| Rust functions/variables | snake_case | `get_active_ports`, `process_name` |
| Rust types | PascalCase | `PortInfo`, `PortPurgeError` |
| Tauri IPC commands | snake_case | `kill_process_by_pid` |
| Serde JSON output | camelCase (via `rename_all`) | `processName` |
| TypeScript variables | camelCase | `fetchPorts`, `searchQuery` |
| React components | PascalCase | `App` |
| TypeScript interfaces | PascalCase | `PortInfo`, `Toast` |
| Files | Match existing patterns | `App.tsx`, `windows.rs` |

**Known mismatch:** Rust serializes `process_name` as `processName` (camelCase) but TypeScript interface uses `process_name`. Do not change one side without verifying and updating the other.

---

## Protected Files and Systems

| Path | Risk Level | Why Protected |
|------|------------|---------------|
| `src-tauri/tauri.conf.json` | **Critical** | App ID, bundle config, updater endpoint and pubkey — breaks build/release if wrong |
| `src-tauri/capabilities/default.json` | **Critical** | Tauri v2 permission model — wrong permissions break plugins or create security gaps |
| `.github/workflows/release.yml` | **Critical** | Multi-platform release pipeline — errors block shipping |
| `updater.key` / `updater.key.pub` | **Critical** | Signing keys — never commit or expose |
| `src-tauri/src/sys/windows.rs` | **High** | Fragile `netstat`/`tasklist` parsing — easy to break on format changes |
| `src-tauri/src/sys/unix.rs` | **High** | Fragile `lsof` parsing — column positions are format-dependent |
| `src-tauri/src/lib.rs` | **High** | IPC registration, tray, plugins, window events — central app wiring |
| `src/App.tsx` | **Medium** | Large monolithic file — easy to introduce regressions in unrelated sections |
| `vite.config.ts` | **Medium** | Port 1420 is required by Tauri dev config |
| `package-lock.json` | **Medium** | Only update via `npm install`, not hand-edited |

---

## Forbidden Changes

- Force-pushing to `main`/`master`.
- Updating git config.
- Skipping git hooks (`--no-verify`) unless user explicitly requests.
- Committing `.env` files with secrets.
- Removing the system tray or single-instance plugin without explicit request.
- Adding localhost filtering to documentation only without code changes (or vice versa).
- Changing version in only one file (must sync all version locations).
- Modifying `Cargo.lock` by hand (use `cargo` commands).
- Documenting or reading contents of `node_modules/`, `dist/`, `target/`.

---

## Safe Refactor Strategy

1. **Read first:** `ai/PROJECT_CONTEXT.md` + files you will touch.
2. **Identify scope:** UI-only, Rust-only, or cross-boundary (IPC)?
3. **Plan minimal diff:** List exact functions/lines to change.
4. **Preserve contracts:** IPC command names, argument shapes, and return types must stay compatible unless migration is explicit.
5. **Edit incrementally:** One concern per change set.
6. **Verify:** Run applicable commands from Testing Requirements section.
7. **Document:** Update `ai/` docs if behavior changes.

### Cross-boundary changes (IPC)

```
1. Define/update Rust type in sys/mod.rs
2. Implement in sys/windows.rs + sys/unix.rs
3. Add #[tauri::command] in lib.rs
4. Register in invoke_handler
5. Update TypeScript interface in App.tsx
6. Call invoke() from App.tsx
7. cargo test && npm run build
```

---

## Code Quality Expectations

- Match surrounding code style and indentation.
- No unnecessary comments — code should be self-explanatory.
- No drive-by refactors in files you are not changing for the task.
- No `console.log` left in production paths (existing `console.error` in updater catch is known — do not add more).
- Error messages should remain user-friendly (follow `PortPurgeError` patterns).
- Prefer `Result` and explicit error mapping in Rust over panics.

---

## Completion Checklist

Before marking any task complete:

- [ ] Changes are minimal and scoped to the request
- [ ] No secrets exposed in code or documentation
- [ ] Both platform modules updated (if `sys/` changed)
- [ ] IPC commands registered (if new commands added)
- [ ] `npm run build` passes (if TypeScript changed)
- [ ] `cargo test --manifest-path src-tauri/Cargo.toml` passes (if Rust changed)
- [ ] No unrelated files modified
- [ ] Version strings synced (if version bumped)
- [ ] `ai/PROJECT_CONTEXT.md` updated if behavior changed

---

## Anti-Scope-Creep Rules

- Do not extract `App.tsx` into components unless asked.
- Do not add ESLint/Prettier/config unless asked.
- Do not add CI test steps unless asked.
- Do not fix README inaccuracies unless asked (but do not introduce new ones).
- Do not add icons, LICENSE, or `.env.example` unless asked.
- Do not "improve" the UI design while fixing a bug.
- Do not replace `kill -9` with graceful kill unless asked.
- Do not add localhost filtering unless product decision is confirmed.

---

## Known AI Failure Modes

| Failure Mode | How It Happens | Prevention |
|--------------|----------------|------------|
| **Adding a web server** | Agent assumes "backend" means HTTP API | Read PROJECT_CONTEXT §1 and §8 first |
| **Editing only one platform** | Fix Windows parser, forget Unix | Always check both `windows.rs` and `unix.rs` |
| **Breaking IPC contract** | Rename command or change args without updating frontend | Grep for command name across repo |
| **Parser regression** | Change whitespace/column assumptions in netstat/lsof parsing | Test on real OS output; add fixtures when possible |
| **Wholesale App.tsx rewrite** | "Refactoring" UI while fixing small bug | Edit only the targeted section |
| **Forgetting invoke_handler** | Add `#[tauri::command]` but don't register | Grep `generate_handler` after adding commands |
| **Version drift** | Bump `package.json` only | Grep for `0.1.0` and version fields |
| **Docs/code mismatch** | Document localhost filter that doesn't exist | Verify in `sys/*.rs` before documenting behavior |
| **Committing secrets** | Include signing keys in tauri.conf or docs | Only pubkey in config; private keys are gitignored |
| **Adding unnecessary abstractions** | Create service classes/hooks for one-time logic | Keep logic inline unless extraction is requested |
| **Breaking tauri dev port** | Change Vite port without updating tauri.conf.json | Port 1420 must match in both files |
| **Removing tray behavior** | Simplify lib.rs setup block | Tray/single-instance/close-to-tray are core features |
