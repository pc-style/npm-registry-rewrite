import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { expect, test } from "bun:test";
import { LocalRegistryStore } from "../src/store";

test("stores and reads decisions", async () => {
  const root = await mkdtemp(join(tmpdir(), "registry-trust-"));
  try {
    const store = new LocalRegistryStore(root);
    await store.saveDecision("@scope/pkg", "1.0.0", { status: "allow", reason: "ok", decidedAt: "2026-01-01T00:00:00.000Z" });
    await expect(store.getDecision("@scope/pkg", "1.0.0")).resolves.toMatchObject({ status: "allow", reason: "ok" });
    await expect(store.listDecisions()).resolves.toHaveLength(1);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
