"""
Narración del video.

Cada subtítulo del guion se convierte en una frase hablada:
* si existe una grabación propia en narracion/grabada/<id>.wav (o .mp3, .m4a, .ogg),
  se usa esa grabación;
* si no, se sintetiza con Piper (voz neuronal sin conexión, modelo en narracion/voces/);
* si el modelo de Piper no está, se usa espeak-ng (voz "es-419", más robótica).

Lo que se dice es el mismo texto del subtítulo, sin las referencias a líneas
del programa (lo que va entre paréntesis) y con los nombres de equipos escritos
como se pronuncian (S1 → "ese 1", VA-01 → "ve a cero uno", etc.).
"""

from __future__ import annotations

import hashlib
import re
import shutil
import subprocess
import sys
import wave
from pathlib import Path

import numpy as np

RAIZ = Path(__file__).resolve().parent
DIR_NARRACION = RAIZ / "narracion"
DIR_GRABADA = DIR_NARRACION / "grabada"
DIR_CACHE = DIR_NARRACION / "sintetica"
SR = 22050
DIR_VOCES = DIR_NARRACION / "voces"
VOZ_PIPER = "es_AR-daniela-high"      # alternativa masculina: "es_MX-ald-medium"
ESCALA_PIPER = 0.92                   # < 1 habla un poco más rápido
VOZ_ESPEAK = "es-419"
VELOCIDAD = 165                       # palabras por minuto (espeak-ng y estimaciones)

_LETRAS = {"A": "a", "B": "be", "C": "ce", "D": "de", "E": "e", "F": "efe"}
_DIGITOS = ["cero", "uno", "dos", "tres", "cuatro", "cinco", "seis", "siete", "ocho", "nueve"]


def _digitos(s: str) -> str:
    return " ".join(_DIGITOS[int(c)] for c in s)


def _codigo(n: str) -> str:
    """'3701' → 'treinta y siete cero uno'; '01' → 'cero uno'."""
    if len(n) == 4:
        return f"{n[:2]} {_digitos(n[2:])}"
    if n.startswith("0"):
        return _digitos(n)
    return n


def texto_hablado(texto: str) -> str:
    t = re.sub(r"\s*\([^)]*\)", "", texto)
    t = re.sub(r"\bP-(\d{4})([A-F])\b", lambda m: f"pe {_codigo(m[1])} {_LETRAS[m[2]]}", t)
    t = re.sub(r"\bT-(\d{4})\b", lambda m: f"te {_codigo(m[1])}", t)
    t = re.sub(r"\bVA-(\d{2})\b", lambda m: f"ve a {_codigo(m[1])}", t)
    t = re.sub(r"\b(PIT|FIT|TIT|LIT)-(\d{2})\b",
               lambda m: " ".join({"P": "pe", "F": "efe", "T": "te", "L": "ele", "I": "i"}[c] for c in m[1])
               + " " + _digitos(m[2]), t)
    t = re.sub(r"\bS(\d+)\b", lambda m: "ese " + (_digitos(m[1]) if m[1].startswith("0") else m[1]), t)
    t = re.sub(r"\bH(\d+)\b", r"hache \1", t)
    t = re.sub(r"\bKA1\b", "ka a uno", t)
    t = re.sub(r"\bG(\d)\b", r"ge \1", t)
    t = re.sub(r"\bx(\d+)\b", r"por \1", t)
    t = t.replace("°C", " grados").replace("%", " por ciento").replace("PLC", "pe ele ce")
    t = t.replace("by-pass", "baipás").replace("·", ",").replace(":", ",")
    return re.sub(r"\s+", " ", t).strip()


def _leer_wav(ruta: Path) -> np.ndarray:
    with wave.open(str(ruta)) as w:
        datos = np.frombuffer(w.readframes(w.getnframes()), dtype=np.int16)
        if w.getnchannels() > 1:
            datos = datos.reshape(-1, w.getnchannels()).mean(axis=1)
    return datos.astype(np.float32) / 32768


