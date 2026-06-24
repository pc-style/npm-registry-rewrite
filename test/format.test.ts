import { expect, test } from "bun:test";
import { formatCheck, formatDecision, formatReport } from "../src/format";
import type { PackageReport } from "../src/types";

test("formats plain reports without ansi by default in non-tty runs", () => {
  const output = formatReport(report(), { color: false });
  expect(output).toContain("WARN");
  expect(output).toContain("Package");
  expect(output).toContain("Artifact");
  expect(output).toContain("Tarball bytes: verified via sha512/integrity");
  expect(output).not.toContain("\x1b[");
});

test("adds ansi color when requested", () => {
  const output = formatReport(report(), { color: true });
  expect(output).toContain("\x1b[");
  expect(output).toContain("WARN");
});

test("formats short decision and check lines consistently", () => {
  const decision = formatDecision("is-odd", "3.0.1", { status: "allow", reason: "reviewed", decidedAt: "2026-01-01T00:00:00.000Z" }, { color: false });
  const check = formatCheck(report(), { color: false });
  expect(decision).toBe("[ALLOW] saved for is-odd@3.0.1: reviewed");
  expect(check).toBe("is-odd@3.0.1 [WARN] (72/100)");
});

test("formats failed tarball byte verification", () => {
  const fixture = report();
  fixture.tarball.verification = {
    status: "failed",
    algorithm: "sha512",
    source: "integrity",
    message: "integrity mismatch"
  };
  const output = formatReport(fixture, { color: false });
  expect(output).toContain("Tarball bytes: failed via sha512/integrity (integrity mismatch)");
});

test("formats missing tarball verification as unverified", () => {
  const fixture = report() as PackageReport & { tarball: Omit<PackageReport["tarball"], "verification"> };
  delete (fixture.tarball as { verification?: PackageReport["tarball"]["verification"] }).verification;
  const output = formatReport(fixture as PackageReport, { color: false });
  expect(output).toContain("Tarball bytes: unverified (no verification status reported)");
});

test("formats suspicious packed-content findings when structured fields exist", () => {
  const fixture = report() as PackageReport & {
    files: PackageReport["files"] & {
      suspiciousPackedContent: Array<{ path: string; kind: string; severity: string; message: string }>;
    };
  };
  fixture.files.suspiciousPackedContent = [
    {
      path: "package/bin/postinstall.js",
      kind: "lifecycle-script",
      severity: "warn",
      message: "packed lifecycle script"
    }
  ];
  const output = formatReport(fixture, { color: false });
  expect(output).toContain("Packed content: package/bin/postinstall.js: packed lifecycle script");
});

test("formats suspicious content summaries when model fields exist", () => {
  const fixture = report();
  fixture.files.suspiciousContent.installScripts = {
    count: 1,
    bytes: 512,
    paths: ["package/scripts/install.js"]
  };
  const output = formatReport(fixture, { color: false });
  expect(output).toContain("Packed content: installScripts: 1 finding, 512 B (package/scripts/install.js)");
});

function report(): PackageReport {
  return {
    schemaVersion: 1,
    spec: { raw: "is-odd", name: "is-odd", registryUrl: "https://registry.npmjs.org", resolvedVersion: "3.0.1" },
    identity: {
      name: "is-odd",
      version: "3.0.1",
      description: "Returns true if the given number is odd.",
      license: "MIT",
      repository: "https://github.com/i-voted-for-trump/is-odd"
    },
    maintainers: [{ name: "maintainer" }],
    publish: {
      created: "2015-01-01T00:00:00.000Z",
      modified: "2025-01-01T00:00:00.000Z",
      versionPublishedAt: "2020-01-01T00:00:00.000Z",
      publishAgeDays: 2000
    },
    tarball: {
      url: "https://registry.npmjs.org/is-odd/-/is-odd-3.0.1.tgz",
      bytes: 2774,
      integrity: "sha512-test",
      verification: { status: "verified", algorithm: "sha512", source: "integrity", message: "Tarball bytes match npm dist.integrity." }
    },
    scripts: { hasLifecycle: false, lifecycle: {}, all: {} },
    dependencies: { dependencies: 1, devDependencies: 0, peerDependencies: 0, optionalDependencies: 0, totalRuntime: 1, totalDeclared: 1, samples: ["is-number"] },
    files: {
      fileCount: 4,
      unpackedBytes: 4096,
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
    riskSignals: [{ id: "unapproved", severity: "warn", message: "Package has not been approved yet." }],
    verdict: { status: "warn", score: 72, reasons: ["Run allow after review."], blockers: [], generatedAt: "2026-01-01T00:00:00.000Z" },
    generatedAt: "2026-01-01T00:00:00.000Z"
  };
}
