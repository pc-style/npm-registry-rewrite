import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { homedir } from "node:os";
import type { PackageReport, RegistryStore, UserDecision } from "./types";

export class LocalRegistryStore implements RegistryStore {
  constructor(private readonly root = process.env.REGISTRY_TRUST_HOME ?? join(homedir(), ".registry-trust")) {}

  async getReport(name: string, version: string): Promise<PackageReport | undefined> {
    return readJson<PackageReport>(this.reportPath(name, version));
  }

  async saveReport(report: PackageReport): Promise<void> {
    await writeJson(this.reportPath(report.identity.name, report.identity.version), report);
  }

  async getDecision(name: string, version: string): Promise<UserDecision | undefined> {
    return readJson<UserDecision>(this.decisionPath(name, version));
  }

  async saveDecision(name: string, version: string, decision: UserDecision): Promise<void> {
    await writeJson(this.decisionPath(name, version), decision);
  }

  async listDecisions(): Promise<Array<{ name: string; version: string; decision: UserDecision }>> {
    const dir = join(this.root, "decisions");
    const glob = new Bun.Glob("*.json");
    const decisions: Array<{ name: string; version: string; decision: UserDecision }> = [];
    try {
      for await (const file of glob.scan(dir)) {
        const decoded = decodeKey(file.replace(/\.json$/, ""));
        const [name, version] = splitKey(decoded);
        const decision = await readJson<UserDecision>(join(dir, file));
        if (decision) decisions.push({ name, version, decision });
      }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
    return decisions;
  }

  private reportPath(name: string, version: string): string {
    return join(this.root, "reports", `${encodeKey(`${name}@${version}`)}.json`);
  }

  private decisionPath(name: string, version: string): string {
    return join(this.root, "decisions", `${encodeKey(`${name}@${version}`)}.json`);
  }
}

async function readJson<T>(path: string): Promise<T | undefined> {
  try {
    return (await Bun.file(path).json()) as T;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return undefined;
    throw error;
  }
}

async function writeJson(path: string, value: unknown): Promise<void> {
  await mkdir(path.slice(0, path.lastIndexOf("/")), { recursive: true });
  await Bun.write(path, `${JSON.stringify(value, null, 2)}\n`);
}

function encodeKey(value: string): string {
  return Buffer.from(value).toString("base64url");
}

function decodeKey(value: string): string {
  return Buffer.from(value, "base64url").toString("utf8");
}

function splitKey(value: string): [string, string] {
  const marker = value.lastIndexOf("@");
  return [value.slice(0, marker), value.slice(marker + 1)];
}
