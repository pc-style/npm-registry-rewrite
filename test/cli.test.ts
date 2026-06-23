import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { expect, test } from "bun:test";
import { main } from "../src/cli";

test("help exits successfully", async () => {
  await expect(main(["--help"])).resolves.toBe(0);
});

test("allow saves exact decisions in configured store", async () => {
  const root = await mkdtemp(join(tmpdir(), "registry-trust-cli-"));
  const previous = process.env.REGISTRY_TRUST_HOME;
  process.env.REGISTRY_TRUST_HOME = root;
  try {
    await expect(main(["allow", "is-odd@3.0.1", "--reason", "test"])).resolves.toBe(0);
    const decision = await Bun.file(join(root, "decisions", "aXMtb2RkQDMuMC4x.json")).json();
    expect(decision).toMatchObject({ status: "allow", reason: "test" });
  } finally {
    if (previous === undefined) delete process.env.REGISTRY_TRUST_HOME;
    else process.env.REGISTRY_TRUST_HOME = previous;
    await rm(root, { recursive: true, force: true });
  }
});
