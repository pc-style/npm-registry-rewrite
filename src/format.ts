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
  lines.push(detail("Tarball bytes", formatTarballVerification(report, ansi), ansi));
  lines.push(detail("Files", `${report.files.fileCount} files, ${formatBytes(report.files.unpackedBytes)} unpacked`, ansi));
  if (report.files.notablePaths.length) lines.push(detail("Notable paths", report.files.notablePaths.slice(0, 8).join(", "), ansi));
  for (const line of formatSuspiciousPackedContent(report)) lines.push(detail("Packed content", line, ansi));
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

function formatTarballVerification(report: PackageReport, ansi: ReturnType<typeof createAnsi>): string {
  const verification = readRecord(readRecord(report.tarball)?.verification);
  const status = verification?.status;
  const source = typeof verification?.source === "string" ? verification.source : undefined;
  const algorithm = typeof verification?.algorithm === "string" ? verification.algorithm : undefined;
  const message = typeof verification?.message === "string" ? verification.message : undefined;
  const suffix = [algorithm, source].filter(Boolean).join("/");
  const detailText = suffix ? ` via ${suffix}` : "";

  if (status === "verified") return `${ansi.green("verified")}${detailText}${message ? ` (${message})` : ""}`;
  if (status === "failed") return `${ansi.red("failed")}${detailText}${message ? ` (${message})` : ""}`;
  if (status === "unverified") return `${ansi.yellow("unverified")}${detailText}${message ? ` (${message})` : ""}`;
  return `${ansi.yellow("unverified")} (no verification status reported)`;
}

function formatSuspiciousPackedContent(report: PackageReport): string[] {
  const files = readRecord(report.files);
  const suspiciousContent = readRecord(files?.suspiciousContent);
  const summaryLines = suspiciousContent
    ? Object.entries(suspiciousContent).flatMap(([kind, value]) => formatSuspiciousContentSummary(kind, value))
    : [];
  const findings = firstArray(
    files?.suspiciousPackedContent,
    files?.suspiciousPackedContents,
    files?.suspiciousFindings,
    files?.packedContentFindings
  );
  if (!findings?.length) return summaryLines;

  return [...summaryLines, ...findings.slice(0, 8).map((finding) => {
    if (typeof finding === "string") return finding;
    const record = readRecord(finding);
    if (!record) return String(finding);
    const path = stringValue(record.path) ?? stringValue(record.file) ?? stringValue(record.name);
    const kind = stringValue(record.kind) ?? stringValue(record.type) ?? stringValue(record.reason);
    const severity = stringValue(record.severity);
    const message = stringValue(record.message) ?? stringValue(record.description);
    const label = [severity, kind].filter(Boolean).join(" ");
    const prefix = path ? `${path}: ` : "";
    const body = message ?? label;
    return body ? `${prefix}${body}` : JSON.stringify(record);
  })];
}

function formatSuspiciousContentSummary(kind: string, value: unknown): string[] {
  const record = readRecord(value);
  const count = typeof record?.count === "number" ? record.count : 0;
  if (!record || count <= 0) return [];
  const bytes = typeof record.bytes === "number" ? `, ${formatBytes(record.bytes)}` : "";
  const paths = Array.isArray(record.paths) ? record.paths.filter((path): path is string => typeof path === "string").slice(0, 4) : [];
  return [`${kind}: ${count} finding${count === 1 ? "" : "s"}${bytes}${paths.length ? ` (${paths.join(", ")})` : ""}`];
}

function firstArray(...values: unknown[]): unknown[] | undefined {
  return values.find((value): value is unknown[] => Array.isArray(value));
}

function readRecord(value: unknown): Record<string, unknown> | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  return value as Record<string, unknown>;
}

function stringValue(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KiB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MiB`;
}
