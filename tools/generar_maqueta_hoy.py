"""Genera propuesta/maqueta_HOY.html a partir del plan embebido en el HTML original.

Solo lectura: no modifica el original. Uso:
    python3 tools/generar_maqueta_hoy.py original/Pizarra_Operaciones_2026-11-13.html 2026-11-18
"""
import html, json, re, sys, collections

src, hoy = sys.argv[1], sys.argv[2]
txt = open(src, encoding="utf-8").read()
m = re.search(r"/\*PLAN_INICIAL_INI\*/(.*?)/\*PLAN_INICIAL_FIN\*/", txt, re.S)
plan = json.loads(m.group(1))
U = {u["id"]: u for u in plan["unidades"]}
OBRA = {"lmt": "EFE LMT", "chena": "EFE CHENA", "nos": "EFE NOS"}
PERSONAL = {"supervisor", "jefe_terreno", "capataz", "electromecanico", "topografo", "rigger",
            "habilitado_via", "operador", "operador_grua", "prevencionista", "ayudante", "m1_oocc", "m1_ooee"}
EQUIPO = {"georradar", "equipo_tendido", "portacarretes", "hincadora"}
e = lambda s: html.escape(str(s if s is not None else ""))

acts = [a for a in plan["actividades"] if a["fecha"] == hoy]
acts.sort(key=lambda a: (a["turno"] != "Diurno", a.get("proyecto", ""), -(a.get("posteIni") or 0)))

# --- alertas (mismas reglas propuestas para la Etapa 6, calculadas sobre datos reales) ---
alertas = []
uso = collections.defaultdict(list)
for a in acts:
    for r in a["recursos"]:
        uso[(r["unidad"], a["turno"])].append(a)
for (uid, turno), lst in uso.items():
    if len({x["id"] for x in lst}) > 1:
        mando = U.get(uid, {}).get("tipo") in ("supervisor", "jefe_terreno", "capataz")
        alertas.append(("info" if mando else "alta", "Supervisión en varios frentes" if mando else "Recurso asignado simultáneamente",
                        f"{U.get(uid, {}).get('nombre', uid)} está en {len(lst)} actividades ({turno})",
                        [x["id"] for x in lst]))
for a in acts:
    if not (a.get("responsable") or "").strip():
        alertas.append(("alta", "Actividad sin responsable", a["actividad"], [a["id"]]))
    for r in a["recursos"]:
        u = U.get(r["unidad"])
        if u is None:
            alertas.append(("alta", "Recurso inexistente", f"«{a['actividad']}» referencia {r['unidad']}", [a["id"]]))
        elif u.get("activo") is False:
            alertas.append(("media", "Recurso inactivo", f"{u['nombre']} en «{a['actividad']}»", [a["id"]]))
    if a.get("requierePreventiva") and not a.get("preventiva"):
        alertas.append(("media", "Documentación requerida sin respaldo",
                        f"«{a['actividad']}» requiere preventiva EPF y no tiene una vinculada", [a["id"]]))
venc = [a for a in plan["actividades"] if a["fecha"] < hoy and a["estado"].lower() in ("programada", "en curso")]
if venc:
    alertas.append(("media", "Vencidas sin cierre ni reprogramación",
                    f"{len(venc)} actividades con fecha anterior a hoy siguen 'Programada' (sin cierre registrado)", []))
ids = set(U)
for c in plan["configuraciones"]:
    falt = [x for x in c["miembros"] if x not in ids]
    if falt:
        alertas.append(("media", "Cuadrilla incompleta",
                        f"«{c['nombre']}»: {len(falt)} de {len(c['miembros'])} integrantes no existen en la dotación", []))
for r in plan["lp"]["restricciones"]:
    if r["st"] != "ok":
        hit = [a["id"] for a in acts if a.get("partida") == r["act"]]
        if hit:
            alertas.append(("alta", "Restricción pendiente", f"{r['act']}: {r['t']}", hit))
orden = {"alta": 0, "media": 1, "info": 2}
alertas.sort(key=lambda x: orden[x[0]])
con_alerta = collections.Counter(i for al in alertas for i in al[3])

def recursos(a, filtro):
    return [U[r["unidad"]] for r in a["recursos"] if r["unidad"] in U and filtro(U[r["unidad"]]["tipo"])]

def lugar(a):
    if a.get("posteIni"):
        pi, pf = sorted([a["posteIni"], a["posteFin"] or a["posteIni"]])
        return f"P{pi}" if pi == pf else f"P{pi}–P{pf}"
    return "—"

