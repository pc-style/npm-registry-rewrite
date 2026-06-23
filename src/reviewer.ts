import { analyzeTarball } from "./analyzer";
import { collectRiskSignals, daysSince, makeVerdict } from "./policy";
import { parsePackageSpec } from "./spec";
import type { PackageReport, RegistryMetadata, RegistryStore, RegistryVersion } from "./types";
import { RegistryClient } from "./registry-client";

export type ReviewOptions = {
  refresh?: boolean;
  client?: RegistryClient;
  store: RegistryStore;
};

export async function reviewPackage(input: string, options: ReviewOptions): Promise<PackageReport> {
  const spec = parsePackageSpec(input);
  const client = options.client ?? new RegistryClient(spec.registryUrl);
  const metadata = await client.fetchMetadata(spec.name);
  const versionMetadata = client.resolveVersion(metadata, spec.requestedVersion);
  const decision = await options.store.getDecision(spec.name, versionMetadata.version);

  if (!options.refresh) {
    const cached = await options.store.getReport(spec.name, versionMetadata.version);
    if (cached) {
      const verdict = makeVerdict(cached.riskSignals, decision);
      return { ...cached, verdict };
    }
  }

  const tarballUrl = versionMetadata.dist?.tarball;
  if (!tarballUrl) {
    throw new Error(`Version ${spec.name}@${versionMetadata.version} does not include a tarball URL`);
  }

  const tarballBytes = await client.fetchTarball(tarballUrl);
  const analysis = await analyzeTarball(tarballBytes);
  const generatedAt = new Date().toISOString();
  const baseReport = {
    schemaVersion: 1 as const,
    spec: { ...spec, resolvedVersion: versionMetadata.version },
    identity: {
      name: versionMetadata.name,
      version: versionMetadata.version,
      description: versionMetadata.description ?? metadata.description,
      license: versionMetadata.license,
      homepage: versionMetadata.homepage,
      repository: repositoryToString(versionMetadata.repository)
    },
    maintainers: versionMetadata.maintainers ?? metadata.maintainers ?? [],
    publish: publishInfo(metadata, versionMetadata),
    tarball: {
      url: tarballUrl,
      bytes: tarballBytes.byteLength,
      integrity: versionMetadata.dist?.integrity,
      shasum: versionMetadata.dist?.shasum
    },
    scripts: analysis.scripts,
    dependencies: analysis.dependencies,
    files: analysis.files,
    generatedAt
  };
  const riskSignals = collectRiskSignals(baseReport);
  const report: PackageReport = {
    ...baseReport,
    riskSignals,
    verdict: makeVerdict(riskSignals, decision)
  };
  await options.store.saveReport(report);
  return report;
}

function publishInfo(metadata: RegistryMetadata, versionMetadata: RegistryVersion): PackageReport["publish"] {
  const versionPublishedAt = metadata.time?.[versionMetadata.version];
  return {
    created: metadata.time?.created,
    modified: metadata.time?.modified,
    versionPublishedAt,
    publishAgeDays: daysSince(versionPublishedAt)
  };
}

function repositoryToString(repository: RegistryVersion["repository"]): string | undefined {
  if (!repository) return undefined;
  if (typeof repository === "string") return repository;
  return repository.url;
}
