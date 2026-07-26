import { describe, it, expect } from "vitest";
import conf from "../../../src-tauri/tauri.conf.json";

/** Final rotated public key (A666E53E49439825). Safe to embed in tests. */
const EXPECTED_PUBKEY =
  "dW50cnVzdGVkIGNvbW1lbnQ6IG1pbmlzaWduIHB1YmxpYyBrZXk6IEE2NjZFNTNFNDk0Mzk4MjUKUldRbG1FTkpQdVZtcGdaZ1hueW9xM0RWb3lDbm5EUTBXVjhJUlBpOUE2VC8yMmpNRitabUhndUUK";

const EXPECTED_ENDPOINT =
  "https://github.com/Sankalpa-KMCP/PortPurge-System/releases/latest/download/latest.json";

const EXPECTED_PUBLIC_HEADER =
  "untrusted comment: minisign public key: A666E53E49439825";

const RETIRED_PUBLIC_KEY_ID = "A051C5C7747123BA";

function decodePubkeyComment(pubkey: string): string {
  const decoded = atob(pubkey.trim());
  return decoded.split(/\r?\n/)[0]?.trim() ?? "";
}

describe("updater configuration safety", () => {
  it("enables updater artifact creation", () => {
    expect(conf.bundle.createUpdaterArtifacts).toBe(true);
  });

  it("embeds exactly the final rotated public key", () => {
    expect(conf.plugins.updater.pubkey).toBe(EXPECTED_PUBKEY);
  });

  it("classifies the configured pubkey as a minisign public key for A666E53E49439825", () => {
    const header = decodePubkeyComment(conf.plugins.updater.pubkey);
    expect(header).toBe(EXPECTED_PUBLIC_HEADER);
    expect(header).toMatch(/minisign public key:\s*A666E53E49439825/i);
  });

  it("rejects encrypted private-key headers in pubkey", () => {
    const header = decodePubkeyComment(conf.plugins.updater.pubkey).toLowerCase();
    expect(header).not.toContain("encrypted secret key");
    expect(header).not.toContain("rsign encrypted secret key");
    expect(header).not.toContain("minisign encrypted secret key");
  });

  it("targets the authoritative Sankalpa-KMCP release endpoint", () => {
    expect(conf.plugins.updater.endpoints).toEqual([EXPECTED_ENDPOINT]);
    expect(conf.plugins.updater.endpoints[0]).not.toMatch(/IT25100142/i);
  });

  it("does not reference the retired Prompt 8 public-key id in active config", () => {
    const serialized = JSON.stringify(conf);
    expect(serialized).not.toContain(RETIRED_PUBLIC_KEY_ID);
    const header = decodePubkeyComment(conf.plugins.updater.pubkey);
    expect(header).not.toContain(RETIRED_PUBLIC_KEY_ID);
  });
});

describe("updater restoration is not gated by a frontend kill-switch", () => {
  it("does not ship an importable updaterContainment module", async () => {
    // If containment is reintroduced, this @ts-expect-error becomes unused and fails tsc.
    // @ts-expect-error containment module must remain deleted
    await expect(import("../updaterContainment")).rejects.toBeTruthy();
  });

  it("does not export UPDATER_ENABLED from the updater hook module", async () => {
    const mod = await import("../useAppUpdater");
    expect(mod).not.toHaveProperty("UPDATER_ENABLED");
    expect("UPDATER_ENABLED" in mod).toBe(false);
  });
});