def tarjeta(a):
    est = a["estado"].capitalize()
    n_al = con_alerta.get(a["id"], 0)
    pers = recursos(a, lambda t: t in PERSONAL)
    maq = recursos(a, lambda t: t not in PERSONAL and t not in EQUIPO)
    eq = recursos(a, lambda t: t in EQUIPO)
    li = lambda xs: "".join(f"<li>{e(x['nombre'])}</li>" for x in xs) or "<li class=mut>Sin asignar</li>"
    rend = f"{a.get('rendimiento')} {a.get('unidad') or ''}/turno" if a.get("rendimiento") else "—"
    return f"""
<details class="card {'warn' if n_al else ''}" id="{e(a['id'])}">
 <summary>
  <div class="l1"><span class="obra">{OBRA.get(a.get('proyecto'), '')}</span>
   <span class="estado st-{e(est.lower())}">{e(est)}</span>
   {f'<span class="chip-al">⚠ {n_al}</span>' if n_al else ''}</div>
  <div class="tit">{e(a['actividad'])}</div>
  <div class="meta"><span>📍 {e(a.get('entregable') or '—')}</span><span>⛓ {lugar(a)}</span>
   <span>👷 {e(a.get('responsable'))}</span><span>👥 {e(a.get('cuadrilla') or '—')}</span>
   <span>{'☀ Diurno' if a['turno'] == 'Diurno' else '☾ Nocturno'}</span></div>
 </summary>
 <div class="det">
  <div><h4>Personal ({len(pers)})</h4><ul>{li(pers)}</ul></div>
  <div><h4>Maquinaria / vehículos ({len(maq)})</h4><ul>{li(maq)}</ul></div>
  <div><h4>Equipos ({len(eq)})</h4><ul>{li(eq)}</ul></div>
  <div><h4>Rendimiento</h4><p>{e(rend)} · partida {e(a.get('partida') or '—')}</p>
   <h4>Entregable</h4><p>{e(a.get('entregable') or '—')}</p>
   <h4>Preventiva</h4><p>{'Requiere preventiva EPF' if a.get('requierePreventiva') else 'No requiere'}</p></div>
  <div class="full"><h4>Observaciones</h4><p>{e(a.get('observaciones') or '—')}</p></div>
  <div class="full mut">Documentación e historial: se habilitan en la Etapa 4 (hoy no existen en los datos).</div>
 </div>
</details>"""

def col(titulo, lst):
    return f'<section><h3>{titulo} <small>{len(lst)}</small></h3>{"".join(tarjeta(a) for a in lst) or "<p class=mut>Sin actividades en este turno</p>"}</section>'

ejec = [a for a in acts if a["estado"].lower() == "en curso"]
term = [a for a in acts if a["estado"].lower() == "terminada"]
prog = [a for a in acts if a["estado"].lower() == "programada"]
graves = {i for n, _, _, ids_ in alertas if n == "alta" for i in ids_}
restr = [a for a in acts if a["id"] in graves]
personas = {r["unidad"] for a in acts for r in a["recursos"] if U.get(r["unidad"], {}).get("tipo") in PERSONAL}
maquinas = {r["unidad"] for a in acts for r in a["recursos"] if r["unidad"] in U and U[r["unidad"]]["tipo"] not in PERSONAL}
cuadr = {a.get("cuadrilla") for a in acts if a.get("cuadrilla")}
nombre = {a["id"]: a["actividad"] for a in acts}
grupos = collections.OrderedDict()
for n, t, d, ids_ in alertas:
    grupos.setdefault((n, t), []).append((d, ids_))
def item(d, ids_):
    links = "".join(f'<a href="#{e(i)}" onclick="document.getElementById(\'{e(i)}\').open=true">{e(nombre.get(i, "")[:38])}</a>' for i in ids_[:4])
    return f'<div class="it">{e(d)}{"<div class=lk>" + links + "</div>" if links else ""}</div>'
al_html = "".join(
    f'<li class="{n}"><details {"open" if n == "alta" else ""}><summary><b>{e(t)}</b> <small>{len(v)}</small></summary>'
    + "".join(item(d, i) for d, i in v) + "</details></li>" for (n, t), v in grupos.items())

