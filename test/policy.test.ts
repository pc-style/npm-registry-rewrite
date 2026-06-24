import { expect, test } from "bun:test";
import { collectRiskSignals, makeVerdict } from "../src/policy";
import type { PackageReport } from "../src/types";

test("warns until a package is explicitly allowed", () => {
  const verdict = makeVerdict([], undefined);
  expect(verdict.status).toBe("warn");
  expect(verdict.reasons[0]).toContain("Run allow");
});

test("saved allow upgrades clean reports to allow", () => {
  const verdict = makeVerdict([], { status: "allow", reason: "reviewed", decidedAt: new Date().toISOString() });
  expect(verdict.status).toBe("allow");
});

test("saved deny blocks regardless of signals", () => {
  const verdict = makeVerdict([], { status: "deny", reason: "bad", decidedAt: new Date().toISOString() });
  expect(verdict.status).toBe("deny");
  expect(verdict.blockers).toContain("User-saved deny decision.");
});

test("collects lifecycle and missing package json signals", () => {
  const base = baseReport();
  base.scripts = { hasLifecycle: true, lifecycle: { postinstall: "node postinstall.js" }, all: { postinstall: "node postinstall.js" } };
  base.files.packageJsonFound = false;
  const signals = collectRiskSignals(base);
  expect(signals.map((signal) => signal.id)).toContain("lifecycle-scripts");
  expect(signals.map((signal) => signal.id)).toContain("missing-package-json");
});

test("collects suspicious packed-content signals with examples", () => {
  const base = baseReport();
  base.files.suspiciousContent!.nativeBinaries = { count: 1, bytes: 123, paths: ["package/build/addon.node"] };
  base.files.suspiciousContent!.wasmFiles = { count: 1, bytes: 456, paths: ["package/dist/parser.wasm"] };
  base.files.suspiciousContent!.installScripts = { count: 1, bytes: 12, paths: ["package/scripts/postinstall.sh"] };
  base.files.suspiciousContent!.shellScripts = { count: 1, bytes: 12, paths: ["package/scripts/postinstall.sh"] };
  base.files.suspiciousContent!.largeFiles = { count: 1, bytes: 1024 * 1024, paths: ["package/assets/model.bin"] };
  base.files.suspiciousContent!.sensitivePaths = { count: 1, bytes: 9, paths: ["package/.env"] };

  const signals = collectRiskSignals(base);
  expect(signals.map((signal) => signal.id)).toContain("native-binaries");
  expect(signals.map((signal) => signal.id)).toContain("wasm-files");
  expect(signals.map((signal) => signal.id)).toContain("packed-install-scripts");
  expect(signals.map((signal) => signal.id)).toContain("shell-scripts");
  expect(signals.map((signal) => signal.id)).toContain("large-packed-files");
  expect(signals.map((signal) => signal.id)).toContain("sensitive-paths");
  expect(signals.find((signal) => signal.id === "native-binaries")?.message).toContain("package/build/addon.node");
});

function baseReport(): Omit<PackageReport, "riskSignals" | "verdict"> {
  return {
    schemaVersion: 1,
    spec: { raw: "safe", name: "safe", registryUrl: "https://registry.npmjs.org", resolvedVersion: "1.0.0" },
    identity: { name: "safe", version: "1.0.0" },
    maintainers: [{ name: "maintainer" }],
    publish: { versionPublishedAt: "2020-01-01T00:00:00.000Z", publishAgeDays: 1000 },
    tarball: {
      url: "https://example.com/safe.tgz",
      bytes: 100,
      integrity: "sha512-test",
      verification: { status: "verified", algorithm: "sha512", source: "integrity", message: "Tarball bytes match npm dist.integrity." }
    },
    scripts: { hasLifecycle: false, lifecycle: {}, all: {} },
    dependencies: { dependencies: 0, devDependencies: 0, peerDependencies: 0, optionalDependencies: 0, totalRuntime: 0, totalDeclared: 0, samples: [] },
    files: {
      fileCount: 1,
      unpackedBytes: 100,
      packageJsonFound: true,
      notablePaths: ["package/package.json"],
      suspiciousContent: {
        nativeBinaries: { count: 0, bytes: 0, paths: [] },
        wasmFiles: { count: 0, bytes: 0, paths: [] },
        installScripts: { count: 0, bytes: 0, paths: [] },
        shellScripts: { count: 0, bytes: 0, paths: [] },
        largeFiles: { count: 0, bytes: 0, paths: [] },
        sensitivePaths: { count: 0, bytes: 0, paths: [] }
      }
    },
    generatedAt: new Date().toISOString()
  };
}
