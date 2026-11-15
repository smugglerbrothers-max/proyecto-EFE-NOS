"""
Guion del video: línea de tiempo de escenas, acciones del operador, cambios de
las señales analógicas, narración y verificaciones automáticas.

Las acciones solo tocan lo que tocaría un operador o el proceso (pulsadores,
selectores, nivel, temperatura, presión). Todo lo que el PLC responde sale del
programa IL a través de simulador.py. Si una verificación falla, el render se
detiene e indica qué escena y qué condición no se cumplió.

Narración: cada ("sub", texto) es a la vez subtítulo y frase hablada. Las
frases nunca se pisan: si el PLC reacciona mientras todavía se está hablando,
la frase siguiente espera su turno. Las acciones del operador (pulsar, girar,
mover una señal) también esperan a que termine la frase anterior, para que el
espectador escuche la explicación antes del siguiente paso. Las respuestas del
PLC y los cambios de velocidad de la simulación ocurren siempre en el momento.

Uso:  python guion.py      (corre el guion sin video y muestra las verificaciones)
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Callable

from simulador import Tablero

FPS = 30
PAUSA_ENTRE_FRASES = 0.35      # s de silencio entre una frase y la siguiente


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
    t: float | None = None             # segundo mínimo de la escena (espera la narración)
    cuando: Cond | None = None         # o bien: al cumplirse esta condición del PLC
    retardo: float | None = None       # con 'cuando': s después; si se da, espera la narración
    hecha: bool = False
    t_real: float | None = None        # instante en que se ejecutó

    @property
    def espera_narracion(self) -> bool:
        return self.cuando is None or self.retardo is not None


@dataclass
class Verificacion:
    descripcion: str
    condicion: Cond
    lineas: str = ""                   # líneas del programa responsables
    durante: bool = False              # True: debe cumplirse en algún momento de la escena
    resultado: bool | None = None      # False: se evalúa al final de la escena


@dataclass
class Escena:
    numero: int
    titulo: str
    duracion: float                    # duración mínima (se alarga si la narración lo pide)
    acciones: list[Accion] = field(default_factory=list)
    verificaciones: list[Verificacion] = field(default_factory=list)
    simula: bool = True                # portada y cierre no corren el PLC
    velocidad_inicial: float = 1.0
    narracion: str = ""                # frase hablada de portada / cierre
    t_real: float = 0.0                # duración final


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


def V(descripcion, condicion, lineas, durante=False):
    return Verificacion(descripcion, condicion, lineas, durante)


BOMBAS = ["P-3701A", "P-3701B", "P-3702C", "P-3702D", "P-3702E", "P-3702F"]
VALVULAS = ["VA-01", "VA-02", "VA-03", "VA-04", "VA-05", "VA-06", "VA-07", "VA-08", "VA-09"]


def construir_guion() -> list[Escena]:
    E: list[Escena] = []

    E.append(Escena(1, "Portada", 10, simula=False, narracion=(
        "Simulación del programa PLC de la torre de enfriamiento de Costa Azul. "
        "Como no pudimos probarlo en el equipo real, ejecutamos el programa ciclo a ciclo, igual que el PLC.")))

    # 2 — Partida general (G1 y G3 parten con el mismo flanco de M0) y torre ------------
    E.append(Escena(2, "Partida general con S1 y habilitación de la torre con S41", 6, [
        Accion([("sub", "Partimos con los estanques al 60 %, el agua a 30 °C y todo detenido.")], t=0),
        Accion([("pulsar", "S1"),
                ("sub", "Al pulsar S1, el PLC enciende H12. Con el mismo pulso parten G1 y G3: "
                        "primero se abren VA-01 y VA-07 (líneas 8, 14, 19, 28 y 31).")], t=1),
        Accion([("sub", "Tres segundos después parten las bombas P-3701A y P-3702E "
                        "(líneas 21–22 y 33–34).")], cuando=y("P-3701A")),
        Accion([("pulsar", "S41"),
                ("sub", "Con S41 habilitamos la torre: se abre VA-03, se cierra el by-pass VA-04, "
                        "se enciende H13 y parte el ventilador (líneas 9, 11 y 12).")], t=1),
    ], [
        V("S1 enciende H12 (sistema en servicio)", y("H12"), "8", durante=True),
        V("G1 abre VA-01 y 3 s después parte P-3701A", todos(y("VA-01"), y("P-3701A")), "19, 21, 22"),
        V("G3 parte en paralelo con G1 (VA-07 y P-3702E)", todos(y("VA-07"), y("P-3702E")),
          "27, 28, 31, 33, 34"),
        V("S41 habilita la torre: VA-03, VA-04, H13 y ventilador",
          todos(y("VA-03"), y("VA-04"), y("H13"), y("M-3703")), "9, 11, 12"),
    ]))

    # 3 — Cambio de bomba en G1 --------------------------------------------------------
    E.append(Escena(3, "Grupo 1: cambio de bomba con el selector S11", 6, [
        Accion([("selector", "S11", True),
                ("sub", "Al girar S11, el PLC cierra VA-01, detiene P-3701A y abre VA-02 "
                        "(líneas 19 y 20).")], t=1.5),
        Accion([("sub", "Tres segundos después parte P-3701B. Las dos bombas nunca funcionan "
                        "juntas (líneas 22 y 24).")], cuando=y("P-3701B")),
    ], [
        V("Al girar S11 se cierra VA-01 y se abre VA-02",
          todos(no("VA-01"), y("VA-02"), no("P-3701A")), "19, 20, 22", durante=True),
        V("P-3701B parte 3 s después, nunca junto con P-3701A",
          todos(y("P-3701B"), no("P-3701A")), "23, 24"),
    ]))

    # 4 — G3 trabaja en paralelo con G1 --------------------------------------------------
    E.append(Escena(4, "Grupo 3 en paralelo con el grupo 1", 6, [
        Accion([("sub", "G3 trabaja en paralelo con G1: su permiso exige que G1 esté en marcha "
                        "(línea 27).")], t=0),
        Accion([("pulsar", "S13"),
                ("sub", "Si detenemos G1 con S13, G3 también se detiene (líneas 14 y 29).")], t=1),
        Accion([("pulsar", "S12"),
                ("sub", "Al dar marcha con S12, G1 parte con la bomba B y G3 rearranca solo "
                        "(líneas 14, 28 y 30).")], t=1),
    ], [
        V("Al detener G1 también se detiene G3",
          todos(no("P-3701B"), no("P-3702E"), no("VA-07")), "27, 29", durante=True),
        V("Al dar marcha a G1, G3 rearranca solo", todos(y("P-3701B"), y("P-3702E")), "14, 30, 28"),
    ]))

    # 5 — Recirculación por temperatura ---------------------------------------------------
    E.append(Escena(5, "Temperatura de T-3702 sobre 40 °C: recirculación con G2", 6, [
        Accion([("vel", 5), ("mover", "temp_t2", 42.0, 0.5),
                ("sub", "Ahora calentamos el agua de T-3702. Aceleramos el tiempo x5.")], t=0),
        Accion([("vel", 1),
                ("sub", "Sobre 40 °C, el PLC pide recirculación: parte G2, abre VA-05 y activa KA1 "
                        "(líneas 39 a 44 y 66).")], cuando=m("M20")),
        Accion([("sub", "Tres segundos después parte P-3702C. KA1 baja G1 y G3 a segunda velocidad "
                        "para no sobrecargar la torre.")], cuando=y("P-3702C")),
    ], [
        V("Con T-3702 sobre 40 °C y torre habilitada parte G2 (VA-05, P-3702C)",
          todos(y("VA-05"), y("P-3702C")), "39, 41, 42, 43, 44, 46, 47"),
        V("KA1 se activa mientras opera la recirculación", y("KA1"), "66"),
    ]))

    # 6 — Nivel bajo en T-3701 -------------------------------------------------------------
    E.append(Escena(6, "Nivel bajo en T-3701: G1 se detiene y rearranca solo", 6, [
        Accion([("vel", 10), ("mover", "nivel_t1", 12.0, 1.0),
                ("sub", "Simulamos que T-3701 se vacía. Tiempo acelerado x10.")], t=0),
        Accion([("vel", 1),
                ("sub", "Con 15 % o menos, G1 se detiene y se enciende H7. G3 se detiene con él "
                        "(líneas 13, 15, 27 y 50).")], cuando=y("H7")),
        Accion([("vel", 10), ("mover", "nivel_t1", 55.0, 1.0),
                ("sub", "El estanque se recupera, pero G1 espera hasta llegar a 50 % (línea 16).")],
               cuando=y("H7"), retardo=0.5),
        Accion([("vel", 1),
                ("sub", "Al llegar a 50 %, G1 rearranca solo y G3 lo sigue (líneas 14, 16 y 30).")],
               cuando=ocurrio("M12")),
    ], [
        V("Con T-3701 ≤ 15 %: G1 se detiene y se enciende H7",
          todos(y("H7"), no("P-3701A"), no("P-3701B"), no("VA-01"), no("VA-02")), "13, 15, 50",
          durante=True),
        V("Al volver a 50 % G1 rearranca solo, y G3 con él",
          todos(y("P-3701B"), y("P-3702E"), no("H7")), "16, 14, 30"),
    ]))

    # 7 — Baja presión ---------------------------------------------------------------------
    E.append(Escena(7, "Baja presión en la línea al condensador", 6, [
        Accion([("falla_presion", True),
                ("sub", "Ahora simulamos una caída de presión: PIT-01 baja a 6 bar.")], t=0.3),
        Accion([("vel", 5),
                ("sub", "El PLC espera 30 segundos bajo 8 bar antes de dar la alarma (línea 37). "
                        "Aceleramos x5.")], t=1),
        Accion([("vel", 1),
                ("sub", "Se cumplen los 30 segundos: se enciende H14 y suena la bocina "
                        "(líneas 38 y 58).")], cuando=y("H14")),
        Accion([("pulsar", "S52"),
                ("sub", "Con S52 reconocemos la alarma: la bocina se calla, pero H14 sigue encendida "
                        "(líneas 56 a 58).")], cuando=y("H14"), retardo=0.5),
        Accion([("falla_presion", False),
                ("sub", "Al normalizar la presión, H14 se apaga. G3 nunca se detuvo, para no dejar "
                        "sin agua al condensador.")], cuando=y("H14"), retardo=0.5),
    ], [
        V("Tras 30 s bajo 8 bar se encienden H14 y la bocina HA1",
          todos(y("H14"), y("HA1"), y("P-3702E")), "37, 38, 58", durante=True),
        V("S52 silencia la bocina y H14 sigue encendida", todos(y("H14"), no("HA1")), "57, 58",
          durante=True),
        V("Al terminar, presión normal y sin alarma", todos(no("H14"), no("HA1"), y("P-3702E")), "37, 38"),
    ]))

    # 8 — Reposición de agua ---------------------------------------------------------------
    E.append(Escena(8, "Reposición de agua con VA-09", 6, [
        Accion([("sub", "Ahora rellenamos T-3702 a mano. Está en 60 %, bajo el límite de 70 %.")], t=0),
        Accion([("pulsar", "S51"), ("vel", 5),
                ("sub", "Pulsamos S51 y el PLC abre VA-09 con agua de osmosis (líneas 61 y 63). "
                        "Tiempo x5.")], t=1),
        Accion([("vel", 1),
                ("sub", "Al 80 % se cierra VA-09. Ese nivel también es alto: se enciende H10 y "
                        "G1 se detiene (líneas 13, 53 y 62).")], cuando=y("H10")),
        Accion([("vel", 5), ("mover", "nivel_t2", 65.0, 0.5),
                ("sub", "G3 sigue sacando agua de T-3702 y el nivel baja (línea 27).")],
               cuando=y("H10"), retardo=0.5),
        Accion([("vel", 1),
                ("sub", "Bajo 70 %, G1 rearranca solo (línea 18).")], cuando=ocurrio("M15")),
    ], [
        V("S51 abre VA-09 con T-3702 bajo 70 %", y("VA-09"), "61, 63", durante=True),
        V("Al 80 % se cierra VA-09, se enciende H10, G1 se detiene y G3 sigue",
          todos(y("H10"), no("VA-09"), no("P-3701B"), y("P-3702E")), "62, 53, 13, 27", durante=True),
        V("G1 rearranca solo bajo 70 %", todos(y("P-3701B"), y("P-3702E"), no("VA-09")), "18, 14"),
    ]))

    # 9 — Emergencia general ----------------------------------------------------------------
    E.append(Escena(9, "Emergencia general S00", 6, [
        Accion([("hongo", "S00", True),
                ("sub", "Accionamos la emergencia general S00: se detienen todas las bombas y el ventilador, y las válvulas quedan sin "
                        "energía, en reposo (líneas 7 y 8).")], t=1.5),
        Accion([("hongo", "S00", False),
                ("sub", "Al soltar S00 nada parte solo: hay que dar partida de nuevo con S1.")], t=1),
    ], [
        V("S00 detiene bombas y ventilador, y desenergiza todas las válvulas",
          lambda t: t.accionado("S00") and not any(
              t.y(s) for s in BOMBAS + VALVULAS + ["M-3703", "H12", "H13", "KA1"]), "7, 8", durante=True),
        V("Al desenclavar S00 el sistema no parte solo",
          lambda t: not any(t.y(s) for s in BOMBAS + ["H12"]), "8"),
    ]))

    E.append(Escena(10, "Resumen de lo verificado", 12, simula=False, narracion=(
        "En resumen, todas las comprobaciones resultaron correctas. "
        "La lógica se tomó tal cual del programa, sin modificarla.")))
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


@dataclass
class Frase:
    ident: str
    texto: str
    t_video: float          # instante en que empieza en el video
    duracion: float
    ruta: object = None     # wav (si se sintetizó o grabó)


class Reproductor:
    """Recorre el guion. Por cada cuadro de video avanza el PLC lo que corresponda.

    narrador(ident, texto) -> (ruta_wav | None, duración_s). Por defecto se estima la
    duración sin generar audio (sirve para pruebas y para revisar el guion).
    """

    DURACION_PULSO = 0.4      # segundos de video que se mantiene apretado un pulsador

    def __init__(self, fps: int = FPS, narrador=None):
        self.fps = fps
        if narrador is None:
            from narracion import estimar
            narrador = lambda ident, texto: (None, estimar(texto))
        self.narrador = narrador
        self.escenas = construir_guion()
        self.tab = Tablero()
        self.planta = Planta(self.tab)
        self.tab.correr(0.1)                  # primer scan y escalado inicial
        self.t_sim_inicio = self.tab.plc.t_ms
        self.verificaciones: list[tuple[Escena, Verificacion]] = []
        self.frases: list[Frase] = []
        self.duracion_total = 0.0

    @property
    def duracion_estimada(self) -> float:
        return sum(e.duracion for e in self.escenas) + 60

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
                self._cola.append(h[1])
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

    def _decir(self, texto: str, te: float, t_video: float, esc: Escena) -> None:
        self._n_frase += 1
        ident = f"e{esc.numero:02d}_{self._n_frase:02d}"
        ruta, dur = self.narrador(ident, texto)
        self.frases.append(Frase(ident, texto, t_video, dur, ruta))
        self.subtitulo = texto
        self._fin_voz = te + dur + PAUSA_ENTRE_FRASES

    def cuadros(self):
        self._t_obj = float(self.tab.plc.t_ms)
        t_video = 0.0
        for esc in self.escenas:
            self.velocidad = esc.velocidad_inicial
            self.subtitulo = ""
            self.tab.marca_escena = len(self.tab.plc.eventos)
            self._soltar: dict[str, float] = {}
            self._cola: list[str] = []
            self._fin_voz = 0.0
            self._n_frase = 0
            self._ultimo_paso = 0.0          # cuándo se ejecutó la última acción que esperó turno
            disparos: dict[int, float] = {}
            k = 0
            while True:
                te = k / self.fps
                if not esc.simula:
                    if esc.narracion and self._n_frase == 0 and te >= 0.8:
                        self._decir(esc.narracion, te, t_video, esc)
                        self.subtitulo = ""
                else:
                    for tag, hasta in list(self._soltar.items()):
                        if te >= hasta:
                            self.tab.accionar(tag, False)
                            del self._soltar[tag]
                    libre = te >= self._fin_voz and not self._cola
                    for i, a in enumerate(esc.acciones):
                        if a.hecha:
                            continue
                        if a.cuando is not None and i not in disparos and a.cuando(self.tab):
                            disparos[i] = te
                        if a.cuando is None:
                            listo = libre and te >= self._ultimo_paso + a.t
                        elif i not in disparos:
                            listo = False
                        elif a.retardo is None:
                            listo = True                       # reacción del PLC: inmediata
                        else:
                            listo = libre and te >= max(disparos[i], self._ultimo_paso) + a.retardo
                        if listo:
                            a.hecha = True
                            a.t_real = te
                            self._ejecutar(a.hacer, te)
                            if a.espera_narracion:
                                self._ultimo_paso = te
                                libre = False
                    if self._cola and te >= self._fin_voz:
                        self._decir(self._cola.pop(0), te, t_video, esc)
                    for v in esc.verificaciones:
                        if v.durante and not v.resultado and v.condicion(self.tab):
                            v.resultado = True
                yield Cuadro(esc, te, t_video, self.subtitulo, self.velocidad,
                             set(self._soltar) | self._hongos())
                if esc.simula:
                    self._avanzar_sim(self.velocidad / self.fps)
                t_video += 1 / self.fps
                k += 1
                terminado = (te >= esc.duracion and te >= self._fin_voz + 0.6 and not self._cola
                             and all(a.hecha for a in esc.acciones))
                if terminado or te > 120:
                    break
            esc.t_real = k / self.fps
            if esc.simula:
                pendientes = [a for a in esc.acciones if not a.hecha]
                for v in esc.verificaciones:
                    if not v.durante:
                        v.resultado = bool(v.condicion(self.tab))
                    elif v.resultado is None:
                        v.resultado = False
                    self.verificaciones.append((esc, v))
                fallas = [v for v in esc.verificaciones if not v.resultado]
                if fallas or pendientes:
                    msg = [f"La escena {esc.numero} ({esc.titulo}) no se comportó como dice el guion:"]
                    msg += [f"  - NO se cumplió: {v.descripcion} (líneas {v.lineas})" for v in fallas]
                    msg += [f"  - Acción que nunca ocurrió: {a.hacer}" for a in pendientes]
                    raise ErrorGuion("\n".join(msg))
        self.duracion_total = t_video

    def _hongos(self) -> set[str]:
        return {tag for tag in ("S00", "S01", "S02", "S03") if self.tab.accionado(tag)}


if __name__ == "__main__":
    r = Reproductor()
    for _ in r.cuadros():
        pass
    print(f"Duración del video: {r.duracion_total:.0f} s; tiempo simulado: "
          f"{(r.tab.plc.t_ms - r.t_sim_inicio) / 1000:.1f} s")
    for e in r.escenas:
        print(f"  Escena {e.numero:2d}: {e.t_real:5.1f} s  {e.titulo}")
    for esc, v in r.verificaciones:
        print(f"  [{'OK' if v.resultado else 'FALLA'}] Escena {esc.numero}: {v.descripcion} "
              f"(líneas {v.lineas})")
