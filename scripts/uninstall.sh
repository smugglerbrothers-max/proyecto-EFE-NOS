#!/usr/bin/env bash
set -euo pipefail
# Quita el preset y el timer. NO toca OmniRoute, sus combos, ni ~/.dsh/settings.yaml,
# ni la telemetría. El preset se mueve a un backup, no se borra.

PRESET_DIR="${DSH_PRESET_DIR:-$HOME/.dsh/.agent-presets/orchestrator}"
UNIT_DIR="${XDG_CONFIG_HOME:-$HOME/.config}/systemd/user"

systemctl --user disable --now orquestador-quarantine.timer 2>/dev/null || true
rm -f "$UNIT_DIR/orquestador-quarantine.timer" "$UNIT_DIR/orquestador-quarantine.service"
systemctl --user daemon-reload 2>/dev/null || true
echo "Timer de cuarentena quitado"

if [[ -d "$PRESET_DIR" ]]; then
  BACKUP="$PRESET_DIR.removed-$(date +%Y%m%d-%H%M%S)"
  mv "$PRESET_DIR" "$BACKUP"
  echo "Preset movido a $BACKUP"
fi
echo "Listo. Para restaurar el combo code completo: bash scripts/configure-code-combo.sh"
