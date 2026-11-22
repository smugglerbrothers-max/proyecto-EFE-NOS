"""El motor JavaScript del simulador interactivo debe comportarse igual que simulador.py.

Se genera un escenario al azar (pulsadores, selectores, hongos, fallas y valores analógicos que
cruzan todos los umbrales del programa), se ejecuta en los dos motores y se compara el estado
completo después de cada scan: bits, registros D, temporizadores y líneas que actuaron.
"""

import json
import random
import shutil
import subprocess
import sys
from pathlib import Path

import pytest

RAIZ = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(RAIZ))

from simulador import ENTRADAS, PLC, cargar_programa  # noqa: E402

pytestmark = pytest.mark.skipif(shutil.which("node") is None, reason="Node.js no está instalado")

NIVELES = [0, 400, 479, 480, 481, 1600, 1601, 1650, 2240, 2241, 2560, 2600, 3200]
TEMPS = [960, 999, 1000, 1001, 1200, 1600, 1601, 1640, 1999, 2000, 2040, 4000]
PRESIONES = [0, 1500, 1999, 2000, 2001, 2500, 4000]


def escenario(semilla: int) -> list[dict]:
    rnd = random.Random(semilla)
    normal = {e.direccion: e.contacto == "NC" for e in ENTRADAS}
    pasos = [
        {"n": 5, "X": dict(normal), "D": {8280: 1920, 8281: 1920, 10: 1200, 11: 1200, 12: 0, 13: 2500},
         "M100": True},
        {"n": 30, "X": {"X000": True}, "D": {}},        # partida
        {"n": 400, "X": {"X000": False}, "D": {}},
        {"n": 3100, "X": {}, "D": {13: 1500}},          # baja presión 30 s con G3 en marcha (T11)
        {"n": 50, "X": {"X024": True}, "D": {}},        # reset
        {"n": 50, "X": {"X024": False}, "D": {13: 2500}},
        {"n": 30, "X": {"X021": True}, "D": {}},        # habilitar torre
        {"n": 400, "X": {"X021": False}, "D": {11: 1700}},   # 42,5 °C: recirculación con G2
        {"n": 50, "X": {}, "D": {11: 900}},
    ]
    x = dict(normal)
    for k in range(400):
        cambios, D = {}, {}
        r = rnd.random()
        if r < 0.45:                              # pulso o cambio de una entrada
            e = rnd.choice(ENTRADAS)
            x[e.direccion] = not x[e.direccion]
            cambios[e.direccion] = x[e.direccion]
        elif r < 0.55:                            # volver a condición normal (excepto selectores)
            for e in ENTRADAS:
                if e.tipo != "selector":
                    x[e.direccion] = normal[e.direccion]
            cambios = dict(x)
        else:                                     # valores analógicos en torno a los umbrales
            canal = rnd.choice([8280, 8281, 10, 11, 12, 13])
            pool = NIVELES if canal > 8000 else PRESIONES if canal == 13 else TEMPS
            D[canal] = rnd.choice(pool) if rnd.random() < 0.8 else rnd.randint(0, 4000 if canal < 8000 else 3200)
        n = rnd.choice([1, 1, 2, 3, 10, 50, 120, 300])
        pasos.append({"n": n, "X": cambios, "D": D})
    x = dict(normal)
    pasos.append({"n": 30200, "X": dict(normal), "D": {10: 2040}})   # alta temperatura 5 min (T10)
    pasos.append({"n": 50, "X": {}, "D": {10: 1200}, "M100": False})  # FROM con el bloque analógico
    return pasos


def estado(plc: PLC) -> str:
    b = ",".join(sorted(k for k, v in plc.bits.items() if v))
    d = ",".join(f"{k}={v}" for k, v in sorted(plc.D.items()) if v != 0)
    t = ",".join(f"{k}={v}" for k, v in sorted(plc.temp_acum.items()) if v)
    lin = ",".join(str(n) for n in sorted(plc.lineas_scan))
    return f"{b}|{d}|{t}|{lin}"


@pytest.mark.parametrize("semilla", [1, 2])
def test_motor_js_igual_a_python(tmp_path, semilla):
    pasos = escenario(semilla)
    ruta_esc = tmp_path / "escenario.json"
    ruta_esc.write_text(json.dumps(pasos))
    salida = tmp_path / "js.txt"
    subprocess.run(["node", str(RAIZ / "tests" / "correr_motor_js.js"), str(RAIZ / "Programa_IL_GXWorks2.txt"),
                    str(ruta_esc), str(salida)], check=True)
    js = salida.read_text().splitlines()

    plc = PLC(cargar_programa())
    py = []
    for p in pasos:
        plc.entradas.update(p["X"])
        for k, v in p["D"].items():
            plc.D[int(k)] = v
        if "M100" in p:
            plc.bits["M100"] = p["M100"]
        for _ in range(p["n"]):
            plc.scan()
            py.append(estado(plc))

    assert len(py) == len(js)
    for i, (a, b) in enumerate(zip(py, js)):
        assert a == b, f"scan {i}: Python y JS difieren\nPY: {a}\nJS: {b}"
    # el escenario recorrió las partes importantes del programa
    vistos = {e.dispositivo for e in plc.eventos if e.valor}
    for dispositivo in ("Y000", "Y001", "Y002", "Y004", "Y025", "Y032", "Y033", "Y037", "M33", "T10", "T11"):
        assert dispositivo in vistos, f"el escenario nunca activó {dispositivo}"


def test_html_interactivo_al_dia():
    """simulador_interactivo.html debe llevar el IL y el motor actuales (python construir_interactivo.py)."""
    html = (RAIZ / "simulador_interactivo.html").read_text(encoding="utf-8")
    programa = (RAIZ / "Programa_IL_GXWorks2.txt").read_text(encoding="utf-8")
    motor = (RAIZ / "interactivo" / "motor_plc.js").read_text(encoding="utf-8")
    assert json.dumps(programa, ensure_ascii=False).replace("</", "<\\/") in html, \
        "el HTML no tiene el programa IL actual: corre python construir_interactivo.py"
    assert motor in html, "el HTML no tiene el motor actual: corre python construir_interactivo.py"
