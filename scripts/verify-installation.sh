#!/usr/bin/env bash
set -uo pipefail

# Checks everything the preset needs at runtime. Exit 0 = ready, 1 = something
# is missing (each failure is listed). Never prints credential values.

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DEST="${DSH_PRESET_DIR:-$HOME/.dsh/.agent-presets/orchestrator}"
ROUTER="${OMNIROUTE_URL:-http://127.0.0.1:20128}"
FILES=(agent.cordis.yml preset.yml orchestrator-readonly-policy-v2.js orchestrator-job-watchdog.js omniroute-limit-observer.js bin/quarantine-controller.mjs)
fail=0
ok()   { echo "  OK   $*"; }
bad()  { echo "  FAIL $*"; fail=1; }
warn() { echo "  WARN $*"; }

echo "Tools:"
command -v omniroute >/dev/null && ok "omniroute" || bad "omniroute not on PATH"
command -v zstd >/dev/null && ok "zstd (watchdog reads child transcripts)" || warn "zstd missing: fast-fail diagnostics will be blind"
if command -v node >/dev/null; then
  if node -e 'require("node:sqlite")' 2>/dev/null; then ok "node $(node --version) with node:sqlite"
  else bad "node $(node --version) has no node:sqlite (observer telemetry disabled; use Node >= 22.13)"; fi
else bad "node not found"; fi

echo "OmniRoute:"
systemctl --user is-active --quiet omniroute.service && ok "omniroute.service active" || bad "omniroute.service is not active (systemctl --user start omniroute.service)"
if curl -fsS -m 5 -o /dev/null "$ROUTER/v1/models" 2>/dev/null; then ok "router answers at $ROUTER"
else warn "router did not answer $ROUTER/v1/models (may need OMNIROUTE_API_KEY)"; fi
if command -v omniroute >/dev/null; then
  combos="$(omniroute combo list --json 2>/dev/null || true)"
  if python3 - "$combos" "$ROOT/omniroute-code-combo.json" <<'PY'
import json, sys
try:
    data = json.loads(sys.argv[1])
except Exception:
    sys.exit(1)
items = data if isinstance(data, list) else data.get("combos", data.get("data", []))
want = [m["model"] for m in json.load(open(sys.argv[2]))["models"]]
for c in items if isinstance(items, list) else []:
    if isinstance(c, dict) and c.get("name") == "code":
        got = [m.get("model") if isinstance(m, dict) else m for m in c.get("models", [])]
        if got and got != want:
            print("    order/models differ from omniroute-code-combo.json:", got)
            sys.exit(2)
        sys.exit(0)
sys.exit(1)
PY
  then ok "combo 'code' present"
  else rc=$?; [[ $rc == 2 ]] && bad "combo 'code' differs (run scripts/configure-code-combo.sh)" || bad "combo 'code' not found (run scripts/configure-code-combo.sh)"; fi
fi
[[ -n "${OMNIROUTE_API_KEY:-}" ]] && ok "OMNIROUTE_API_KEY set in this shell" || warn "OMNIROUTE_API_KEY not set in this shell (DSH reads it via apiKeyEnv)"

echo "DSH:"
for file in "${FILES[@]}"; do
  if [[ ! -f "$DEST/$file" ]]; then bad "$DEST/$file missing (run scripts/install.sh)"
  elif ! cmp -s "$DEST/$file" "$ROOT/orchestrator/$file"; then warn "$file installed differs from repo (re-run scripts/install.sh)"
  else ok "$file"; fi
done
grep -qsE '^\s{2,}omniroute:\s*$' "$HOME/.dsh/settings.yaml" && ok "provider omniroute in ~/.dsh/settings.yaml" || bad "provider omniroute missing (python3 scripts/merge-settings.py)"
systemctl --user is-active --quiet orquestador-quarantine.timer && ok "orquestador-quarantine.timer active" || warn "quarantine timer inactive: cooldowns are logged but not applied to the combo (bash scripts/install.sh)"

echo
[[ $fail == 0 ]] && echo "READY: select the 'Orquestador' preset and start a NEW session." || echo "NOT READY: fix the FAIL lines above."
echo "No credential-bearing files are part of this bundle."
exit $fail
