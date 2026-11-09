// =====================================================================
//  UMBRAL — Arte procedural de criaturas de horror.
//  Cada criatura se dibuja con vectores en un lienzo y se anima con "t".
//  Si existe assets/criaturas/<id>.png se usa esa imagen en su lugar.
// =====================================================================
'use strict';

const Art = (() => {
  // ---------- utilidades de color ----------
  function hexToRgb(h) {
    h = h.replace('#', '');
    if (h.length === 3) h = h.split('').map(c => c + c).join('');
    const n = parseInt(h, 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  function parseColor(c) {
    if (c[0] === '#') return hexToRgb(c);
    const m = c.match(/[\d.]+/g);
    return m ? [+m[0], +m[1], +m[2]] : [128, 128, 128];
  }
  function shade(hex, amt) {
    const [r, g, b] = parseColor(hex);
    const f = v => Math.max(0, Math.min(255, Math.round(amt >= 0 ? v + (255 - v) * amt : v * (1 + amt))));
    return `rgb(${f(r)},${f(g)},${f(b)})`;
  }
  function rgba(hex, a) { const [r, g, b] = parseColor(hex); return `rgba(${r},${g},${b},${a})`; }
  function alphaOf(c) { const m = c.match(/rgba\([^)]*,\s*([\d.]+)\)/); return m ? +m[1] : 1; }

  // Relleno con volumen (luz arriba-izquierda, sombra abajo) + tinta interior
  let INK = true;
  function volFill(fill, x0, y0, x1, y1) {
    if (typeof fill !== 'string' || alphaOf(fill) < 0.6 || (y1 - y0) < 3) return fill;
    const g = C.createLinearGradient(x0, y0, x0 + (x1 - x0) * 0.35, y1);
    g.addColorStop(0, shade(fill, 0.28));
    g.addColorStop(0.45, fill);
    g.addColorStop(1, shade(fill, -0.45));
    return g;
  }
  function ink(lw) {
    if (!INK) return;
    C.strokeStyle = 'rgba(8,4,10,0.85)'; C.lineWidth = lw; C.lineJoin = 'round'; C.stroke();
  }

  function seeded(str) {
    let h = 2166136261;
    for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
    return () => { h += 0x6D2B79F5; let t = h; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  }

  // ---------- imágenes personalizadas ----------
  const images = {};
  function getImage(id) {
    if (typeof CUSTOM_SPRITES === 'undefined' || !CUSTOM_SPRITES.includes(id)) return null;
    if (images[id] === undefined) {
      images[id] = null;
      const img = new Image();
      img.onload = () => { images[id] = img; };
      img.onerror = () => { images[id] = false; };
      img.src = (typeof SPRITE_DATA !== 'undefined' && SPRITE_DATA[id]) || `assets/criaturas/${id}.png`;
    }
    return images[id] || null;
  }

  // ---------- primitivas ----------
  let C; // contexto actual

  function ellipse(x, y, rx, ry, fill, stroke, rot = 0) {
    rx = Math.abs(rx); ry = Math.abs(ry);
    C.beginPath(); C.ellipse(x, y, rx, ry, rot, 0, Math.PI * 2);
    if (fill) {
      C.fillStyle = volFill(fill, x - rx, y - ry, x + rx, y + ry); C.fill();
      if (!stroke && rx > 4 && ry > 3 && alphaOf(fill) > 0.6) {
        ink(Math.min(1.8, rx * 0.12));
        // brillo especular
        if (rx > 9) { C.beginPath(); C.ellipse(x - rx * 0.35, y - ry * 0.45, rx * 0.28, ry * 0.14, -0.4, 0, Math.PI * 2); C.fillStyle = 'rgba(255,255,255,0.13)'; C.fill(); }
      }
    }
    if (stroke) { C.strokeStyle = stroke; C.lineWidth = 2; C.stroke(); }
  }
  function poly(pts, fill, stroke, lw = 2) {
    C.beginPath(); C.moveTo(pts[0][0], pts[0][1]);
    let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
    for (const p of pts) { x0 = Math.min(x0, p[0]); y0 = Math.min(y0, p[1]); x1 = Math.max(x1, p[0]); y1 = Math.max(y1, p[1]); }
    for (let i = 1; i < pts.length; i++) C.lineTo(pts[i][0], pts[i][1]);
    C.closePath();
    if (fill) {
      C.fillStyle = volFill(fill, x0, y0, x1, y1); C.fill();
      if (!stroke && (x1 - x0) + (y1 - y0) > 14 && alphaOf(fill) > 0.6) ink(1.3);
    }
    if (stroke) { C.strokeStyle = stroke; C.lineWidth = lw; C.stroke(); }
  }
  function line(x1, y1, x2, y2, color, w) {
    C.beginPath(); C.moveTo(x1, y1); C.lineTo(x2, y2);
    C.strokeStyle = color; C.lineWidth = w; C.lineCap = 'round'; C.stroke();
  }
  function curve(pts, color, w) {
    C.beginPath(); C.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length - 1; i++) {
      const xc = (pts[i][0] + pts[i + 1][0]) / 2, yc = (pts[i][1] + pts[i + 1][1]) / 2;
      C.quadraticCurveTo(pts[i][0], pts[i][1], xc, yc);
    }
    const l = pts[pts.length - 1]; C.lineTo(l[0], l[1]);
    C.strokeStyle = color; C.lineWidth = w; C.lineCap = 'round'; C.lineJoin = 'round'; C.stroke();
  }

  // Ojo brillante con pupila rasgada y parpadeo
  function eye(x, y, r, color, t, seed = 0, opts = {}) {
    const blinkPhase = (t * 0.45 + seed * 7.3) % 4.2;
    const blink = blinkPhase < 0.12 ? Math.sin(blinkPhase / 0.12 * Math.PI) : 0;
    ellipse(x, y, r * 1.35, r * 1.15, 'rgba(0,0,0,0.85)');
    const open = 1 - blink;
    if (open < 0.08) { line(x - r, y, x + r, y, '#000', 2); return; }
    C.save();
    C.shadowColor = color; C.shadowBlur = r * 2.2;
    ellipse(x, y, r, r * open, opts.hollow ? '#000' : color);
    C.restore();
    if (opts.hollow) { ellipse(x, y, r * 0.35, r * 0.35 * open, color); return; }
    // pupila
    const lx = Math.sin(t * 0.7 + seed) * r * 0.2;
    ellipse(x + lx, y, r * (opts.round ? 0.45 : 0.22), r * 0.8 * open, '#050003');
    ellipse(x + lx - r * 0.3, y - r * 0.35 * open, r * 0.18, r * 0.14, 'rgba(255,255,255,0.7)');
  }

  function teeth(x1, y1, x2, y2, n, len, color = '#efe6cf', dir = 1) {
    const dx = (x2 - x1) / n, dy = (y2 - y1) / n;
    C.fillStyle = color;
    for (let i = 0; i < n; i++) {
      const ax = x1 + dx * i, ay = y1 + dy * i;
      const l = len * (0.7 + 0.3 * Math.sin(i * 2.3));
      C.beginPath(); C.moveTo(ax, ay); C.lineTo(ax + dx, ay + dy);
      C.lineTo(ax + dx / 2, ay + dy / 2 + l * dir); C.closePath(); C.fill();
    }
  }

  // Tentáculo afilado y ondulante
  function tentacle(x, y, len, w, ang, t, phase, color, segs = 14, amp = 0.35) {
    const pts = [];
    for (let i = 0; i <= segs; i++) {
      const f = i / segs;
      const a = ang + Math.sin(t * 2.2 + phase + f * 4) * amp * f;
      const px = x + Math.cos(a) * len * f + Math.sin(t * 1.6 + phase + f * 5) * 6 * f;
      const py = y + Math.sin(a) * len * f;
      pts.push([px, py, w * (1 - f * 0.92)]);
    }
    const left = [], right = [];
    for (let i = 0; i < pts.length; i++) {
      const p = pts[i], q = pts[Math.min(i + 1, pts.length - 1)], o = pts[Math.max(i - 1, 0)];
      const dx = q[0] - o[0], dy = q[1] - o[1];
      const d = Math.hypot(dx, dy) || 1;
      const nx = -dy / d, ny = dx / d;
      left.push([p[0] + nx * p[2] / 2, p[1] + ny * p[2] / 2]);
      right.push([p[0] - nx * p[2] / 2, p[1] - ny * p[2] / 2]);
    }
    poly(left.concat(right.reverse()), color);
    // franja de luz a lo largo del tentáculo
    if (w > 5 && alphaOf(color) > 0.6) curve(left.slice(0, -2).map((p, i) => [(p[0] * 2 + pts[i][0]) / 3, (p[1] * 2 + pts[i][1]) / 3]), 'rgba(255,255,255,0.12)', Math.max(1, w * 0.18));
    return pts;
  }

  function horn(x, y, len, ang, bend, color) {
    const ex = x + Math.cos(ang) * len, ey = y + Math.sin(ang) * len;
    const cx = x + Math.cos(ang + bend) * len * 0.6, cy = y + Math.sin(ang + bend) * len * 0.6;
    const w = len * 0.22;
    C.beginPath();
    C.moveTo(x - w * Math.sin(ang), y + w * Math.cos(ang));
    C.quadraticCurveTo(cx, cy, ex, ey);
    C.quadraticCurveTo(cx - w * 0.5, cy, x + w * Math.sin(ang), y - w * Math.cos(ang));
    C.closePath();
    const hg = C.createLinearGradient(x, y, ex, ey);
    hg.addColorStop(0, shade(color, -0.35)); hg.addColorStop(0.6, color); hg.addColorStop(1, shade(color, 0.35));
    C.fillStyle = hg; C.fill();
    if (len > 7) ink(Math.min(1.4, len * 0.06));
  }

  function drips(x, y, w, n, t, color) {
    for (let i = 0; i < n; i++) {
      const dx = x - w / 2 + (w / (n - 1 || 1)) * i;
      const l = 6 + ((t * 18 + i * 13) % 18);
      line(dx, y, dx, y + l, color, 2.2);
      ellipse(dx, y + l, 2, 2.6, color);
    }
  }

  function flame(x, y, w, h, t, c1, c2, seed = 0) {
    C.save();
    C.globalCompositeOperation = 'lighter';
    for (let k = 0; k < 3; k++) {
      const hh = h * (1 - k * 0.25), ww = w * (1 - k * 0.25);
      const wob = Math.sin(t * 9 + seed + k) * ww * 0.25;
      C.beginPath();
      C.moveTo(x - ww / 2, y);
      C.quadraticCurveTo(x - ww * 0.6, y - hh * 0.5, x + wob, y - hh);
      C.quadraticCurveTo(x + ww * 0.6, y - hh * 0.5, x + ww / 2, y);
      C.closePath();
      C.fillStyle = k === 0 ? rgba(c1, 0.55) : k === 1 ? rgba(c2, 0.6) : 'rgba(255,250,200,0.7)';
      C.fill();
    }
    C.restore();
  }

  // Grietas brillantes (lava / energía) estilo referencias
  function cracks(cx, cy, w, h, color, t, seed, n = 4) {
    const rnd = seeded('cr' + seed);
    C.save();
    C.shadowColor = color; C.shadowBlur = 8;
    const a = 0.65 + Math.sin(t * 3 + seed) * 0.3;
    C.globalAlpha = a;
    for (let i = 0; i < n; i++) {
      let x = cx + (rnd() - 0.5) * w, y = cy + (rnd() - 0.5) * h;
      const pts = [[x, y]];
      for (let k = 0; k < 4; k++) { x += (rnd() - 0.5) * w * 0.35; y += (rnd() - 0.3) * h * 0.3; pts.push([x, y]); }
      C.beginPath(); C.moveTo(pts[0][0], pts[0][1]);
      for (const p of pts) C.lineTo(p[0], p[1]);
      C.strokeStyle = color; C.lineWidth = 1.8; C.lineCap = 'round'; C.stroke();
    }
    C.restore();
  }

  // Placa de armadura ósea con borde
  function plate(x, y, w, h, rot, color, edge) {
    C.save(); C.translate(x, y); C.rotate(rot);
    poly([[-w / 2, h / 2], [-w / 2, -h / 4], [0, -h / 2], [w / 2, -h / 4], [w / 2, h / 2], [0, h / 3]], color, edge || '#120a06', 1.5);
    line(-w * 0.3, 0, w * 0.3, 0, 'rgba(255,255,255,0.25)', 1.2);
    C.restore();
  }

  function legJointed(x, y, kx, ky, fx, fy, color, w) {
    C.beginPath(); C.moveTo(x, y); C.lineTo(kx, ky); C.lineTo(fx, fy);
    C.lineCap = 'round'; C.lineJoin = 'round';
    if (INK && w > 3 && alphaOf(color) > 0.6) { C.strokeStyle = 'rgba(8,4,10,0.9)'; C.lineWidth = w + 2.4; C.stroke(); }
    C.strokeStyle = color; C.lineWidth = w; C.stroke();
    if (w > 4 && alphaOf(color) > 0.6) { C.strokeStyle = 'rgba(255,255,255,0.12)'; C.lineWidth = w * 0.3; C.beginPath(); C.moveTo(x - w * 0.2, y - w * 0.2); C.lineTo(kx - w * 0.2, ky - w * 0.2); C.stroke(); }
  }

  function claws(x, y, dir, color = '#e8dcc0', n = 3, len = 8) {
    for (let i = 0; i < n; i++) {
      const a = (dir > 0 ? 0.3 : Math.PI - 0.3) + (i - 1) * 0.35 * dir + Math.PI / 2 * 0.6;
      horn(x, y, len, a, 0.4 * dir, color);
    }
  }

  // ---------- cabeza genérica de bestia ----------
  function beastHead(a, hx, hy, r, t, s, seed, R) {
    const body = a.c1, acc = a.c2;
    const jaw = (Math.sin(t * 3 + seed) * 0.5 + 0.5) * 0.35 + 0.15;
    const sn = (a.snout || 1) * r * 1.1;
    if (a.mane) {
      const n = 10 + s * 3, pts = [];
      for (let i = 0; i < n; i++) {
        const ang = (i / n) * Math.PI * 2;
        const rr = r * (i % 2 ? 1.25 : 1.75 + 0.15 * Math.sin(t * 2 + i));
        pts.push([hx - r * 0.3 + Math.cos(ang) * rr, hy + Math.sin(ang) * rr]);
      }
      poly(pts, shade(acc, -0.45));
      if (a.fire) for (let i = 0; i < 4; i++) flame(hx - r * 0.6 + i * r * 0.3, hy - r * 0.9, r * 0.6, r * (1.2 + s * 0.2), t, '#ff5a1a', '#ffb03b', i + seed);
    }
    if (a.horns) {
      horn(hx - r * 0.2, hy - r * 0.7, r * (1.1 + s * 0.35), -2.1, 0.6, '#d8cfb6');
      horn(hx + r * 0.3, hy - r * 0.8, r * (0.9 + s * 0.3), -1.7, 0.5, '#bfb69d');
    }
    // cuello/cabeza
    ellipse(hx, hy, r, r * 0.9, body);
    // hocico superior
    if (a.croc) {
      poly([[hx, hy - r * 0.5], [hx + sn * 1.4, hy - r * 0.1], [hx + sn * 1.4, hy + r * 0.15], [hx, hy + r * 0.2]], shade(body, 0.1));
      teeth(hx + r * 0.2, hy + r * 0.15, hx + sn * 1.35, hy + r * 0.15, 9, 5);
      poly([[hx, hy + r * 0.3], [hx + sn * 1.3, hy + r * (0.3 + jaw)], [hx + sn * 1.2, hy + r * (0.55 + jaw)], [hx, hy + r * 0.7]], shade(body, -0.15));
      teeth(hx + r * 0.2, hy + r * (0.32 + jaw * 0.3), hx + sn * 1.25, hy + r * (0.3 + jaw), 8, 5, '#efe6cf', -1);
    } else {
      poly([[hx + r * 0.2, hy - r * 0.55], [hx + sn + r * 0.4, hy - r * 0.15], [hx + sn + r * 0.45, hy + r * 0.12], [hx + r * 0.3, hy + r * 0.15]], shade(body, 0.08));
      ellipse(hx + sn + r * 0.38, hy - r * 0.1, r * 0.12, r * 0.08, '#000');
      // mandíbula
      poly([[hx + r * 0.2, hy + r * 0.3], [hx + sn + r * 0.2, hy + r * (0.25 + jaw)], [hx + sn, hy + r * (0.5 + jaw)], [hx, hy + r * 0.75]], shade(body, -0.2));
      // boca interior
      poly([[hx + r * 0.3, hy + r * 0.16], [hx + sn + r * 0.4, hy + r * 0.13], [hx + sn + r * 0.2, hy + r * (0.25 + jaw)], [hx + r * 0.3, hy + r * 0.3]], '#3a0006');
      teeth(hx + r * 0.35, hy + r * 0.14, hx + sn + r * 0.4, hy + r * 0.13, 5 + s, r * 0.22);
      teeth(hx + r * 0.35, hy + r * 0.3, hx + sn + r * 0.2, hy + r * (0.25 + jaw), 4 + s, r * 0.2, '#efe6cf', -1);
      if (a.tusks) { horn(hx + sn * 0.6, hy + r * 0.2, r * 0.9, 0.9, -0.9, '#efe6cf'); }
    }
    if (a.trunk) {
      tentacle(hx + sn + r * 0.3, hy - r * 0.05, r * (1.6 + s * 0.4), r * 0.35, 1.3, t, seed, shade(body, 0.05), 10, 0.5);
    }
    if (a.humanface) {
      ellipse(hx + r * 0.25, hy - r * 0.05, r * 0.62, r * 0.7, '#d8b89a');
      line(hx - r * 0.05, hy + r * 0.35, hx + r * 0.6, hy + r * 0.35, '#3a0006', 3);
      teeth(hx, hy + r * 0.33, hx + r * 0.55, hy + r * 0.33, 6, 4);
    }
    // orejas
    if (!a.croc && !a.trunk) {
      poly([[hx - r * 0.5, hy - r * 0.5], [hx - r * 0.75, hy - r * 1.4 - s * 2], [hx - r * 0.05, hy - r * 0.75]], shade(body, -0.25));
    }
    // ojos
    const ne = s >= 3 ? 3 : 2;
    eye(hx + r * 0.3, hy - r * 0.35, r * (s === 1 ? 0.3 : 0.24), a.eye, t, seed);
    if (ne >= 2) eye(hx - r * 0.1, hy - r * 0.42, r * (s === 1 ? 0.24 : 0.18), a.eye, t, seed + 1);
    if (ne >= 3) { eye(hx - r * 0.25, hy - r * 0.05, r * 0.14, a.eye, t, seed + 2); eye(hx + r * 0.05, hy - r * 0.75, r * 0.12, a.eye, t, seed + 3); }
  }

  const TYPE_GLOW = a => a.glow || a.eye;

  // ---------- PLANES DE CUERPO ----------
  const PLANS = {};

  PLANS.bestia = (a, t, s, R) => {
    const body = a.c1, acc = a.c2;
    const br = Math.sin(t * 2.2) * 1.5;
    const up = a.upright ? 0.25 : 0;
    const by = -42;
    const legW = 9 + s * 2.5;
    const step = Math.sin(t * 3) * 2;
    // alas
    if (a.wings) {
      const flap = Math.sin(t * 3) * 0.25;
      C.save(); C.translate(-8, by - 14); C.rotate(-0.4 + flap);
      poly([[0, 0], [-30, -45], [-60, -50 - s * 6], [-48, -25], [-62, -18], [-40, -6], [-50, 6], [-20, 2]], shade(acc, -0.5));
      for (let i = 0; i < 3; i++) line(0, 0, [-60, -62, -50][i], [-50, -18, 6][i], shade(acc, -0.2), 2);
      C.restore();
    }
    // cola
    const tb = [-40, by - 4];
    if (a.tail === 'escorpion') {
      const segs = 7; let px = tb[0], py = tb[1];
      for (let i = 0; i < segs; i++) {
        const ang = -Math.PI * 0.6 - i * 0.32 + Math.sin(t * 2 + i * 0.5) * 0.06;
        const nx = px + Math.cos(ang) * 11, ny = py + Math.sin(ang) * 11;
        ellipse(nx, ny, 7 - i * 0.3, 6 - i * 0.3, i % 2 ? shade(acc, -0.3) : shade(acc, -0.1));
        px = nx; py = ny;
      }
      horn(px, py, 16, 0.8 + Math.sin(t * 2) * 0.1, 0.5, '#e8f0c0');
      C.save(); C.shadowColor = a.eye; C.shadowBlur = 10; ellipse(px + 10, py + 9, 2.5, 2.5, a.eye); C.restore();
    } else {
      const pts = tentacle(tb[0], tb[1], 40 + s * 6, 10, Math.PI * 0.95, t, 1.3, shade(body, -0.1), 10, 0.5);
      const end = pts[pts.length - 1];
      if (a.tail === 'mano') {
        C.save(); C.translate(end[0], end[1]);
        ellipse(0, 0, 7, 6, shade(acc, 0.1));
        for (let i = 0; i < 5; i++) line(0, 0, -6 - i * 1.5 + Math.sin(t * 4 + i) * 2, -10 + i * 4, shade(acc, 0.1), 3);
        C.restore();
      } else if (a.tail === 'serpiente') {
        ellipse(end[0] - 4, end[1] - 4, 8, 6, shade(acc, -0.2));
        eye(end[0] - 7, end[1] - 6, 2.5, a.eye, t, 9);
        teeth(end[0] - 12, end[1] - 1, end[0] - 2, end[1] - 1, 3, 4);
      }
    }
    // patas traseras (al fondo)
    legJointed(-26, by + 8, -34, by + 26, -28 + step, 0, shade(body, -0.35), legW);
    legJointed(24, by + 8, 30, by + 26, 26 - step, 0, shade(body, -0.35), legW);
    // cuerpo
    C.save(); C.rotate(-up);
    ellipse(0, by + br, 44 + s * 2, 22 + s * 5, body);
    ellipse(4, by + 10 + br + s * 2, 32, 9 + s * 2, shade(acc, -0.35));
    ellipse(-4, by - 10 + br - s, 30, 8, 'rgba(255,255,255,0.07)');
    if (a.skinless) {
      for (let i = 0; i < 6; i++) curve([[-36 + i * 12, by - 16], [-30 + i * 12, by], [-34 + i * 12, by + 16]], shade(acc, 0.1), 2);
      for (let i = 0; i < 4; i++) curve([[-40, by - 8 + i * 6], [0, by - 12 + i * 7], [38, by - 6 + i * 5]], '#2a0006', 1.2);
    }
    if (a.ribs) for (let i = 0; i < 5; i++) curve([[-18 + i * 9, by - 16], [-14 + i * 9, by], [-18 + i * 9, by + 14]], shade(acc, -0.1), 2);
    if (a.spots) for (let i = 0; i < 9; i++) ellipse(-30 + (i * 37) % 60, by - 10 + (i * 13) % 20, 4, 3, shade(acc, -0.6), shade(acc, 0));
    if (a.croc) for (let i = 0; i < 6; i++) poly([[-30 + i * 11, by - 20], [-25 + i * 11, by - 30], [-20 + i * 11, by - 20]], shade(acc, -0.3));
    // púas dorsales
    const ns = (a.spikes || 0) + s * 2;
    for (let i = 0; i < ns; i++) {
      const f = i / Math.max(1, ns - 1);
      const px = -34 + f * 60, py = by - 18 - Math.sin(f * Math.PI) * 6;
      horn(px, py + br, 10 + s * 3 + Math.sin(f * Math.PI) * 6, -Math.PI / 2 - 0.4, -0.3, a.spikes ? shade(acc, 0.1) : shade(body, -0.3));
    }
    if (s >= 2) cracks(0, by + br, 70, 30, TYPE_GLOW(a), t, R, 3 + s);
    if (s >= 3) { plate(-20, by - 14 + br, 20, 14, -0.2, '#d8cfb6'); plate(2, by - 18 + br, 22, 15, 0, '#cfc6ac'); plate(24, by - 14 + br, 18, 13, 0.25, '#d8cfb6'); }
    if (a.fire && !a.mane) for (let i = 0; i < 3; i++) flame(-20 + i * 16, by - 18, 14, 18 + s * 4, t, '#ff5a1a', '#ffb03b', i);
    // jinete (nuckelavee)
    if (a.rider && s >= 2) {
      const rx = -6, ry = by - 20;
      poly([[rx - 8, ry], [rx - 6, ry - 34], [rx + 8, ry - 34], [rx + 10, ry]], shade(acc, -0.1));
      for (let i = 0; i < 3; i++) line(rx - 4 + i * 4, ry - 30, rx - 4 + i * 4, ry - 4, '#1a0004', 1.5);
      line(rx + 6, ry - 30, rx + 30, ry - 10 + Math.sin(t * 2) * 3, shade(acc, -0.1), 5);
      line(rx - 6, ry - 30, rx - 20, ry - 4, shade(acc, -0.1), 5);
      ellipse(rx + 1, ry - 46, 9 + s, 11 + s, shade(acc, -0.05));
      eye(rx + 4, ry - 48, 3.2, a.eye, t, 7);
    }
    if (a.chains) {
      for (let i = 0; i < 6; i++) ellipse(30 - i * 8, by - 4 + Math.sin(t * 2 + i) * 2 + i * 3, 4, 2.4, null, '#8a8a8a', 0.4);
    }
    C.restore();
    // patas delanteras
    legJointed(-18, by + 10, -12, by + 28, -16 - step, 0, body, legW);
    legJointed(30, by + 8, 38, by + 26, 34 + step, 0, body, legW);
    claws(-16 - step, 0, 1, '#d8ccb0', 3, 5);
    claws(34 + step, 0, 1, '#d8ccb0', 3, 5);
    // cabeza(s)
    const nh = a.heads || 1;
    const hr = (s === 1 ? 19 : 17 + s * 2);
    for (let h = nh - 1; h >= 0; h--) {
      const off = nh === 1 ? 0 : (h - (nh - 1) / 2);
      const hx = 44 + Math.abs(off) * -4 + (a.upright ? 6 : 0);
      const hy = by - 16 - off * 20 - (a.upright ? 14 : 0) + Math.sin(t * 2 + h) * 2;
      line(30, by - 6, hx - 6, hy + 4, body, hr * 1.1);
      beastHead(a, hx, hy, hr, t, s, h * 3.1 + R, R);
    }
  };

  PLANS.humanoide = (a, t, s, R) => {
    const body = a.c1, acc = a.c2;
    const ll = a.longlimbs ? 1.25 : 1;
    const hunch = a.hunch ? 0.35 : 0.08;
    const sway = Math.sin(t * 1.6) * 0.04;
    const legH = 40 * ll;
    const hipY = -legH;
    const step = Math.sin(t * 2) * 2;
    // piernas
    legJointed(-8, hipY, -16, hipY + legH * 0.5, -10 + step, 0, shade(body, -0.25), 7 + s * 2);
    legJointed(8, hipY, 14, hipY + legH * 0.5, 12 - step, 0, body, 7 + s * 2);
    if (a.horse) { ellipse(-10 + step, -2, 6, 4, '#111'); ellipse(12 - step, -2, 6, 4, '#111'); }
    else { claws(-10 + step, 0, 1, '#cfc4a8', 3, 5); claws(12 - step, 0, 1, '#cfc4a8', 3, 5); }
    C.save(); C.translate(0, hipY); C.rotate(hunch + sway);
    const torsoH = 42 + s * 4;
    // brazo trasero
    const armL = 46 * ll;
    const sw = Math.sin(t * 2.4) * 0.15;
    legJointed(-10, -torsoH + 6, -18, -torsoH + armL * 0.5, -8 + Math.sin(t * 2.4) * 5, -torsoH + armL, shade(body, -0.3), 6);
    // torso
    poly([[-14, 0], [-18 - (a.belly ? 6 : 0), -torsoH * 0.5], [-16, -torsoH], [16, -torsoH], [18 + (a.belly ? 8 : 0), -torsoH * 0.5], [14, 0]], body);
    if (a.belly) {
      C.save(); C.shadowColor = '#ff7b1a'; C.shadowBlur = 20;
      ellipse(4, -torsoH * 0.45, 12, 10, '#2a0a00');
      ellipse(4, -torsoH * 0.45, 9, 7, `rgba(255,${120 + Math.sin(t * 8) * 40},30,0.9)`);
      C.restore();
      for (let i = 0; i < 4; i++) line(-6 + i * 6, -torsoH * 0.45 - 10, -6 + i * 6, -torsoH * 0.45 + 10, '#2a0a00', 2);
    }
    ellipse(-4, -torsoH * 0.7, 10, torsoH * 0.22, 'rgba(255,255,255,0.07)');
    // costillas
    for (let i = 0; i < 4; i++) curve([[-12, -torsoH * 0.35 - i * 7], [0, -torsoH * 0.32 - i * 7 - 3], [12, -torsoH * 0.35 - i * 7]], shade(acc, -0.2), 1.6);
    if (s >= 2) cracks(0, -torsoH * 0.5, 26, torsoH * 0.8, TYPE_GLOW(a), t, R, 2 + s);
    if (s >= 3) { plate(-16, -torsoH + 2, 18, 14, -0.5, '#d8cfb6'); plate(16, -torsoH + 2, 18, 14, 0.5, '#d8cfb6'); horn(-20, -torsoH - 2, 10, -2.4, 0.3, '#efe6cf'); horn(20, -torsoH - 2, 10, -0.7, -0.3, '#efe6cf'); }
    if (a.drowned) {
      drips(0, -2, 24, 4, t, rgba('#3fd0ff', 0.7));
      for (let i = 0; i < 5; i++) ellipse(-8 + (i * 7) % 18, -torsoH * 0.2 - (i * 11) % 30, 2.5, 2.5, shade(acc, 0.3));
    }
    if (a.chainsBody) {}
    // brazo delantero
    legJointed(12, -torsoH + 6, 24 + Math.cos(t * 2.4) * 3, -torsoH + armL * 0.5, 30 + Math.sin(t * 2.4 + 1) * 5, -torsoH + armL - 6, body, 6);
    if (a.claws || s >= 2) {
      const hx = 30 + Math.sin(t * 2.4 + 1) * 5, hy = -torsoH + armL - 6;
      for (let i = 0; i < 4; i++) horn(hx, hy, 9 + s * 2, 0.9 + i * 0.25, 0.5, '#e8dcc0');
    }
    // cabeza
    const hx = 4, hy = -torsoH - 14 - s;
    line(0, -torsoH, hx, hy + 6, shade(body, -0.1), 8);
    C.translate(hx, hy); C.rotate(-hunch * 0.8 - sway);
    if (a.horse) {
      poly([[-10, -12], [12, -10], [30, 4], [30, 12], [8, 14], [-10, 8]], shade(acc, -0.3));
      teeth(14, 10, 30, 10, 6, 4);
      if (a.mane) for (let i = 0; i < 7; i++) curve([[-8 + i * 3, -12], [-14 + i * 2, -2 + Math.sin(t * 3 + i) * 3], [-18 + i * 2, 14 + i * 2]], '#0a0a0a', 3);
      eye(6, -4, 4.2, a.eye, t, R);
      eye(14, -4, 2.6, a.eye, t, R + 1);
    } else if (a.skullface) {
      if (a.antlers) {
        for (const d of [-1, 1]) {
          C.save(); C.scale(d, 1);
          const L = 26 + s * 10;
          curve([[2, -12], [10, -12 - L * 0.5], [6, -12 - L]], '#d8d0bc', 4);
          for (let k = 1; k <= 2 + s; k++) curve([[6 + k, -12 - L * k / (3 + s)], [16 + k * 3, -18 - L * k / (3 + s)], [20 + k * 2, -26 - L * k / (3 + s)]], '#d8d0bc', 3);
          C.restore();
        }
      }
      poly([[-12, -14], [12, -14], [14, 4], [8, 16], [-8, 16], [-14, 4]], '#e8e0c8');
      ellipse(-5, -3, 5, 6, '#000'); ellipse(6, -3, 5, 6, '#000');
      eye(-5, -3, 2.2, a.eye, t, R, { hollow: true });
      eye(6, -3, 2.2, a.eye, t, R + 1, { hollow: true });
      poly([[0, 3], [-2, 8], [2, 8]], '#000');
      teeth(-7, 12, 8, 12, 6, 5, '#000', 1);
    } else if (a.bullhorns) {
      horn(-8, -10, 22 + s * 8, -2.6, 0.9, '#3a2a1a');
      horn(8, -10, 22 + s * 8, -0.5, -0.9, '#3a2a1a');
      ellipse(0, 0, 15, 15, shade(acc, -0.4));
      poly([[-6, 4], [16, 2], [18, 12], [-4, 14]], shade(acc, -0.5));
      ellipse(14, 6, 2, 2, '#000');
      eye(-2, -4, 3.5, a.eye, t, R); eye(8, -5, 3, a.eye, t, R + 1);
      if (s >= 2) flame(0, -12, 16, 16 + s * 6, t, '#ff5a1a', '#ffb03b', R);
    } else {
      // rostro de gul / draugr
      ellipse(0, 0, 12 + s, 14 + s, shade(acc, -0.1));
      if (a.crown && s >= 2) {
        const pts = [[-12, -10]];
        for (let i = 0; i < 5; i++) pts.push([-10 + i * 5, -22 - (i % 2) * 6], [-8 + i * 5, -12]);
        pts.push([12, -10]);
        poly(pts, '#8a7a3a');
      }
      eye(-4, -3, 3.6, a.eye, t, R, { round: true }); eye(6, -3, 3, a.eye, t, R + 1, { round: true });
      if (s >= 3) eye(1, -10, 2.4, a.eye, t, R + 2);
      const jw = a.jaw ? 6 + Math.sin(t * 3) * 3 : 2;
      poly([[-8, 6], [10, 6], [8, 6 + jw + 4], [-6, 6 + jw + 4]], '#200004');
      teeth(-8, 6, 10, 6, 6, 4); teeth(-6, 10 + jw, 8, 10 + jw, 5, 4, '#efe6cf', -1);
      if (a.drowned) { for (let i = 0; i < 5; i++) curve([[-10 + i * 5, -12], [-12 + i * 5, 2], [-14 + i * 5, 18 + i]], '#1a2a1a', 2); }
    }
    C.restore();
  };

  PLANS.serpiente = (a, t, s, R) => {
    const body = a.c1, acc = a.c2;
    const n = 14 + s * 2;
    const pts = [];
    for (let i = 0; i < n; i++) {
      const f = i / (n - 1);
      let x, y;
      if (f < 0.55) { // espiral en el suelo
        const ang = f / 0.55 * Math.PI * 1.6 + Math.PI;
        const r = 36 - f * 30;
        x = Math.cos(ang) * r - 6; y = -12 + Math.sin(ang) * r * 0.35;
      } else { // se alza
        const g = (f - 0.55) / 0.45;
        x = -4 + g * 20 + Math.sin(t * 2 + g * 3) * 4;
        y = -18 - g * (56 + s * 4);
      }
      pts.push([x, y]);
    }
    for (let i = 0; i < n; i++) {
      const f = i / (n - 1);
      const r = (10 + s * 1.2) * (0.55 + 0.6 * Math.sin(Math.min(1, f * 1.4) * Math.PI * 0.5 + 0.3));
      const [x, y] = pts[i];
      ellipse(x, y, r, r * 0.9, i % 2 ? body : shade(body, 0.08));
      if (i % 2 === 0) ellipse(x + r * 0.2, y + r * 0.3, r * 0.55, r * 0.4, shade(acc, -0.2));
      if (a.spikes && i % 3 === 0 && i > 2) horn(x, y - r * 0.6, 6 + s * 2, -Math.PI / 2 - 0.5, -0.3, shade(acc, 0.2));
      if (s >= 2 && i % 3 === 1) cracks(x, y, r * 1.4, r, TYPE_GLOW(a), t, R + i, 1);
      if (s >= 3 && i % 3 === 0 && i > 3) plate(x, y - r * 0.5, r * 1.2, r * 0.8, 0, '#d8cfb6');
      if (a.fins && i % 4 === 1) poly([[x - r, y], [x - r * 2.2, y - r * 1.4], [x, y - r * 0.6]], rgba(a.c2, 0.6));
    }
    const [hx, hy] = pts[n - 1];
    if (a.torso) {
      // torso femenino
      poly([[hx - 10, hy + 6], [hx - 12, hy - 22], [hx + 12, hy - 22], [hx + 10, hy + 6]], shade(acc, -0.2));
      legJointed(hx + 10, hy - 18, hx + 22, hy - 4, hx + 30 + Math.sin(t * 2) * 4, hy - 20, shade(acc, -0.2), 4);
      legJointed(hx - 10, hy - 18, hx - 18, hy - 2, hx - 10, hy + 6, shade(acc, -0.35), 4);
      horn(hx + 30 + Math.sin(t * 2) * 4, hy - 20, 7, -0.6, 0.3, '#e8dcc0');
      const fy = hy - 34;
      if (a.snakehair) {
        for (let i = 0; i < 6 + s * 2; i++) {
          const ang = -Math.PI + (i / (5 + s * 2)) * Math.PI;
          const p = tentacle(hx, fy - 4, 18 + s * 4, 5, ang, t, i * 1.7, shade(acc, -0.1), 8, 0.6);
          const e = p[p.length - 1];
          ellipse(e[0], e[1], 3, 2.4, shade(acc, 0.1)); ellipse(e[0], e[1] - 1, 0.9, 0.9, a.eye);
        }
      }
      if (a.hair) for (let i = 0; i < 8; i++) curve([[hx - 8 + i * 2, fy - 10], [hx - 12 + i * 2 + Math.sin(t * 2 + i) * 2, fy + 6], [hx - 14 + i * 3, fy + 26]], '#100008', 2.5);
      ellipse(hx, fy, 10, 12, '#c8b8a8');
      eye(hx - 3, fy - 2, 3, a.eye, t, R, { round: true }); eye(hx + 5, fy - 2, 3, a.eye, t, R + 1, { round: true });
      poly([[hx - 4, fy + 5], [hx + 6, fy + 5], [hx + 4, fy + 9], [hx - 2, fy + 9]], '#3a0006');
      teeth(hx - 4, fy + 5, hx + 6, fy + 5, 4, 3);
      if (s >= 3 && a.hair) { ellipse(hx, fy - 16, 12, 4, null, '#ffd0e0'); }
    } else {
      // cabeza de serpiente
      const hr = 12 + s * 2;
      const jaw = (Math.sin(t * 3) * 0.5 + 0.5) * 0.5 + 0.3;
      if (s >= 3 && !a.crown) { poly([[hx - hr, hy + 4], [hx - hr * 2, hy - hr * 1.5], [hx + hr * 0.4, hy - hr * 1.1], [hx + hr * 2, hy - hr * 1.5], [hx + hr, hy + 4]], rgba(a.c2, 0.7)); }
      poly([[hx - hr, hy], [hx - hr * 0.6, hy - hr * 0.8], [hx + hr * 1.6, hy - hr * 0.3], [hx + hr * 1.7, hy + hr * 0.1], [hx, hy + hr * 0.2]], shade(body, 0.1));
      poly([[hx - hr * 0.6, hy + hr * 0.3], [hx + hr * 1.5, hy + hr * (0.2 + jaw)], [hx + hr * 1.2, hy + hr * (0.5 + jaw)], [hx - hr * 0.6, hy + hr * 0.8]], shade(body, -0.2));
      poly([[hx, hy + hr * 0.15], [hx + hr * 1.65, hy + hr * 0.12], [hx + hr * 1.4, hy + hr * (0.25 + jaw)], [hx, hy + hr * 0.4]], '#3a0006');
      horn(hx + hr * 1.2, hy + hr * 0.12, hr * 0.7, 1.7, 0.2, '#f0ead8');
      horn(hx + hr * 0.6, hy + hr * 0.14, hr * 0.5, 1.6, 0.2, '#f0ead8');
      const tongue = Math.sin(t * 6) > 0.3;
      if (tongue) curve([[hx + hr * 1.5, hy + hr * 0.3], [hx + hr * 2.2, hy + hr * 0.35], [hx + hr * 2.6, hy + hr * 0.15]], '#c21d4d', 2);
      eye(hx + hr * 0.4, hy - hr * 0.35, hr * 0.28, a.eye, t, R);
      if (s >= 2) eye(hx - hr * 0.1, hy - hr * 0.45, hr * 0.2, a.eye, t, R + 1);
      if (a.crown) {
        const cp = [[hx - hr * 0.8, hy - hr * 0.7]];
        for (let i = 0; i < 3 + s; i++) cp.push([hx - hr * 0.6 + i * hr * 0.4, hy - hr * (1.4 + (i % 2) * 0.5) - s * 2], [hx - hr * 0.4 + i * hr * 0.4, hy - hr * 0.8]);
        poly(cp, '#d8cfb6');
      }
    }
  };

  PLANS.tentaculo = (a, t, s, R) => {
    const body = a.c1, acc = a.c2;
    const n = (a.tentacles || 6) + (s - 1) * 2;
    const by = -56 - s * 4;
    const pulse = Math.sin(t * 1.8) * 3;
    for (let i = 0; i < n; i++) {
      const f = i / (n - 1);
      const ang = Math.PI * (0.1 + f * 0.8);
      const p = tentacle(-20 + f * 40, by + 18, 50 + s * 8 + (i % 2) * 10, 12 + s, ang, t, i * 1.3, i % 2 ? shade(acc, -0.35) : shade(acc, -0.2), 16, 0.6);
      for (let k = 3; k < p.length - 2; k += 3) ellipse(p[k][0], p[k][1], p[k][2] * 0.2, p[k][2] * 0.2, shade(acc, 0.3));
    }
    // manto
    C.beginPath();
    C.moveTo(-30 - pulse, by + 16);
    C.bezierCurveTo(-40 - pulse, by - 30, -10, by - 56 - pulse * 2, 4, by - 54 - pulse * 2);
    C.bezierCurveTo(30, by - 52, 42 + pulse, by - 20, 32 + pulse, by + 16);
    C.closePath(); C.fillStyle = body; C.fill();
    for (let i = 0; i < 5; i++) curve([[-24 + i * 12, by + 10], [-20 + i * 10, by - 20], [-6 + i * 4, by - 44]], shade(acc, -0.5), 2);
    // pico
    poly([[0, by + 10], [10, by + 24 + Math.sin(t * 4) * 3], [-6, by + 20]], '#1a1a10');
    // ojos
    const ne = 2 + (s - 1) * 2;
    for (let i = 0; i < ne; i++) {
      const ex = -16 + (i % 3) * 16 + (i >= 3 ? 8 : 0), ey = by - 4 - Math.floor(i / 3) * 14 - (i % 2) * 4;
      eye(ex, ey, (i < 2 ? 6 : 4) + (s === 1 ? 1.5 : 0), a.eye, t, R + i);
    }
  };

  PLANS.espectro = (a, t, s, R) => {
    const body = a.c1, acc = a.c2;
    const fl = -14 + Math.sin(t * 1.8) * 5;
    C.save(); C.translate(0, fl);
    const H = 70 + s * 6, W = 26 + s * 3;
    const top = -H;
    if (a.fire) {
      // cuerpo de humo y fuego (ifrit)
      tentacle(0, -16, 32, 24, Math.PI / 2 + 0.3, t, 0, rgba(acc, 0.5), 12, 0.6);
      for (let i = 0; i < 5; i++) flame(-14 + i * 7, -10, 18, 40 + s * 8, t, '#ff3b0a', acc, i);
      poly([[-W * 0.7, -20], [-W, top + 26], [-W * 0.5, top + 14], [W * 0.5, top + 14], [W, top + 26], [W * 0.7, -20]], body);
      for (let i = 0; i < 4; i++) curve([[-W * 0.6 + i * 10, -22], [-W * 0.5 + i * 9, top + 30], [-W * 0.3 + i * 7, top + 16]], rgba(acc, 0.8), 2);
      // brazos
      legJointed(-W * 0.8, top + 26, -W - 14, top + 46, -W - 6 + Math.sin(t * 2) * 6, top + 64, body, 7);
      legJointed(W * 0.8, top + 26, W + 16, top + 40, W + 26 + Math.sin(t * 2 + 1) * 6, top + 30, body, 7);
      flame(W + 26 + Math.sin(t * 2 + 1) * 6, top + 30, 14, 22 + s * 4, t, '#ff5a1a', '#fff36b', 3);
      // cabeza
      const hy = top + 2;
      for (let i = 0; i < 3; i++) flame(-8 + i * 8, hy - 6, 14, 22 + s * 6, t, '#ff3b0a', acc, i + 7);
      ellipse(0, hy, 13 + s, 14 + s, shade(body, 0.1));
      if (a.horns) { horn(-8, hy - 8, 16 + s * 6, -2.2, 0.7, '#1a0a00'); horn(8, hy - 8, 16 + s * 6, -0.9, -0.7, '#1a0a00'); }
      eye(-5, hy - 2, 3.5, a.eye, t, R); eye(6, hy - 2, 3.5, a.eye, t, R + 1);
      poly([[-7, hy + 6], [8, hy + 6], [0, hy + 12]], '#ffef9b');
      teeth(-7, hy + 6, 8, hy + 6, 5, 3, '#1a0a00');
      C.restore(); return;
    }
    // manto/sábana espectral
    C.beginPath();
    C.moveTo(-W * 0.6, top + 16);
    C.quadraticCurveTo(-W * 1.1, top + H * 0.5, -W * 1.2, -6);
    const teeth_n = 7;
    for (let i = 0; i <= teeth_n; i++) {
      const x = -W * 1.2 + (W * 2.4 / teeth_n) * i;
      const y = (i % 2 ? -18 : 4) + Math.sin(t * 3 + i) * 5;
      C.lineTo(x, y);
    }
    C.quadraticCurveTo(W * 1.1, top + H * 0.5, W * 0.6, top + 16);
    C.closePath();
    const g = C.createLinearGradient(0, top, 0, 10);
    g.addColorStop(0, rgba(a.c1, 0.95)); g.addColorStop(1, rgba(a.c1, 0.05));
    C.fillStyle = g; C.fill();
    for (let i = 0; i < 4; i++) curve([[-W * 0.5 + i * W * 0.33, top + 24], [-W * 0.7 + i * W * 0.4, top + H * 0.5], [-W * 0.9 + i * W * 0.55, -8]], rgba(acc, 0.35), 2);
    // brazos largos
    const reach = Math.sin(t * 1.4) * 6;
    legJointed(W * 0.6, top + 30, W + 14, top + 44, W + 30 + reach, top + 40, rgba(a.c1, 0.9), 5);
    legJointed(-W * 0.6, top + 30, -W - 10, top + 50, -W - 6, top + 66 + reach, rgba(a.c1, 0.8), 5);
    for (let i = 0; i < 4; i++) line(W + 30 + reach, top + 40, W + 38 + reach + i, top + 34 + i * 4, rgba(a.c1, 0.9), 2);
    // cabeza
    const hy = top + 6;
    if (a.hair) {
      for (let i = 0; i < 10; i++) curve([[-12 + i * 2.6, hy - 10], [-16 + i * 3 + Math.sin(t * 2 + i) * 3, hy + 14], [-18 + i * 3.5 + Math.sin(t * 1.5 + i) * 5, hy + 40 + (i % 3) * 8]], '#0a0a0a', 3);
    }
    if (a.veil) { poly([[-16, hy - 14], [16, hy - 14], [22, hy + 22], [-22, hy + 22]], 'rgba(240,240,250,0.5)'); }
    ellipse(0, hy, 12 + s, 14 + s, shade(a.c1, -0.05));
    if (a.hair) poly([[-13, hy - 14], [13, hy - 14], [12, hy - 4], [-12, hy - 4]], '#0a0a0a');
    if (a.horns === 0 && a.whistle) {
      // tunche: rostro oscuro con boca de silbido
      ellipse(0, hy, 11 + s, 13 + s, '#0a120a');
      eye(-4, hy - 2, 2.6, a.eye, t, R); eye(5, hy - 2, 2.6, a.eye, t, R + 1);
      ellipse(1, hy + 7, 2, 2.6, '#000', '#6f8f5a');
      const wv = (t * 30) % 20;
      for (let i = 0; i < 3; i++) { C.beginPath(); C.arc(1, hy + 7, 6 + wv + i * 8, -0.5, 0.5); C.strokeStyle = rgba(a.eye, 0.4 - i * 0.12); C.lineWidth = 1.5; C.stroke(); }
    } else {
      ellipse(-5, hy - 2, 4, 5.5, '#000'); ellipse(5, hy - 2, 4, 5.5, '#000');
      eye(-5, hy - 1, 1.8, a.eye === '#000000' ? '#ffffff' : a.eye, t, R, { hollow: true });
      eye(5, hy - 1, 1.8, a.eye === '#000000' ? '#ffffff' : a.eye, t, R + 1, { hollow: true });
      const scream = a.mouth ? 8 + Math.sin(t * 4) * 4 + s * 2 : 4;
      ellipse(0, hy + 8, 3.5, scream * 0.6, '#000');
      if (a.tears) for (const d of [-5, 5]) drips(d, hy + 3, 0.1, 1, t + d, 'rgba(0,0,0,0.8)');
    }
    C.restore();
  };

  PLANS.alado = (a, t, s, R) => {
    const body = a.c1, acc = a.c2;
    const fl = -34 + Math.sin(t * 3) * 6;
    C.save(); C.translate(0, fl);
    const flap = Math.sin(t * 6) * 0.45;
    const span = 50 + s * 10;
    for (const d of [-1, 1]) {
      C.save(); C.scale(d, 1); C.rotate(-flap * (d === 1 ? 1 : 1));
      if (a.face || a.talons && !a.bat) {
        // alas de plumas
        for (let i = 0; i < 6; i++) {
          const ang = -0.9 + i * 0.25;
          poly([[6, -20], [6 + Math.cos(ang) * span * (1 - i * 0.07), -20 + Math.sin(ang) * span * 0.8], [10 + Math.cos(ang + 0.15) * span * 0.6, -10 + Math.sin(ang + 0.15) * span * 0.6]], i % 2 ? shade(acc, -0.4) : shade(acc, -0.25));
        }
      } else {
        poly([[4, -22], [span * 0.5, -22 - span * 0.5], [span, -18 - span * 0.4], [span * 0.8, -6], [span * 0.95, 4], [span * 0.6, 0], [span * 0.55, 14], [span * 0.3, 2], [10, 4]], shade(acc, -0.5));
        for (const [x, y] of [[span, -18 - span * 0.4], [span * 0.95, 4], [span * 0.55, 14]]) line(span * 0.5, -22 - span * 0.5, x, y, shade(acc, -0.15), 2);
        line(4, -22, span * 0.5, -22 - span * 0.5, shade(acc, -0.15), 3);
        horn(span * 0.5, -22 - span * 0.5, 7, -2.2, 0.3, '#d8ccb0');
      }
      C.restore();
    }
    if (a.half) {
      // manananggal: torso partido, entrañas colgando
      const eh = s >= 2 ? 1 : 0.3;
      for (let i = 0; i < 4; i++) tentacle(-6 + i * 4, 6, 14 + eh * 26, 5, Math.PI / 2 + (i - 1.5) * 0.15, t, i, i % 2 ? '#7a1a2a' : '#a02a3a', 10, 0.3);
      poly([[-12, 6], [-14, -30], [14, -30], [12, 6]], shade(acc, -0.1));
      drips(0, 6, 22, 4, t, '#7a0a0a');
    } else {
      ellipse(0, -10, 14 + s, 22 + s * 2, body);
      for (let i = 0; i < 4; i++) curve([[-10, -16 + i * 6], [0, -18 + i * 6], [10, -16 + i * 6]], shade(acc, -0.3), 1.5);
      // patas con garras
      for (const d of [-1, 1]) {
        legJointed(d * 6, 8, d * 10, 20, d * 6 + Math.sin(t * 3) * 2, 30, '#3a3020', 3);
        claws(d * 6 + Math.sin(t * 3) * 2, 30, d, '#d8ccb0', 3, 6);
      }
    }
    // cabeza
    const hy = -42 - s * 2;
    if (a.bat) {
      poly([[-12, hy - 4], [-18, hy - 24 - s * 3], [-4, hy - 10]], body);
      poly([[12, hy - 4], [18, hy - 24 - s * 3], [4, hy - 10]], body);
    }
    if (a.face || a.half || a.tongue) {
      for (let i = 0; i < 9; i++) curve([[-10 + i * 2.5, hy - 12], [-14 + i * 3 + Math.sin(t * 2 + i) * 2, hy + 6], [-16 + i * 4, hy + 22]], a.face ? '#9a9a9a' : '#0a0a0a', 2.5);
    }
    ellipse(0, hy, 12 + s, 13 + s, a.face ? '#b8a898' : a.bat ? '#c8b8b8' : '#a88878');
    eye(-4, hy - 2, 3.2, a.eye, t, R, { round: true }); eye(5, hy - 2, 3.2, a.eye, t, R + 1, { round: true });
    if (s >= 3) eye(0.5, hy - 9, 2.4, a.eye, t, R + 2);
    if (a.face) {
      poly([[-1, hy + 2], [8, hy + 6], [0, hy + 8]], '#3a3020'); // pico/nariz
      line(-6, hy + 9, 6, hy + 9, '#200', 2);
    } else {
      poly([[-6, hy + 6], [7, hy + 6], [5, hy + 11], [-4, hy + 11]], '#3a0006');
      horn(-4, hy + 6, 6 + s, 1.6, 0.1, '#f0ead8'); horn(4, hy + 6, 6 + s, 1.5, -0.1, '#f0ead8');
    }
    if (a.tongue && s >= 2) curve([[1, hy + 10], [10, hy + 24 + Math.sin(t * 4) * 6], [6 + Math.sin(t * 3) * 10, hy + 46 + s * 6]], '#c21d4d', 2.5);
    C.restore();
  };

  PLANS.arana = (a, t, s, R) => {
    const body = a.c1, acc = a.c2;
    const by = -30;
    for (let side = 0; side < 2; side++) {
      for (let i = 0; i < 4; i++) {
        const d = side ? 1 : -1;
        const ph = Math.sin(t * 5 + i * 1.6 + side) * 3;
        const ox = 6 + i * 4;
        const kx = d * (26 + i * 6) + 10, ky = by - 30 - (i % 2) * 6 - s * 3;
        const fx = d * (38 + i * 10) + 12 + ph, fy = 0;
        legJointed(ox * d * 0.3 + 10, by, kx, ky, fx, fy, side ? body : shade(body, -0.3), 4 + s * 0.6);
        if (a.stripes) { line((ox * d * 0.3 + 10 + kx) / 2, (by + ky) / 2 - 2, (ox * d * 0.3 + 10 + kx) / 2 + 2, (by + ky) / 2 + 2, acc, 3); }
      }
    }
    // abdomen
    ellipse(-22, by - 6, 26 + s * 3, 22 + s * 2, body);
    if (a.stripes) for (let i = 0; i < 3; i++) ellipse(-22, by - 6, 18 - i * 5, 4 + i, null, acc);
    // marca de calavera
    ellipse(-24, by - 12, 6, 6, acc); ellipse(-26, by - 13, 1.6, 1.6, body); ellipse(-22, by - 13, 1.6, 1.6, body);
    // cefalotórax
    ellipse(12, by, 16 + s, 13 + s, shade(body, 0.08));
    if (s >= 3) {
      // torso de mujer (jorōgumo)
      poly([[8, by - 6], [6, by - 40], [22, by - 40], [20, by - 6]], '#c8b8a8');
      for (let i = 0; i < 10; i++) curve([[8 + i * 1.6, by - 58], [4 + i * 2 + Math.sin(t * 2 + i) * 2, by - 40], [0 + i * 3, by - 14]], '#0a0a0a', 2.5);
      legJointed(22, by - 36, 34, by - 30, 40 + Math.sin(t * 2) * 4, by - 46, '#c8b8a8', 3.5);
      ellipse(14, by - 50, 9, 11, '#d8c8b8');
      poly([[5, by - 60], [23, by - 60], [20, by - 54], [8, by - 54]], '#0a0a0a');
      eye(11, by - 51, 2.6, a.eye, t, R, { round: true }); eye(18, by - 51, 2.6, a.eye, t, R + 1, { round: true });
      line(11, by - 44, 18, by - 44, '#7a0a1a', 1.8);
    }
    // ojos múltiples
    const ne = 4 + s * 2;
    for (let i = 0; i < ne; i++) {
      const ex = 18 + (i % 4) * 4 - (i >= 4 ? 2 : 0), ey = by - 4 + Math.floor(i / 4) * 5 - (i % 2) * 2;
      eye(ex, ey, i < 2 ? 2.8 : 1.8, a.eye, t, R + i);
    }
    // quelíceros
    const ch = Math.sin(t * 6) * 0.25;
    horn(22, by + 8, 10 + s * 2, 1.3 + ch, 0.5, '#1a1a10');
    horn(28, by + 6, 10 + s * 2, 1.0 - ch, 0.5, '#1a1a10');
    if (s >= 2) drips(26, by + 16, 4, 2, t, '#b6ff3b');
  };

  PLANS.craneo = (a, t, s, R) => {
    const bone = a.c1, acc = a.c2;
    const fl = -18 + Math.sin(t * 1.6) * 5;
    C.save(); C.translate(0, fl);
    const sr = 22 + s * 3;
    const cy = -50 - s * 4;
    if (a.flesh) {
      // cuello larguísimo serpenteante (rokurokubi)
      const nl = s === 1 ? 0 : s === 2 ? 0 : 1;
      if (s >= 2) {
        if (nl) {
          const pts = [];
          for (let i = 0; i <= 18; i++) { const f = i / 18; pts.push([-30 + Math.sin(f * 7 + t * 1.5) * 18 + f * 30, 30 - f * (80 + s * 6) + 10]); }
          curve(pts, '#d8b8a0', 9); curve(pts, '#c8a890', 5);
          poly([[-44, 34], [-40, 0], [-20, 0], [-16, 34]], '#3a1a2a'); // cuerpo con kimono
        } else {
          drips(0, cy + sr, 14, 4, t, '#7a0a0a');
          tentacle(0, cy + sr * 0.8, 24, 8, Math.PI / 2, t, 0, '#a02a3a', 8, 0.5);
        }
      } else {
        poly([[-12, cy + sr], [12, cy + sr], [16, cy + sr + 26], [-16, cy + sr + 26]], '#8a2a3a'); // cuerpo de muñeca
      }
      for (let i = 0; i < 14; i++) curve([[-sr + i * sr / 7, cy - sr * 0.8], [-sr * 1.2 + i * sr / 6 + Math.sin(t * 2 + i) * 3, cy + sr * 0.2], [-sr * 1.3 + i * sr / 5 + Math.sin(t * 1.4 + i) * 5, cy + sr * 1.5 + (i % 3) * 6]], '#0a0a0a', 3);
      ellipse(0, cy, sr * 0.8, sr, bone);
      poly([[-sr * 0.8, cy - sr * 0.9], [sr * 0.8, cy - sr * 0.9], [sr * 0.75, cy - sr * 0.35], [-sr * 0.75, cy - sr * 0.35]], '#0a0a0a');
      eye(-sr * 0.3, cy - sr * 0.05, sr * 0.16, '#f5f0e8', t, R, { round: true });
      eye(sr * 0.3, cy - sr * 0.05, sr * 0.16, '#f5f0e8', t, R + 1, { round: true });
      const sm = 0.25 + Math.sin(t * 2) * 0.1 + s * 0.08;
      C.beginPath(); C.arc(0, cy + sr * 0.35, sr * 0.45, 0.15, Math.PI - 0.15);
      C.strokeStyle = '#5a0010'; C.lineWidth = 2.5; C.stroke();
      ellipse(0, cy + sr * 0.5, sr * 0.3, sr * sm * 0.4, '#1a0006');
      teeth(-sr * 0.25, cy + sr * 0.45, sr * 0.25, cy + sr * 0.45, 5, 3, '#1a1a1a');
      C.restore(); return;
    }
    // columna
    if (a.spine || s >= 2) {
      for (let i = 0; i < 6 + s * 2; i++) {
        const vy = cy + sr + 4 + i * 7, vx = Math.sin(t * 2 + i * 0.6) * (i * 1.5);
        ellipse(vx, vy, 7 - i * 0.4, 3.5, shade(bone, -0.1 - i * 0.04));
        if (i % 2 === 0 && i < 6) curve([[vx, vy], [vx - 16 - s * 3, vy + 4], [vx - 12 - s * 4, vy + 14]], shade(bone, -0.15), 3);
        if (i % 2 === 0 && i < 6) curve([[vx, vy], [vx + 16 + s * 3, vy + 4], [vx + 12 + s * 4, vy + 14]], shade(bone, -0.15), 3);
      }
    }
    // brazos esqueléticos
    if (s >= 2 || a.claws) {
      const reach = Math.sin(t * 1.5) * 8;
      for (const d of [-1, 1]) {
        legJointed(d * sr * 0.9, cy + sr * 0.9, d * (sr + 22 + s * 4), cy + sr * 0.5, d * (sr + 30 + s * 6), cy + sr * 1.6 + reach * d, bone, 4 + s);
        const hx = d * (sr + 30 + s * 6), hy = cy + sr * 1.6 + reach * d;
        for (let i = 0; i < 4; i++) horn(hx, hy, 9 + s * 2, Math.PI / 2 + (i - 1.5) * 0.35, 0.3 * d, bone);
      }
    }
    if (a.stars) {
      C.save(); C.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 6 + s * 3; i++) {
        const ang = t * 0.6 + i * 1.3, r = sr * 1.4 + (i % 3) * 8;
        const px = Math.cos(ang) * r, py = cy + Math.sin(ang) * r * 0.6;
        const tw = 0.5 + Math.sin(t * 5 + i) * 0.5;
        ellipse(px, py, 2 + tw * 1.5, 2 + tw * 1.5, rgba(a.eye, 0.4 + tw * 0.5));
      }
      C.restore();
      // falda de estrellas / tela
      poly([[-sr * 0.8, cy + sr * 0.7], [sr * 0.8, cy + sr * 0.7], [sr * 1.2, cy + sr * 2.2], [-sr * 1.2, cy + sr * 2.2]], rgba(acc, 0.85));
      for (let i = 0; i < 6; i++) ellipse(-sr + i * sr * 0.4, cy + sr * (1.2 + (i % 2) * 0.5), 1.5, 1.5, '#fff');
    }
    // cráneo
    ellipse(0, cy, sr, sr * 0.92, bone);
    ellipse(-sr * 0.2, cy - sr * 0.3, sr * 0.5, sr * 0.3, shade(bone, 0.15));
    for (let i = 0; i < 3; i++) curve([[-sr * 0.6 + i * sr * 0.5, cy - sr * 0.8], [-sr * 0.5 + i * sr * 0.45, cy - sr * 0.5], [-sr * 0.65 + i * sr * 0.5, cy - sr * 0.3]], shade(bone, -0.3), 1.2);
    // pómulos y fosas
    for (const d of [-1, 1]) {
      ellipse(d * sr * 0.38, cy + sr * 0.05, sr * 0.28, sr * 0.3, '#050003');
      C.save(); C.globalCompositeOperation = 'lighter';
      const fv = 0.6 + Math.sin(t * 6 + d) * 0.3;
      flame(d * sr * 0.38, cy + sr * 0.18, sr * 0.3, sr * (0.5 + fv * 0.3), t, a.eye, a.eye, d * 4);
      C.restore();
      eye(d * sr * 0.38, cy + sr * 0.05, sr * 0.09, a.eye, t, R + d, { round: true });
    }
    poly([[0, cy + sr * 0.25], [-sr * 0.1, cy + sr * 0.45], [sr * 0.1, cy + sr * 0.45]], '#050003');
    // mandíbula
    const jaw = a.jaw ? (Math.sin(t * 5) * 0.5 + 0.5) * sr * 0.3 : sr * 0.05;
    poly([[-sr * 0.7, cy + sr * 0.55], [sr * 0.7, cy + sr * 0.55], [sr * 0.6, cy + sr * 0.6], [-sr * 0.6, cy + sr * 0.6]], '#050003');
    teeth(-sr * 0.55, cy + sr * 0.55, sr * 0.55, cy + sr * 0.55, 8, sr * 0.12, bone);
    poly([[-sr * 0.65, cy + sr * 0.62 + jaw], [sr * 0.65, cy + sr * 0.62 + jaw], [sr * 0.45, cy + sr * 0.95 + jaw], [-sr * 0.45, cy + sr * 0.95 + jaw]], shade(bone, -0.1));
    teeth(-sr * 0.5, cy + sr * 0.64 + jaw, sr * 0.5, cy + sr * 0.64 + jaw, 7, sr * 0.1, '#050003', -1);
    if (s >= 3) { // grietas
      curve([[sr * 0.1, cy - sr * 0.9], [sr * 0.25, cy - sr * 0.5], [sr * 0.15, cy - sr * 0.2]], '#3a3020', 1.5);
    }
    C.restore();
  };

  PLANS.masa = (a, t, s, R) => {
    const body = a.c1, acc = a.c2;
    const cy = -40 - s * 4, r = 34 + s * 6;
    C.beginPath();
    const n = 26;
    for (let i = 0; i <= n; i++) {
      const ang = (i / n) * Math.PI * 2;
      const wob = Math.sin(ang * 3 + t * 2) * 5 + Math.sin(ang * 5 - t * 3) * 3;
      const rr = r + wob;
      const x = Math.cos(ang) * rr, y = cy + Math.sin(ang) * rr * 0.85;
      if (i === 0) C.moveTo(x, Math.min(y, 0)); else C.lineTo(x, Math.min(y, 0));
    }
    C.closePath();
    const g = C.createRadialGradient(-r * 0.3, cy - r * 0.3, 4, 0, cy, r * 1.1);
    g.addColorStop(0, shade(acc, -0.1)); g.addColorStop(1, body);
    C.fillStyle = g; C.fill();
    // manos que emergen
    if (s >= 2) for (let i = 0; i < s; i++) {
      const ang = -2.5 + i * 1.8 + Math.sin(t + i) * 0.1;
      const bx = Math.cos(ang) * r * 0.9, byy = cy + Math.sin(ang) * r * 0.75;
      legJointed(bx, byy, bx + Math.cos(ang) * 16, byy + Math.sin(ang) * 10 - 8, bx + Math.cos(ang) * 26, byy + Math.sin(ang) * 18 + Math.sin(t * 3 + i) * 4, shade(acc, -0.1), 4);
      for (let k = 0; k < 4; k++) horn(bx + Math.cos(ang) * 26, byy + Math.sin(ang) * 18 + Math.sin(t * 3 + i) * 4, 6, ang - 0.6 + k * 0.4, 0.2, shade(acc, 0.2));
    }
    const rnd = seeded('masa' + s);
    const ne = 3 + s * 3;
    for (let i = 0; i < ne; i++) {
      const ang = rnd() * Math.PI * 2, rr = rnd() * r * 0.7;
      eye(Math.cos(ang) * rr, cy + Math.sin(ang) * rr * 0.75 - 4, 3 + rnd() * (s === 1 ? 6 : 5), a.eye, t, R + i);
    }
    // bocas
    const nm = s;
    for (let i = 0; i < nm; i++) {
      const mx = -r * 0.35 + i * r * 0.4, my = cy + r * 0.35 - (i % 2) * 10;
      const o = 3 + (Math.sin(t * 3 + i * 2) * 0.5 + 0.5) * 6;
      ellipse(mx, my, 10, o, '#1a0006');
      teeth(mx - 9, my - o * 0.6, mx + 9, my - o * 0.6, 5, 4);
      teeth(mx - 8, my + o * 0.6, mx + 8, my + o * 0.6, 4, 4, '#efe6cf', -1);
    }
    drips(0, -2, r * 1.2, 5, t, rgba(acc, 0.8));
  };

  // ---------- render principal ----------
  const STAGE_SCALE = [0.62, 0.82, 1.0];
  const buffers = {};
  function getBuf(key, w, h) {
    let b = buffers[key];
    if (!b || b.width !== w || b.height !== h) {
      b = document.createElement('canvas'); b.width = w; b.height = h; buffers[key] = b;
    }
    return b;
  }

  /**
   * Dibuja una criatura.
   * @param ctx contexto destino
   * @param sp especie
   * @param x,y punto en el suelo (centro de los pies)
   * @param size altura de referencia en px (para etapa 3)
   * @param t tiempo en segundos
   * @param o { flip, flash, alpha, silhouette, buf, squash, rot, shadow }
   */
  function draw(ctx, sp, x, y, size, t, o = {}) {
    const k = (size / 100) * STAGE_SCALE[sp.stage - 1] * (o.scale || 1);
    const W = Math.ceil(size * 1.9), H = Math.ceil(size * 1.6);
    const buf = getBuf(o.buf || 'main', W, H);
    const b = buf.getContext('2d');
    b.setTransform(1, 0, 0, 1, 0, 0);
    b.clearRect(0, 0, W, H);
    b.save();
    b.translate(W / 2, H * 0.92);
    const breath = 1 + Math.sin(t * 2.2) * 0.015;
    b.scale(k * (o.flip ? -1 : 1) * (o.squash ? 1 + o.squash : 1), k * breath * (o.squash ? 1 - o.squash : 1));
    const img = getImage(sp.id);
    C = b;
    if (img) {
      const ih = 92, iw = Math.min(ih * img.width / img.height, 120), ihh = iw * img.height / img.width;
      b.drawImage(img, -iw / 2, -ihh, iw, ihh);
    } else {
      const R = seeded(sp.id)() * 10;
      // aura para etapa 3
      if (sp.stage === 3 && !o.silhouette) {
        b.save(); b.globalCompositeOperation = 'lighter';
        const gg = b.createRadialGradient(0, -50, 5, 0, -50, 75);
        gg.addColorStop(0, rgba(TYPES[sp.types[0]].glow, 0.18 + Math.sin(t * 2) * 0.05));
        gg.addColorStop(1, 'rgba(0,0,0,0)');
        b.fillStyle = gg; b.fillRect(-90, -130, 180, 140);
        b.restore();
      }
      b.lineJoin = 'round'; b.lineCap = 'round';
      try { (PLANS[sp.plan] || PLANS.masa)(sp.art, t, sp.stage, R); } catch (e) { console.error(sp.id, e); }
    }
    b.restore();
    // Iluminación tipo anime: luz de borde (arriba-izq) y sombra (abajo-der)
    if (!img && !o.silhouette) {
      const lb = getBuf((o.buf || 'main') + '_lt', W, H);
      const lc = lb.getContext('2d');
      const off = Math.max(2, size / 45);
      for (const [dx, dy, col, a] of [[off, off, '#fff4e0', 0.30], [-off * 1.4, -off * 1.4, '#000000', 0.38]]) {
        lc.setTransform(1, 0, 0, 1, 0, 0); lc.globalCompositeOperation = 'source-over';
        lc.clearRect(0, 0, W, H);
        lc.drawImage(buf, 0, 0);
        lc.globalCompositeOperation = 'destination-out';
        lc.drawImage(buf, dx, dy);
        lc.globalCompositeOperation = 'source-in';
        lc.fillStyle = col; lc.fillRect(0, 0, W, H);
        b.save(); b.globalAlpha = a; b.globalCompositeOperation = 'source-atop'; b.drawImage(lb, 0, 0); b.restore();
      }
      // degradado ambiental vertical
      b.save(); b.globalCompositeOperation = 'source-atop';
      const vg = b.createLinearGradient(0, H * 0.2, 0, H * 0.95);
      vg.addColorStop(0, 'rgba(255,240,220,0.06)'); vg.addColorStop(1, 'rgba(0,0,0,0.28)');
      b.fillStyle = vg; b.fillRect(0, 0, W, H); b.restore();
    }
    // Contorno de tinta estilo cómic
    if (!o.noOutline && !img) {
      const ob = getBuf((o.buf || 'main') + '_ol', W, H);
      const oc = ob.getContext('2d');
      oc.setTransform(1, 0, 0, 1, 0, 0);
      oc.clearRect(0, 0, W, H);
      const th = Math.max(2, size / 55);
      for (let i = 0; i < 8; i++) {
        const ang = i / 8 * Math.PI * 2;
        oc.drawImage(buf, Math.cos(ang) * th, Math.sin(ang) * th);
      }
      oc.globalCompositeOperation = 'source-in';
      oc.fillStyle = '#07040a'; oc.fillRect(0, 0, W, H);
      oc.globalCompositeOperation = 'source-over';
      oc.drawImage(buf, 0, 0);
      b.clearRect(0, 0, W, H);
      b.drawImage(ob, 0, 0);
    }
    if (o.silhouette || o.flash) {
      b.save();
      b.globalCompositeOperation = 'source-atop';
      b.fillStyle = o.silhouette ? (typeof o.silhouette === 'string' ? o.silhouette : '#000') : `rgba(255,255,255,${o.flash})`;
      b.fillRect(0, 0, W, H);
      b.restore();
    }
    ctx.save();
    if (o.shadow !== false) {
      ctx.fillStyle = 'rgba(0,0,0,0.45)';
      ctx.beginPath(); ctx.ellipse(x, y, size * 0.45 * STAGE_SCALE[sp.stage - 1], size * 0.08, 0, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = o.alpha === undefined ? 1 : o.alpha;
    if (o.rot) { ctx.translate(x, y); ctx.rotate(o.rot); ctx.translate(-x, -y); }
    ctx.drawImage(buf, x - W / 2, y - H * 0.92);
    ctx.restore();
  }

  // Miniatura estática (para menús): devuelve un canvas
  const thumbCache = {};
  function thumb(sp, size = 96, silhouette = false) {
    const key = sp.id + size + silhouette;
    if (thumbCache[key] && !getImage(sp.id)) return thumbCache[key];
    const c = document.createElement('canvas');
    c.width = size; c.height = size;
    const cx = c.getContext('2d');
    const sc = 1 / STAGE_SCALE[sp.stage - 1] * 0.75;
    draw(cx, sp, size / 2, size * 0.88, size * 0.95 * Math.min(sc, 1.25), 1.3, { silhouette, buf: 'thumb', shadow: false });
    thumbCache[key] = c;
    return c;
  }

  return { draw, thumb, shade, rgba, seeded };
})();
