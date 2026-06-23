export type PackageSpec = {
  raw: string;
  name: string;
  requestedVersion?: string;
  resolvedVersion?: string;
  registryUrl: string;
};

export type Maintainer = {
  name: string;
  email?: string;
};

export type DependencySummary = {
  dependencies: number;
  devDependencies: number;
  peerDependencies: number;
  optionalDependencies: number;
  totalRuntime: number;
  totalDeclared: number;
  samples: string[];
};

export type ScriptSummary = {
  hasLifecycle: boolean;
  lifecycle: Record<string, string>;
  all: Record<string, string>;
};

export type FileSummary = {
  fileCount: number;
  unpackedBytes: number;
  packageJsonFound: boolean;
  notablePaths: string[];
};

export type RiskSignal = {
  id: string;
  severity: "info" | "warn" | "block";
  message: string;
};

export type Verdict = {
  status: "allow" | "warn" | "deny";
  score: number;
  reasons: string[];
  blockers: string[];
  generatedAt: string;
};

export type UserDecision = {
  status: "allow" | "deny";
  reason?: string;
  decidedAt: string;
};

export type PackageReport = {
  schemaVersion: 1;
  spec: PackageSpec;
  identity: {
    name: string;
    version: string;
    description?: string;
    license?: string;
    homepage?: string;
    repository?: string;
  };
  maintainers: Maintainer[];
  publish: {
    created?: string;
    modified?: string;
    versionPublishedAt?: string;
    publishAgeDays?: number;
  };
  tarball: {
    url: string;
    bytes: number;
    integrity?: string;
    shasum?: string;
  };
  scripts: ScriptSummary;
  dependencies: DependencySummary;
  files: FileSummary;
  riskSignals: RiskSignal[];
  verdict: Verdict;
  generatedAt: string;
};

export type RegistryStore = {
  getReport(name: string, version: string): Promise<PackageReport | undefined>;
  saveReport(report: PackageReport): Promise<void>;
  getDecision(name: string, version: string): Promise<UserDecision | undefined>;
  saveDecision(name: string, version: string, decision: UserDecision): Promise<void>;
  listDecisions(): Promise<Array<{ name: string; version: string; decision: UserDecision }>>;
};

export type RegistryMetadata = {
  name: string;
  description?: string;
  "dist-tags"?: Record<string, string>;
  time?: Record<string, string>;
  maintainers?: Maintainer[];
  versions?: Record<string, RegistryVersion>;
};

export type RegistryVersion = {
  name: string;
  version: string;
  description?: string;
  license?: string;
  homepage?: string;
  repository?: string | { url?: string; type?: string };
  maintainers?: Maintainer[];
  scripts?: Record<string, string>;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
  optionalDependencies?: Record<string, string>;
  dist?: {
    tarball?: string;
    integrity?: string;
    shasum?: string;
    unpackedSize?: number;
    fileCount?: number;
  };
};