def _a_wav(origen: Path, destino: Path, filtros: str = "") -> None:
    cmd = ["ffmpeg", "-v", "error", "-y", "-i", str(origen), "-ac", "1", "-ar", str(SR)]
    if filtros:
        cmd += ["-af", filtros]
    subprocess.run(cmd + [str(destino)], check=True)


def grabacion_propia(ident: str) -> Path | None:
    for ext in (".wav", ".mp3", ".m4a", ".ogg"):
        p = DIR_GRABADA / f"{ident}{ext}"
        if p.exists():
            return p
    return None


def preparar(ident: str, texto: str) -> tuple[Path, float]:
    """Devuelve (wav listo para mezclar, duración en s) de la frase 'ident'."""
    DIR_CACHE.mkdir(parents=True, exist_ok=True)
    propia = grabacion_propia(ident)
    if propia is not None:
        destino = DIR_CACHE / f"{ident}_propia.wav"
        if not destino.exists() or destino.stat().st_mtime < propia.stat().st_mtime:
            _a_wav(propia, destino, "silenceremove=start_periods=1:start_threshold=-45dB,areverse,"
                                    "silenceremove=start_periods=1:start_threshold=-45dB,areverse,"
                                    "loudnorm=I=-18:TP=-2")
    else:
        hablado = texto_hablado(texto)
        modelo = DIR_VOCES / f"{VOZ_PIPER}.onnx"
        motor = f"piper:{VOZ_PIPER}:{ESCALA_PIPER}" if modelo.exists() else f"espeak:{VOZ_ESPEAK}:{VELOCIDAD}"
        h = hashlib.sha1(f"{motor}|{hablado}".encode()).hexdigest()[:10]
        destino = DIR_CACHE / f"{ident}_{h}.wav"
        if not destino.exists():
            crudo = destino.with_suffix(".raw.wav")
            if modelo.exists():
                subprocess.run([sys.executable, "-m", "piper", "-m", str(modelo), "-f", str(crudo),
                                "--length-scale", str(ESCALA_PIPER)],
                               input=hablado, text=True, check=True, capture_output=True)
            elif shutil.which("espeak-ng"):
                subprocess.run(["espeak-ng", "-v", VOZ_ESPEAK, "-s", str(VELOCIDAD), "-w", str(crudo),
                                hablado], check=True, capture_output=True)
            else:
                raise RuntimeError("No hay voz disponible: descarga el modelo de Piper (ver README), "
                                   "instala espeak-ng o graba narracion/grabada/" + ident + ".wav")
            _a_wav(crudo, destino, "highpass=f=80,loudnorm=I=-18:TP=-2")
            crudo.unlink()
    return destino, len(_leer_wav(destino)) / SR


def estimar(texto: str) -> float:
    """Duración aproximada sin sintetizar (para correr el guion rápido)."""
    return len(texto_hablado(texto).split()) / (VELOCIDAD / 60) + 0.4


def mezclar(clips: list[tuple[float, Path]], duracion: float, destino: Path) -> None:
    """Pone cada frase en su instante y escribe la pista de audio completa."""
    pista = np.zeros(int((duracion + 1) * SR), dtype=np.float32)
    for t, ruta in clips:
        datos = _leer_wav(ruta)
        i = int(t * SR)
        fin = min(len(pista), i + len(datos))
        pista[i:fin] += datos[: fin - i]
    pista = np.clip(pista[: int(duracion * SR)], -1, 1)
    destino.parent.mkdir(parents=True, exist_ok=True)
    with wave.open(str(destino), "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes((pista * 32767).astype(np.int16).tobytes())


if __name__ == "__main__":
    import sys
    print(texto_hablado(" ".join(sys.argv[1:]) or "Al pulsar S1 parten P-3701A y VA-01 (línea 8)."))
