import type { PackageReport, UserDecision } from "./types";

export function formatReport(report: PackageReport): string {
  const lines: string[] = [];
  lines.push(`${statusIcon(report.verdict.status)} ${report.identity.name}@${report.identity.version} — ${report.verdict.status.toUpperCase()} (${report.verdict.score}/100)`);
  if (report.identity.description) lines.push(report.identity.description);
  lines.push("");
  lines.push(`Identity: ${report.identity.license ?? "unknown license"}${report.identity.repository ? `, ${report.identity.repository}` : ""}`);
  lines.push(`Maintainers: ${report.maintainers.length ? report.maintainers.map((maintainer) => maintainer.name).join(", ") : "none listed"}`);
  lines.push(`Published: ${report.publish.versionPublishedAt ?? "unknown"}${report.publish.publishAgeDays !== undefined ? ` (${report.publish.publishAgeDays} days ago)` : ""}`);
  lines.push(`Registry changed: created ${report.publish.created ?? "unknown"}, modified ${report.publish.modified ?? "unknown"}`);
  lines.push(`Tarball: ${formatBytes(report.tarball.bytes)}${report.tarball.integrity ? ", integrity present" : ", missing integrity"}`);
  lines.push(`Files: ${report.files.fileCount} files, ${formatBytes(report.files.unpackedBytes)} unpacked`);
  if (report.files.notablePaths.length) lines.push(`Notable paths: ${report.files.notablePaths.slice(0, 8).join(", ")}`);
  lines.push(`Dependencies: ${report.dependencies.totalRuntime} runtime, ${report.dependencies.totalDeclared} declared`);
  lines.push(`Scripts: ${Object.keys(report.scripts.all).length ? Object.keys(report.scripts.all).join(", ") : "none"}`);

  if (report.riskSignals.length) {
    lines.push("");
    lines.push("Risk signals:");
    for (const signal of report.riskSignals) lines.push(`- [${signal.severity}] ${signal.message}`);
  }

  lines.push("");
  lines.push("Verdict reasons:");
  for (const reason of report.verdict.reasons) lines.push(`- ${reason}`);
  lines.push("");
  lines.push(`Next: registry-trust allow ${report.identity.name}@${report.identity.version} --reason "reviewed"`);
  return lines.join("\n");
}

export function formatDecision(name: string, version: string, decision: UserDecision): string {
  return `${decision.status.toUpperCase()} saved for ${name}@${version}${decision.reason ? `: ${decision.reason}` : ""}`;
}

function statusIcon(status: PackageReport["verdict"]["status"]): string {
  if (status === "allow") return "ALLOW";
  if (status === "deny") return "DENY";
  return "WARN";
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KiB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MiB`;
}
