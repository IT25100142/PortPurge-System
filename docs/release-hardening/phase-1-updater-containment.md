# Phase 1 — Updater signing containment and restoration

**Status:** Rotation complete; updater wiring restored; signed-update verification pending  
**Date:** 2026-07-26  
**Branch:** `release-hardening`  

## Confirmed exposure (historical)

| Field | Value |
|---|---|
| Classification | **Confirmed** — encrypted Tauri/minisign (`rsign`) **private** signing key material was previously embedded in `plugins.updater.pubkey` |
| Affected path | `src-tauri/tauri.conf.json` → `plugins.updater.pubkey` |
| First known commit | `2a386c8` |
| Containment commit | `aa61153` (`security: contain compromised updater signing key`) |
| Visibility | Still present in **Git history** (active tree cleaned; secret body not reproduced here) |

The historical keypair remains **compromised**. History scrubbing is still an open decision.

## Rotation completed (S3)

| Item | Status |
|---|---|
| Authoritative repository | `Sankalpa-KMCP/PortPurge-System` |
| Active public-key identifier | **A666E53E49439825** |
| Public-key header | `untrusted comment: minisign public key: A666E53E49439825` |
| GitHub secrets rotated | `TAURI_SIGNING_PRIVATE_KEY`, `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` |
| Retired provisional id (Prompt 8) | `A051C5C7747123BA` — **not** active; must not be configured |
| Local recovery | Current-user DPAPI vault outside the repository (not in Git) |

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

## Still open

- **Signed-update verification** (valid / modified / retired-key / missing-signature) has **not** been executed yet.
- **Historical Git exposure** of the pre-containment private material remains until a scrubbing decision is made.
- Release workflow still references secret **names** only; do not embed values.

## CI / ignore protections (retain)

- `.github/workflows/secret-scan.yml` — Gitleaks working-tree + new-commit scans
- `.gitleaks.toml` — custom minisign/rsign encrypted-secret detection
- `.gitignore` — sensitive local key/env patterns

## Restoration checklist (completed for wiring)

- [x] New public key configured and verified as a **public** key comment  
- [x] GitHub signing secrets replaced (external step)  
- [x] `createUpdaterArtifacts` restored  
- [x] Updater + process plugins and capabilities restored  
- [x] Frontend containment removed  
- [x] Endpoint ownership aligned  
- [ ] Signed artifact acceptance/rejection tests  
- [ ] Optional history scrubbing decision  
