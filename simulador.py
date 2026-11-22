"""
Motor de simulación del programa PLC (Mitsubishi FX3GE) de la torre de
enfriamiento Costa Azul.

Lee Programa_IL_GXWorks2.txt (lista de instrucciones) y lo ejecuta por ciclos
de scan de 10 ms simulados, con la semántica del FX:

* evaluación en orden de línea, imagen de entradas al inicio del scan;
* LD/LDI/LDP y comparaciones abren un bloque nuevo; ANB/ORB unen bloques;
* flancos (LDP/ORP/ANDP y PLS) con memoria propia de cada instrucción,
  comparando con el valor que tenía en el scan anterior;
* temporizadores T0–T199 de 100 ms a la conexión (OUT T Kn, n en décimas de s);
* MUL/DIV de 16 bits (MUL deja el producto en 32 bits D,D+1; DIV deja el
  cociente en D y el resto en D+1), MOV, DADD de 32 bits, TO/FROM al FX3U-4AD.

La lógica NO está escrita en este archivo: sale completa del archivo IL.
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from pathlib import Path

RUTA_PROGRAMA = Path(__file__).with_name("Programa_IL_GXWorks2.txt")
SCAN_MS = 10

# ---------------------------------------------------------------------------
# Tabla de entradas y salidas (Memoria del programa, sección 2, y guía
# CADe_SIMU). "NC" = contacto normalmente cerrado: en condición normal la
# entrada está en 1 y se abre (0) al accionarlo.
# ---------------------------------------------------------------------------

@dataclass(frozen=True)
class Entrada:
    tag: str
    direccion: str
    descripcion: str
    contacto: str      # "NA" o "NC"
    tipo: str          # "pulsador", "hongo", "selector", "falla"


ENTRADAS = [
    Entrada("S1", "X000", "Partida general", "NA", "pulsador"),
    Entrada("S0", "X001", "Parada general", "NC", "pulsador"),
    Entrada("S00", "X002", "Emergencia general", "NC", "hongo"),
    Entrada("S01", "X003", "Emergencia G1", "NC", "hongo"),
    Entrada("S02", "X004", "Emergencia G2", "NC", "hongo"),
    Entrada("S03", "X005", "Emergencia G3", "NC", "hongo"),
    Entrada("S11", "X006", "Selector G1 A/B", "NA", "selector"),
    Entrada("S21", "X007", "Selector G2 C/D", "NA", "selector"),
    Entrada("S31", "X010", "Selector G3 E/F", "NA", "selector"),
    Entrada("S12", "X011", "Marcha G1", "NA", "pulsador"),
    Entrada("S13", "X012", "Parada G1", "NC", "pulsador"),
    Entrada("S22", "X013", "Marcha G2", "NA", "pulsador"),
    Entrada("S23", "X014", "Parada G2", "NC", "pulsador"),
    Entrada("S32", "X015", "Marcha G3", "NA", "pulsador"),
    Entrada("S33", "X020", "Parada G3", "NC", "pulsador"),
    Entrada("S41", "X021", "Habilitar torre", "NA", "pulsador"),
    Entrada("S42", "X022", "Deshabilitar torre", "NA", "pulsador"),
    Entrada("S51", "X023", "Relleno manual", "NA", "pulsador"),
    Entrada("S52", "X024", "Reset alarmas", "NA", "pulsador"),
    Entrada("FV34", "X025", "Falla VDF3/VDF4", "NC", "falla"),
    Entrada("FPS34", "X026", "Falla PS3/PS4", "NC", "falla"),
    Entrada("FV12", "X027", "Falla VDF1/VDF2", "NC", "falla"),
    Entrada("FQM7", "X030", "Falla QM7 ventilador", "NC", "falla"),
]
ENTRADA_POR_TAG = {e.tag: e for e in ENTRADAS}

SALIDAS = {
    "Y000": ("P-3701A", "Marcha P-3701A"),
    "Y001": ("P-3701B", "Marcha P-3701B"),
    "Y002": ("P-3702C", "Marcha P-3702C"),
    "Y003": ("P-3702D", "Marcha P-3702D"),
    "Y004": ("P-3702E", "Marcha P-3702E"),
    "Y005": ("P-3702F", "Marcha P-3702F"),
    "Y006": ("M-3703", "Ventilador torre"),
    "Y007": ("VA-01", "Descarga P-3701A"),
    "Y010": ("VA-02", "Descarga P-3701B"),
    "Y011": ("VA-03", "Entrada torre"),
    "Y020": ("VA-04", "By-pass torre"),
    "Y021": ("VA-05", "Descarga P-3702C"),
    "Y022": ("VA-06", "Descarga P-3702D"),
    "Y023": ("VA-07", "Descarga P-3702E"),
    "Y024": ("VA-08", "Descarga P-3702F"),
    "Y025": ("VA-09", "Reposición osmosis"),
    "Y026": ("H7", "Nivel bajo T-3701"),
    "Y027": ("H8", "Nivel alto T-3701"),
    "Y030": ("H9", "Nivel bajo T-3702"),
    "Y031": ("H10", "Nivel alto T-3702"),
    "Y032": ("H11", "Alta temp. T-3701"),
    "Y033": ("HA1", "Bocina"),
    "Y034": ("H12", "Sistema en servicio"),
    "Y035": ("H13", "Torre habilitada"),
    "Y036": ("KA1", "Vel. reducida G1/G3"),
    "Y037": ("H14", "Baja presión"),
}
SALIDA_POR_TAG = {v[0]: k for k, v in SALIDAS.items()}

# H1–H6 no son salidas del PLC: se alimentan del relé "en marcha" de cada VDF
# o partidor (Memoria 2.2). En la simulación suponemos que el accionamiento
# responde a la orden, así que siguen a Y000–Y005.
LUCES_BOMBA = {"H1": "Y000", "H2": "Y001", "H3": "Y002",
               "H4": "Y003", "H5": "Y004", "H6": "Y005"}


# ---------------------------------------------------------------------------
# Lectura del programa
# ---------------------------------------------------------------------------

@dataclass
class Instruccion:
    op: str
    args: list[str]
    linea: int          # número de línea del programa ("; Línea N:")
    indice: int         # posición en la lista completa

    def texto(self) -> str:
        return " ".join([self.op, *self.args])


@dataclass
class Programa:
    instrucciones: list[Instruccion]
    comentarios: dict[int, str] = field(default_factory=dict)

    def texto_linea(self, linea: int) -> str:
        return " ; ".join(i.texto() for i in self.instrucciones if i.linea == linea)

    @property
    def lineas(self) -> list[int]:
        return sorted({i.linea for i in self.instrucciones})


_RE_LINEA = re.compile(r";\s*L[íi]nea\s+(\d+)\s*:\s*(.*)")


def cargar_programa(ruta: Path | str = RUTA_PROGRAMA) -> Programa:
    texto = Path(ruta).read_text(encoding="utf-8")
    instrucciones: list[Instruccion] = []
    comentarios: dict[int, str] = {}
    linea = -1
    for cruda in texto.splitlines():
        s = cruda.strip()
        if not s:
            continue
        if s.startswith(";"):
            m = _RE_LINEA.match(s)
            if m:
                linea = int(m.group(1))
                comentarios[linea] = m.group(2).strip()
            continue
        partes = s.split()
        instrucciones.append(Instruccion(partes[0].upper(), partes[1:], linea, len(instrucciones)))
    return Programa(instrucciones, comentarios)


# ---------------------------------------------------------------------------
# PLC
# ---------------------------------------------------------------------------

_COMPARACIONES = {
    "=": lambda a, b: a == b,
    "<>": lambda a, b: a != b,
    ">": lambda a, b: a > b,
    "<": lambda a, b: a < b,
    ">=": lambda a, b: a >= b,
    "<=": lambda a, b: a <= b,
}
_RE_COMPARACION = re.compile(r"^(LD|AND|OR)(<>|>=|<=|=|>|<)$")


def _s16(v: int) -> int:
    v &= 0xFFFF
    return v - 0x10000 if v & 0x8000 else v


def _s32(v: int) -> int:
    v &= 0xFFFFFFFF
    return v - 0x100000000 if v & 0x80000000 else v


class InstruccionNoSoportada(Exception):
    pass


@dataclass
class Evento:
    t_ms: int
    linea: int
    dispositivo: str
    valor: bool


class PLC:
    """Ejecuta un Programa por ciclos de scan."""

    def __init__(self, programa: Programa | None = None, scan_ms: int = SCAN_MS):
        self.programa = programa or cargar_programa()
        self.scan_ms = scan_ms
        self.t_ms = 0
        self.n_scan = 0
        self.entradas: dict[str, bool] = {}       # estado físico de los X
        self.bits: dict[str, bool] = {}           # imagen X, Y, M, T, S
        self.D: dict[int, int] = {}               # registros de datos
        self.temp_acum: dict[int, int] = {}       # ms acumulados por timer
        self.bfm: dict[int, int] = {}             # buffer del FX3U-4AD (unidad K0)
        self._flancos: dict[int, bool] = {}       # memoria por instrucción
        self.eventos: list[Evento] = []
        self.lineas_scan: set[int] = set()        # líneas que cambiaron algo en el último scan
        self._validar()

    # -- utilidades de acceso ---------------------------------------------
    def _validar(self) -> None:
        conocidas = {"LD", "LDI", "AND", "ANI", "OR", "ORI", "ANB", "ORB", "LDP", "ORP",
                     "ANDP", "OUT", "SET", "RST", "PLS", "MUL", "DIV", "MOV", "DADD",
                     "TO", "FROM", "END"}
        for ins in self.programa.instrucciones:
            if ins.op not in conocidas and not _RE_COMPARACION.match(ins.op):
                raise InstruccionNoSoportada(f"Línea {ins.linea}: {ins.texto()}")

    def bit(self, nombre: str) -> bool:
        return self.bits.get(nombre, False)

    def _leer_bit(self, op: str) -> bool:
        if op == "M8000":
            return True
        return self.bits.get(op, False)

    def _valor(self, op: str) -> int:
        if op[0] == "K":
            return int(op[1:])
        if op[0] == "H":
            return int(op[1:], 16)
        if op[0] == "D":
            return self.D.get(int(op[1:]), 0)
        raise ValueError(f"Operando de palabra no soportado: {op}")

    def _valor32(self, op: str) -> int:
        if op[0] == "K":
            return int(op[1:])
        n = int(op[1:])
        bajo = self.D.get(n, 0) & 0xFFFF
        alto = self.D.get(n + 1, 0) & 0xFFFF
        return _s32((alto << 16) | bajo)

    def _escribir_D(self, op: str, valor: int) -> None:
        self.D[int(op[1:])] = _s16(valor)

    def _escribir_D32(self, op: str, valor: int) -> None:
        n = int(op[1:])
        v = valor & 0xFFFFFFFF
        self.D[n] = _s16(v & 0xFFFF)
        self.D[n + 1] = _s16(v >> 16)

    def _escribir_bit(self, nombre: str, valor: bool, linea: int) -> None:
        anterior = self.bits.get(nombre, False)
        self.bits[nombre] = valor
        if anterior != valor:
            self.lineas_scan.add(linea)
            if not nombre.startswith("M8"):
                self.eventos.append(Evento(self.t_ms, linea, nombre, valor))

    # -- ciclo de scan ----------------------------------------------------
    def scan(self) -> None:
        self.lineas_scan = set()
        primer_scan = self.n_scan == 0
        self.bits["M8002"] = primer_scan
        self.bits["M8013"] = (self.t_ms % 1000) >= 500   # reloj 1 s (0,5 s ON / 0,5 s OFF)
        for direccion, valor in self.entradas.items():   # imagen de entradas
            self.bits[direccion] = valor

        acc = False
        pila: list[bool] = []
        linea_actual = None
        for ins in self.programa.instrucciones:
            if ins.linea != linea_actual:     # cada línea del programa es un circuito nuevo
                linea_actual = ins.linea
                pila = []
            op, a = ins.op, ins.args
            m = _RE_COMPARACION.match(op)
            if m:
                tipo, cmp = m.groups()
                r = _COMPARACIONES[cmp](self._valor(a[0]), self._valor(a[1]))
                if tipo == "LD":
                    pila.append(acc)
                    acc = r
                elif tipo == "AND":
                    acc = acc and r
                else:
                    acc = acc or r
            elif op in ("LD", "LDI", "LDP"):
                pila.append(acc)
                acc = self._contacto(ins)
            elif op in ("AND", "ANI", "ANDP"):
                c = self._contacto(ins)        # se evalúa siempre: los flancos actualizan su memoria
                acc = acc and c
            elif op in ("OR", "ORI", "ORP"):
                c = self._contacto(ins)
                acc = acc or c
            elif op == "ANB":
                acc = pila.pop() and acc
            elif op == "ORB":
                acc = pila.pop() or acc
            elif op == "OUT":
                if a[0].startswith("T"):
                    self._temporizador(int(a[0][1:]), self._valor(a[1]), acc, ins.linea)
                else:
                    self._escribir_bit(a[0], acc, ins.linea)
            elif op == "SET":
                if acc:
                    self._escribir_bit(a[0], True, ins.linea)
            elif op == "RST":
                if acc:
                    if a[0].startswith("T"):
                        self.temp_acum[int(a[0][1:])] = 0
                    self._escribir_bit(a[0], False, ins.linea)
            elif op == "PLS":
                previo = self._flancos.get(ins.indice, False)
                self._flancos[ins.indice] = acc
                self._escribir_bit(a[0], acc and not previo, ins.linea)
            elif op == "MUL":
                if acc:
                    self._escribir_D32(a[2], _s16(self._valor(a[0])) * _s16(self._valor(a[1])))
            elif op == "DIV":
                if acc:
                    s1, s2 = _s16(self._valor(a[0])), _s16(self._valor(a[1]))
                    if s2 != 0:
                        q = int(s1 / s2)                       # trunca hacia cero
                        r = s1 - q * s2
                        n = int(a[2][1:])
                        self.D[n] = _s16(q)
                        self.D[n + 1] = _s16(r)
            elif op == "MOV":
                if acc:
                    self._escribir_D(a[1], self._valor(a[0]))
            elif op == "DADD":
                if acc:
                    self._escribir_D32(a[2], self._valor32(a[0]) + self._valor32(a[1]))
            elif op == "TO":
                if acc:   # TO m1 m2 S n: escribe en el BFM m2 del módulo m1
                    for k in range(self._valor(a[3])):
                        self.bfm[self._valor(a[1]) + k] = self._valor(a[2])
            elif op == "FROM":
                if acc:   # FROM m1 m2 D n: lee BFM m2.. hacia D..
                    base = int(a[2][1:])
                    for k in range(self._valor(a[3])):
                        self.D[base + k] = _s16(self.bfm.get(self._valor(a[1]) + k, 0))
            elif op == "END":
                break

        self.n_scan += 1
        self.t_ms += self.scan_ms

    def _contacto(self, ins: Instruccion) -> bool:
        op, dev = ins.op, ins.args[0]
        v = self._leer_bit(dev)
        if op in ("LDP", "ORP", "ANDP"):
            previo = self._flancos.get(ins.indice, False)
            self._flancos[ins.indice] = v
            return v and not previo
        if op in ("LDI", "ANI", "ORI"):
            return not v
        return v

    def _temporizador(self, n: int, k: int, entrada: bool, linea: int) -> None:
        base_ms = 100 if n < 200 else 10   # T0–T199: 100 ms; T200–T245: 10 ms
        if entrada:
            self.temp_acum[n] = min(self.temp_acum.get(n, 0) + self.scan_ms, k * base_ms)
        else:
            self.temp_acum[n] = 0
        self._escribir_bit(f"T{n}", entrada and self.temp_acum[n] >= k * base_ms, linea)

    def correr(self, segundos: float) -> None:
        for _ in range(round(segundos * 1000 / self.scan_ms)):
            self.scan()


# ---------------------------------------------------------------------------
# Tablero y señales analógicas: capa de "terreno" alrededor del PLC
# ---------------------------------------------------------------------------

class Tablero:
    """Maneja pulsadores, selectores y transmisores como lo haría el operador.

    Los valores analógicos se cargan como valores crudos, igual que en la
    simulación de GX Works2 (Memoria, sección 5): D8280/D8281 para nivel
    (0–3200) y D10–D13 para temperatura, caudal y presión (0–4000), con M100 = ON
    (modo simulación) para que FROM no sobrescriba D10–D13.
    """

    def __init__(self, plc: PLC | None = None, modo_simulacion: bool = True):
        self.plc = plc or PLC()
        self.plc.bits["M100"] = modo_simulacion
        for e in ENTRADAS:                       # condición normal (Memoria, prueba 1)
            self.plc.entradas[e.direccion] = e.contacto == "NC"
        self.nivel_t1 = self.nivel_t2 = 60.0
        self.temp_t1 = self.temp_t2 = 30.0
        self.caudal = 0.0
        self.presion = 10.0
        self.escribir_analogicas()

    # -- analógicas ------------------------------------------------------
    @staticmethod
    def crudo_nivel(pct: float) -> int:
        return max(0, min(3200, round(pct * 32)))

    @staticmethod
    def crudo_temp(c: float) -> int:
        return max(0, min(4000, round(c * 40)))

    @staticmethod
    def crudo_caudal(q: float) -> int:
        return max(0, min(4000, round(q * 4000 / 30)))

    @staticmethod
    def crudo_presion(bar: float) -> int:
        return max(0, min(4000, round(bar * 250)))

    def escribir_analogicas(self) -> None:
        D = self.plc.D
        D[8280] = self.crudo_nivel(self.nivel_t1)
        D[8281] = self.crudo_nivel(self.nivel_t2)
        crudos = [self.crudo_temp(self.temp_t1), self.crudo_temp(self.temp_t2),
                  self.crudo_caudal(self.caudal), self.crudo_presion(self.presion)]
        if self.plc.bit("M100"):
            for k, v in enumerate(crudos):
                D[10 + k] = v
        else:
            for k, v in enumerate(crudos):
                self.plc.bfm[10 + k] = v

    def fijar(self, **valores: float) -> None:
        for k, v in valores.items():
            if not hasattr(self, k):
                raise AttributeError(k)
            setattr(self, k, v)
        self.escribir_analogicas()

    # -- elementos de mando ----------------------------------------------
    def accionar(self, tag: str, accionado: bool = True) -> None:
        """Pulsador apretado / hongo enclavado / selector en posición 2 / falla activa."""
        e = ENTRADA_POR_TAG[tag]
        self.plc.entradas[e.direccion] = accionado if e.contacto == "NA" else not accionado

    def accionado(self, tag: str) -> bool:
        e = ENTRADA_POR_TAG[tag]
        v = self.plc.entradas[e.direccion]
        return v if e.contacto == "NA" else not v

    def pulsar(self, tag: str, segundos: float = 0.3) -> None:
        self.accionar(tag, True)
        self.correr(segundos)
        self.accionar(tag, False)

    def correr(self, segundos: float) -> None:
        self.escribir_analogicas()
        self.plc.correr(segundos)

    # -- lectura ----------------------------------------------------------
    def y(self, tag: str) -> bool:
        """Estado de una salida por su nombre (P-3701A, VA-01, H12, KA1...) o de H1–H6."""
        if tag in LUCES_BOMBA:
            return self.plc.bit(LUCES_BOMBA[tag])
        return self.plc.bit(SALIDA_POR_TAG[tag])

    def escalado(self) -> dict[str, float]:
        D = self.plc.D
        return {
            "nivel_t1": D.get(100, 0) / 10, "nivel_t2": D.get(101, 0) / 10,
            "temp_t1": D.get(110, 0) / 10, "temp_t2": D.get(111, 0) / 10,
            "caudal": D.get(112, 0) / 10, "presion": D.get(113, 0) / 10,
        }


if __name__ == "__main__":
    prog = cargar_programa()
    print(f"{len(prog.instrucciones)} instrucciones, líneas {prog.lineas[0]}–{prog.lineas[-1]}")
    t = Tablero()
    t.correr(0.1)
    t.pulsar("S1")
    t.correr(4)
    print({k: t.y(k) for k in ("H12", "VA-01", "P-3701A", "VA-07", "P-3702E")})
