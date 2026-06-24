import type { PackageReport, UserDecision } from "./types";
import { createAnsi } from "./ansi";

type FormatOptions = {
  color?: boolean | "auto";
};

export function formatReport(report: PackageReport, options: FormatOptions = {}): string {
  const ansi = createAnsi(options.color);
  const identity = `${report.identity.name}@${report.identity.version}`;
  const lines: string[] = [];
  lines.push(`${statusBadge(report.verdict.status, ansi)} ${ansi.bold(identity)} ${ansi.dim("—")} ${statusText(report.verdict.status, ansi)} ${scoreText(report.verdict.score, ansi)}`);
  if (report.identity.description) lines.push(report.identity.description);
  lines.push("");
  lines.push(sectionTitle("Package", ansi));
  lines.push(detail("Identity", `${report.identity.license ?? "unknown license"}${report.identity.repository ? `, ${report.identity.repository}` : ""}`, ansi));
  lines.push(detail("Maintainers", report.maintainers.length ? report.maintainers.map((maintainer) => maintainer.name).join(", ") : "none listed", ansi));
  lines.push(detail("Published", `${report.publish.versionPublishedAt ?? "unknown"}${report.publish.publishAgeDays !== undefined ? ` (${report.publish.publishAgeDays} days ago)` : ""}`, ansi));
  lines.push(detail("Registry", `created ${report.publish.created ?? "unknown"}, modified ${report.publish.modified ?? "unknown"}`, ansi));
  lines.push("");
  lines.push(sectionTitle("Artifact", ansi));
  lines.push(detail("Tarball", `${formatBytes(report.tarball.bytes)}${report.tarball.integrity ? ", integrity present" : ", missing integrity"}`, ansi));
  lines.push(detail("Files", `${report.files.fileCount} files, ${formatBytes(report.files.unpackedBytes)} unpacked`, ansi));
  if (report.files.notablePaths.length) lines.push(detail("Notable paths", report.files.notablePaths.slice(0, 8).join(", "), ansi));
  lines.push(detail("Dependencies", `${report.dependencies.totalRuntime} runtime, ${report.dependencies.totalDeclared} declared`, ansi));
  lines.push(detail("Scripts", Object.keys(report.scripts.all).length ? Object.keys(report.scripts.all).join(", ") : "none", ansi));

  if (report.riskSignals.length) {
    lines.push("");
    lines.push(sectionTitle("Risk signals", ansi));
    for (const signal of report.riskSignals) lines.push(`  ${severityBadge(signal.severity, ansi)} ${signal.message}`);
  }

  lines.push("");
  lines.push(sectionTitle("Verdict reasons", ansi));
  for (const reason of report.verdict.reasons) lines.push(`  - ${reason}`);
  lines.push("");
  lines.push(`${ansi.dim("Next")} ${ansi.cyan(`registry-trust allow ${identity} --reason "reviewed"`)}`);
  return lines.join("\n");
}

export function formatDecision(name: string, version: string, decision: UserDecision, options: FormatOptions = {}): string {
  const ansi = createAnsi(options.color);
  const identity = ansi.bold(`${name}@${version}`);
  return `${statusBadge(decision.status, ansi)} saved for ${identity}${decision.reason ? `${ansi.dim(":")} ${decision.reason}` : ""}`;
}

export function formatCheck(report: PackageReport, options: FormatOptions = {}): string {
  const ansi = createAnsi(options.color);
  return `${ansi.bold(`${report.identity.name}@${report.identity.version}`)} ${statusBadge(report.verdict.status, ansi)} ${scoreText(report.verdict.score, ansi)}`;
}

function sectionTitle(title: string, ansi: ReturnType<typeof createAnsi>): string {
  return ansi.bold(ansi.gray(title));
}

function detail(label: string, value: string, ansi: ReturnType<typeof createAnsi>): string {
  return `  ${ansi.dim(`${label}:`)} ${value}`;
}

function statusBadge(status: PackageReport["verdict"]["status"] | UserDecision["status"], ansi: ReturnType<typeof createAnsi>): string {
  const text = `[${status.toUpperCase()}]`;
  if (status === "allow") return ansi.green(text);
  if (status === "deny") return ansi.red(text);
  return ansi.yellow(text);
}

function statusText(status: PackageReport["verdict"]["status"], ansi: ReturnType<typeof createAnsi>): string {
  if (status === "allow") return ansi.green("ALLOW");
  if (status === "deny") return ansi.red("DENY");
  return ansi.yellow("WARN");
}

function scoreText(score: number, ansi: ReturnType<typeof createAnsi>): string {
  const text = `(${score}/100)`;
  if (score >= 80) return ansi.green(text);
  if (score >= 50) return ansi.yellow(text);
  return ansi.red(text);
}

function severityBadge(severity: PackageReport["riskSignals"][number]["severity"], ansi: ReturnType<typeof createAnsi>): string {
  const text = `[${severity.toUpperCase()}]`;
  if (severity === "block") return ansi.red(text);
  if (severity === "warn") return ansi.yellow(text);
  return ansi.cyan(text);
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KiB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MiB`;
}
