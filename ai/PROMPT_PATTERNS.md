# Prompt Patterns

Reusable prompt templates for AI workflows on PortPurge-System.

Each pattern encourages planning before coding, minimal diffs, architecture preservation, and validation before completion.

**Always pre-read:** `ai/PROJECT_CONTEXT.md` and `ai/AI_RULES.md`

---

## 1. Safe Refactor

**Goal:** Restructure existing code without changing behavior.

```
You are working on PortPurge-System, a Tauri v2 + React desktop app.

Task: [describe refactor, e.g. "extract toast logic from App.tsx into a hook"]

Before coding:
1. Read ai/PROJECT_CONTEXT.md and ai/AI_RULES.md
2. Read the files you will modify
3. List the exact functions/sections to change
4. Confirm this does NOT require IPC contract changes

Constraints:
- Minimal diff — change only what is necessary
- Do not split App.tsx into multiple files unless this task explicitly requests it
- Preserve all existing behavior (polling, kill flow, updater, toasts)
- Do not add dependencies

Validation:
- npm run build
- cargo test --manifest-path src-tauri/Cargo.toml -- --nocapture
- npm run tauri dev (smoke test if UI changed)

Anti-patterns:
- Rewriting App.tsx wholesale
- Renaming IPC commands
- Adding abstractions for one-time logic
```

---

## 2. Bug Fixing

**Goal:** Fix a specific bug with root-cause analysis.

```
You are working on PortPurge-System, a Tauri v2 + React desktop app.

Bug: [describe symptom, e.g. "process names show as undefined on Windows"]
Platform: [Windows / macOS / Linux / all]
Reproduction: npm run tauri dev → [steps]

Before coding:
1. Read ai/PROJECT_CONTEXT.md §14 (Known Issues)
2. Read relevant sys/ module: src-tauri/src/sys/windows.rs or unix.rs
3. Read src/App.tsx if the bug is in UI/IPC layer
4. Identify root cause — do not patch symptoms

Constraints:
- Fix the root cause, not just the symptom
- If parser bug: check BOTH windows.rs and unix.rs for similar issues
- Do not change unrelated code
- Do not add dependencies

Validation:
- cargo test --manifest-path src-tauri/Cargo.toml -- --nocapture
- npm run build
- Manual test on target platform via npm run tauri dev

Anti-patterns:
- Guessing netstat/lsof output format without reading actual output
- Fixing docs without fixing code (or vice versa)
- Adding try/catch that swallows errors silently
```

---

## 3. Feature Implementation

**Goal:** Add a new user-facing capability.

```
You are working on PortPurge-System, a Tauri v2 + React desktop app.

Feature: [describe feature, e.g. "add localhost-only filter toggle"]

Scope:
- [ ] UI only (src/App.tsx)
- [ ] Rust backend only (src-tauri/)
- [ ] Both (IPC command needed)
- [ ] Config change (tauri.conf.json / capabilities)

Before coding:
1. Read ai/PROJECT_CONTEXT.md §4 (Core Features) and §12 (Development Workflow)
2. Identify which files need changes
3. Plan the IPC contract if cross-boundary

Constraints:
- Extend existing patterns — do not introduce new frameworks
- If new IPC command: follow the registration pattern in lib.rs
- If new plugin: update Cargo.toml + capabilities/default.json
- Platform changes: update BOTH windows.rs and unix.rs
- Minimal diff

Validation:
- npm run build
- cargo test --manifest-path src-tauri/Cargo.toml -- --nocapture
- npm run tauri dev — manually verify the feature

Anti-patterns:
- Adding a REST API for the feature
- Creating new folder structure without need
- Scope creep (e.g. redesigning UI while adding a filter)
```

---

## 4. Debugging

**Goal:** Investigate unexpected behavior without making changes yet.

```
You are debugging PortPurge-System, a Tauri v2 + React desktop app.

Issue: [describe what is happening vs what is expected]
Platform: [Windows / macOS / Linux]
When: [startup / polling / kill / update / tray]

Investigation steps:
1. Read ai/PROJECT_CONTEXT.md §5 (Application Flow)
2. Trace the flow from App.tsx invoke() → lib.rs → sys/*.rs
3. Check if README claims match actual code behavior
4. Check ai/PROJECT_CONTEXT.md §14 for known issues

Report:
- Root cause (with file paths and line numbers)
- Whether this is a known issue
- Proposed minimal fix (do NOT implement unless asked)
- Which platforms are affected

Do not make code changes unless explicitly asked to fix.
```

---

## 5. Architecture Review

**Goal:** Evaluate a proposed change against existing architecture.

