import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../../..");
const TAURI_CONF = join(ROOT, "src-tauri/tauri.conf.json");

/** Final rotated public key (A666E53E49439825). Safe to embed in tests. */
const EXPECTED_PUBKEY =
  "dW50cnVzdGVkIGNvbW1lbnQ6IG1pbmlzaWduIHB1YmxpYyBrZXk6IEE2NjZFNTNFNDk0Mzk4MjUKUldRbG1FTkpQdVZtcGdaZ1hueW9xM0RWb3lDbm5EUTBXVjhJUlBpOUE2VC8yMmpNRitabUhndUUK";

const EXPECTED_ENDPOINT =
  "https://github.com/Sankalpa-KMCP/PortPurge-System/releases/latest/download/latest.json";

const EXPECTED_PUBLIC_HEADER =
  "untrusted comment: minisign public key: A666E53E49439825";

const RETIRED_PUBLIC_KEY_ID = "A051C5C7747123BA";

function decodePubkeyComment(pubkey: string): string {
  const decoded = Buffer.from(pubkey.trim(), "base64").toString("utf8");
  return decoded.split(/\r?\n/)[0]?.trim() ?? "";
}

describe("updater configuration safety", () => {
  const conf = JSON.parse(readFileSync(TAURI_CONF, "utf8")) as {
    bundle: { createUpdaterArtifacts: boolean };
    plugins: {
      updater: { pubkey: string; endpoints: string[] };
    };
  };

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
    const raw = readFileSync(TAURI_CONF, "utf8");
    expect(raw).not.toContain(RETIRED_PUBLIC_KEY_ID);
    const header = decodePubkeyComment(conf.plugins.updater.pubkey);
    expect(header).not.toContain(RETIRED_PUBLIC_KEY_ID);
  });
});

describe("updater restoration is not gated by a frontend kill-switch", () => {
  it("does not ship updaterContainment.ts", () => {
    expect(existsSync(join(ROOT, "src/hooks/updaterContainment.ts"))).toBe(false);
  });

  it("does not reference UPDATER_ENABLED in the updater hook", () => {
    const hook = readFileSync(join(ROOT, "src/hooks/useAppUpdater.ts"), "utf8");
    expect(hook).not.toMatch(/UPDATER_ENABLED/);
    expect(hook).not.toMatch(/updaterContainment/);
  });
});
