import { gzipSync } from "node:zlib";
import { expect, test } from "bun:test";
import tar from "tar-stream";
import { analyzeTarball } from "../src/analyzer";

test("analyzes package json scripts and dependencies from tarballs", async () => {
  const bytes = await fixtureTarball({
    "package/package.json": JSON.stringify({
      name: "fixture",
      version: "1.0.0",
      scripts: { postinstall: "node postinstall.js", test: "bun test" },
      dependencies: { leftpad: "1.0.0" },
      optionalDependencies: { native: "1.0.0" }
    }),
    "package/bin/fixture.js": "console.log('fixture')"
  });

  const analysis = await analyzeTarball(bytes);
  expect(analysis.files.packageJsonFound).toBe(true);
  expect(analysis.scripts.hasLifecycle).toBe(true);
  expect(analysis.dependencies.totalRuntime).toBe(2);
  expect(analysis.files.notablePaths).toContain("package/bin/fixture.js");
});

test("handles missing package json", async () => {
  const bytes = await fixtureTarball({ "package/index.js": "export default 1" });
  const analysis = await analyzeTarball(bytes);
  expect(analysis.files.packageJsonFound).toBe(false);
  expect(analysis.dependencies.totalDeclared).toBe(0);
});

test("summarizes suspicious packed content from paths and sizes", async () => {
  const bytes = await fixtureTarball({
    "package/package.json": JSON.stringify({ name: "fixture", version: "1.0.0" }),
    "package/build/addon.node": "native",
    "package/dist/parser.wasm": "wasm",
    "package/scripts/postinstall.sh": "setup",
    "package/.env": "SECRET=1",
    "package/assets/model.bin": "x".repeat(1024 * 1024)
  });

  const analysis = await analyzeTarball(bytes);
  expect(analysis.files.notablePaths).toContain("package/build/addon.node");
  expect(analysis.files.notablePaths).toContain("package/dist/parser.wasm");
  expect(analysis.files.suspiciousContent!.nativeBinaries.paths).toEqual(["package/build/addon.node"]);
  expect(analysis.files.suspiciousContent!.wasmFiles.paths).toEqual(["package/dist/parser.wasm"]);
  expect(analysis.files.suspiciousContent!.installScripts.paths).toEqual(["package/scripts/postinstall.sh"]);
  expect(analysis.files.suspiciousContent!.shellScripts.paths).toEqual(["package/scripts/postinstall.sh"]);
  expect(analysis.files.suspiciousContent!.sensitivePaths.paths).toEqual(["package/.env"]);
  expect(analysis.files.suspiciousContent!.largeFiles.paths).toEqual(["package/assets/model.bin"]);
});

async function fixtureTarball(files: Record<string, string>): Promise<Uint8Array> {
  const pack = tar.pack();
  for (const [name, body] of Object.entries(files)) {
    pack.entry({ name }, body);
  }
  pack.finalize();

  const chunks: Buffer[] = [];
  for await (const chunk of pack) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return gzipSync(Buffer.concat(chunks));
}
