#!/usr/bin/env bash
set -euo pipefail

# Recreates only the `code` combo from omniroute-code-combo.json (single source
# of truth; the observer's CODE_COMBO is tested against it). Credentials remain
# in OmniRoute's private environment and are never written by this script.
#
#   DRY_RUN=1 bash scripts/configure-code-combo.sh   # print, change nothing

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
COMBO_FILE="${COMBO_FILE:-$ROOT/omniroute-code-combo.json}"

if ! command -v omniroute >/dev/null 2>&1; then
  echo "ERROR: omniroute is not installed or not on PATH" >&2
  exit 2
fi
[[ -f "$COMBO_FILE" ]] || { echo "ERROR: missing $COMBO_FILE" >&2; exit 2; }

# Validate BEFORE touching the router: a bad spec must not leave it without a combo.
read -r NAME STRATEGY SPEC < <(python3 - "$COMBO_FILE" <<'PY'
import json, sys
data = json.load(open(sys.argv[1], encoding="utf-8"))
models = data.get("models")
if not isinstance(models, list) or not models:
    sys.exit("ERROR: combo file has no models")
for m in models:
    if not isinstance(m, dict) or not m.get("model") or not m.get("providerId"):
        sys.exit(f"ERROR: invalid combo entry: {m!r}")
print(data.get("name", "code"), data.get("strategy", "priority"), json.dumps(models, separators=(",", ":")))
PY
)

echo "Combo $NAME ($STRATEGY):"
python3 -c 'import json,sys; [print(f"  {i}. {m[\"providerId\"]}: {m[\"model\"]}") for i,m in enumerate(json.loads(sys.argv[1]),1)]' "$SPEC"

if [[ "${DRY_RUN:-0}" == "1" ]]; then
  echo "DRY_RUN=1: no changes made"
  exit 0
fi

omniroute combo delete "$NAME" --yes >/dev/null 2>&1 || true
if ! omniroute combo create "$NAME" --strategy "$STRATEGY" --models "$SPEC"; then
  echo "ERROR: 'omniroute combo create $NAME' failed; the router has NO '$NAME' combo now." >&2
  echo "       Fix the cause and re-run this script (it is idempotent)." >&2
  exit 1
fi

echo
echo "Configured combo $NAME: OpenCode/Zen -> OpenRouter -> Gemini"