out = f"""<!DOCTYPE html><html lang="es"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>Maqueta HOY · Pizarra Operativa 2.0</title>
<style>
:root{{--bg:#0f1720;--pan:#17212b;--bd:#26323f;--tx:#e6edf3;--mut:#8b98a5;--ok:#3fb950;--run:#2f81f7;--warn:#d29922;--bad:#f85149}}
*{{box-sizing:border-box}}body{{margin:0;font:14px/1.4 system-ui,sans-serif;background:var(--bg);color:var(--tx)}}
header{{display:flex;gap:12px;align-items:center;flex-wrap:wrap;padding:10px 16px;border-bottom:1px solid var(--bd);background:var(--pan)}}
nav a{{color:var(--mut);text-decoration:none;padding:6px 10px;border-radius:6px}}nav a.on{{background:#f0883e;color:#111;font-weight:600}}
.fecha{{font-weight:700;font-size:16px}}.sp{{flex:1}}
.kpis{{display:flex;gap:8px;flex-wrap:wrap;padding:12px 16px}}.kpi{{background:var(--pan);border:1px solid var(--bd);border-radius:8px;padding:8px 12px;min-width:110px}}
.kpi b{{display:block;font-size:20px}}.kpi span{{color:var(--mut);font-size:12px}}.kpi.al b{{color:var(--bad)}}
main{{display:grid;grid-template-columns:1fr 330px;gap:16px;padding:0 16px 24px}}
.cols{{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:12px;align-items:start}}
h3{{margin:6px 0;font-size:13px;text-transform:uppercase;letter-spacing:.04em;color:var(--mut)}}h3 small{{background:var(--bd);border-radius:10px;padding:1px 7px;color:var(--tx)}}
.card{{background:var(--pan);border:1px solid var(--bd);border-left:4px solid var(--run);border-radius:8px;margin-bottom:8px}}
.card.warn{{border-left-color:var(--warn)}}summary{{list-style:none;cursor:pointer;padding:8px 10px}}summary::-webkit-details-marker{{display:none}}
.l1{{display:flex;gap:6px;align-items:center;font-size:11px}}.obra{{color:var(--mut)}}.estado{{background:#23303d;border-radius:4px;padding:1px 6px}}
.chip-al{{color:var(--warn);margin-left:auto}}.tit{{font-weight:600;margin:3px 0}}
.meta{{display:flex;flex-wrap:wrap;gap:4px 10px;color:var(--mut);font-size:12px}}
.det{{display:grid;grid-template-columns:1fr 1fr;gap:4px 14px;padding:4px 12px 10px;border-top:1px solid var(--bd)}}.det .full{{grid-column:1/-1}}
.det h4{{margin:8px 0 2px;font-size:11px;color:var(--mut);text-transform:uppercase}}.det ul{{margin:0;padding-left:16px}}.det p{{margin:0}}
.mut{{color:var(--mut)}}aside{{background:var(--pan);border:1px solid var(--bd);border-radius:8px;padding:10px;align-self:start;position:sticky;top:8px;max-height:92vh;overflow:auto}}
aside ul{{list-style:none;margin:0;padding:0}}aside li{{border-left:3px solid var(--warn);padding:5px 8px;margin:6px 0;background:#1c2733;border-radius:4px}}
aside li.alta{{border-left-color:var(--bad)}}aside li b{{display:block;font-size:12px}}aside li span{{font-size:12px;color:var(--mut)}}aside a{{color:#58a6ff;font-size:12px;display:block}}aside li.info{{border-left-color:var(--mut)}}
aside summary{{cursor:pointer}}.it{{font-size:12px;color:var(--mut);margin:4px 0 0}}.lk{{padding-left:8px}}
@media(max-width:820px){{main{{grid-template-columns:1fr}}aside{{position:static;max-height:none;order:-1}}.det{{grid-template-columns:1fr}}}}
</style></head><body>
<header><span class="fecha">HOY · miércoles {hoy[8:10]}-{hoy[5:7]}-{hoy[:4]}</span><span>☀ Diurno / ☾ Nocturno</span><span class="sp"></span>
<nav><a class="on">Hoy</a><a>Programa</a><a>Recursos</a><a>Gestión</a><a>Control</a></nav></header>
<div class="kpis">
 <div class="kpi"><b>{len(prog)}</b><span>Programadas</span></div><div class="kpi"><b>{len(ejec)}</b><span>En ejecución</span></div>
 <div class="kpi"><b>{len(term)}</b><span>Terminadas</span></div><div class="kpi"><b>{len(restr)}</b><span>Con alerta grave</span></div>
 <div class="kpi"><b>{len(cuadr)}</b><span>Cuadrillas activas</span></div><div class="kpi"><b>{len(personas)} · {len(maquinas)}</b><span>Personas · Máquinas</span></div>
 <div class="kpi al"><b>{len(alertas)}</b><span>Alertas</span></div></div>
<main><div class="cols">{col("☀ Turno diurno", [a for a in acts if a["turno"] == "Diurno"])}{col("☾ Turno nocturno", [a for a in acts if a["turno"] != "Diurno"])}</div>
<aside><h3>Requiere atención</h3><ul>{al_html}</ul></aside></main>
<p class="mut" style="padding:0 16px 16px">Maqueta estática generada desde los datos reales del archivo original ({len(acts)} actividades del {hoy}). No es la versión funcional.</p>
</body></html>"""
open("propuesta/maqueta_HOY.html", "w", encoding="utf-8").write(out)
print(len(acts), "actividades,", len(alertas), "alertas")
