# Phase 1 — Updater signing containment

**Status:** Temporary containment applied (rotation incomplete)  
**Date:** 2026-07-26  
**Branch:** `release-hardening`  

## Confirmed exposure

| Field | Value |
|---|---|
| Classification | **Confirmed** — encrypted Tauri/minisign (`rsign`) **private** signing key material was embedded in the updater `pubkey` field |
| Affected path | `src-tauri/tauri.conf.json` → `plugins.updater.pubkey` |
| First known commit | `2a386c8` (`fix: plug in real tauri update public key string`) |
| Pre-containment tip | Present through `9a48015` (Phase 0 docs) |
| Visibility | Tracked in public Git history (secret body not reproduced here) |

The keypair must be treated as **compromised**. Encrypted-at-rest does not make a published private key safe.

## Temporary updater-disabled state

Fail-closed containment (no unsigned fallback):

1. **Removed** exposed private material and the updater plugin block from `src-tauri/tauri.conf.json`.
2. Set `bundle.createUpdaterArtifacts` to `false` (no updater `.sig` artifacts until rotation).
3. **Do not register** `tauri-plugin-updater` or `tauri-plugin-process` in `src-tauri/src/lib.rs` until restoration.
4. Removed `updater:default` and `process:allow-restart` from `src-tauri/capabilities/default.json`.
5. Frontend gate: `src/hooks/updaterContainment.ts` exports `UPDATER_ENABLED = false`; `useAppUpdater` never calls `check`, `downloadAndInstall`, or `relaunch` while false.
6. App version display and all non-updater features remain available; no startup update toast loop.

Reversal requires deliberate restoration steps below — not merely restoring an empty pubkey.

## CI secret scanning

Workflow: `.github/workflows/secret-scan.yml` (separate from `publish` / release).

| Job | Scope | Behaviour |
|---|---|---|
| `gitleaks (working tree)` | `--no-git` current tree | Fail-closed; `--redact` |
| `gitleaks (new commits)` | `base..head` for push/PR | Fail-closed on newly introduced secrets; `--redact` |

- Gitleaks **8.30.1** installed from the official GitHub release (no paid Gitleaks Action license required).
- `actions/checkout` pinned to commit SHA `11bd719…` (v4.2.2).
- Custom rules in `.gitleaks.toml` (extends defaults) detect plaintext and base64-embedded minisign/rsign **encrypted secret key** markers.
- **No broad allowlist** of `tauri.conf.json`.
- **No fingerprint suppression** of the historical value was added in this step (local Gitleaks/Docker were unavailable to mint opaque fingerprints safely).

### Known historical gate (AC-10)

A **full-history** `gitleaks detect` over this repository is **expected to fail** until a human decides on history scrubbing, because commits from `2a386c8` through the pre-containment tip still contain the exposure. CI does **not** pretend that history is clean. The workflow gates **current tree** and **new commits** only.

## Ignore-pattern changes

`.gitignore` now covers (non-exhaustive): `.env` / `.env.*` with exceptions for `.env.example` and `.env.*.example`; `updater.key`; `*.pem` / `*.key` / `*.p12` / `*.pfx` / `*.pkcs12`; `secrets.json` / `credentials.json`; local gitleaks report scratch files.

Tracked template `.env.example` remains. Updater **public** keys are not broadly ignored.

## External actions still required (manual)

1. Generate a **new** keypair **outside** the repository (`npm run tauri signer generate -- -w <outside-path>/portpurge.key`).
2. Store the private key in a password manager or vault (never commit, even encrypted).
3. Replace GitHub Actions secrets `TAURI_SIGNING_PRIVATE_KEY` and `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`.
4. Configure the new **public** key in `plugins.updater.pubkey` (comment must be a public-key header).
5. Resolve updater endpoint ownership (`IT25100142/...` vs origin `Sankalpa-KMCP/...`) — deferred from this step.
6. Inspect or revoke old external copies (developer machines, backups, chat logs).
7. Decide whether Git history scrubbing is required after rotation.
8. Verify signed-updater rejection cases (valid / modified / old-key / missing signature) after re-enable.
9. Consider enabling GitHub native secret scanning / push protection in repository settings.

## Restoration conditions (re-enable updater)

All of the following must be true before flipping containment off:

1. New public key configured in `tauri.conf.json` and verified as a **public** key comment.
2. GitHub signing secrets replaced; old secrets removed.
3. `createUpdaterArtifacts` set back to `true` when ready to publish signed builds.
4. Re-register updater + process plugins in `lib.rs` and restore capability permissions.
5. Set `UPDATER_ENABLED = true` in `updaterContainment.ts`.
6. Validation (`npm` / `cargo` suites) green; containment tests updated for the enabled path.
7. Endpoint ownership decision recorded.
8. Prefer completing signature rejection tests before wide release.

## Out of scope for this phase

- Key generation, GitHub secret edits, release publication, endpoint correction, history rewrite, and signature testing were **not** performed here.
