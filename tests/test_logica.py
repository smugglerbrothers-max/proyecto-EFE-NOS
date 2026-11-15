"""Pruebas automáticas de la lógica del programa IL (Programa_IL_GXWorks2.txt)."""

import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from simulador import PLC, Tablero, cargar_programa  # noqa: E402


@pytest.fixture
def t():
    tab = Tablero()
    tab.correr(0.1)          # primer scan (M8002) y escalado inicial
    return tab


def partida(t, torre=False):
    t.pulsar("S1")
    if torre:
        t.pulsar("S41")


def correr_vigilando(t, segundos, condicion):
    """Corre scan a scan y verifica una condición en cada ciclo."""
    for _ in range(round(segundos * 1000 / t.plc.scan_ms)):
        t.escribir_analogicas()
        t.plc.scan()
        assert condicion(), f"condición violada en t = {t.plc.t_ms} ms"


# -- lectura del programa y escalado -------------------------------------------

def test_programa_completo():
    p = cargar_programa()
    assert p.lineas == list(range(0, 68))
    assert p.instrucciones[-1].op == "END"


def test_escalado_lineas_2_a_6(t):
    t.fijar(nivel_t1=50, nivel_t2=60, temp_t1=30, temp_t2=41, caudal=12, presion=10)
    t.correr(0.05)
    D = t.plc.D
    assert D[8280] == 1600 and D[100] == 500          # 12 mA → 50,0 % (ejemplo de la Memoria)
    assert D[101] == 600
    assert D[110] == 300 and D[111] == 410
    assert D[112] == 120
    assert D[113] == 100


# -- casos pedidos -----------------------------------------------------------

def test_1_partida_enciende_H12(t):
    assert not t.y("H12")
    partida(t)
    assert t.y("H12")
    assert t.plc.bit("M0")


def test_2_G1_valvula_y_bomba_3s_despues(t):
    partida(t)                       # pulso de 0,3 s
    assert t.y("VA-01") and not t.y("VA-02")
    t.correr(2.6)                    # 2,9 s desde que abrió VA-01
    assert not t.y("P-3701A")
    t.correr(0.2)                    # pasa los 3,0 s
    assert t.y("P-3701A") and t.y("H1")
    assert not t.y("P-3701B")


def test_3_cambio_de_bomba_con_S11_nunca_juntas(t):
    partida(t)
    t.correr(4)
    assert t.y("P-3701A")
    t.accionar("S11", True)          # selector a B
    nunca_juntas = lambda: not (t.y("P-3701A") and t.y("P-3701B"))
    correr_vigilando(t, 0.05, nunca_juntas)
    assert not t.y("VA-01") and t.y("VA-02")
    assert not t.y("P-3701A") and not t.y("P-3701B")
    correr_vigilando(t, 3.1, nunca_juntas)
    assert t.y("P-3701B") and not t.y("P-3701A")
    t.accionar("S11", False)         # y de vuelta a A
    correr_vigilando(t, 3.2, nunca_juntas)
    assert t.y("P-3701A") and not t.y("P-3701B")


def test_4_nivel_bajo_T3701_detiene_y_rearranca_G1(t):
    partida(t)
    t.correr(4)
    assert t.plc.bit("M10") and t.y("P-3701A")
    t.fijar(nivel_t1=15.0)           # D100 = 150 → ≤ 15 %
    t.correr(0.1)
    assert not t.plc.bit("M10") and not t.y("P-3701A") and not t.y("VA-01")
    assert t.y("H7")
    t.fijar(nivel_t1=30)             # sobre 15 % pero bajo 50 %: no rearranca
    t.correr(5)
    assert not t.plc.bit("M10") and not t.y("H7")
    t.fijar(nivel_t1=50)             # recupera 50 %
    t.correr(0.1)
    assert t.plc.bit("M10") and t.y("VA-01")
    t.correr(3.1)
    assert t.y("P-3701A")


def test_5_temperatura_T3702_sobre_40_arranca_G2_y_KA1(t):
    partida(t, torre=True)
    assert t.y("H13")
    t.fijar(temp_t2=40.0)            # 40,0 °C: no es "sobre 40"
    t.correr(1)
    assert not t.plc.bit("M20")
    t.fijar(temp_t2=41.0)
    t.correr(0.1)
    assert t.plc.bit("M20") and t.y("VA-05") and t.y("KA1")
    t.correr(3.1)
    assert t.y("P-3702C") and not t.y("P-3702D")


def test_5b_sin_torre_habilitada_no_arranca_G2(t):
    partida(t, torre=False)
    t.fijar(temp_t2=45)
    t.correr(5)
    assert not t.plc.bit("M20") and not t.y("KA1")