```
You are reviewing an architecture proposal for PortPurge-System.

Proposal: [describe the proposed change]

Review against:
1. ai/PROJECT_CONTEXT.md §6 (Architecture)
2. ai/ARCHITECTURE_DECISIONS.md (relevant ADRs)
3. ai/AI_RULES.md (Hard Rules, Architecture Preservation)

Evaluate:
- Does this fit the Tauri IPC architecture?
- Does it require changes to both platform modules?
- Does it introduce unnecessary complexity?
- Does it conflict with any accepted ADR?
- What are the risks?

Output:
- Approve / Modify / Reject with reasoning
- List affected files
- Suggest minimal implementation path if approved
- Flag if an ADR update is needed

Do not implement unless explicitly asked.
```

---

## 6. Code Review

**Goal:** Review a diff or set of changes for quality and safety.

```
You are reviewing code changes for PortPurge-System.

Changes: [describe or paste diff summary]

Check:
1. Minimal diff? Any unrelated changes?
2. IPC contract preserved? (command names, args, return types)
3. Both platform modules updated if sys/ changed?
4. New commands registered in invoke_handler?
5. Secrets exposed? (signing keys, tokens)
6. Version strings synced if version changed?
7. Matches existing code style and Tailwind patterns?
8. ai/AI_RULES.md completion checklist satisfied?

Output:
- Issues found (severity: critical / high / medium / low)
- File paths and line references
- Suggested fixes
- Approval status

Anti-patterns to flag:
- HTTP API additions
- Database additions
- App.tsx wholesale rewrite
- Parser changes without platform testing
```

---

## 7. Security Review

**Goal:** Assess security implications of code or configuration.

```
You are performing a security review of PortPurge-System.

Scope: [specific files/feature, or "full app"]

Review:
1. ai/PROJECT_CONTEXT.md §15 (Security and Privacy)
2. src-tauri/capabilities/default.json — permission scope
3. src-tauri/tauri.conf.json — CSP, updater config
4. src-tauri/src/sys/*.rs — command injection risks
5. src/App.tsx — client-side data exposure
6. .github/workflows/release.yml — secret handling

Check for:
- Process kill without confirmation (kill HAS confirmation — verify it stays)
- Shell command injection via user input
- Overly broad Tauri capabilities
- Exposed signing keys or secrets
- Updater trust chain integrity
- Missing input validation on new IPC commands

Output:
- Findings by severity
- File paths
- Recommended mitigations
- What is acceptable risk for a local dev utility

Never expose actual secret values — use [REDACTED].
```

---

## 8. Migration Planning

**Goal:** Plan a structural change that affects multiple files.

```
You are planning a migration for PortPurge-System.

Migration: [e.g. "extract App.tsx into components", "add localhost filter", "add parser unit tests"]

Before planning:
1. Read ai/PROJECT_CONTEXT.md
2. Read ai/ARCHITECTURE_DECISIONS.md for constraints
3. Identify all affected files

Plan must include:
- Step-by-step migration order (minimize broken intermediate states)
- Files created/modified/deleted per step
- IPC contract impact (if any)
- Platform-specific considerations
- Rollback strategy
- Testing plan per step
- Whether ADRs need updating

Constraints:
- Each step should leave the app buildable
- No database migrations (no database exists)
- Prefer incremental over big-bang

Output a numbered plan. Do not implement unless asked.
```

---

## 9. API / IPC Changes

**Goal:** Add or modify a Tauri IPC command safely.

```
You are changing the IPC contract in PortPurge-System.

Change: [e.g. "add kill_process_by_port command" or "add address field to PortInfo"]

Required steps (in order):
1. Update shared types in src-tauri/src/sys/mod.rs
2. Implement in src-tauri/src/sys/windows.rs
3. Implement in src-tauri/src/sys/unix.rs
4. Add #[tauri::command] handler in src-tauri/src/lib.rs
5. Register in invoke_handler (generate_handler![...])
6. Update TypeScript interface in src/App.tsx
7. Call invoke() from App.tsx
8. Update ai/PROJECT_CONTEXT.md §8 if contract changed

Constraints:
- Backward compatibility: do not rename existing commands without migration plan
- Serde rename_all = "camelCase" on PortInfo — align TypeScript field names
- Error handling: return String via .map_err(|e| e.to_string())

Validation:
- cargo test --manifest-path src-tauri/Cargo.toml -- --nocapture
- npm run build
- npm run tauri dev — test new command manually

Anti-patterns:
- Adding HTTP endpoint instead of IPC command
- Implementing logic in lib.rs instead of sys/
- Forgetting invoke_handler registration
```

---

## 10. UI Changes

**Goal:** Modify the dashboard appearance or interaction.

