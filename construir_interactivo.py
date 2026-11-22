"""
Arma simulador_interactivo.html: una sola página, sin dependencias externas, que lleva dentro
el programa IL (Programa_IL_GXWorks2.txt), el motor interactivo/motor_plc.js, el Ladder
(interactivo/ladder.js) y el modelo de proceso (interactivo/proceso.js).

Uso:  python construir_interactivo.py
"""

import json
from pathlib import Path

RAIZ = Path(__file__).resolve().parent
SALIDA = RAIZ / "simulador_interactivo.html"


def construir() -> Path:
    plantilla = (RAIZ / "interactivo" / "plantilla.html").read_text(encoding="utf-8")
    motor = (RAIZ / "interactivo" / "motor_plc.js").read_text(encoding="utf-8")
    ladder = (RAIZ / "interactivo" / "ladder.js").read_text(encoding="utf-8")
    proceso = (RAIZ / "interactivo" / "proceso.js").read_text(encoding="utf-8")
    programa = (RAIZ / "Programa_IL_GXWorks2.txt").read_text(encoding="utf-8")
    assert "/*__MOTOR__*/" in plantilla and "__PROGRAMA_IL__" in plantilla
    html = plantilla.replace("/*__MOTOR__*/", motor).replace("/*__LADDER__*/", ladder)
    html = html.replace("/*__PROCESO__*/", proceso)
    html = html.replace("__PROGRAMA_IL__", json.dumps(programa, ensure_ascii=False).replace("</", "<\\/"))
    SALIDA.write_text(html, encoding="utf-8")
    return SALIDA


if __name__ == "__main__":
    ruta = construir()
    print(f"{ruta} ({ruta.stat().st_size / 1024:.0f} KB)")
