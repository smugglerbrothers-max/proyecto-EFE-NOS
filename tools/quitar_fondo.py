#!/usr/bin/env python3
"""Quita el fondo blanco de una ilustración, la recorta y la guarda en assets/criaturas/<id>.png

Uso:  python3 tools/quitar_fondo.py <id> <imagen_origen>
Ej.:  python3 tools/quitar_fondo.py cerbero_3 ~/Descargas/cerbero.png
Luego ejecuta:  python3 tools/empaquetar_sprites.py
"""
import sys, os
from PIL import Image, ImageFilter
from collections import deque
cid, src = sys.argv[1], sys.argv[2]
im = Image.open(src).convert('RGBA')
# escalar x2 con suavizado para mejor nitidez al mostrar
if max(im.size) < 400:
    im = im.resize((im.width*2, im.height*2), Image.LANCZOS)
im = im.filter(ImageFilter.UnsharpMask(radius=1.2, percent=80, threshold=2))
W, H = im.size
px = im.load()
def bgish(p): r,g,b,a = p; return r>225 and g>225 and b>225 and max(r,g,b)-min(r,g,b)<30
seen = bytearray(W*H)
q = deque()
for x in range(W):
    for y in (0, H-1): q.append((x,y))
for y in range(H):
    for x in (0, W-1): q.append((x,y))
while q:
    x,y = q.popleft()
    i = y*W+x
    if seen[i]: continue
    seen[i]=1
    if not bgish(px[x,y]): continue
    px[x,y] = (255,255,255,0)
    for dx,dy in ((1,0),(-1,0),(0,1),(0,-1)):
        nx,ny=x+dx,y+dy
        if 0<=nx<W and 0<=ny<H and not seen[ny*W+nx]: q.append((nx,ny))
# huecos cerrados de fondo (p. ej. entre humo o patas): regiones blancas grandes
mark = bytearray(W*H)
for sy in range(H):
    for sx in range(W):
        i0 = sy*W+sx
        if mark[i0] or px[sx,sy][3] == 0 or not bgish(px[sx,sy]): continue
        comp = []; q = deque([(sx,sy)]); mark[i0] = 1
        while q:
            x,y = q.popleft(); comp.append((x,y))
            for dx,dy in ((1,0),(-1,0),(0,1),(0,-1)):
                nx,ny = x+dx,y+dy
                if 0<=nx<W and 0<=ny<H and not mark[ny*W+nx] and px[nx,ny][3] and bgish(px[nx,ny]):
                    mark[ny*W+nx] = 1; q.append((nx,ny))
        if len(comp) > (W*H)//900:
            for x,y in comp: px[x,y] = (255,255,255,0)
# suavizar borde: píxeles casi blancos junto a transparencia -> semitransparentes
alpha = im.split()[3]
for y in range(1,H-1):
    for x in range(1,W-1):
        r,g,b,a = px[x,y]
        if a and r>200 and g>200 and b>200:
            if any(px[x+dx,y+dy][3]==0 for dx,dy in ((1,0),(-1,0),(0,1),(0,-1))):
                px[x,y]=(r,g,b,int(255*(1-(min(r,g,b)-200)/55)))
bbox = im.getbbox()
im = im.crop(bbox)
dest = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'assets', 'criaturas', cid + '.png')
im.save(dest, optimize=True)
print(cid, im.size)
