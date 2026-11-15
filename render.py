"""
Render del video de simulación (1920×1080, 30 fps) con Pillow + FFmpeg.

Antes de dibujar corre las pruebas automáticas (pytest). Si alguna falla, no
genera el video. Después recorre el guion cuadro a cuadro: el PLC simulado
avanza en cada cuadro y la pantalla muestra su estado real.

Uso:
    python render.py                 # video completo + capturas
    python render.py --solo-capturas # solo las PNG (rápido, para revisar)
"""

from __future__ import annotations

import argparse
import math
import re
import shutil
import subprocess
import sys
import textwrap
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

from guion import FPS, Cuadro, Reproductor
from simulador import ENTRADAS, SALIDAS, Tablero

RAIZ = Path(__file__).resolve().parent
SALIDA_VIDEO = RAIZ / "video_simulacion_PLC_torre.mp4"
DIR_CAPTURAS = RAIZ / "capturas"
W, H = 1920, 1080

# -- paleta -------------------------------------------------------------------
FONDO = (13, 20, 36)
PANEL = (24, 34, 54)
BORDE = (52, 67, 94)
TEXTO = (226, 232, 240)
TENUE = (138, 152, 175)
GRIS = (90, 102, 122)
GRIS_TUBO = (64, 76, 96)
VERDE = (34, 197, 94)
AZUL = (59, 130, 246)
AGUA = (37, 99, 175)
AMARILLO = (250, 204, 21)
ROJO = (239, 68, 68)
NARANJO = (249, 115, 22)

_FUENTES = "/usr/share/fonts/truetype/dejavu/"


def fuente(tam: int, negrita: bool = False, mono: bool = False) -> ImageFont.FreeTypeFont:
    nombre = "DejaVuSansMono" if mono else "DejaVuSans"
    if negrita:
        nombre += "-Bold"
    return ImageFont.truetype(_FUENTES + nombre + ".ttf", tam)


F = {k: fuente(*v) for k, v in {
    "t13": (13,), "t14": (14,), "t15": (15,), "t16": (16,), "t18": (18,), "t20": (20,),
    "b14": (14, True), "b16": (16, True), "b18": (18, True), "b20": (20, True), "b22": (22, True),
    "b26": (26, True), "b30": (30, True), "b40": (40, True), "b56": (56, True),
    "m13": (13, False, True), "t12": (12,), "m14": (14, False, True), "m15": (15, False, True),
    "mb14": (14, True, True), "sub": (30,), "t24": (24,), "t28": (28,),
}.items()}


def mezclar(c1, c2, a):
    return tuple(round(c1[i] * (1 - a) + c2[i] * a) for i in range(3))


def coma(v: float, dec: int = 1) -> str:
    return f"{v:.{dec}f}".replace(".", ",")


# ---------------------------------------------------------------------------
# Elementos gráficos
# ---------------------------------------------------------------------------

def texto_c(d, xy, s, f, color=TEXTO, anchor="mm"):
    d.text(xy, s, font=f, fill=color, anchor=anchor)


def bomba(d, x, y, nombre, marcha, r=17, abajo=False):
    col = VERDE if marcha else GRIS
    if marcha:
        d.ellipse([x - r - 5, y - r - 5, x + r + 5, y + r + 5], fill=mezclar(PANEL, VERDE, 0.25))
    d.ellipse([x - r, y - r, x + r, y + r], fill=col, outline=(15, 23, 42), width=2)
    d.polygon([(x - 7, y - 9), (x - 7, y + 9), (x + 9, y)], fill=(15, 23, 42))
    texto_c(d, (x, y + (r + 11) * (1 if abajo else -1)), nombre, F["b14"], VERDE if marcha else TENUE)


def valvula(d, x, y, nombre, abierta, vertical=False, etiqueta="arriba", s=12):
    col = AZUL if abierta else GRIS
    if vertical:
        d.polygon([(x - s, y - s), (x + s, y - s), (x, y)], fill=col, outline=(15, 23, 42))
        d.polygon([(x - s, y + s), (x + s, y + s), (x, y)], fill=col, outline=(15, 23, 42))
    else:
        d.polygon([(x - s, y - s), (x - s, y + s), (x, y)], fill=col, outline=(15, 23, 42))
        d.polygon([(x + s, y - s), (x + s, y + s), (x, y)], fill=col, outline=(15, 23, 42))
    off = {"arriba": (0, -s - 11), "abajo": (0, s + 11), "izq": (-s - 6, 0), "der": (s + 6, 0)}[etiqueta]
    anc = {"arriba": "mm", "abajo": "mm", "izq": "rm", "der": "lm"}[etiqueta]
    texto_c(d, (x + off[0], y + off[1]), nombre, F["b14"], AZUL if abierta else TENUE, anc)


