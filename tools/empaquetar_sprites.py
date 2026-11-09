#!/usr/bin/env python3
"""Empaqueta las imágenes PNG de assets/criaturas/ en assets/criaturas/sprites.js
(como data URI WebP) para que el juego funcione abriendo index.html sin servidor.

Uso:  python3 tools/empaquetar_sprites.py
Requiere Pillow (pip install pillow).
Cada PNG debe llamarse <id>.png (p. ej. cerbero_3.png), con fondo transparente
y la criatura mirando hacia la DERECHA.
"""
import base64, io, os, glob
from PIL import Image

DIR = os.path.join(os.path.dirname(__file__), '..', 'assets', 'criaturas')
out = []
for path in sorted(glob.glob(os.path.join(DIR, '*.png'))):
    cid = os.path.splitext(os.path.basename(path))[0]
    im = Image.open(path).convert('RGBA')
    if max(im.size) > 512:
        im.thumbnail((512, 512), Image.LANCZOS)
    buf = io.BytesIO()
    im.save(buf, 'WEBP', quality=90, method=6)
    out.append((cid, 'data:image/webp;base64,' + base64.b64encode(buf.getvalue()).decode()))

with open(os.path.join(DIR, 'sprites.js'), 'w') as f:
    f.write('// GENERADO por tools/empaquetar_sprites.py — no editar a mano.\n')
    f.write('// Ilustraciones que reemplazan el dibujo procedural de cada criatura.\n')
    f.write('const SPRITE_DATA = {\n')
    for cid, uri in out:
        f.write(f"  '{cid}': '{uri}',\n")
    f.write('};\nconst CUSTOM_SPRITES = Object.keys(SPRITE_DATA);\n')
print(f'{len(out)} sprites empaquetados:', ', '.join(c for c, _ in out))
