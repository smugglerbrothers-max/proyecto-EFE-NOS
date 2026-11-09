#!/usr/bin/env bash
set -euo pipefail

# Installs the Orquestador preset into DeepSeek Harness. Idempotent: an existing
# install is backed up first. Runtime state (.omniroute-limit-state.json) is kept.
#
#   bash scripts/install.sh            # preset + quarantine controller timer
#   bash scripts/install.sh --all      # + settings merge + combo + Gemini patch + verify
#   NO_TIMER=1 bash scripts/install.sh # skip the systemd --user timer

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DEST="${DSH_PRESET_DIR:-$HOME/.dsh/.agent-presets/orchestrator}"
UNIT_DIR="${XDG_CONFIG_HOME:-$HOME/.config}/systemd/user"
FILES=(agent.cordis.yml preset.yml orchestrator-readonly-policy-v2.js orchestrator-job-watchdog.js omniroute-limit-observer.js bin/quarantine-controller.mjs)

for file in "${FILES[@]}"; do
  [[ -f "$ROOT/orchestrator/$file" ]] || { echo "ERROR: missing orchestrator/$file" >&2; exit 2; }
  if [[ "$file" == *.js || "$file" == *.mjs ]]; then
    node --check "$ROOT/orchestrator/$file" || { echo "ERROR: syntax error in $file" >&2; exit 2; }
  fi
done

if [[ -d "$DEST" ]] && compgen -G "$DEST/*" >/dev/null; then
  BACKUP="$DEST.bak-$(date +%Y%m%d-%H%M%S)"
  for file in "${FILES[@]}"; do
    if [[ -f "$DEST/$file" ]]; then mkdir -p "$BACKUP/$(dirname "$file")"; cp -p "$DEST/$file" "$BACKUP/$file"; fi
  done
  [[ -d "$BACKUP" ]] && echo "Backup of previous preset: $BACKUP"
fi

for file in "${FILES[@]}"; do
  mode=0644; [[ "$file" == bin/* ]] && mode=0755
  install -D -m "$mode" "$ROOT/orchestrator/$file" "$DEST/$file"
done
echo "Preset installed in $DEST"

if [[ "${NO_TIMER:-0}" != "1" ]] && command -v systemctl >/dev/null; then
  NODE_BIN="$(command -v node)"
  OMNI_DIR="$(dirname "$(command -v omniroute 2>/dev/null || echo "$HOME/.npm-global/bin/omniroute")")"
  UNIT_PATH="$OMNI_DIR:$(dirname "$NODE_BIN"):/usr/local/bin:/usr/bin:/bin"
  mkdir -p "$UNIT_DIR"
  sed -e "s#@NODE@#$NODE_BIN#g" -e "s#@PATH@#$UNIT_PATH#g" -e "s#@PRESET_DIR@#$DEST#g" \
    "$ROOT/systemd/orquestador-quarantine.service.in" > "$UNIT_DIR/orquestador-quarantine.service"
  install -m 0644 "$ROOT/systemd/orquestador-quarantine.timer" "$UNIT_DIR/orquestador-quarantine.timer"
  if systemctl --user daemon-reload 2>/dev/null && systemctl --user enable --now orquestador-quarantine.timer 2>/dev/null; then
    echo "Timer orquestador-quarantine.timer enabled (every minute)"
  else
    echo "WARN: could not enable the user timer (no systemd --user session?)."
    echo "      Run it by hand: node $DEST/bin/quarantine-controller.mjs"
  fi
fi

if [[ "${1:-}" == "--all" ]]; then
  python3 "$ROOT/scripts/merge-settings.py" || true
  bash "$ROOT/scripts/configure-code-combo.sh"
  bash "$ROOT/scripts/patch-gemini-max.sh"
  bash "$ROOT/scripts/verify-installation.sh"
elif ! grep -qsE '^\s{2,}omniroute:\s*$' "$HOME/.dsh/settings.yaml"; then
  echo
  echo "PENDING: python3 scripts/merge-settings.py   (adds provider 'omniroute' to ~/.dsh/settings.yaml)"
fi