def tubo(d, pts, activo, t_video, ancho=7):
    d.line(pts, fill=AGUA if activo else GRIS_TUBO, width=ancho, joint="curve")
    if not activo:
        return
    paso, fase = 26, (t_video * 70) % 26
    acum = 0.0
    for (x1, y1), (x2, y2) in zip(pts, pts[1:]):
        lon = math.hypot(x2 - x1, y2 - y1)
        p = (fase - acum) % paso
        while p < lon:
            px, py = x1 + (x2 - x1) * p / lon, y1 + (y2 - y1) * p / lon
            d.ellipse([px - 2.5, py - 2.5, px + 2.5, py + 2.5], fill=(186, 220, 255))
            p += paso
        acum += lon


def estanque(d, x0, y0, x1, y1, nombre, nivel, temp, tit):
    d.rectangle([x0, y0, x1, y1], fill=(16, 24, 40), outline=TENUE, width=3)
    ya = y1 - (y1 - y0) * max(0, min(100, nivel)) / 100
    if nivel > 0:
        d.rectangle([x0 + 3, ya, x1 - 3, y1 - 3], fill=AGUA)
    for pct, col in ((15, AMARILLO), (50, TENUE), (70, TENUE), (80, ROJO)):
        yy = y1 - (y1 - y0) * pct / 100
        d.line([x1 - 14, yy, x1 - 3, yy], fill=col, width=2)
        texto_c(d, (x1 - 17, yy), f"{pct}", F["t13"], col, "rm")
    cx = x0 + 52
    texto_c(d, (cx, y0 + 18), nombre, F["b18"])
    texto_c(d, (cx, y0 + 66), f"{coma(nivel)} %", F["b18"])
    texto_c(d, (cx, y0 + 90), f"{coma(temp)} °C", F["t15"])
    texto_c(d, (cx, y0 + 108), tit, F["t13"], TENUE)


# ---------------------------------------------------------------------------
# Pantalla
# ---------------------------------------------------------------------------

