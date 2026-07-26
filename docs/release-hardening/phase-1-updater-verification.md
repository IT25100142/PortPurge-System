# Phase 1 — Updater signature verification

**Status:** Four-case isolated signature verification **COMPLETE** (exact compromised-key replay not performed)  
**Date:** 2026-07-26  
**Host platform:** Windows  
**Source commit:** `9120438ab66a425b048f267d416b5b81045f8482` (`release-hardening`)  
**Active public-key ID:** **A666E53E49439825**

## Phase 1 closure context (post-rewrite)

| Item | Status |
|---|---|
| Project-controlled Phase 1 controls | **COMPLETE** |
| Strict technical exit criterion | **FAIL** — solely due to accepted GitHub unreachable-object retention by known SHA |
| Accepted-risk project verdict | **PASS** |
| Default-branch integration | **Pending** |
| Reachable live history (encrypted-private findings) | **0** classifications / **0** encoded markers |
| GitHub Releases / distributed release assets | **None** |
| Active development clone | `E:/PortPurge-System-clean` |

Reachable live refs were rewritten and classify clean. GitHub may still retain unreachable historical objects accessible through known SHAs; the user accepted that residual risk and declined the Support purge. This document does **not** claim those objects were purged.

## Tooling versions

| Component | Version |
|---|---|
| Tauri CLI | 2.11.2 |
| `tauri-plugin-updater` | 2.10.1 |
| `minisign-verify` (harness + plugin) | 0.2.5 |
| Active public-key ID | **A666E53E49439825** |

## Method

1. Isolated local clone of commit `9120438` under `%LOCALAPPDATA%\PortPurge\updater-sig-test\<run-id>\` (not a `git worktree`; active repo untouched during the build).
2. Active signing material decrypted from the current-user DPAPI vault into process memory only and passed to the build as **process-scoped** environment variables `TAURI_SIGNING_PRIVATE_KEY` / `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` (never argv, never `.env`, never persistent user/machine env).
3. Genuine Windows NSIS updater artifact produced with `npx tauri build --bundles nsis`.
4. Plugin-equivalent Rust harness mirrored `tauri-plugin-updater` 2.10.1 `verify_signature` (base64-decode pubkey + signature → `PublicKey::decode` / `Signature::decode` → `public_key.verify(data, &signature, true)`).
5. Harness is **verify-only** (no install, execute, relaunch, or shell-launch paths). Verification therefore occurs **before** any install path by construction.
6. Temporary workspace, binaries, signatures, disposable foreign keys, and logs were logically deleted after evidence capture. DPAPI vault left intact.

## Artifact (non-secret)

| Field | Value |
|---|---|
| Filename | `PortPurge_0.6.0_x64-setup.exe` |
| Type | Windows NSIS setup / updater payload |
| Size | 3276196 bytes |
| SHA-256 | `8e5ba110c40817cfd60f8f0324c092084010de14ab28b219a1659d3878c18924` |
| Signature file SHA-256 | `b372a519bcd7149d271377988f94640b099afb6d9963f064c43d88c6cf24f9d1` |
| Build exit | 0 |
| Installer executed | **No** |
| Published as GitHub Release asset | **No** (no Releases / distributed assets existed) |

## Results

| Case | Description | Result | Safe error category |
|---|---|---|---|
| **V1** | Untouched NSIS artifact + active `.sig` + pubkey A666E53E49439825 | **PASS** (`VERIFY_OK`) | — |
| **V2** | One post-sign byte flip; original signature retained | **PASS** (rejected) | `MINISIGN` |
| **V3** | Disposable foreign-key signature verified under active pubkey | **PASS** (rejected) | `MINISIGN` |
| **V4a** | Absent signature input | **PASS** (rejected) | `ABSENT_SIGNATURE` |
| **V4b** | Empty signature string | **PASS** (rejected) | `EMPTY_SIGNATURE` (+ plugin-path decode failure detail) |

Modified artifact SHA-256 (V2): `af541c1bddf4e2ca287872c0974e349688fcb3b934df716bc85af911131e51ea`

### V3 structural identity proof (no retired private keys used)

| Identity | Relationship to active A666E53E49439825 |
|---|---|
| Disposable foreign public ID `87286FCA416E558` | Different |
| Retired Prompt 8 `A051C5C7747123BA` | Different |
| Historical `876A418ECFF7F0EB` | Different |
| Historical `F447B63DBADDB9D0` | Different |

**Exact-old-key limitation:** Prompt 8 / retired private material was not recovered for replay. Historical Git private blobs were **not** retrieved. V3 is the safe disposable foreign-key equivalent demonstrating key-mismatch enforcement under the active pubkey. No exact compromised-key replay was performed.

## Secret-leak scan (counts only)

| Check | Count / value |
|---|---|
| Files scanned (scoped) | 189 |
| Active private-key byte-sequence matches | **0** |
| Active password byte-sequence matches | **0** |
| DPAPI payload copies in workspace | **0** |
| Encrypted-secret marker hits in evidence/logs/artifacts | **0** |
| Artifact contains private key | **false** |
| Artifact contains password | **false** |
| Installer executed | **false** |
| Workspace deleted after capture | **true** |
| DPAPI vault intact | **true** |

## Local remediation cross-reference

- Stale clone `E:/PortPurge-System` deleted (logical filesystem removal, not forensic erasure).
- Contaminated local tag `pre-hardening-backup` intentionally discarded.
- Contaminated bundles and rewrite workspaces deleted (bundle count **0**).
- Continued work uses `E:/PortPurge-System-clean` only.
- See [`phase-1-updater-containment.md`](./phase-1-updater-containment.md) for the full accepted-risk and reachable-history record.

## Related

- Containment / restoration / residual-risk narrative: [`phase-1-updater-containment.md`](./phase-1-updater-containment.md)