```
You are making UI changes to PortPurge-System.

Change: [describe UI change]

Before coding:
1. Read src/App.tsx — understand existing layout and state
2. Read src/index.css — check for custom animations
3. Match existing design: dark theme, glassmorphism, indigo/violet gradients

Constraints:
- Edit only the relevant section of App.tsx
- Use Tailwind v4 utility classes (no new CSS unless animation needed)
- Use lucide-react for icons (already imported)
- Do not add a UI component library
- Do not add react-router
- Preserve existing features (polling, kill, toasts, updater)

Validation:
- npm run build
- npm run tauri dev — visual check
- Verify kill confirmation flow still works
- Verify toasts still appear and dismiss

Anti-patterns:
- Full App.tsx rewrite
- Changing color scheme globally unless asked
- Removing optimistic kill behavior
- Breaking responsive layout (md: breakpoints)
```

---

## 11. Dependency Evaluation

**Goal:** Assess whether to add or update a dependency.

```
You are evaluating a dependency for PortPurge-System.

Package: [name and version]
Type: [npm / cargo]
Purpose: [why it is needed]

Evaluate:
1. Is this achievable with existing deps or stdlib?
2. For Rust OS interaction: can shell commands or std::process suffice?
3. For UI: can Tailwind + lucide handle it?
4. Is it an official Tauri plugin (preferred for desktop features)?
5. Bundle size / build time impact?
6. Maintenance status and license?

Alternatives:
- List at least one alternative approach without the dependency

Recommendation:
- Add / Don't add / Use alternative
- If add: exact file to modify (package.json or Cargo.toml)
- Any capability permission changes needed

Do not install unless explicitly asked.
```

---

## 12. Documentation Updates

**Goal:** Update project documentation accurately.

```
You are updating documentation for PortPurge-System.

Scope: [README.md / ai/PROJECT_CONTEXT.md / ai/AI_RULES.md / ai/ARCHITECTURE_DECISIONS.md / all ai/]

Before writing:
1. Verify claims against actual source code — do not trust README alone
2. Check ai/PROJECT_CONTEXT.md §14 for known doc/code mismatches

Rules:
- Use exact file paths
- Never expose secrets — use [REDACTED]
- State clearly when something is uncertain
- Do not document node_modules/, dist/, target/
- If behavior changes, update both README and ai/ docs

Known mismatches to check:
- README "localhost only" vs actual sys/ behavior
- README "parsing unit tests" vs integration test in lib.rs
- README "cd portpurge" vs PortPurge-System folder name

Validation:
- No contradictions between ai/ files
- Setup commands match package.json scripts exactly
- IPC commands match lib.rs invoke_handler
```

---

## 13. Testing Improvements

**Goal:** Add or improve tests.

```
You are improving tests for PortPurge-System.

Scope: [e.g. "add netstat parser unit tests", "add CI test step"]

Current state:
- 1 Rust integration test in src-tauri/src/lib.rs (live OS)
- No frontend tests
- No CI test gate

Constraints:
- Parser tests should use fixture strings, not live OS commands
- Do not add frontend test framework unless explicitly requested
- CI changes go in .github/workflows/release.yml

Recommended approach for parser tests:
1. Extract parsing logic into testable functions in sys/
2. Create #[test] with sample netstat/lsof output strings
3. Test edge cases: empty output, IPv6 addresses, unknown PIDs

Validation:
- cargo test --manifest-path src-tauri/Cargo.toml -- --nocapture
- Tests must pass without admin/sudo

Anti-patterns:
- Tests that require specific ports to be open
- Tests that kill real processes
- Adding heavyweight test frameworks for a small app
```

---

## 14. Configuration Changes

**Goal:** Modify build, release, or app configuration.

```
You are changing configuration for PortPurge-System.

Config: [tauri.conf.json / capabilities/default.json / vite.config.ts / release.yml]

Before changing:
1. Read ai/PROJECT_CONTEXT.md §10 (Environment Variables)
2. Read ai/AI_RULES.md Protected Files section
3. Understand downstream impact

High-risk fields:
- tauri.conf.json: identifier, version, updater pubkey/endpoints, bundle icons
- capabilities/default.json: permission grants
- vite.config.ts: port 1420 (must match tauri.conf.json devUrl)
- release.yml: secrets references, platform matrix

Constraints:
- Do not change app identifier without explicit request
- Do not change updater pubkey without explicit request
- Port 1420 in vite.config.ts must match tauri.conf.json devUrl
- New plugin permissions must be added to capabilities/default.json

Validation:
- npm run build (for vite/tsconfig changes)
- npm run tauri dev (for tauri.conf.json changes)
- Review CI workflow syntax (for release.yml changes)

Anti-patterns:
- Committing signing private keys
- Setting CSP without understanding webview impact
- Changing dev port in only one config file
```

---

## General Prompt Prefix

Use this prefix for any PortPurge task:

```
Project: PortPurge-System (Tauri v2 + React desktop app)
Read first: ai/PROJECT_CONTEXT.md, ai/AI_RULES.md
Architecture: Tauri IPC only — no HTTP API, no database
Platform: Changes to sys/ require BOTH windows.rs and unix.rs
Rules: Minimal diff, no secrets, no scope creep, validate before done
```
