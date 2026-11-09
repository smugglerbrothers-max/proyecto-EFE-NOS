#!/usr/bin/env python3
"""Genera UMBRAL.html: el juego completo en un solo archivo (CSS, JS e imágenes incluidos).
Se puede abrir directo en el celular o PC sin servidor.
Uso: python3 tools/construir_html.py
"""
import os, re
root = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
html = open(os.path.join(root, 'index.html'), encoding='utf8').read()
css = open(os.path.join(root, 'css', 'style.css'), encoding='utf8').read()
html = html.replace('<link rel="stylesheet" href="css/style.css">', '<style>\n' + css + '\n</style>')
def inline(m):
    src = m.group(1)
    code = open(os.path.join(root, src), encoding='utf8').read().replace('</script', '<\\/script')
    return f'<script>/* {src} */\n{code}\n</script>'
html = re.sub(r'<script src="([^"]+)"></script>', inline, html)
out = os.path.join(root, 'UMBRAL.html')
open(out, 'w', encoding='utf8').write(html)
print('UMBRAL.html', round(os.path.getsize(out) / 1e6, 2), 'MB')
