#!/usr/bin/env bash
set -uo pipefail
# Panel rápido: servicios, cuarentenas y qué modelo contestó en las últimas llamadas.
# Sólo lee. Uso: bash scripts/status.sh [N]   (N = últimas llamadas, default 10)

N="${1:-10}"
PRESET_DIR="${DSH_PRESET_DIR:-$HOME/.dsh/.agent-presets/orchestrator}"
EVENTS="$HOME/.dsh/logs/omniroute-limit-events.jsonl"

echo "Servicios:"
for unit in omniroute.service opencode-wrap.service orquestador-quarantine.timer; do
  printf '  %-30s %s\n' "$unit" "$(systemctl --user is-active "$unit" 2>/dev/null || echo '?')"
done
echo
if [[ -f "$PRESET_DIR/bin/quarantine-controller.mjs" ]]; then
  node --disable-warning=ExperimentalWarning "$PRESET_DIR/bin/quarantine-controller.mjs" --status
else
  echo "(controlador no instalado: bash scripts/install.sh)"
fi
echo
echo "Últimas $N llamadas (modelo que contestó / error):"
if [[ -f "$EVENTS" ]]; then
  tail -n 500 "$EVENTS" | python3 -c '
import json, sys
n = int(sys.argv[1])
rows = [json.loads(l) for l in sys.stdin if l.strip()]
rows = [r for r in rows if r.get("action") in ("success", "observed_error")][-n:]
for r in rows:
    mark = "ok " if r["action"] == "success" else "ERR"
    extra = "" if r["action"] == "success" else " %s %s" % (r.get("status"), r.get("reason"))
    print("  %s %s  %s:%s%s" % (mark, r.get("timestamp") or r.get("at"), r.get("provider"), r.get("model"), extra))
if not rows:
    print("  (sin llamadas registradas todavía)")
' "$N"
else
  echo "  (no existe $EVENTS: el observer escribe ahí cuando corre una sesión del preset)"
fi
