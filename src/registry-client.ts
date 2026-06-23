import { packageMetadataUrl } from "./spec";
import type { RegistryMetadata, RegistryVersion } from "./types";

export class RegistryClient {
  constructor(private readonly registryUrl = "https://registry.npmjs.org") {}

  async fetchMetadata(name: string): Promise<RegistryMetadata> {
    const response = await fetch(packageMetadataUrl(name, this.registryUrl), {
      headers: { accept: "application/json" }
    });

    if (!response.ok) {
      throw new Error(`npm metadata fetch failed for ${name}: HTTP ${response.status}`);
    }

    const metadata = await response.json();
    if (!isMetadata(metadata)) {
      throw new Error(`npm metadata response for ${name} is malformed`);
    }
    return metadata;
  }

  resolveVersion(metadata: RegistryMetadata, requestedVersion?: string): RegistryVersion {
    const version = requestedVersion ?? metadata["dist-tags"]?.latest;
    if (!version) {
      throw new Error(`No latest dist-tag found for ${metadata.name}`);
    }

    const versionMetadata = metadata.versions?.[version];
    if (!versionMetadata) {
      throw new Error(`Version ${metadata.name}@${version} was not found in npm metadata`);
    }
    return versionMetadata;
  }

  async fetchTarball(url: string): Promise<Uint8Array> {
    const response = await fetch(url, { headers: { accept: "application/octet-stream" } });
    if (!response.ok) {
      throw new Error(`tarball fetch failed: HTTP ${response.status}`);
    }
    return new Uint8Array(await response.arrayBuffer());
  }
}

function isMetadata(value: unknown): value is RegistryMetadata {
  return Boolean(
    value &&
      typeof value === "object" &&
      typeof (value as RegistryMetadata).name === "string" &&
      (!("versions" in value) || typeof (value as RegistryMetadata).versions === "object")
  );
}
