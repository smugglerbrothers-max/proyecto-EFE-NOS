"""La conversión del programa IL al Ladder del simulador interactivo debe ser exacta."""

import json
import shutil
import subprocess
from pathlib import Path

import pytest

RAIZ = Path(__file__).resolve().parents[1]
pytestmark = pytest.mark.skipif(shutil.which("node") is None, reason="Node.js no está instalado")


def test_ladder_equivale_al_IL():
    r = subprocess.run(["node", str(RAIZ / "tests" / "verificar_ladder.js"), str(RAIZ / "Programa_IL_GXWorks2.txt")],
                       capture_output=True, text=True, check=True)
    res = json.loads(r.stdout)
    assert res["errores"] == []
    assert res["lineas"] == 68
    assert 27 in res["conParalelo"] and 14 in res["conParalelo"]   # ANB de la línea 27 y OR de la 14
