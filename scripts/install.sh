#!/usr/bin/env bash
set -euo pipefail

# Installs the Orquestador preset into DeepSeek Harness. Idempotent: an existing
# install is backed up first. Runtime state (.omniroute-limit-state.json) is kept.
#
#   bash scripts/install.sh            # preset only
#   bash scripts/install.sh --all      # preset + combo + Gemini patch + verify

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DEST="${DSH_PRESET_DIR:-$HOME/.dsh/.agent-presets/orchestrator}"
FILES=(agent.cordis.yml preset.yml orchestrator-readonly-policy-v2.js orchestrator-job-watchdog.js omniroute-limit-observer.js)

for file in "${FILES[@]}"; do
  [[ -f "$ROOT/orchestrator/$file" ]] || { echo "ERROR: missing orchestrator/$file" >&2; exit 2; }
  node --check "$ROOT/orchestrator/$file" 2>/dev/null || [[ "$file" != *.js ]] || { echo "ERROR: syntax error in $file" >&2; exit 2; }
done

if [[ -d "$DEST" ]] && compgen -G "$DEST/*" >/dev/null; then
  BACKUP="$DEST.bak-$(date +%Y%m%d-%H%M%S)"
  mkdir -p "$BACKUP"
  for file in "${FILES[@]}"; do [[ -f "$DEST/$file" ]] && cp -p "$DEST/$file" "$BACKUP/"; done
  echo "Backup of previous preset: $BACKUP"
fi

mkdir -p "$DEST"
for file in "${FILES[@]}"; do install -m 0644 "$ROOT/orchestrator/$file" "$DEST/$file"; done
echo "Preset installed in $DEST"

if ! grep -qs 'omniroute:' "$HOME/.dsh/settings.yaml"; then
  echo
  echo "PENDING: merge omniroute-settings.example.yaml into ~/.dsh/settings.yaml"
  echo "         (provider 'omniroute' + subagent-model-selection). Not done automatically"
  echo "         so your existing settings are never rewritten."
fi

if [[ "${1:-}" == "--all" ]]; then
  bash "$ROOT/scripts/configure-code-combo.sh"
  bash "$ROOT/scripts/patch-gemini-max.sh"
  bash "$ROOT/scripts/verify-installation.sh"
fi
