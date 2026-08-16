> [!IMPORTANT]
> **Archival prepared 2026-08-16; repository-settings authorization is still required to make this repository read-only.** Development continues in [pc-style/supply-chain-guard](https://github.com/pc-style/supply-chain-guard). Supply Chain Guard preserves and extends this project's npm tarball-integrity safety property; detailed migration/provenance and the independently rerun 26/26 test evidence are recorded [there](https://github.com/pc-style/supply-chain-guard/blob/main/docs/npm-registry-rewrite-lineage.md). Full Git history and all branches are preserved.

# registry-trust

A Bun-only MVP for an agent-first npm registry trust layer. It reviews a public npm package before install/exec, caches the generated report locally, and gates later installs on an explicit local allow/deny decision.

## What it shows

`registry-trust` fetches public npm metadata and the package tarball, then reports:

- package identity: name, version, description, license, homepage, repository
- maintainer and publish/change signals
- tarball size plus cryptographic verification against reported integrity/shasum
- lifecycle scripts and dependency counts
- notable and suspicious packed files such as binaries, native `.node` files, `.wasm`, install scripts, shell scripts, large files, and sensitive-looking paths
- an explainable verdict: `ALLOW`, `WARN`, or `DENY`

The MVP is intentionally conservative: clean packages remain `WARN` until a human/agent saves an explicit `allow` decision.

## Install dependencies

```bash
bun install
```

## Run the CLI

```bash
bun run src/cli.ts review is-odd
bun run src/cli.ts review is-odd@3.0.1 --json
bun run src/cli.ts allow is-odd@3.0.1 --reason "reviewed demo package"
bun run src/cli.ts check is-odd@3.0.1 && bun add is-odd@3.0.1
```

Use `REGISTRY_TRUST_HOME` to keep reports/decisions in an isolated directory:

```bash
tmpdir=$(mktemp -d)
REGISTRY_TRUST_HOME="$tmpdir" bun run src/cli.ts demo is-odd
rm -rf "$tmpdir"
```

## Commands

```text
registry-trust review <pkg|pkg@version> [--json] [--refresh]
registry-trust allow <pkg|pkg@version> [--reason <text>]
registry-trust deny <pkg|pkg@version> [--reason <text>]
registry-trust check <pkg|pkg@version> [--json]
registry-trust demo <pkg|pkg@version>
```

- `review` fetches/analyzes and caches a package report. It exits `2` only for a deny verdict.
- `allow` / `deny` save an explicit local decision for an exact version. If no version is supplied, the current `latest` version is resolved first.
- `check` exits `0` only when the verdict is `ALLOW`; `WARN` and `DENY` exit non-zero for install-gating.
- `demo` prints a report plus the intended review -> allow -> gated install flow.

## Local storage

By default the local JSON store lives at `~/.registry-trust`:

```text
~/.registry-trust/reports/<base64url package@version>.json
~/.registry-trust/decisions/<base64url package@version>.json
```

Set `REGISTRY_TRUST_HOME=/path/to/store` to override this. Storage sits behind the `RegistryStore` interface so it can move to a hosted backend later without changing the reviewer flow.

## Validation

```bash
bun test
bun run typecheck
bun run check
```

## MVP scope

Supported now:

- public `https://registry.npmjs.org` metadata and tarballs
- package specs in `name`, `name@version`, `@scope/name`, and `@scope/name@version` form
- local JSON report/decision cache
- human-readable and JSON report output
- tarball byte verification against `dist.integrity`, with `dist.shasum` fallback
- deterministic suspicious packed-content findings

Intentionally out of scope for this MVP:

- semver ranges, aliases, git/file/url specs, and alternate registries
- a local server or install wrapper
- executing packages or scripts
- AI auditing and release-to-release diffing

## License

MIT
