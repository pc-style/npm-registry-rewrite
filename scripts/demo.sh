#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

STORE_DIR="$(mktemp -d)"
INSTALL_DIR="$(mktemp -d)"
cleanup() {
  rm -rf "$STORE_DIR" "$INSTALL_DIR"
}
trap cleanup EXIT

PACKAGE="${1:-is-odd}"
EXACT_PACKAGE=""
STEP_SLEEP="${REGISTRY_TRUST_DEMO_SLEEP:-0.45}"
DEMO_CLEAR="${REGISTRY_TRUST_DEMO_CLEAR:-1}"

pause() {
  sleep "$STEP_SLEEP"
}

clear_screen() {
  if [[ "$DEMO_CLEAR" != "0" ]]; then
    pause
    printf "\033[2J\033[H"
  fi
}

feature() {
  clear_screen
  echo "registry-trust demo"
  echo "Feature: $*"
  echo
  pause
}

run() {
  echo
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo "$ $*"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  pause
  "$@"
  pause
}

run_expect() {
  local expected="$1"
  shift
  echo
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo "$ $*"
  echo "expected exit: $expected"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  pause
  set +e
  "$@"
  local actual=$?
  set -e
  echo "exit: $actual"
  pause
  if [[ "$actual" != "$expected" ]]; then
    echo "Expected exit $expected but got $actual" >&2
    exit 1
  fi
}

run_gate_install() {
  echo
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo "$ REGISTRY_TRUST_HOME=... bun run src/cli.ts check $EXACT_PACKAGE && (cd $INSTALL_DIR && bun init -y && bun add $EXACT_PACKAGE)"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  pause
  REGISTRY_TRUST_HOME="$STORE_DIR" bun run src/cli.ts check "$EXACT_PACKAGE" && (
    cd "$INSTALL_DIR"
    bun init -y
    bun add "$EXACT_PACKAGE"
  )
}

json_field() {
  python3 -c 'import json,sys; data=json.load(sys.stdin); cur=data
for part in sys.argv[1].split("."):
    cur=cur[part]
print(cur)' "$1"
}

feature "environment + repo state"
echo "repo: $ROOT_DIR"
echo "package: $PACKAGE"
echo "isolated REGISTRY_TRUST_HOME: $STORE_DIR"
echo "temp install dir: $INSTALL_DIR"
echo "runtime: $(bun --version)"
pause

run bun run check
run git status --short
run git log --oneline -1
run bun run src/cli.ts --help

# 1. Review the package and print the human-readable trust report.
feature "human-readable package review"
run env REGISTRY_TRUST_HOME="$STORE_DIR" bun run src/cli.ts review "$PACKAGE" --refresh

# 2. Generate a JSON report from real npm metadata/tarball analysis.
feature "JSON report from real npm metadata and tarball analysis"
echo
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "$ env REGISTRY_TRUST_HOME=... bun run src/cli.ts review $PACKAGE --json"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
pause
JSON_REPORT="$(REGISTRY_TRUST_HOME="$STORE_DIR" bun run src/cli.ts review "$PACKAGE" --json)"
printf '%s\n' "$JSON_REPORT"
EXACT_PACKAGE="$(printf '%s\n' "$JSON_REPORT" | json_field identity.name)@$(printf '%s\n' "$JSON_REPORT" | json_field identity.version)"
echo
echo "resolved exact package: $EXACT_PACKAGE"
pause

# 3. Before an explicit allow decision, check is a gate and must fail for WARN.
feature "install gate blocks unapproved WARN verdicts"
run_expect 1 env REGISTRY_TRUST_HOME="$STORE_DIR" bun run src/cli.ts check "$EXACT_PACKAGE"

# 4. Save an explicit allow decision.
feature "explicit allow decision"
run env REGISTRY_TRUST_HOME="$STORE_DIR" bun run src/cli.ts allow "$EXACT_PACKAGE" --reason "demo reviewed"

# 5. After allow, check succeeds and can gate a real Bun install in a temp project.
feature "allow opens a real Bun install gate"
run_expect 0 env REGISTRY_TRUST_HOME="$STORE_DIR" bun run src/cli.ts check "$EXACT_PACKAGE"
run_gate_install

# 6. Show the built-in demo command while the package is allowed.
feature "built-in demo command"
run env REGISTRY_TRUST_HOME="$STORE_DIR" bun run src/cli.ts demo "$EXACT_PACKAGE"

# 7. Save a deny decision to show deny overrides allow and blocks the gate.
feature "deny override closes the gate"
run env REGISTRY_TRUST_HOME="$STORE_DIR" bun run src/cli.ts deny "$EXACT_PACKAGE" --reason "demo deny override"
run_expect 1 env REGISTRY_TRUST_HOME="$STORE_DIR" bun run src/cli.ts check "$EXACT_PACKAGE"

echo
pause
echo "Demo completed successfully."
