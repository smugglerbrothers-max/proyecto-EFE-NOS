"""
Guion del video: línea de tiempo de escenas, acciones del operador, cambios de
las señales analógicas y verificaciones automáticas.

Las acciones solo tocan lo que tocaría un operador o el proceso (pulsadores,
selectores, nivel, temperatura, presión). Todo lo que el PLC responde sale del
programa IL a través de simulador.py. Si una verificación falla, el render se
detiene e indica qué escena y qué condición no se cumplió.

Uso:  python guion.py      (corre el guion sin video y muestra las verificaciones)
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Callable

from simulador import Tablero

FPS = 30


# ---------------------------------------------------------------------------
# Modelo muy simple del proceso (lo que el PLC "ve" por sus transmisores)
# ---------------------------------------------------------------------------

class Planta:
    """Evoluciona nivel, temperatura, caudal y presión en tiempo simulado."""

    def __init__(self, tab: Tablero):
        self.tab = tab
        self.movimientos: dict[str, tuple[float, float]] = {}   # var -> (destino, velocidad/s)
        self.falla_presion = False
        self.presion_normal = 10.0     # bar con G3 en marcha
        self.presion_falla = 6.0
        self.caudal_osmosis = 12.0     # m³/h con VA-09 abierta
        self.relleno_pct_s = 1.0       # % por segundo que sube T-3702 con VA-09 abierta

    def mover(self, var: str, destino: float, velocidad: float) -> None:
        self.movimientos[var] = (destino, abs(velocidad))

    def paso(self, dt: float) -> None:
        t = self.tab
        for var, (destino, vel) in list(self.movimientos.items()):
            actual = getattr(t, var)
            d = destino - actual
            if abs(d) <= vel * dt:
                setattr(t, var, destino)
                del self.movimientos[var]
            else:
                setattr(t, var, actual + vel * dt * (1 if d > 0 else -1))
        g3 = t.y("P-3702E") or t.y("P-3702F")
        objetivo = (self.presion_falla if self.falla_presion else self.presion_normal) if g3 else 0.0
        t.presion += (objetivo - t.presion) * min(1.0, dt / 1.2)
        va09 = t.y("VA-09")
        t.caudal += ((self.caudal_osmosis if va09 else 0.0) - t.caudal) * min(1.0, dt / 0.8)
        if va09:
            t.nivel_t2 = min(100.0, t.nivel_t2 + self.relleno_pct_s * dt)


# ---------------------------------------------------------------------------
# Estructura del guion
# ---------------------------------------------------------------------------

Cond = Callable[[Tablero], bool]


@dataclass
class Accion:
    hacer: list[tuple]                 # [("pulsar","S1"), ("sub","..."), ("vel",10), ...]
    t: float | None = None             # segundo de la escena (tiempo de video)
    cuando: Cond | None = None         # o bien: al cumplirse esta condición
    retardo: float = 0.0               # segundos de video después de la condición
    hecha: bool = False
    t_real: float | None = None        # instante en que se ejecutó (para revisar el guion)


@dataclass
class Verificacion:
    descripcion: str
    condicion: Cond
    t: float | None = None             # se evalúa en ese segundo de la escena...
    lineas: str = ""                   # líneas del programa responsables
    resultado: bool | None = None      # ...o, si t es None, al final de la escena


@dataclass
class Escena:
    numero: int
    titulo: str
    duracion: float
    acciones: list[Accion] = field(default_factory=list)
    verificaciones: list[Verificacion] = field(default_factory=list)
    simula: bool = True                # portada y cierre no corren el PLC
    velocidad_inicial: float = 1.0


def y(tag: str) -> Cond:
    return lambda t: t.y(tag)


def no(tag: str) -> Cond:
    return lambda t: not t.y(tag)


def todos(*conds: Cond) -> Cond:
    return lambda t: all(c(t) for c in conds)


def m(bit: str) -> Cond:
    return lambda t: t.plc.bit(bit)


def ocurrio(dispositivo: str, valor: bool = True) -> Cond:
    """Verdadero si, desde que empezó la escena, el dispositivo cambió a 'valor'."""
    return lambda t: any(e.dispositivo == dispositivo and e.valor == valor
                         for e in t.plc.eventos[t.marca_escena:])


BOMBAS = ["P-3701A", "P-3701B", "P-3702C", "P-3702D", "P-3702E", "P-3702F"]
VALVULAS = ["VA-01", "VA-02", "VA-03", "VA-04", "VA-05", "VA-06", "VA-07", "VA-08", "VA-09"]


def construir_guion() -> list[Escena]:
    E: list[Escena] = []

    E.append(Escena(1, "Portada", 10, simula=False))

    # 2 — Partida general (G1 y G3 parten con el mismo flanco de M0) y torre ------------
    E.append(Escena(2, "Partida general con S1 y habilitación de la torre con S41", 17, [
        Accion([("sub", "Partimos con los estanques al 60 %, el agua a 30 °C, 10 bar disponibles "
                        "y sin fallas. Todo está detenido.")], t=0),
        Accion([("pulsar", "S1"),
                ("sub", "Al dar partida con S1, el PLC enciende H12 y habilita los grupos. Con el "
                        "mismo pulso parten G1 y G3 en paralelo: primero se abren VA-01 y VA-07 "
                        "(líneas 8, 14, 19, 28 y 31).")], t=3.5),
        Accion([("sub", "Pasados 3 s con la válvula abierta, parten P-3701A y P-3702E "
                        "(temporizadores T0 y T4, líneas 21–22 y 33–34).")],
               cuando=y("P-3701A")),
        Accion([("pulsar", "S41"),
                ("sub", "Con S41 habilitamos la torre: se abre VA-03, se cierra el by-pass VA-04, "
                        "se enciende H13 y parte el ventilador (líneas 9, 11 y 12).")], t=11.5),
    ], [
        Verificacion("S1 enciende H12 (sistema en servicio)", y("H12"), t=4.0, lineas="8"),
        Verificacion("G1 abre VA-01 y 3 s después parte P-3701A",
                     todos(y("VA-01"), y("P-3701A")), lineas="19, 21, 22"),
        Verificacion("G3 parte en paralelo con G1 (VA-07 y P-3702E)",
                     todos(y("VA-07"), y("P-3702E")), lineas="27, 28, 31, 33, 34"),
        Verificacion("S41 habilita la torre: VA-03, VA-04, H13 y ventilador",
                     todos(y("VA-03"), y("VA-04"), y("H13"), y("M-3703")), lineas="9, 11, 12"),
    ]))

    # 3 — Cambio de bomba en G1 --------------------------------------------------------
    E.append(Escena(3, "Grupo 1: cambio de bomba con el selector S11", 13, [
        Accion([("sub", "El grupo 1 envía el agua caliente de T-3701 a la torre con P-3701A.")], t=0),
        Accion([("selector", "S11", True),
                ("sub", "Giramos S11 a la posición B: el PLC cierra VA-01, detiene P-3701A y abre "
                        "VA-02 (líneas 19 y 20).")], t=2),
        Accion([("sub", "Corre de nuevo el retardo de 3 s y recién entonces parte P-3701B. "
                        "El interbloqueo impide que A y B funcionen juntas (líneas 22 y 24).")],
               cuando=y("P-3701B")),
    ], [
        Verificacion("Al girar S11 se cierra VA-01 y se abre VA-02",
                     todos(no("VA-01"), y("VA-02"), no("P-3701A")), t=2.5, lineas="19, 20, 22"),
        Verificacion("P-3701B parte 3 s después, nunca junto con P-3701A",
                     todos(y("P-3701B"), no("P-3701A")), lineas="23, 24"),
    ]))

    # 4 — G3 trabaja en paralelo con G1 --------------------------------------------------
    E.append(Escena(4, "Grupo 3 en paralelo con el grupo 1", 15, [
        Accion([("sub", "G3 lleva agua fría de T-3702 al condensador. Su permiso exige que G1 esté "
                        "en marcha, así los dos estanques no se desbalancean (línea 27).")], t=0),
        Accion([("pulsar", "S13"),
                ("sub", "Lo comprobamos: detenemos G1 con su parada local S13 y G3 se detiene "
                        "con él (líneas 14, 27 y 29).")], t=3.5),
        Accion([("pulsar", "S12"),
                ("sub", "Damos marcha a G1 con S12: parte con P-3701B, y G3 rearranca solo "
                        "detrás de él (líneas 14, 30 y 28).")], t=8),
    ], [
        Verificacion("Al detener G1 también se detiene G3",
                     todos(no("P-3701B"), no("P-3702E"), no("VA-07")), t=5.5, lineas="27, 29"),
        Verificacion("Al dar marcha a G1, G3 rearranca solo",
                     todos(y("P-3701B"), y("P-3702E")), lineas="14, 30, 28"),
    ]))

    # 5 — Recirculación por temperatura ---------------------------------------------------
    E.append(Escena(5, "Temperatura de T-3702 sobre 40 °C: recirculación con G2", 17, [
        Accion([("vel", 5), ("mover", "temp_t2", 42.0, 0.5),
                ("sub", "Ahora simulamos que el agua de T-3702 se calienta. Aceleramos el tiempo "
                        "x5 mientras sube la temperatura.")], t=0),
        Accion([("vel", 1),
                ("sub", "Al pasar los 40 °C, el PLC pide recirculación: parte G2, abre VA-05 y "
                        "activa KA1 (líneas 39, 41, 43, 44 y 66).")], cuando=m("M20")),
        Accion([("sub", "3 s después parte P-3702C. KA1 baja G1 y G3 a segunda velocidad para no "
                        "superar los 30 m³/h de la torre.")], cuando=y("P-3702C"), retardo=1.0),
    ], [
        Verificacion("Con T-3702 sobre 40 °C y torre habilitada parte G2 (VA-05, P-3702C)",
                     todos(y("VA-05"), y("P-3702C")), lineas="39, 41, 42, 43, 44, 46, 47"),
        Verificacion("KA1 se activa mientras opera la recirculación", y("KA1"), lineas="66"),
    ]))

    # 6 — Nivel bajo en T-3701 -------------------------------------------------------------
    E.append(Escena(6, "Nivel bajo en T-3701: G1 se detiene y rearranca solo", 22, [
        Accion([("vel", 10), ("mover", "nivel_t1", 12.0, 1.0),
                ("sub", "Simulamos que T-3701 se vacía. Tiempo acelerado x10.")], t=0),
        Accion([("vel", 1),
                ("sub", "Con 15 % o menos, el PLC detiene G1 y enciende H7. G3 también se "
                        "detiene, porque trabaja en paralelo con G1 (líneas 13, 15, 27 y 50).")],
               cuando=y("H7")),
        Accion([("vel", 10), ("mover", "nivel_t1", 55.0, 1.0),
                ("sub", "El estanque se recupera. Sobre 15 % vuelve el permiso, pero G1 espera "
                        "hasta que T-3701 llegue a 50 % (línea 16).")],
               cuando=y("H7"), retardo=5),
        Accion([("vel", 1),
                ("sub", "Al llegar a 50 %, G1 rearranca solo, y G3 lo sigue (líneas 16, 14 y 30).")],
               cuando=ocurrio("M12")),
    ], [
        Verificacion("Con T-3701 ≤ 15 %: G1 detenido, H7 encendida",
                     lambda t: True, lineas="13, 15, 50"),   # se reemplaza abajo por una vigilancia
        Verificacion("Al volver a 50 % G1 rearranca solo, y G3 con él",
                     todos(y("P-3701B"), y("P-3702E"), no("H7")), lineas="16, 14, 30"),
    ]))

    # 7 — Baja presión ---------------------------------------------------------------------
    E.append(Escena(7, "Baja presión en la línea al condensador", 22, [
        Accion([("falla_presion", True),
                ("sub", "Simulamos una caída de presión en la línea al condensador: "
                        "PIT-01 baja a 6 bar.")], t=0.5),
        Accion([("vel", 5),
                ("sub", "El PLC espera 30 s con presión bajo 8 bar antes de dar la alarma "
                        "(temporizador T11, línea 37). Aceleramos x5.")], t=2.5),
        Accion([("vel", 1),
                ("sub", "Se cumplen los 30 s: se enciende H14 y suena la bocina HA1 "
                        "(líneas 38 y 58).")], cuando=y("H14")),
        Accion([("pulsar", "S52"),
                ("sub", "Reconocemos con S52 (reset): la bocina se calla, pero H14 sigue "
                        "encendida mientras dure la falla (líneas 57 y 58).")],
               cuando=y("H14"), retardo=4),
        Accion([("falla_presion", False),
                ("sub", "Al normalizar la presión, H14 se apaga sola. G3 nunca se detuvo, para "
                        "no dejar sin agua al condensador.")],
               cuando=y("H14"), retardo=9.5),
    ], [
        Verificacion("Tras 30 s bajo 8 bar se encienden H14 y la bocina HA1",
                     todos(y("H14"), y("HA1"), y("P-3702E")), t=-1, lineas="37, 38, 58"),
        Verificacion("S52 silencia la bocina y H14 sigue encendida",
                     todos(y("H14"), no("HA1")), t=-1, lineas="57, 58"),
        Verificacion("Al terminar, presión normal y sin alarma",
                     todos(no("H14"), no("HA1"), y("P-3702E")), lineas="37, 38"),
    ]))

    # 8 — Reposición de agua ---------------------------------------------------------------
    E.append(Escena(8, "Reposición de agua con VA-09", 25, [
        Accion([("sub", "Rellenamos T-3702 a mano. El estanque está en 60 %, bajo el máximo de "
                        "70 % que permite el relleno manual.")], t=0),
        Accion([("pulsar", "S51"), ("vel", 5),
                ("sub", "Pulsamos S51: el PLC abre VA-09 y entra agua de osmosis. El caudal "
                        "FIT-01 se suma en el totalizador (líneas 61, 63 y 65). Tiempo x5.")], t=2),
        Accion([("vel", 1),
                ("sub", "Al llegar a 80 % se cierra VA-09. Ese 80 % también es nivel alto: se "
                        "enciende H10 y G1 se detiene para no rebalsar T-3702 (líneas 62, 53 y 13).")],
               cuando=y("H10")),
        Accion([("vel", 5), ("mover", "nivel_t2", 65.0, 0.5),
                ("sub", "G3 sigue sacando agua de T-3702 y el nivel baja (línea 27). "
                        "Tiempo x5.")], cuando=y("H10"), retardo=6),
        Accion([("vel", 1),
                ("sub", "Cuando T-3702 baja de 70 %, G1 rearranca solo (línea 18).")],
               cuando=ocurrio("M15")),
    ], [
        Verificacion("S51 abre VA-09 con T-3702 bajo 70 %", y("VA-09"), t=2.8, lineas="61, 63"),
        Verificacion("VA-09 se cierra al 80 %; H10 enciende y G1 se detiene; G3 sigue",
                     lambda t: True, lineas="62, 53, 13, 27"),        # vigilancia, ver abajo
        Verificacion("G1 rearranca solo bajo 70 %",
                     todos(y("P-3701B"), y("P-3702E"), no("VA-09")), lineas="18, 14"),
    ]))

    # 9 — Emergencia general ----------------------------------------------------------------
    E.append(Escena(9, "Emergencia general S00", 14, [
        Accion([("sub", "Para terminar, accionamos la emergencia general S00 con todo en marcha.")], t=0),
        Accion([("hongo", "S00", True),
                ("sub", "El PLC pierde M1 y M0: se detienen todas las bombas y el ventilador, y las "
                        "válvulas quedan sin energía, en su posición de reposo (líneas 7 y 8).")], t=2),
        Accion([("hongo", "S00", False),
                ("sub", "Al desenclavar S00 nada parte solo: hay que volver a dar partida con S1.")],
               t=8.5),
    ], [
        Verificacion("S00 detiene bombas y ventilador, y desenergiza todas las válvulas",
                     lambda t: not any(t.y(s) for s in BOMBAS + VALVULAS + ["M-3703", "H12", "H13", "KA1"]),
                     t=3.0, lineas="7, 8"),
        Verificacion("Al desenclavar S00 el sistema no parte solo",
                     lambda t: not any(t.y(s) for s in BOMBAS + ["H12"]), lineas="8"),
    ]))

    E.append(Escena(10, "Resumen de lo verificado", 16, simula=False))

    # Vigilancias: verificaciones que se cumplen "en algún momento" de la escena.
    E[5].verificaciones[0] = Verificacion(
        "Con T-3701 ≤ 15 %: G1 se detiene y se enciende H7",
        todos(y("H7"), no("P-3701A"), no("P-3701B"), no("VA-01"), no("VA-02")),
        t=-1, lineas="13, 15, 50")
    E[7].verificaciones[1] = Verificacion(
        "Al 80 % se cierra VA-09, se enciende H10, G1 se detiene y G3 sigue",
        todos(y("H10"), no("VA-09"), no("P-3701B"), y("P-3702E")),
        t=-1, lineas="62, 53, 13, 27")
    return E


# ---------------------------------------------------------------------------
# Reproductor: avanza el guion cuadro a cuadro
# ---------------------------------------------------------------------------

class ErrorGuion(Exception):
    pass


@dataclass
class Cuadro:
    escena: Escena
    t_escena: float
    t_video: float
    subtitulo: str
    velocidad: float
    pulsados: set[str]


class Reproductor:
    """Recorre el guion. Por cada cuadro de video avanza el PLC lo que corresponda."""

    DURACION_PULSO = 0.4      # segundos de video que se mantiene apretado un pulsador

    def __init__(self, fps: int = FPS):
        self.fps = fps
        self.escenas = construir_guion()
        self.tab = Tablero()
        self.planta = Planta(self.tab)
        self.tab.correr(0.1)                  # primer scan y escalado inicial
        self.t_sim_inicio = self.tab.plc.t_ms
        self.verificaciones: list[tuple[Escena, Verificacion]] = []

    @property
    def duracion_total(self) -> float:
        return sum(e.duracion for e in self.escenas)

    def _avanzar_sim(self, segundos: float) -> None:
        plc = self.tab.plc
        objetivo = self._t_obj + segundos * 1000
        self._t_obj = objetivo
        while plc.t_ms + plc.scan_ms <= objetivo + 1e-6:
            self.planta.paso(plc.scan_ms / 1000)
            self.tab.escribir_analogicas()
            plc.scan()

    def _ejecutar(self, hacer: list[tuple], esc_t: float) -> None:
        for h in hacer:
            tipo = h[0]
            if tipo == "sub":
                self.subtitulo = h[1]
            elif tipo == "vel":
                self.velocidad = h[1]
            elif tipo == "pulsar":
                self.tab.accionar(h[1], True)
                self._soltar[h[1]] = esc_t + self.DURACION_PULSO
            elif tipo in ("selector", "hongo"):
                self.tab.accionar(h[1], h[2])
            elif tipo == "mover":
                self.planta.mover(h[1], h[2], h[3])
            elif tipo == "falla_presion":
                self.planta.falla_presion = h[1]
            else:
                raise ErrorGuion(f"acción desconocida: {h}")

    def cuadros(self):
        self._t_obj = float(self.tab.plc.t_ms)
        t_video = 0.0
        self.subtitulo = ""
        for esc in self.escenas:
            self.velocidad = esc.velocidad_inicial
            self.tab.marca_escena = len(self.tab.plc.eventos)
            self.subtitulo = ""
            self._soltar: dict[str, float] = {}
            disparos: dict[int, float] = {}      # acción -> instante en que se cumplió la condición
            vigilancias = [v for v in esc.verificaciones if v.t == -1]
            n = round(esc.duracion * self.fps)
            for k in range(n):
                te = k / self.fps
                if esc.simula:
                    for tag, hasta in list(self._soltar.items()):
                        if te >= hasta:
                            self.tab.accionar(tag, False)
                            del self._soltar[tag]
                    for i, a in enumerate(esc.acciones):
                        if a.hecha:
                            continue
                        if a.t is not None and te >= a.t:
                            a.hecha = True
                            a.t_real = te
                            self._ejecutar(a.hacer, te)
                        elif a.cuando is not None:
                            if i not in disparos and a.cuando(self.tab):
                                disparos[i] = te
                            if i in disparos and te >= disparos[i] + a.retardo:
                                a.hecha = True
                                a.t_real = te
                                self._ejecutar(a.hacer, te)
                    for v in esc.verificaciones:
                        if v.t is not None and v.t >= 0 and v.resultado is None and te >= v.t:
                            v.resultado = bool(v.condicion(self.tab))
                    for v in vigilancias:
                        if not v.resultado and v.condicion(self.tab):
                            v.resultado = True
                yield Cuadro(esc, te, t_video, self.subtitulo, self.velocidad,
                             {t for t in self._soltar} | self._hongos())
                if esc.simula:
                    self._avanzar_sim(self.velocidad / self.fps)
                t_video += 1 / self.fps
            if esc.simula:
                pendientes = [a for a in esc.acciones if not a.hecha]
                for v in esc.verificaciones:
                    if v.resultado is None and v.t is None:
                        v.resultado = bool(v.condicion(self.tab))
                    if v.t == -1 and v.resultado is None:
                        v.resultado = False
                    self.verificaciones.append((esc, v))
                fallas = [v for v in esc.verificaciones if not v.resultado]
                if fallas or pendientes:
                    msg = [f"La escena {esc.numero} ({esc.titulo}) no se comportó como dice el guion:"]
                    msg += [f"  - NO se cumplió: {v.descripcion} (líneas {v.lineas})" for v in fallas]
                    msg += [f"  - Acción que nunca ocurrió: {a.hacer}" for a in pendientes]
                    raise ErrorGuion("\n".join(msg))

    def _hongos(self) -> set[str]:
        return {tag for tag in ("S00", "S01", "S02", "S03") if self.tab.accionado(tag)}


if __name__ == "__main__":
    r = Reproductor()
    for _ in r.cuadros():
        pass
    print(f"Duración del video: {r.duracion_total:.0f} s; tiempo simulado: "
          f"{(r.tab.plc.t_ms - r.t_sim_inicio) / 1000:.1f} s")
    for esc, v in r.verificaciones:
        print(f"  [{'OK' if v.resultado else 'FALLA'}] Escena {esc.numero}: {v.descripcion} "
              f"(líneas {v.lineas})")
