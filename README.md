# Orquestador — DeepSeek Harness + OmniRoute

Bundle replicable del preset **Orquestador**: el agente principal corre en
modo read-only, orquesta y verifica; todo el trabajo pesado lo produce un único
subagente in-process (`omniroute_code`) servido por el combo `code` del router
local OmniRoute. El bundle **no contiene** claves, tokens, `.env`, bases
SQLite, call logs, estado de cuarentena ni prompts de sesión.

```text
DeepSeek Harness — Orquestador (read-only, guard + watchdog + observer)
  └─ omniroute_code (in-process, maxDepth 1, SÍ escribe)
       └─ OmniRoute :20128, combo `code` (priority, failover del router)
            1. ocwrap/big-pickle                  (OpenCode/Zen — cuota compartida con el main)
            2. ocwrap/longcat-2.5-preview-free    (OpenCode/Zen — cuota compartida con el main)
            3. openrouter cohere/north-mini-code:free
            4. openrouter nex-agi/nex-n2.5-pro:free
            5. gemini gemini-flash-lite-latest    (último; reasoning_effort=max forzado por parche)
```

## Estructura

| Ruta | Qué es |
|---|---|
| `orchestrator/agent.cordis.yml` | Composición del preset (persona, plugins, herramientas, delegación). |
| `orchestrator/preset.yml` | Nombre y descripción visibles en DSH. |
| `orchestrator/orchestrator-readonly-policy-v2.js` | Fija read-only al raíz, niega escrituras/shell productivo, esperas ciegas, secretos en prompts y escaladas de privilegio en hijos. |
| `orchestrator/orchestrator-job-watchdog.js` | Avisa (20 min) y mata (45 min de silencio total / 75 min de runtime) jobs sin señales de vida; rescata el motivo de los fallos de arranque. |
| `orchestrator/omniroute-limit-observer.js` | Lee `call_logs` de OmniRoute, registra eventos y mantiene la cuarentena de 5 h por modelo. |
| `orchestrator/bin/quarantine-controller.mjs` | **Controlador de cuarentena** (corre fuera de DSH, cada minuto): saca del combo `code` los modelos en cuarentena y los devuelve al vencer. Publica `~/.omniroute/quarantine-state.json`. |
| `systemd/orquestador-quarantine.{service.in,timer}` | Timer `--user` del controlador (`install.sh` completa rutas de `node` y `omniroute`). |
| `omniroute-code-combo.json` | **Fuente única** del combo `code` (la usan el script y, vía test, el observer). |
| `omniroute-settings.example.yaml` | Fragmento para `~/.dsh/settings.yaml` (provider `omniroute`). |
| `scripts/install.sh` | Instala el preset en `~/.dsh/.agent-presets/orchestrator/` con backup. |
| `scripts/configure-code-combo.sh` | (Re)crea el combo `code` desde el JSON. `DRY_RUN=1` para ver sin tocar. |
| `scripts/patch-gemini-max.sh` | Parchea OmniRoute para forzar `max` sólo en Gemini. Re-correr tras cada upgrade. |
| `scripts/merge-settings.py` | Agrega el provider `omniroute` a `~/.dsh/settings.yaml` con backup; nunca reescribe claves existentes. |
| `scripts/status.sh` | Panel: servicios, cuarentenas y qué modelo contestó en las últimas llamadas. |
| `scripts/uninstall.sh` | Quita preset y timer (los mueve a backup). No toca OmniRoute ni settings. |
| `omniroute.env.example` | Nombres de las variables privadas (vacías). Copiarlo **fuera** del repo. |
| `scripts/verify-installation.sh` | Comprueba todo lo necesario y dice `READY` / `NOT READY`. |
| `test/` | Tests `node:test` de los guards, el watchdog y el observer (`npm test`). |

## Activación (paso a paso)

Requisitos: DeepSeek Harness con plugins locales y el provider de subagentes
in-process; OmniRoute global (`omniroute`) como `omniroute.service` de
**usuario**; `ocwrap` (`opencode-wrap.service`) en `:8000`; Node ≥ 22.13
(para `node:sqlite`); Python 3; `zstd` recomendado.

1. **Credenciales** (fuera del repo, en el entorno privado de cada servicio):

   ```bash
   install -D -m 600 omniroute.env.example ~/.config/omniroute/omniroute.env
   $EDITOR ~/.config/omniroute/omniroute.env   # OPENCODE/OPENROUTER/GOOGLE/OMNIROUTE_API_KEY
   ```

   y que la unit de OmniRoute lo cargue con
   `EnvironmentFile=%h/.config/omniroute/omniroute.env`. `OMNIROUTE_API_KEY`
   tiene que estar exportada también donde arranca DSH.

2. **Servicios arriba:**

   ```bash
   systemctl --user enable --now omniroute.service opencode-wrap.service
   ```

3. **Settings de DSH:** `python3 scripts/merge-settings.py` (lo hace también
   `install.sh --all`). Si tu `settings.yaml` ya tiene `llm-pi-ai:` o
   `subagent-model-selection:`, no lo toca: imprime las líneas a agregar a mano.

4. **Instalar y configurar todo:**

   ```bash
   npm test                          # opcional: guards y observer en verde
   bash scripts/install.sh --all     # preset + combo + parche Gemini + verificación
   ```

   O por partes: `install.sh`, `merge-settings.py`, `configure-code-combo.sh`,
   `patch-gemini-max.sh`, `verify-installation.sh`. `install.sh` además
   habilita `orquestador-quarantine.timer` (`NO_TIMER=1` para omitirlo).

5. **Activar:** cuando `verify-installation.sh` diga `READY`, en DeepSeek
   Harness elegí el preset **Orquestador** y abrí una **sesión nueva** (los
   plugins se cargan al componer la sesión; una sesión vieja no los toma).

