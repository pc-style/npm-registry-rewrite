import { createGunzip } from "node:zlib";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import tar from "tar-stream";
import type { DependencySummary, FileSummary, ScriptSummary, SuspiciousContentFinding } from "./types";

const LIFECYCLE_SCRIPTS = new Set([
  "preinstall",
  "install",
  "postinstall",
  "prepack",
  "prepare",
  "postpack",
  "prepublish",
  "prepublishOnly"
]);

const LARGE_FILE_BYTES = 1024 * 1024;
const FINDING_PATH_LIMIT = 8;
const NATIVE_BINARY_EXTENSIONS = new Set([".node", ".so", ".dylib", ".dll", ".exe"]);
const SHELL_SCRIPT_EXTENSIONS = new Set([".sh", ".bash", ".zsh", ".fish", ".ps1", ".bat", ".cmd"]);
const INSTALL_SCRIPT_BASENAMES = new Set([
  "preinstall",
  "install",
  "postinstall",
  "prepack",
  "prepare",
  "postpack",
  "prepublish",
  "prepublishonly"
]);
const SENSITIVE_PATH_PATTERN = /(^|[._/-])(credential|credentials|token|tokens|secret|secrets|ssh|env|private[-_]?key|id_rsa|id_dsa|id_ecdsa|id_ed25519)([._/-]|$)/i;

export type TarballAnalysis = {
  scripts: ScriptSummary;
  dependencies: DependencySummary;
  files: FileSummary;
};

export async function analyzeTarball(bytes: Uint8Array): Promise<TarballAnalysis> {
  const extract = tar.extract();
  const files: FileSummary = {
    fileCount: 0,
    unpackedBytes: 0,
    packageJsonFound: false,
    notablePaths: [],
    suspiciousContent: emptySuspiciousContentSummary()
  };
  let packageJson: Record<string, unknown> | undefined;

  const readEntries = (async () => {
    for await (const entry of extract) {
      const name = entry.header.name;
      const size = Number(entry.header.size ?? 0);
      if (entry.header.type === "file") {
        files.fileCount += 1;
        files.unpackedBytes += size;
        collectNotablePath(files, name);
        collectSuspiciousContent(files, name, size);
      }

      if (name === "package/package.json") {
        files.packageJsonFound = true;
        const text = await streamToText(entry);
        packageJson = JSON.parse(text) as Record<string, unknown>;
      } else {
        entry.resume();
      }
    }
  })();

  await pipeline(Readable.from(Buffer.from(bytes)), createGunzip(), extract);
  await readEntries;

  if (!packageJson) {
    return {
      scripts: summarizeScripts(undefined),
      dependencies: summarizeDependencies(undefined),
      files
    };
  }

  return {
    scripts: summarizeScripts(asRecord(packageJson.scripts)),
    dependencies: summarizeDependencies(packageJson),
    files
  };
}

function emptySuspiciousContentSummary(): FileSummary["suspiciousContent"] {
  return {
    nativeBinaries: emptyFinding(),
    wasmFiles: emptyFinding(),
    installScripts: emptyFinding(),
    shellScripts: emptyFinding(),
    largeFiles: emptyFinding(),
    sensitivePaths: emptyFinding()
  };
}

function emptyFinding(): SuspiciousContentFinding {
  return { count: 0, bytes: 0, paths: [] };
}

function collectNotablePath(files: FileSummary, name: string): void {
  const lower = name.toLowerCase();
  if (
    lower === "package/package.json" ||
    lower.includes("/bin/") ||
    lower.endsWith(".node") ||
    lower.endsWith(".wasm") ||
    lower.endsWith("install.js") ||
    lower.endsWith("postinstall.js")
  ) {
    files.notablePaths.push(name);
  }
}

function collectSuspiciousContent(files: FileSummary, name: string, size: number): void {
  const suspiciousContent = files.suspiciousContent;
  if (!suspiciousContent) return;
  const normalized = name.replace(/\\/g, "/");
  const lower = normalized.toLowerCase();
  const basename = lower.slice(lower.lastIndexOf("/") + 1);
  const extension = basename.includes(".") ? basename.slice(basename.lastIndexOf(".")) : "";
  const stem = extension ? basename.slice(0, -extension.length) : basename;

  if (NATIVE_BINARY_EXTENSIONS.has(extension)) {
    addFinding(suspiciousContent.nativeBinaries, name, size);
  }
  if (extension === ".wasm") {
    addFinding(suspiciousContent.wasmFiles, name, size);
  }
  if (INSTALL_SCRIPT_BASENAMES.has(stem) || basename === "install.js" || basename === "postinstall.js") {
    addFinding(suspiciousContent.installScripts, name, size);
  }
  if (SHELL_SCRIPT_EXTENSIONS.has(extension)) {
    addFinding(suspiciousContent.shellScripts, name, size);
  }
  if (size >= LARGE_FILE_BYTES) {
    addFinding(suspiciousContent.largeFiles, name, size);
  }
  if (SENSITIVE_PATH_PATTERN.test(lower)) {
    addFinding(suspiciousContent.sensitivePaths, name, size);
  }
}

function addFinding(finding: SuspiciousContentFinding, path: string, size: number): void {
  finding.count += 1;
  finding.bytes += size;
  if (finding.paths.length < FINDING_PATH_LIMIT) finding.paths.push(path);
}

function summarizeScripts(scripts: Record<string, unknown> | undefined): ScriptSummary {
  const all: Record<string, string> = {};
  const lifecycle: Record<string, string> = {};
  for (const [name, command] of Object.entries(scripts ?? {})) {
    if (typeof command !== "string") continue;
    all[name] = command;
    if (LIFECYCLE_SCRIPTS.has(name)) lifecycle[name] = command;
  }
  return { all, lifecycle, hasLifecycle: Object.keys(lifecycle).length > 0 };
}

function summarizeDependencies(packageJson: Record<string, unknown> | undefined): DependencySummary {
  const dependencies = asRecord(packageJson?.dependencies) ?? {};
  const devDependencies = asRecord(packageJson?.devDependencies) ?? {};
  const peerDependencies = asRecord(packageJson?.peerDependencies) ?? {};
  const optionalDependencies = asRecord(packageJson?.optionalDependencies) ?? {};
  const runtimeNames = Object.keys(dependencies);
  const declaredNames = new Set([
    ...runtimeNames,
    ...Object.keys(devDependencies),
    ...Object.keys(peerDependencies),
    ...Object.keys(optionalDependencies)
  ]);

  return {
    dependencies: runtimeNames.length,
    devDependencies: Object.keys(devDependencies).length,
    peerDependencies: Object.keys(peerDependencies).length,
    optionalDependencies: Object.keys(optionalDependencies).length,
    totalRuntime: runtimeNames.length + Object.keys(optionalDependencies).length,
    totalDeclared: declaredNames.size,
    samples: [...declaredNames].sort().slice(0, 8)
  };
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  return value as Record<string, unknown>;
}

async function streamToText(stream: NodeJS.ReadableStream): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of stream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks).toString("utf8");
}
