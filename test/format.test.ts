import { expect, test } from "bun:test";
import { formatCheck, formatDecision, formatReport } from "../src/format";
import type { PackageReport } from "../src/types";

test("formats plain reports without ansi by default in non-tty runs", () => {
  const output = formatReport(report(), { color: false });
  expect(output).toContain("WARN");
  expect(output).toContain("Package");
  expect(output).toContain("Artifact");
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
    tarball: { url: "https://registry.npmjs.org/is-odd/-/is-odd-3.0.1.tgz", bytes: 2774, integrity: "sha512-test" },
    scripts: { hasLifecycle: false, lifecycle: {}, all: {} },
    dependencies: { dependencies: 1, devDependencies: 0, peerDependencies: 0, optionalDependencies: 0, totalRuntime: 1, totalDeclared: 1, samples: ["is-number"] },
    files: { fileCount: 4, unpackedBytes: 4096, packageJsonFound: true, notablePaths: ["package/package.json"] },
    riskSignals: [{ id: "unapproved", severity: "warn", message: "Package has not been approved yet." }],
    verdict: { status: "warn", score: 72, reasons: ["Run allow after review."], blockers: [], generatedAt: "2026-01-01T00:00:00.000Z" },
    generatedAt: "2026-01-01T00:00:00.000Z"
  };
}
