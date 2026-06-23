import { expect, test } from "bun:test";
import { packageMetadataUrl, parsePackageSpec } from "../src/spec";

test("parses latest package specs", () => {
  expect(parsePackageSpec("is-odd")).toMatchObject({ name: "is-odd", requestedVersion: undefined });
});

test("parses exact package specs", () => {
  expect(parsePackageSpec("is-odd@3.0.1")).toMatchObject({ name: "is-odd", requestedVersion: "3.0.1" });
});

test("parses scoped exact package specs", () => {
  expect(parsePackageSpec("@scope/pkg@1.2.3")).toMatchObject({ name: "@scope/pkg", requestedVersion: "1.2.3" });
});

test("encodes scoped package metadata URLs", () => {
  expect(packageMetadataUrl("@scope/pkg")).toBe("https://registry.npmjs.org/%40scope%2Fpkg");
});

test("rejects unsupported URL specs", () => {
  expect(() => parsePackageSpec("https://example.com/pkg.tgz")).toThrow("Unsupported package spec");
});
