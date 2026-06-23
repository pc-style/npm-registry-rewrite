import type { PackageSpec } from "./types";

const DEFAULT_REGISTRY = "https://registry.npmjs.org";

export function parsePackageSpec(input: string, registryUrl = DEFAULT_REGISTRY): PackageSpec {
  const raw = input.trim();
  if (!raw) {
    throw new Error("Package spec is required");
  }

  if (raw.includes(" ") || raw.startsWith("http:") || raw.startsWith("https:") || raw.startsWith("file:")) {
    throw new Error(`Unsupported package spec: ${raw}`);
  }

  if (raw.startsWith("@")) {
    const slash = raw.indexOf("/");
    if (slash === -1) {
      throw new Error(`Invalid scoped package spec: ${raw}`);
    }

    const versionMarker = raw.indexOf("@", slash + 1);
    const name = versionMarker === -1 ? raw : raw.slice(0, versionMarker);
    const requestedVersion = versionMarker === -1 ? undefined : raw.slice(versionMarker + 1);
    validateName(name, raw);
    validateVersion(requestedVersion, raw);
    return { raw, name, requestedVersion, registryUrl };
  }

  const versionMarker = raw.lastIndexOf("@");
  const name = versionMarker === -1 ? raw : raw.slice(0, versionMarker);
  const requestedVersion = versionMarker === -1 ? undefined : raw.slice(versionMarker + 1);
  validateName(name, raw);
  validateVersion(requestedVersion, raw);
  return { raw, name, requestedVersion, registryUrl };
}

export function packageMetadataUrl(name: string, registryUrl = DEFAULT_REGISTRY): string {
  return `${registryUrl.replace(/\/$/, "")}/${encodeURIComponent(name)}`;
}

function validateName(name: string, raw: string): void {
  if (!name || name.includes("@", 1) || name.includes("//")) {
    throw new Error(`Invalid package name in spec: ${raw}`);
  }
}

function validateVersion(version: string | undefined, raw: string): void {
  if (version === "") {
    throw new Error(`Missing version in package spec: ${raw}`);
  }
}
