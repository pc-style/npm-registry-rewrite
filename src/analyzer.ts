import { createGunzip } from "node:zlib";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import tar from "tar-stream";
import type { DependencySummary, FileSummary, ScriptSummary } from "./types";

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
    notablePaths: []
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