def test_6_baja_presion_30s_H14_bocina_y_reset(t):
    partida(t)
    t.correr(4)
    assert t.plc.bit("M30") and t.y("P-3702E")
    t.fijar(presion=6)               # < 8 bar
    t.correr(29.8)
    assert not t.y("H14") and not t.y("HA1")
    t.correr(0.3)
    assert t.y("H14") and t.y("HA1")
    t.pulsar("S52")                  # Reset
    assert not t.y("HA1") and t.y("H14")   # bocina silenciada, luz sigue
    t.fijar(presion=10)
    t.correr(0.1)
    assert not t.y("H14")


def test_7_emergencia_general_detiene_todo(t):
    partida(t, torre=True)
    t.fijar(temp_t2=45)
    t.correr(5)
    marcha = ["P-3701A", "P-3702C", "P-3702E", "M-3703", "VA-01", "VA-03", "VA-05", "VA-07",
              "H12", "H13", "KA1"]
    assert all(t.y(s) for s in marcha)
    t.accionar("S00", True)
    t.correr(0.05)
    salidas_mando = ["P-3701A", "P-3701B", "P-3702C", "P-3702D", "P-3702E", "P-3702F",
                     "M-3703", "VA-01", "VA-02", "VA-03", "VA-04", "VA-05", "VA-06",
                     "VA-07", "VA-08", "VA-09", "H12", "H13", "KA1"]
    assert not any(t.y(s) for s in salidas_mando)
    t.accionar("S00", False)         # al soltar el hongo no vuelve sola
    t.correr(5)
    assert not any(t.y(s) for s in salidas_mando)
    partida(t)
    assert t.y("H12")


# -- pruebas extra de la Memoria (plan de pruebas 4.1) -----------------------

def test_G3_arranca_en_paralelo_con_G1(t):
    partida(t)
    assert t.y("VA-01") and t.y("VA-07")
    t.correr(3.1)
    assert t.y("P-3701A") and t.y("P-3702E")


def test_nivel_alto_T3702_detiene_G1_y_G3_sigue(t):
    partida(t)
    t.correr(4)
    t.fijar(nivel_t2=81.3)
    t.correr(0.1)
    assert t.y("H10") and not t.plc.bit("M10") and t.plc.bit("M30")
    t.fijar(nivel_t2=68.8)
    t.correr(0.1)
    assert t.plc.bit("M10")


def test_relleno_manual_VA09(t):
    partida(t)
    t.fijar(nivel_t2=65)
    t.pulsar("S51")
    assert t.y("VA-09")
    t.fijar(nivel_t2=80)
    t.correr(0.1)
    assert not t.y("VA-09")


def test_relleno_manual_bloqueado_sobre_70(t):
    partida(t)
    t.fijar(nivel_t2=75)
    t.pulsar("S51")
    assert not t.y("VA-09")


def test_reposicion_automatica_nivel_bajo_T3702(t):
    partida(t)
    t.correr(4)
    t.fijar(nivel_t2=12.5)
    t.correr(0.1)
    assert t.y("H9") and t.y("VA-09") and not t.plc.bit("M30")
    t.fijar(nivel_t2=51.6)
    t.correr(0.1)
    assert not t.y("VA-09") and t.plc.bit("M30")


def test_temporizador_fx_semantica():
    """OUT T: acumula mientras la entrada está activa y se repone al caer."""
    from simulador import Instruccion, Programa
    prog = Programa([
        Instruccion("LD", ["X000"], 0, 0),
        Instruccion("OUT", ["T0", "K10"], 0, 1),
        Instruccion("LDP", ["X001"], 1, 2),
        Instruccion("OUT", ["M0"], 1, 3),
        Instruccion("END", [], 2, 4),
    ])
    plc = PLC(prog)
    plc.entradas = {"X000": True, "X001": False}
    plc.correr(0.99)
    assert not plc.bit("T0")
    plc.correr(0.01)
    assert plc.bit("T0")
    plc.entradas["X000"] = False
    plc.scan()
    assert not plc.bit("T0") and plc.temp_acum[0] == 0
    plc.entradas["X001"] = True
    plc.scan()
    assert plc.bit("M0")
    plc.scan()
    assert not plc.bit("M0")          # flanco dura un solo scan


def test_alta_temperatura_T3701_5_minutos(t):
    partida(t)
    t.fijar(temp_t1=51)              # D10 = 2040 (Memoria, prueba 12)
    t.correr(299.5)
    assert not t.y("H11") and not t.y("HA1")
    t.correr(0.6)
    assert t.y("H11") and t.y("HA1")
    t.pulsar("S52")
    assert t.y("H11") and not t.y("HA1")