class Pantalla:
    def __init__(self):
        self.fondo = self._fondo_estatico()

    # -- capa fija ------------------------------------------------------------
    def _fondo_estatico(self) -> Image.Image:
        im = Image.new("RGB", (W, H), FONDO)
        d = ImageDraw.Draw(im)
        for caja in ((10, 90, 800, 862), (810, 90, 1270, 862), (1280, 90, 1910, 862)):
            d.rounded_rectangle(caja, 12, fill=PANEL, outline=BORDE, width=2)
        d.text((26, 100), "Planta (esquema simplificado)", font=F["b20"], fill=TEXTO)
        d.text((826, 100), "Tablero de control", font=F["b20"], fill=TEXTO)
        d.text((1296, 100), "Monitor del PLC (estado real del programa)", font=F["b20"], fill=TEXTO)
        # leyenda
        lx = 26
        for col, s in ((VERDE, "en marcha"), (GRIS, "detenido"), (AZUL, "válvula abierta")):
            d.ellipse([lx, 133, lx + 14, 147], fill=col)
            d.text((lx + 20, 132), s, font=F["t14"], fill=TENUE)
            lx += 40 + int(d.textlength(s, font=F["t14"]))
        return im

    # -- cuadro ---------------------------------------------------------------
    def dibujar(self, c: Cuadro, tab: Tablero, rep: Reproductor) -> Image.Image:
        if not c.escena.simula:
            if c.escena.numero == 1:
                return self.portada(c)
            return self.cierre(c, rep)
        im = self.fondo.copy()
        d = ImageDraw.Draw(im)
        self.encabezado(d, c, tab, rep)
        self.planta(d, c, tab)
        self.tablero(d, c, tab)
        self.monitor(d, c, tab)
        self.subtitulo(d, c)
        return im

    def encabezado(self, d, c, tab, rep):
        d.text((20, 12), "Simulación del programa PLC — Torre de enfriamiento Costa Azul", font=F["b26"], fill=TEXTO)
        d.text((20, 50), f"Escena {c.escena.numero} de {len(rep.escenas)}:  {c.escena.titulo}",
               font=F["t20"], fill=AMARILLO)
        ts = (tab.plc.t_ms - rep.t_sim_inicio) / 1000
        d.text((1500, 18), "Tiempo simulado", font=F["t16"], fill=TENUE, anchor="ra")
        d.text((1500, 40), f"{int(ts // 60):02d}:{coma(ts % 60).zfill(4)} s", font=F["b30"], fill=TEXTO, anchor="ra")
        if c.velocidad != 1:
            d.rounded_rectangle([1530, 14, 1900, 74], 10, fill=NARANJO)
            texto_c(d, (1715, 44), f"Tiempo acelerado  x{c.velocidad:g}", F["b26"], (20, 20, 20))
        else:
            d.rounded_rectangle([1530, 14, 1900, 74], 10, outline=BORDE, width=2)
            texto_c(d, (1715, 44), "x1  tiempo real", F["b22"], TENUE)

    # -- planta ---------------------------------------------------------------
    def planta(self, d, c, tab):
        y = tab.y
        tv = c.t_video
        e = tab  # valores de campo (lo que miden los transmisores)
        g1 = y("P-3701A") or y("P-3701B")
        g2 = y("P-3702C") or y("P-3702D")
        g3 = y("P-3702E") or y("P-3702F")
        va03 = y("VA-03")
        va04_abierta = not y("VA-04")          # VA-04 es NA: se energiza para cerrar

        # torre
        torre = [(330, 175), (500, 175), (530, 345), (300, 345)]
        d.polygon(torre, fill=(30, 44, 70), outline=TENUE)
        for k in range(5):
            yy = 205 + k * 28
            d.line([(318 - k * 1, yy), (512 + k * 1, yy)], fill=(45, 62, 92), width=2)
        texto_c(d, (415, 255), "Torre de", F["b16"])
        texto_c(d, (415, 275), "enfriamiento", F["b16"])
        # ventilador
        vent = y("M-3703")
        fx, fy = 415, 158
        d.ellipse([fx - 26, fy - 26, fx + 26, fy + 26], fill=(15, 23, 42),
                  outline=VERDE if vent else GRIS, width=3)
        ang = tv * 9 if vent else 0.3
        for k in range(3):
            a = ang + k * 2 * math.pi / 3
            d.line([(fx, fy), (fx + 21 * math.cos(a), fy + 21 * math.sin(a))],
                   fill=VERDE if vent else GRIS, width=6)
        texto_c(d, (fx - 36, fy), "Ventilador M-3703", F["b14"], VERDE if vent else TENUE, "rm")

        # tuberías G1 (T-3701 -> torre / by-pass)
        tubo(d, [(160, 545), (178, 545)], y("P-3701A"), tv)
        tubo(d, [(160, 655), (178, 655)], y("P-3701B"), tv)
        tubo(d, [(212, 545), (270, 545)], y("P-3701A") and y("VA-01"), tv)
        tubo(d, [(212, 655), (270, 655)], y("P-3701B") and y("VA-02"), tv)
        tubo(d, [(270, 655), (270, 465)], g1, tv)
        tubo(d, [(270, 465), (270, 200), (322, 200)], g1 and va03, tv)
        tubo(d, [(270, 465), (590, 465), (590, 500)], g1 and va04_abierta, tv)
        # descarga de la torre a T-3702
        tubo(d, [(415, 345), (415, 430), (630, 430), (630, 500)], (g1 and va03) or g2, tv)
        # G2 (T-3702 -> torre)
        tubo(d, [(700, 650), (765, 650), (765, 260), (745, 260)], g2, tv)
        tubo(d, [(745, 215), (745, 305)], g2, tv)
        tubo(d, [(745, 215), (722, 215)], y("P-3702C"), tv)
        tubo(d, [(745, 305), (722, 305)], y("P-3702D"), tv)
        tubo(d, [(688, 215), (620, 215)], y("P-3702C") and y("VA-05"), tv)
        tubo(d, [(688, 305), (620, 305)], y("P-3702D") and y("VA-06"), tv)
        tubo(d, [(620, 215), (620, 305)], g2, tv)
        tubo(d, [(620, 260), (517, 260)], g2, tv)
        # G3 (T-3702 -> condensador -> T-3701)
        tubo(d, [(630, 700), (630, 780), (545, 780)], g3, tv)
        tubo(d, [(545, 740), (545, 820)], g3, tv)
        tubo(d, [(545, 740), (522, 740)], y("P-3702E"), tv)
        tubo(d, [(545, 820), (522, 820)], y("P-3702F"), tv)
        tubo(d, [(488, 740), (425, 740)], y("P-3702E") and y("VA-07"), tv)
        tubo(d, [(488, 820), (425, 820)], y("P-3702F") and y("VA-08"), tv)
        tubo(d, [(425, 740), (425, 820)], g3, tv)
        tubo(d, [(425, 780), (330, 780)], g3, tv)
        tubo(d, [(215, 780), (95, 780), (95, 700)], g3, tv)
        # reposición
        tubo(d, [(680, 398), (680, 500)], y("VA-09"), tv, ancho=6)

        # estanques
        estanque(d, 30, 500, 160, 700, "T-3701", e.nivel_t1, e.temp_t1, "TIT-01")
        estanque(d, 560, 500, 700, 700, "T-3702", e.nivel_t2, e.temp_t2, "TIT-02")

        # condensador
        d.rounded_rectangle([215, 753, 330, 807], 8, fill=(40, 52, 80), outline=TENUE, width=2)
        texto_c(d, (272, 780), "Condensador", F["b14"])
        # PIT-01
        pres = e.presion
        col_p = ROJO if (g3 and pres < 8) else TEXTO
        d.ellipse([366, 768, 390, 792], fill=(15, 23, 42), outline=col_p, width=2)
        d.line([(378, 780), (378 + 9 * math.cos(-2.4 + pres / 16 * 4.8), 780 + 9 * math.sin(-2.4 + pres / 16 * 4.8))],
               fill=col_p, width=2)
        texto_c(d, (378, 815), "PIT-01", F["b14"], col_p)
        texto_c(d, (378, 834), f"{coma(pres)} bar", F["b14"], col_p)

        # bombas y válvulas
        bomba(d, 195, 545, "P-3701A", y("P-3701A"))
        bomba(d, 195, 655, "P-3701B", y("P-3701B"), abajo=True)
        valvula(d, 240, 545, "VA-01", y("VA-01"), etiqueta="abajo")
        valvula(d, 240, 655, "VA-02", y("VA-02"), etiqueta="arriba")
        valvula(d, 270, 330, "VA-03", va03, vertical=True, etiqueta="izq")
        valvula(d, 450, 465, "VA-04 by-pass", va04_abierta, etiqueta="abajo")
        bomba(d, 705, 215, "P-3702C", y("P-3702C"))
        bomba(d, 705, 305, "P-3702D", y("P-3702D"), abajo=True)
        valvula(d, 655, 215, "VA-05", y("VA-05"), etiqueta="abajo")
        valvula(d, 655, 305, "VA-06", y("VA-06"), etiqueta="arriba")
        bomba(d, 505, 740, "P-3702E", y("P-3702E"))
        bomba(d, 505, 820, "P-3702F", y("P-3702F"), abajo=True)
        valvula(d, 457, 740, "VA-07", y("VA-07"), etiqueta="abajo")
        valvula(d, 457, 820, "VA-08", y("VA-08"), etiqueta="arriba")
        valvula(d, 680, 455, "VA-09", y("VA-09"), vertical=True, etiqueta="der")
        texto_c(d, (680, 366), "Agua osmosis", F["t13"], TENUE)
        texto_c(d, (680, 384), f"FIT-01 {coma(e.caudal)} m³/h", F["t13"], AZUL if y("VA-09") else TENUE)

        # rótulos de grupos
        texto_c(d, (195, 600), "G1", F["b18"], VERDE if g1 else TENUE)
        texto_c(d, (705, 260), "G2", F["b18"], VERDE if g2 else TENUE)
        texto_c(d, (590, 805), "G3", F["b18"], VERDE if g3 else TENUE)
        if y("KA1"):
            d.rounded_rectangle([20, 815, 205, 850], 6, fill=mezclar(PANEL, NARANJO, 0.35))
            texto_c(d, (112, 832), "KA1: 2ª velocidad G1/G3", F["b14"], TEXTO)

    # -- tablero --------------------------------------------------------------
    def tablero(self, d, c, tab):
        x0 = 826
        apretado = lambda tag: tab.accionado(tag)
        destacado = c.pulsados

        def pulsador(x, yy, tag, rotulo, color, hongo=False):
            on = apretado(tag)
            r = 22 if hongo else 17
            if tag in destacado or on:
                d.ellipse([x - r - 8, yy - r - 8, x + r + 8, yy + r + 8], outline=AMARILLO, width=3)
            col = mezclar(color, (255, 255, 255), 0.35) if on else mezclar(color, PANEL, 0.25)
            d.ellipse([x - r, yy - r, x + r, yy + r], fill=col, outline=(15, 23, 42), width=3)
            if hongo:
                d.ellipse([x - 9, yy - 9, x + 9, yy + 9], outline=(15, 23, 42), width=2)
            texto_c(d, (x, yy + r + 13), tag, F["b14"], AMARILLO if (tag in destacado or on) else TEXTO)
            texto_c(d, (x, yy + r + 29), rotulo, F["t13"], TENUE)

        def selector(x, yy, tag, a, b):
            on = apretado(tag)
            d.ellipse([x - 19, yy - 19, x + 19, yy + 19], fill=(40, 50, 70), outline=TENUE, width=2)
            ang = math.radians(-50 if not on else 50) - math.pi / 2
            d.line([(x - 15 * math.cos(ang), yy - 15 * math.sin(ang)),
                    (x + 15 * math.cos(ang), yy + 15 * math.sin(ang))], fill=TEXTO, width=6)
            texto_c(d, (x - 26, yy - 20), a, F["b14"], AMARILLO if not on else TENUE)
            texto_c(d, (x + 26, yy - 20), b, F["b14"], AMARILLO if on else TENUE)
            texto_c(d, (x, yy + 32), tag, F["b14"])
            texto_c(d, (x, yy + 48), "selector", F["t13"], TENUE)

        def luz(x, yy, tag, color, rotulo, encendida, r=17):
            if encendida:
                for k, a in ((12, 0.12), (8, 0.22), (4, 0.35)):
                    d.ellipse([x - r - k, yy - r - k, x + r + k, yy + r + k], fill=mezclar(PANEL, color, a))
                d.ellipse([x - r, yy - r, x + r, yy + r], fill=color, outline=(255, 255, 255), width=2)
            else:
                d.ellipse([x - r, yy - r, x + r, yy + r], fill=mezclar(PANEL, color, 0.18), outline=GRIS, width=2)
            texto_c(d, (x, yy + r + 13), tag, F["b14"], TEXTO if encendida else TENUE)
            texto_c(d, (x, yy + r + 28), rotulo, F["t12"], TENUE)

        # mando general
        d.text((x0, 136), "Mando general", font=F["b16"], fill=TENUE)
        fila = 190
        pulsador(x0 + 40, fila, "S1", "partida", VERDE)
        pulsador(x0 + 125, fila, "S0", "parada", ROJO)
        pulsador(x0 + 210, fila, "S00", "emergencia", ROJO, hongo=True)
        pulsador(x0 + 300, fila, "S41", "hab. torre", AZUL)
        pulsador(x0 + 385, fila, "S42", "desh. torre", GRIS)

        # grupos
        d.text((x0, 262), "Grupos de bombeo", font=F["b16"], fill=TENUE)
        for k, (g, sel, a, b, mar, par, em) in enumerate((
                ("G1", "S11", "A", "B", "S12", "S13", "S01"),
                ("G2", "S21", "C", "D", "S22", "S23", "S02"),
                ("G3", "S31", "E", "F", "S32", "S33", "S03"))):
            yy = 320 + k * 92
            texto_c(d, (x0 + 14, yy), g, F["b20"], TEXTO, "lm")
            selector(x0 + 95, yy, sel, a, b)
            pulsador(x0 + 185, yy, mar, "marcha", VERDE)
            pulsador(x0 + 270, yy, par, "parada", ROJO)
            pulsador(x0 + 360, yy, em, "emerg.", ROJO, hongo=True)

        d.text((x0, 584), "Agua y alarmas", font=F["b16"], fill=TENUE)
        pulsador(x0 + 40, 625, "S51", "relleno", AZUL)
        pulsador(x0 + 125, 625, "S52", "reset", AMARILLO)

        # luces
        y = tab.y
        d.text((x0 + 200, 584), "Bocina y relé", font=F["b16"], fill=TENUE)
        bocina = y("HA1")
        parpadeo = bocina and (int(c.t_video * 4) % 2 == 0)
        luz(x0 + 250, 625, "HA1", NARANJO, "bocina", parpadeo or False)
        if bocina:
            for k in range(3):
                r = 30 + k * 9
                d.arc([x0 + 250 - r, 625 - r, x0 + 250 + r, 625 + r], -40, 40, fill=NARANJO, width=3)
        luz(x0 + 360, 625, "KA1", NARANJO, "2ª velocidad", y("KA1"))

        d.text((x0, 690), "Luces piloto", font=F["b16"], fill=TENUE)
        luces = [("H1", VERDE, "bomba A"), ("H2", VERDE, "bomba B"), ("H3", VERDE, "bomba C"),
                 ("H4", VERDE, "bomba D"), ("H5", VERDE, "bomba E"), ("H6", VERDE, "bomba F"),
                 ("H7", AMARILLO, "bajo T1"), ("H8", ROJO, "alto T1"), ("H9", AMARILLO, "bajo T2"),
                 ("H10", ROJO, "alto T2"), ("H11", ROJO, "alta temp"), ("H12", VERDE, "servicio"),
                 ("H13", AZUL, "torre hab."), ("H14", ROJO, "baja pres.")]
        for k, (tag, col, rot) in enumerate(luces):
            xx = x0 + 32 + (k % 7) * 62
            yy = 728 + (k // 7) * 68
            luz(xx, yy, tag, col, rot, y(tag), r=14)

    # -- monitor --------------------------------------------------------------
    def monitor(self, d, c, tab):
        x0, y0 = 1296, 134
        plc = tab.plc
        d.text((x0, y0), "Entradas X", font=F["b16"], fill=TENUE)
        for k, e in enumerate(ENTRADAS):
            col, fila = k // 6, k % 6
            xx, yy = x0 + col * 154, y0 + 24 + fila * 19
            v = plc.bit(e.direccion)
            d.rectangle([xx, yy + 3, xx + 12, yy + 15], fill=VERDE if v else (40, 48, 64))
            d.text((xx + 18, yy), f"{e.direccion} {e.tag}", font=F["m14"], fill=TEXTO if v else TENUE)
            if e.contacto == "NC":
                d.text((xx + 18 + 8.5 * (5 + len(e.tag)) + 4, yy + 1), "NC", font=F["t12"], fill=GRIS)
        y1 = y0 + 24 + 6 * 19 + 8
        d.text((x0, y1), "Salidas Y", font=F["b16"], fill=TENUE)
        for k, (dirc, (tag, desc)) in enumerate(SALIDAS.items()):
            col, fila = k // 7, k % 7
            xx, yy = x0 + col * 154, y1 + 24 + fila * 19
            v = plc.bit(dirc)
            d.rectangle([xx, yy + 3, xx + 12, yy + 15], fill=VERDE if v else (40, 48, 64))
            d.text((xx + 18, yy), f"{dirc} {tag}", font=F["m14"], fill=TEXTO if v else TENUE)
        d.text((1894, y0 + 3), "verde = 1 · NC: vale 1 en reposo",
               font=F["t13"], fill=GRIS, anchor="ra")
        y2 = y1 + 24 + 7 * 19 + 8
        d.text((x0, y2), "Señales analógicas (crudo → escalado por las líneas 2 a 6)", font=F["b16"], fill=TENUE)
        D = plc.D
        filas = [("LIT-01 nivel T-3701", 8280, 100, "%"), ("LIT-02 nivel T-3702", 8281, 101, "%"),
                 ("TIT-01 temp. T-3701", 10, 110, "°C"), ("TIT-02 temp. T-3702", 11, 111, "°C"),
                 ("FIT-01 caudal reposición", 12, 112, "m³/h"), ("PIT-01 presión línea G3", 13, 113, "bar")]
        for k, (nom, dc, de, u) in enumerate(filas):
            yy = y2 + 23 + k * 19
            d.text((x0, yy), nom, font=F["t14"], fill=TEXTO)
            d.text((x0 + 215, yy), f"D{dc}={D.get(dc, 0):>4}", font=F["m14"], fill=TENUE)
            d.text((x0 + 345, yy), f"D{de}={D.get(de, 0):>4}", font=F["m14"], fill=TENUE)
            d.text((x0 + 610, yy), f"{coma(D.get(de, 0) / 10)} {u}", font=F["b14"], fill=TEXTO, anchor="ra")
        y3 = y2 + 23 + 6 * 19 + 2
        total = ((D.get(301, 0) & 0xFFFF) << 16 | (D.get(300, 0) & 0xFFFF)) / 36000
        d.text((x0, y3), f"Totalizador de reposición (D301,D300): {coma(total, 3)} m³", font=F["t14"], fill=TENUE)

        # temporizadores
        y4 = y3 + 26
        d.text((x0, y4), "Temporizadores", font=F["b16"], fill=TENUE)
        tmr = [(0, 30), (1, 30), (2, 30), (3, 30), (4, 30), (5, 30), (11, 300), (10, 3000)]
        for k, (n, kk) in enumerate(tmr):
            col, fila = k % 4, k // 4
            xx, yy = x0 + col * 154, y4 + 23 + fila * 32
            acum = plc.temp_acum.get(n, 0) / 1000
            fin = kk / 10
            act = plc.bit(f"T{n}")
            d.text((xx, yy), f"T{n}", font=F["mb14"], fill=VERDE if act else (AMARILLO if acum > 0 else TENUE))
            d.rectangle([xx + 34, yy + 4, xx + 140, yy + 14], outline=GRIS)
            if acum > 0:
                d.rectangle([xx + 34, yy + 4, xx + 34 + 106 * min(1, acum / fin), yy + 14],
                            fill=VERDE if act else AMARILLO)
            d.text((xx + 34, yy + 15), f"{coma(acum)} / {coma(fin, 0) if fin >= 10 else coma(fin)} s",
                   font=F["t12"], fill=TENUE)

        # líneas en acción
        y5 = y4 + 23 + 2 * 32 + 8
        d.text((x0, y5), "Línea del programa que está actuando", font=F["b16"], fill=AMARILLO)
        vistos, recientes = set(), []
        for e in reversed(plc.eventos):
            clave = e.linea
            if clave in vistos or e.dispositivo.startswith("X"):
                continue
            vistos.add(clave)
            recientes.append(e)
            if len(recientes) == 3:
                break
        yy = y5 + 26
        prog = plc.programa
        for k, e in enumerate(recientes):
            edad = (plc.t_ms - e.t_ms) / 1000 / max(1, c.velocidad)
            nuevo = k == 0 and edad < 2.0
            alto = 62 if k == 0 else 26
            if yy + alto > 858:
                break
            d.rounded_rectangle([x0 - 6, yy - 4, 1898, yy + alto - 6], 6,
                                fill=mezclar(PANEL, AMARILLO, 0.22 if nuevo else 0.06))
            nombre = SALIDAS.get(e.dispositivo, (None,))[0]
            disp = f"{e.dispositivo}{' (' + nombre + ')' if nombre else ''} = {int(e.valor)}"
            d.text((x0, yy), f"Línea {e.linea}", font=F["b16"], fill=AMARILLO if k == 0 else TEXTO)
            d.text((x0 + 92, yy + 1), f"→ {disp}", font=F["b14"], fill=VERDE if e.valor else TENUE)
            if k == 0:
                il = prog.texto_linea(e.linea)
                for j, li in enumerate(textwrap.wrap(il, 72)[:2]):
                    d.text((x0, yy + 21 + j * 17), li, font=F["m13"], fill=TEXTO)
            else:
                d.text((x0 + 330, yy + 1), prog.texto_linea(e.linea)[:38], font=F["m13"], fill=TENUE)
            yy += alto

    # -- subtítulo ------------------------------------------------------------
    def subtitulo(self, d, c):
        d.rounded_rectangle([10, 872, 1910, 1070], 12, fill=(8, 12, 22), outline=BORDE, width=2)
        if not c.subtitulo:
            return
        lineas = textwrap.wrap(c.subtitulo, 95)
        y0 = 971 - len(lineas) * 21
        for k, li in enumerate(lineas):
            d.text((960, y0 + k * 42), li, font=F["sub"], fill=(255, 255, 255), anchor="ma")

    # -- portada y cierre ----------------------------------------------------
    def portada(self, c: Cuadro) -> Image.Image:
        im = Image.new("RGB", (W, H), FONDO)
        d = ImageDraw.Draw(im)
        a = min(1.0, c.t_escena / 1.2)
        col = lambda base: mezclar(FONDO, base, a)
        d.rectangle([0, 0, W, 10], fill=AZUL)
        texto_c(d, (960, 170), "Instituto Profesional Santo Tomás · Sede San Joaquín", F["t28"], col(TENUE))
        texto_c(d, (960, 230), "Taller de Integración de Competencias Profesionales (EEI-057) · Hito III",
                F["t28"], col(TENUE))
        texto_c(d, (960, 350), "Simulación del programa PLC", F["b56"], col(TEXTO))
        texto_c(d, (960, 420), "Torre de enfriamiento — Empresa Costa Azul", F["b40"], col(AZUL))
        texto_c(d, (960, 500), "PLC Mitsubishi FX3GE-24MR/ES + FX2N-16EX + FX2N-16EYR + FX3U-4AD",
                F["t24"], col(TENUE))
        texto_c(d, (960, 600), "Profesor: Juan Andrés Vivar Ramírez", F["b30"], col(TEXTO))
        texto_c(d, (960, 670), "Integrantes", F["t24"], col(TENUE))
        texto_c(d, (960, 715), "Jermain Bascour · Cristian Salas · Yeremi Tobar · Tamae Martinez",
                F["b30"], col(TEXTO))
        texto_c(d, (960, 850), "Ejecutamos el programa IL (líneas 0 a 67) ciclo a ciclo, igual que el PLC,",
                F["t24"], col(TENUE))
        texto_c(d, (960, 888), "porque no pudimos probarlo en el equipo real.", F["t24"], col(TENUE))
        texto_c(d, (960, 990), "Noviembre de 2026", F["t24"], col(TENUE))
        return im

    def cierre(self, c: Cuadro, rep: Reproductor) -> Image.Image:
        im = Image.new("RGB", (W, H), FONDO)
        d = ImageDraw.Draw(im)
        d.rectangle([0, 0, W, 10], fill=VERDE)
        texto_c(d, (960, 70), "Resumen de lo verificado", F["b40"])
        n_ok = sum(1 for _, v in rep.verificaciones if v.resultado)
        texto_c(d, (960, 125), f"{n_ok} de {len(rep.verificaciones)} comprobaciones del video correctas  ·  "
                               f"{rep.pytest_resumen}", F["t24"], TENUE)
        visibles = int(c.t_escena / 0.25) + 1
        yy = 175
        for k, (esc, v) in enumerate(rep.verificaciones[:visibles]):
            col = VERDE if v.resultado else ROJO
            marca = "✔" if v.resultado else "✘"
            d.text((150, yy), marca, font=F["b26"], fill=col)
            d.text((195, yy + 3), f"Escena {esc.numero}: {v.descripcion}", font=F["t22"] if "t22" in F else F["t20"], fill=TEXTO)
            d.text((1770, yy + 5), ("líneas " if "," in v.lineas else "línea ") + v.lineas, font=F["t18"], fill=TENUE, anchor="ra")
            yy += 38
        if c.t_escena > 6:
            texto_c(d, (960, 1000), "La lógica se tomó tal cual del programa IL; el video no la modifica.",
                    F["t24"], TENUE)
            texto_c(d, (960, 1040), "Bascour · Salas · Tobar · Martinez", F["t20"], TENUE)
        return im


F["t22"] = fuente(22)


# ---------------------------------------------------------------------------

def correr_pytest() -> str:
    r = subprocess.run([sys.executable, "-m", "pytest", "-q", str(RAIZ / "tests")],
                       capture_output=True, text=True, cwd=RAIZ)
    print(r.stdout[-1500:])
    if r.returncode != 0:
        sys.exit("Las pruebas automáticas no pasan: no se genera el video.")
    n = re.search(r"(\d+) passed", r.stdout)
    return f"{n.group(1)} pruebas automáticas (pytest) aprobadas" if n else "pruebas aprobadas"


def _tiempo_srt(t: float) -> str:
    ms = round(t * 1000)
    return f"{ms // 3600000:02d}:{ms // 60000 % 60:02d}:{ms // 1000 % 60:02d},{ms % 1000:03d}"


def escribir_textos(rep: Reproductor) -> None:
    """Subtítulos .srt y guion de locución (para grabar la narración con voz propia)."""
    frases = rep.frases
    srt = []
    for k, f in enumerate(frases):
        fin = frases[k + 1].t_video - 0.05 if k + 1 < len(frases) else rep.duracion_total
        srt.append(f"{k + 1}\n{_tiempo_srt(f.t_video)} --> {_tiempo_srt(min(fin, f.t_video + f.duracion + 1.5))}\n"
                   f"{f.texto}\n")
    SALIDA_VIDEO.with_suffix(".srt").write_text("\n".join(srt), encoding="utf-8")

    filas = ["# Guion de locución", "",
             "Cada frase tiene un identificador. Para usar su propia voz, graben cada frase en un",
             "archivo con ese nombre dentro de `narracion/grabada/` (por ejemplo `e02_01.wav`, también",
             "sirve .mp3, .m4a u .ogg) y vuelvan a correr `python render.py`. El video se ajusta solo",
             "a la duración de cada grabación; las frases que no estén grabadas usan la voz sintética.",
             "Lo que va entre paréntesis aparece en pantalla, pero no hace falta decirlo.", "",
             "| Id | Inicio | Escena | Texto |", "|---|---|---|---|"]
    for f in frases:
        esc = int(f.ident[1:3])
        filas.append(f"| `{f.ident}` | {int(f.t_video // 60)}:{f.t_video % 60:04.1f} | {esc} | {f.texto} |")
    (RAIZ / "narracion" / "guion_locucion.md").write_text("\n".join(filas) + "\n", encoding="utf-8")


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--solo-capturas", action="store_true")
    ap.add_argument("--sin-voz", action="store_true", help="video mudo (no genera narración)")
    ap.add_argument("--salida", default=str(SALIDA_VIDEO))
    args = ap.parse_args()

    resumen = correr_pytest()
    narrador = None
    if not args.sin_voz and not args.solo_capturas:
        import narracion
        narrador = narracion.preparar
    rep = Reproductor(FPS, narrador=narrador)
    rep.pytest_resumen = resumen
    pant = Pantalla()
    if DIR_CAPTURAS.exists():
        shutil.rmtree(DIR_CAPTURAS)
    DIR_CAPTURAS.mkdir()

    ffmpeg = None
    video_mudo = Path(args.salida).with_name("_video_sin_audio.mp4")
    if not args.solo_capturas:
        ffmpeg = subprocess.Popen(
            ["ffmpeg", "-y", "-loglevel", "error", "-f", "rawvideo", "-pix_fmt", "rgb24",
             "-s", f"{W}x{H}", "-r", str(FPS), "-i", "-", "-c:v", "libx264", "-preset", "medium",
             "-crf", "20", "-pix_fmt", "yuv420p", str(video_mudo)],
            stdin=subprocess.PIPE)

    capturas_hechas: set = set()
    total = round(rep.duracion_estimada * FPS)
    for i, c in enumerate(rep.cuadros()):
        esc = c.escena
        # capturas: 2 s después de cada paso del guion; portada y cierre completos
        pedir = []
        if esc.simula:
            for k, a in enumerate(esc.acciones):
                if a.t_real is not None and (esc.numero, k) not in capturas_hechas \
                        and c.t_escena >= a.t_real + 2.0:
                    capturas_hechas.add((esc.numero, k))
                    pedir.append(f"escena_{esc.numero:02d}_paso_{k + 1}.png")
        elif (esc.numero, 0) not in capturas_hechas and c.t_escena >= 9.0:
            capturas_hechas.add((esc.numero, 0))
            pedir.append(f"escena_{esc.numero:02d}.png")
        if ffmpeg is None and not pedir:
            continue
        im = pant.dibujar(c, rep.tab, rep)
        for nombre in pedir:
            im.save(DIR_CAPTURAS / nombre)
        if ffmpeg is not None:
            ffmpeg.stdin.write(im.tobytes())
        if i % 300 == 0:
            print(f"  cuadro {i}/~{total}  ({esc.numero}: {esc.titulo})", flush=True)

    if ffmpeg is not None:
        ffmpeg.stdin.close()
        ffmpeg.wait()
        if ffmpeg.returncode != 0:
            sys.exit("FFmpeg terminó con error.")
        if narrador is not None:
            import narracion
            pista = RAIZ / "narracion" / "pista_narracion.wav"
            narracion.mezclar([(f.t_video, f.ruta) for f in rep.frases], rep.duracion_total, pista)
            subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", str(video_mudo), "-i", str(pista),
                            "-c:v", "copy", "-c:a", "aac", "-b:a", "160k", "-shortest",
                            "-movflags", "+faststart", args.salida], check=True)
            video_mudo.unlink()
            escribir_textos(rep)
        else:
            video_mudo.replace(args.salida)
        print(f"Video: {args.salida}  ({rep.duracion_total:.1f} s)")
    print(f"Capturas: {DIR_CAPTURAS} ({len(list(DIR_CAPTURAS.glob('*.png')))} archivos)")
    for esc, v in rep.verificaciones:
        print(f"  [{'OK' if v.resultado else 'FALLA'}] Escena {esc.numero}: {v.descripcion}")


if __name__ == "__main__":
    main()
