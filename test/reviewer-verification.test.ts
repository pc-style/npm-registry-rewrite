import { createHash } from "node:crypto";
import { gzipSync } from "node:zlib";
import { expect, test } from "bun:test";
import tar from "tar-stream";
import { RegistryClient } from "../src/registry-client";
import { reviewPackage } from "../src/reviewer";
import type { PackageReport, RegistryMetadata, RegistryStore, UserDecision } from "../src/types";

test("verifies downloaded tarball bytes against dist.integrity", async () => {
  const bytes = await fixtureTarball();
  const integrity = `sha512-${createHash("sha512").update(bytes).digest("base64")}`;
  const report = await reviewFixture(bytes, { integrity, shasum: "bad-shasum" });

  expect(report.tarball.verification).toMatchObject({
    status: "verified",
    algorithm: "sha512",
    source: "integrity"
  });
  expect(report.riskSignals.map((signal) => signal.id)).not.toContain("tarball-verification-failed");
});

test("falls back to dist.shasum when integrity is absent", async () => {
  const bytes = await fixtureTarball();
  const shasum = createHash("sha1").update(bytes).digest("hex");
  const report = await reviewFixture(bytes, { shasum });

  expect(report.tarball.verification).toMatchObject({
    status: "verified",
    algorithm: "sha1",
    source: "shasum"
  });
  expect(report.riskSignals.map((signal) => signal.id)).toContain("missing-integrity");
  expect(report.verdict.status).toBe("warn");
});

test("blocks reports when tarball verification fails", async () => {
  const bytes = await fixtureTarball();
  const report = await reviewFixture(bytes, { integrity: "sha512-not-the-downloaded-bytes" });

  expect(report.tarball.verification?.status).toBe("failed");
  expect(report.riskSignals).toContainEqual(
    expect.objectContaining({ id: "tarball-verification-failed", severity: "block" })
  );
  expect(report.verdict.status).toBe("deny");
});

async function reviewFixture(bytes: Uint8Array, dist: { integrity?: string; shasum?: string }): Promise<PackageReport> {
  const client = new FixtureClient(bytes, dist);
  return reviewPackage("fixture@1.0.0", { client, store: new MemoryStore(), refresh: true });
}

class FixtureClient extends RegistryClient {
  constructor(
    private readonly bytes: Uint8Array,
    private readonly dist: { integrity?: string; shasum?: string }
  ) {
    super("https://registry.example.test");
  }

  async fetchMetadata(): Promise<RegistryMetadata> {
    return {
      name: "fixture",
      "dist-tags": { latest: "1.0.0" },
      time: { created: "2020-01-01T00:00:00.000Z", modified: "2020-01-01T00:00:00.000Z", "1.0.0": "2020-01-01T00:00:00.000Z" },
      maintainers: [{ name: "maintainer" }],
      versions: {
        "1.0.0": {
          name: "fixture",
          version: "1.0.0",
          dist: {
            tarball: "https://registry.example.test/fixture/-/fixture-1.0.0.tgz",
            ...this.dist
          }
        }
      }
    };
  }

  async fetchTarball(): Promise<Uint8Array> {
    return this.bytes;
  }
}

class MemoryStore implements RegistryStore {
  private report?: PackageReport;

  async getReport(): Promise<PackageReport | undefined> {
    return this.report;
  }

  async saveReport(report: PackageReport): Promise<void> {
    this.report = report;
  }

  async getDecision(): Promise<UserDecision | undefined> {
    return undefined;
  }

  async saveDecision(): Promise<void> {}

  async listDecisions(): Promise<Array<{ name: string; version: string; decision: UserDecision }>> {
    return [];
  }
}

async function fixtureTarball(): Promise<Uint8Array> {
  const pack = tar.pack();
  pack.entry(
    { name: "package/package.json" },
    JSON.stringify({
      name: "fixture",
      version: "1.0.0"
    })
  );
  pack.finalize();

  const chunks: Buffer[] = [];
  for await (const chunk of pack) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return gzipSync(Buffer.concat(chunks));
}