6. **Comprobar que está vivo** en la primera sesión:
   - pedí algo que escriba (p. ej. `echo x > a.md`): debe rechazarlo con
     "El Orquestador usa el shell solo para leer y verificar…";
   - delegá una tarea mínima con `omniroute_code` y mirá qué modelo contestó:
     `bash scripts/status.sh`.

### Cómo funciona la cuarentena

```text
OmniRoute call_logs ──> observer (plugin DSH) ──> .omniroute-limit-state.json
                                                       │
                     quarantine-controller (timer, 1 min)
                                                       ├─> ~/.omniroute/quarantine-state.json  (lo lee el guard)
                                                       └─> omniroute combo create code  (sin los modelos en cuarentena)
```

- Sólo reconfigura cuando cambia el conjunto admitido; el orden siempre es el
  de `omniroute-code-combo.json`.
- Nunca deja el combo vacío: si los 5 están en cuarentena mantiene el combo
  completo y el guard del observer se niega a delegar.
- Si `combo create` falla, restaura el combo completo.
- `ORQ_RECONCILE_COMBO=0` en la unit: publica el estado pero no toca el combo
  (por si preferís depender sólo del lockout nativo de OmniRoute).
- Ver el plan sin tocar nada: `node ~/.dsh/.agent-presets/orchestrator/bin/quarantine-controller.mjs --dry-run`.

### Desactivar / volver atrás

Elegí otro preset en DSH; `bash scripts/uninstall.sh` quita preset y timer. Para restaurar una versión anterior del preset:
`install.sh` deja `~/.dsh/.agent-presets/orchestrator.bak-<fecha>/`. El parche
de Gemini deja `*.bak` con timestamp junto a cada archivo de OmniRoute; un
`npm i -g omniroute` lo revierte por completo.

## Telemetría (no publicar: contiene prompts y metadatos)

- `~/.omniroute/storage.sqlite`, `~/.omniroute/call_logs/`
- `~/.dsh/logs/omniroute-limit-events.jsonl` (rota a `.1` pasados 5 MB)
- `~/.dsh/.agent-presets/orchestrator/.omniroute-limit-state.json`
- `<cwd>/.dsh-tmp/watchdog-stalls.jsonl`

## Cambios respecto del bundle original

**Piezas nuevas** (faltaban en el bundle): controlador de cuarentena + timer
systemd, `merge-settings.py`, `status.sh`, `uninstall.sh`,
`omniroute.env.example`, tests y CI (sintaxis, tests, ShellCheck).

**Fuera del alcance de este bundle** (se mencionan en el preset pero son de
cada proyecto o de tu máquina): `scripts/hf.sh` / `scripts/serve.sh` y las
units `hf-studio-*.service` de HyperFrames, `omniroute.service`,
`opencode-wrap.service` (`ocwrap`) y `~/opencode-usage-widget/`.

**Guard read-only (`orchestrator-readonly-policy-v2.js`)**
- Cierra huecos de escritura: `git switch|cherry-pick|revert|tag|worktree|am|clone|init`, `git -C <dir> …`, `git branch -D/-m`, `find -delete` / `find -exec rm`, y `python -c` / `node -e` que escriben archivos.
- Escaladas en hijos: también `run0`, `bash -c "sudo …"`, `$(…)`, backticks, subshells `( … )` y `timeout -s SIG N sudo`.
- El límite de espera de 120 s acepta `timeout_ms` y `timeoutMs`.
- Exporta las funciones puras para poder testearlas.

**Watchdog**
- El descubrimiento de procesos `opencode acp` (ACP retirado) queda apagado por defecto: escaneaba `/proc` cada 15 s sin encontrar nada. Se reactiva con `DSH_JOB_WATCHDOG_PROCESS_DISCOVERY=1`.
- Vuelve a avisar si un hijo revive y se queda mudo otra vez (antes avisaba una sola vez por job).
- La evidencia ya no dice "proceso AUSENTE" para hijos in-process, y el aviso sugiere `timeout_ms: 120000`.

**Observer**
- Claves de cuarentena canonicalizadas: el ledger mezclaba `openrouter:openrouter/…` y `openrouter:cohere/…`, y el bloqueo "todo el combo en cuarentena" podía no dispararse nunca. Ahora consulta el ledger del controlador **y** el propio.
- Un 4xx genérico (`request_error`) se registra pero no pone al modelo 5 h en cuarentena: suele ser culpa del pedido (contexto, esquema).
- Detecta que la base SQLite se recreó (rowid reiniciado) en vez de quedarse ciego para siempre.
- Escritura atómica del estado, sólo cuando cambió; rotación del log; timer registrado con `ctx.effect` (no se filtra al recargar); se quitó un `Map` sin uso.
- `CODE_COMBO` se verifica por test contra `omniroute-code-combo.json`.

**Scripts**
- `configure-code-combo.sh` lee el JSON, valida **antes** de borrar el combo, admite `DRY_RUN=1` y avisa claramente si el router quedó sin combo.
- `patch-gemini-max.sh` cuenta primero y sólo escribe si el layout del bundle coincide (antes podía dejarlo a medio parchear); `EXPECTED_GEMINI_COPIES` para layouts nuevos.
- `verify-installation.sh` comprueba Node/`node:sqlite`, `zstd`, servicio, router, que el combo coincida con el JSON, archivos instalados idénticos al repo y el provider en `settings.yaml`.
- Nuevo `install.sh` con backup.

**`agent.cordis.yml`**
- Corrige contradicciones: el carril `ocwrap` va **primero** (no último) y el hijo **sí** consume la cuota Zen compartida; numeración del flujo (faltaba el paso 3); comentario obsoleto sobre subagent/fork/workflow/ralph.
