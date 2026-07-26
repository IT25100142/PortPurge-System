# Phase 1 — Updater signing containment and restoration

**Status:** Project-controlled Phase 1 controls **COMPLETE** (default-branch integration pending)  
**Date:** 2026-07-26  
**Branch:** `release-hardening`  
**Active public-key ID:** **A666E53E49439825**  
**Active clone:** `E:/PortPurge-System-clean`

## Final Phase 1 status

| Verdict | Result |
|---|---|
| Project-controlled Phase 1 controls | **COMPLETE** |
| Strict technical exit criterion | **FAIL** — solely because GitHub may retain unreachable historical objects accessible by known commit or blob SHA |
| Accepted-risk project verdict | **PASS** — all project-controlled exposure paths are remediated; the user accepted GitHub direct-SHA retention as residual risk |
| Default-branch integration | **Pending** (not yet fast-forwarded into `master`) |
| Active public-key ID | **A666E53E49439825** |

The original absolute wording (“no signing secret exists in the repository, builds, logs, or distributed application”) remains unmet in the **strict technical** sense while GitHub may retain unreachable objects. That retention is an **explicit exception**: the user accepted it and declined submitting the prepared GitHub Support purge request. This documentation does **not** claim GitHub purged those objects.

## Confirmed exposure (historical)

| Field | Value |
|---|---|
| Classification | **Confirmed** — encrypted Tauri/minisign (`rsign`) **private** signing key material was previously embedded in `plugins.updater.pubkey` |
| Affected path | `src-tauri/tauri.conf.json` → `plugins.updater.pubkey` |
| First known pre-rewrite commit | `2a386c8` (historical identity; no longer on live rewritten refs) |
| Containment (pre-rewrite narrative) | Earlier containment commit retired the embedded private material from the active tree |
| Reachable live history (post-rewrite) | **Clean** — encrypted-private classifications **0**; encoded encrypted-private markers **0**; historical `tauri.conf.json` JSON failures **0** |

The historical keypair remains **compromised** and must never be reused. All live branches and tags were rewritten; old affected objects are **not** reachable from live refs. Fresh-clone and full reachable-history classification returned zero encrypted-private findings. GitHub may still retain unreachable objects accessible through known SHAs (accepted residual risk; Support purge not submitted).

## Rotation completed (S3)

| Item | Status |
|---|---|
| Authoritative repository | `Sankalpa-KMCP/PortPurge-System` |
| Active public-key identifier | **A666E53E49439825** |
| Public-key header | `untrusted comment: minisign public key: A666E53E49439825` |
| GitHub secrets rotated | `TAURI_SIGNING_PRIVATE_KEY`, `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` |
| Retired provisional id (Prompt 8) | `A051C5C7747123BA` — **not** active; must not be configured |
| Local recovery | Current-user DPAPI vault outside the repository (not in Git; contents not documented here) |

Private key / password values are never stored in this repository.

## Updater wiring restored (S4)

Fail-closed containment has been retired. Current restored state:

1. `bundle.createUpdaterArtifacts`: **true**
2. `plugins.updater.pubkey`: final public key for **A666E53E49439825** only
3. Endpoint:
   `https://github.com/Sankalpa-KMCP/PortPurge-System/releases/latest/download/latest.json`
4. `tauri_plugin_updater` and `tauri_plugin_process` registered in `src-tauri/src/lib.rs`
5. Capabilities: `updater:default`, `process:allow-restart`
6. Frontend: normal `useAppUpdater` check / download / install / relaunch (no `UPDATER_ENABLED` kill-switch)
7. Enabled-path Vitest coverage restored; config safety tests guard pubkey class and endpoint owner

## Endpoint ownership

Resolved to the authoritative origin repository **Sankalpa-KMCP/PortPurge-System** (replacing the former `IT25100142/...` endpoint).

## Local remediation (S7-E)

| Item | Status |
|---|---|
| Stale pre-rewrite clone `E:/PortPurge-System` | **Deleted** (logical filesystem removal, not forensic disk erasure) |
| Contaminated local tag `pre-hardening-backup` | **Intentionally discarded** (not migrated, bundled, or pushed) |
| Contaminated bundles / rewrite workspaces | **Deleted** (bundle count **0**) |
| Continued development location | **`E:/PortPurge-System-clean` only** |

## Signature verification

Isolated four-case NSIS harness results are recorded in [`phase-1-updater-verification.md`](./phase-1-updater-verification.md):

- **V1** valid active-key signature accepted
- **V2** modified artifact rejected
- **V3** disposable foreign-key signature rejected under the active public key (exact compromised-key replay not performed)
- **V4** absent and empty signatures rejected
- No installer executed; no GitHub Release / distributed release assets existed

## Residual risk (accepted)

- GitHub may retain unreachable historical objects accessible by known SHA.
- The user explicitly accepted that residual risk and declined the GitHub Support purge.
- Strict technical verdict: **FAIL** against the literal “no signing secret exists anywhere” wording, solely for that retention.
- Accepted-risk project verdict: **PASS** because live refs, fresh clones, builds, workflows, and distributed assets under project control are remediated.

## CI / ignore protections (retain)

- `.github/workflows/secret-scan.yml` — Gitleaks working-tree + new-commit scans (does not prove GitHub purged unreachable objects)
- `.gitleaks.toml` — custom minisign/rsign encrypted-secret detection (retained because native GitHub scanning did not alert on the historical material)
- `.gitignore` — sensitive local key/env patterns

## Restoration checklist

- [x] New public key configured and verified as a **public** key comment  
- [x] GitHub signing secrets replaced (external step)  
- [x] `createUpdaterArtifacts` restored  
- [x] Updater + process plugins and capabilities restored  
- [x] Frontend containment removed  
- [x] Endpoint ownership aligned  
- [x] Isolated four-case signature verification ([phase-1-updater-verification.md](./phase-1-updater-verification.md))  
- [x] Live branches/tags rewritten; reachable-history classification clean  
- [x] Stale local clone and contaminated backups retired  
- [x] GitHub direct-SHA retention accepted and recorded as residual risk  
- [ ] Default-branch fast-forward of `release-hardening` into `master` (pending; not executed in this documentation step)  
