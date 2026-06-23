import type { PackageReport, RiskSignal, UserDecision, Verdict } from "./types";

const DAY_MS = 24 * 60 * 60 * 1000;

export function collectRiskSignals(report: Omit<PackageReport, "riskSignals" | "verdict">): RiskSignal[] {
  const signals: RiskSignal[] = [];

  if (!report.tarball.url) {
    signals.push({ id: "missing-tarball", severity: "block", message: "Version metadata does not include a tarball URL." });
  }

  if (!report.files.packageJsonFound) {
    signals.push({ id: "missing-package-json", severity: "block", message: "Tarball does not contain package/package.json." });
  }

  if (!report.tarball.integrity) {
    signals.push({ id: "missing-integrity", severity: "warn", message: "Version metadata lacks a sha512 integrity field." });
  }

  if (report.scripts.hasLifecycle) {
    signals.push({
      id: "lifecycle-scripts",
      severity: "warn",
      message: `Lifecycle scripts found: ${Object.keys(report.scripts.lifecycle).join(", ")}.`
    });
  }

  if ((report.publish.publishAgeDays ?? Infinity) < 7) {
    signals.push({ id: "fresh-publish", severity: "warn", message: "This version was published less than 7 days ago." });
  }

  if (report.dependencies.totalRuntime >= 20) {
    signals.push({ id: "many-runtime-deps", severity: "warn", message: `Runtime dependency surface is high (${report.dependencies.totalRuntime}).` });
  }

  if (report.tarball.bytes > 5 * 1024 * 1024 || report.files.unpackedBytes > 20 * 1024 * 1024) {
    signals.push({ id: "large-package", severity: "warn", message: "Package tarball or unpacked contents are large for a CLI dependency." });
  }

  if (looksTyposquatty(report.identity.name)) {
    signals.push({ id: "name-pattern", severity: "warn", message: "Package name contains a pattern often used in typosquats." });
  }

  if (report.maintainers.length === 0) {
    signals.push({ id: "no-maintainers", severity: "warn", message: "No maintainers are listed in metadata." });
  }

  return signals;
}

export function makeVerdict(signals: RiskSignal[], decision?: UserDecision): Verdict {
  const blockers = signals.filter((signal) => signal.severity === "block").map((signal) => signal.message);
  const warnings = signals.filter((signal) => signal.severity === "warn").map((signal) => signal.message);
  let score = 100 - warnings.length * 10 - blockers.length * 40;
  score = Math.max(0, Math.min(100, score));

  if (decision?.status === "deny") {
    return {
      status: "deny",
      score: 0,
      reasons: [`User denied this package${decision.reason ? `: ${decision.reason}` : "."}`],
      blockers: ["User-saved deny decision."],
      generatedAt: new Date().toISOString()
    };
  }

  if (blockers.length > 0) {
    return {
      status: "deny",
      score,
      reasons: [...blockers, ...warnings],
      blockers,
      generatedAt: new Date().toISOString()
    };
  }

  if (decision?.status === "allow") {
    return {
      status: "allow",
      score,
      reasons: [`User allowed this package${decision.reason ? `: ${decision.reason}` : "."}`, ...warnings],
      blockers: [],
      generatedAt: new Date().toISOString()
    };
  }

  if (warnings.length > 0) {
    return {
      status: "warn",
      score,
      reasons: warnings,
      blockers: [],
      generatedAt: new Date().toISOString()
    };
  }

  return {
    status: "warn",
    score,
    reasons: ["No blockers found. Run allow to record explicit approval before install/exec."],
    blockers: [],
    generatedAt: new Date().toISOString()
  };
}

export function daysSince(iso: string | undefined): number | undefined {
  if (!iso) return undefined;
  const time = Date.parse(iso);
  if (Number.isNaN(time)) return undefined;
  return Math.max(0, Math.floor((Date.now() - time) / DAY_MS));
}

function looksTyposquatty(name: string): boolean {
  return /-{2,}|_{1,}|\.js$|\d{3,}/.test(name);
}
