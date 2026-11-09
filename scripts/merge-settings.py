#!/usr/bin/env python3
"""Merge omniroute-settings.example.yaml into ~/.dsh/settings.yaml, safely.

Never rewrites existing content (comments and order are preserved):
  - if none of the fragment's top-level keys exist, the fragment is APPENDED
    (after a timestamped backup);
  - if the provider `omniroute` is already there, nothing is done;
  - if `llm-pi-ai:` or `subagent-model-selection:` exist without it, the exact
    lines to add by hand are printed and the exit code is 3.

Usage: merge-settings.py [--dry-run] [SETTINGS_FILE]
"""
import re
import shutil
import sys
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
FRAGMENT = ROOT / "omniroute-settings.example.yaml"

args = [a for a in sys.argv[1:] if a != "--dry-run"]
dry = "--dry-run" in sys.argv
target = Path(args[0]).expanduser() if args else Path.home() / ".dsh" / "settings.yaml"

fragment = FRAGMENT.read_text(encoding="utf-8")
current = target.read_text(encoding="utf-8") if target.exists() else ""

if re.search(r"^\s{2,}omniroute:\s*$", current, re.M):
    print(f"OK: {target} ya tiene el provider omniroute; no cambio nada")
    sys.exit(0)

clashes = [k for k in ("llm-pi-ai", "subagent-model-selection") if re.search(rf"^{re.escape(k)}:", current, re.M)]
if clashes:
    print(f"MANUAL: {target} ya define {', '.join(clashes)}; no lo reescribo para no romperlo.")
    print("Agregá a mano, dentro de esas claves, lo siguiente:\n")
    print(fragment)
    sys.exit(3)

if dry:
    print(f"(dry-run) agregaría el fragmento al final de {target}")
    sys.exit(0)

target.parent.mkdir(parents=True, exist_ok=True)
if target.exists():
    backup = target.with_name(f"{target.name}.bak-{time.strftime('%Y%m%d-%H%M%S')}")
    shutil.copy2(target, backup)
    print(f"Backup: {backup}")
sep = "" if current == "" or current.endswith("\n\n") else ("\n" if current.endswith("\n") else "\n\n")
target.write_text(current + sep + "# --- Orquestador / OmniRoute ---\n" + fragment, encoding="utf-8")
print(f"OK: fragmento agregado a {target}")
