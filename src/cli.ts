#!/usr/bin/env bun
import { formatDecision, formatReport } from "./format";
import { reviewPackage } from "./reviewer";
import { parsePackageSpec } from "./spec";
import { LocalRegistryStore } from "./store";
import type { UserDecision } from "./types";
import { RegistryClient } from "./registry-client";

type Flags = {
  json: boolean;
  refresh: boolean;
  reason?: string;
};

export async function main(argv = Bun.argv.slice(2)): Promise<number> {
  const [command, ...rest] = argv;
  if (!command || command === "help" || command === "--help" || command === "-h") {
    printHelp();
    return 0;
  }

  try {
    const { args, flags } = parseArgs(rest);
    const store = new LocalRegistryStore();

    if (command === "review") {
      const input = requirePackageArg(args);
      const report = await reviewPackage(input, { store, refresh: flags.refresh });
      print(flags.json ? JSON.stringify(report, null, 2) : formatReport(report));
      return report.verdict.status === "deny" ? 2 : 0;
    }

    if (command === "check") {
      const input = requirePackageArg(args);
      const report = await reviewPackage(input, { store, refresh: false });
      print(flags.json ? JSON.stringify(report.verdict, null, 2) : `${report.identity.name}@${report.identity.version}: ${report.verdict.status.toUpperCase()} (${report.verdict.score}/100)`);
      return report.verdict.status === "allow" ? 0 : 1;
    }

    if (command === "allow" || command === "deny") {
      const input = requirePackageArg(args);
      const resolved = await resolveInput(input);
      const decision: UserDecision = { status: command, reason: flags.reason, decidedAt: new Date().toISOString() };
      await store.saveDecision(resolved.name, resolved.version, decision);
      print(flags.json ? JSON.stringify({ name: resolved.name, version: resolved.version, decision }, null, 2) : formatDecision(resolved.name, resolved.version, decision));
      return 0;
    }

    if (command === "demo") {
      const input = requirePackageArg(args);
      const report = await reviewPackage(input, { store, refresh: flags.refresh });
      print(formatReport(report));
      print("\nDemo flow:");
      print(`1. Review completed for ${report.identity.name}@${report.identity.version}.`);
      print(`2. Save approval: registry-trust allow ${report.identity.name}@${report.identity.version} --reason "demo reviewed"`);
      print(`3. Gate later installs: registry-trust check ${report.identity.name}@${report.identity.version} && bun add ${report.identity.name}@${report.identity.version}`);
      return report.verdict.status === "deny" ? 2 : 0;
    }

    throw new Error(`Unknown command: ${command}`);
  } catch (error) {
    errorPrint(error instanceof Error ? error.message : String(error));
    return 1;
  }
}

function parseArgs(argv: string[]): { args: string[]; flags: Flags } {
  const args: string[] = [];
  const flags: Flags = { json: false, refresh: false };
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === "--json") flags.json = true;
    else if (value === "--refresh") flags.refresh = true;
    else if (value === "--reason") {
      const reason = argv[index + 1];
      if (!reason) throw new Error("--reason requires a value");
      flags.reason = reason;
      index += 1;
    } else if (value.startsWith("--reason=")) {
      flags.reason = value.slice("--reason=".length);
    } else if (value.startsWith("--")) {
      throw new Error(`Unknown flag: ${value}`);
    } else {
      args.push(value);
    }
  }
  return { args, flags };
}

async function resolveInput(input: string): Promise<{ name: string; version: string }> {
  const spec = parsePackageSpec(input);
  if (spec.requestedVersion) return { name: spec.name, version: spec.requestedVersion };
  const client = new RegistryClient(spec.registryUrl);
  const metadata = await client.fetchMetadata(spec.name);
  const version = client.resolveVersion(metadata, undefined).version;
  return { name: spec.name, version };
}

function requirePackageArg(args: string[]): string {
  if (args.length !== 1) throw new Error("Expected exactly one package spec");
  return args[0];
}

function printHelp(): void {
  print(`registry-trust\n\nUsage:\n  registry-trust review <pkg|pkg@version> [--json] [--refresh]\n  registry-trust allow <pkg|pkg@version> [--reason <text>]\n  registry-trust deny <pkg|pkg@version> [--reason <text>]\n  registry-trust check <pkg|pkg@version> [--json]\n  registry-trust demo <pkg|pkg@version>\n\nMVP supports latest and exact versions from https://registry.npmjs.org.`);
}

function print(message: string): void {
  process.stdout.write(`${message}\n`);
}

function errorPrint(message: string): void {
  process.stderr.write(`registry-trust: ${message}\n`);
}

if (import.meta.main) {
  process.exitCode = await main();
}
