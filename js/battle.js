// =====================================================================
//  UMBRAL — Batalla animada por turnos con reflejos (QTE).
// =====================================================================
'use strict';

const wait = ms => new Promise(r => setTimeout(r, ms));
function anim(ms, fn) {
  return new Promise(res => {
    const s = performance.now();
    function f(now) {
      const p = Math.min(1, (now - s) / ms);
      fn(p);
      if (p < 1) requestAnimationFrame(f); else res();
    }
    requestAnimationFrame(f);
  });
}
const ease = {
  out: p => 1 - Math.pow(1 - p, 3),
  in: p => p * p * p,
  inOut: p => p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2,
  back: p => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(p - 1, 3) + c1 * Math.pow(p - 1, 2); },
};
const lerp = (a, b, p) => a + (b - a) * p;

const STAGE_MULT = s => s >= 0 ? (2 + s) / 2 : 2 / (2 - s);

class Battle {
  /**
   * opts: { wild: creature } | { trainer: { name, team:[creature], reward, lines:{intro, lose} } }, bg
   */
  constructor(game, opts) {
    this.game = game;
    this.opts = opts;
    this.wild = !!opts.wild;
    this.enemyTeam = this.wild ? [opts.wild] : opts.trainer.team;
    this.ei = 0;
    this.pi = game.party.findIndex(c => c.hp > 0);
    this.bg = opts.bg || ZONE_BG.bosque;
    this.t = 0;
    this.particles = [];
    this.texts = [];
    this.beams = [];
    this.rings = [];
    this.shakeAmt = 0;
    this.flashScreen = 0; this.flashColor = '#fff';
    this.tint = null;
    this.qte = null;
    this.sigil = null;
    this.intro = 1; // cortina de entrada
    this.P = this.mkVis(250, 418, 280);
    this.E = this.mkVis(705, 246, 230);
    this.P.alpha = 0; this.E.offX = 500;
    this.stagesP = { atk: 0, def: 0 }; this.stagesE = { atk: 0, def: 0 };
    this.participants = new Set();
    this.hud = { p: null, e: null };
    this.result = null;
    this.turn = 0;
  }
  mkVis(x, y, size) { return { x, y, size, offX: 0, offY: 0, flash: 0, alpha: 1, squash: 0, rot: 0, scale: 1, sil: false, shake: 0 }; }

  get me() { return this.game.party[this.pi]; }
  get foe() { return this.enemyTeam[this.ei]; }

  // ------------------------------------------------------------------
  //  RENDER
  // ------------------------------------------------------------------
  update(dt) {
    this.t += dt;
    for (const p of this.particles) {
      p.life -= dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vy += (p.g || 0) * dt;
      p.vx *= p.drag || 1; p.vy *= p.drag || 1;
    }
    this.particles = this.particles.filter(p => p.life > 0);
    for (const tx of this.texts) { tx.life -= dt; tx.y += tx.vy * dt; tx.vy *= 0.94; }
    this.texts = this.texts.filter(t => t.life > 0);
    for (const r of this.rings) r.life -= dt;
    this.rings = this.rings.filter(r => r.life > 0);
    this.shakeAmt *= Math.pow(0.0015, dt);
    this.flashScreen = Math.max(0, this.flashScreen - dt * 3);
    for (const V of [this.P, this.E]) V.flash = Math.max(0, V.flash - dt * 4);
    // HP animado
    for (const side of ['p', 'e']) {
      const c = side === 'p' ? this.me : this.foe;
      if (!c) continue;
      const h = this.hud[side];
      if (!h || h.uid !== c.uid) this.hud[side] = { uid: c.uid, hp: c.hp, exp: c.exp };
      else {
        const d = c.hp - h.hp;
        h.hp += Math.sign(d) * Math.min(Math.abs(d), Math.max(1, c.stats.hp * dt * 0.9));
        h.exp += (c.exp - h.exp) * Math.min(1, dt * 5);
      }
    }
  }

  render(ctx, W, H) {
    const t = this.t;
    ctx.save();
    const sx = (Math.random() - 0.5) * this.shakeAmt, sy = (Math.random() - 0.5) * this.shakeAmt;
    ctx.translate(sx, sy);
    this.drawBg(ctx, W, H);
    // plataformas
    this.platform(ctx, this.E.x, this.E.y + 4, 170, 34);
    this.platform(ctx, this.P.x, this.P.y + 4, 210, 40);
    // tinte de aura
    if (this.tint) { ctx.fillStyle = this.tint; ctx.fillRect(-20, -20, W + 40, H + 40); }
    // rayos detrás
    for (const b of this.beams) this.drawBeam(ctx, b);
    // criaturas
    if (this.foe) this.drawMon(ctx, this.foe, this.E, true);
    if (this.me) this.drawMon(ctx, this.me, this.P, false);
    // sello de captura
    if (this.sigil) this.drawSigil(ctx, this.sigil);
    // partículas
    ctx.save();
    for (const p of this.particles) {
      const a = Math.max(0, Math.min(1, p.life / p.max));
      ctx.globalAlpha = a;
      if (p.add) ctx.globalCompositeOperation = 'lighter'; else ctx.globalCompositeOperation = 'source-over';
      if (p.kind === 'slash') {
        ctx.strokeStyle = p.color; ctx.lineWidth = p.r * a; ctx.lineCap = 'round';
        ctx.shadowColor = p.color; ctx.shadowBlur = 15;
        ctx.beginPath(); ctx.moveTo(p.x - p.dx * (1 - a * 0.3), p.y - p.dy * (1 - a * 0.3)); ctx.lineTo(p.x + p.dx, p.y + p.dy); ctx.stroke();
        ctx.shadowBlur = 0;
      } else if (p.kind === 'shard') {
        ctx.fillStyle = p.color;
        ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.life * 10);
        ctx.fillRect(-p.r / 2, -p.r / 4, p.r, p.r / 2); ctx.restore();
      } else {
        ctx.fillStyle = p.color;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r * (p.shrink ? a : 1), 0, Math.PI * 2); ctx.fill();
      }
    }
    ctx.restore();
    // anillos
    for (const r of this.rings) {
      const p = 1 - r.life / r.max;
      ctx.save(); ctx.globalAlpha = r.life / r.max;
      ctx.strokeStyle = r.color; ctx.lineWidth = r.w * (1 - p) + 1; ctx.shadowColor = r.color; ctx.shadowBlur = 12;
      ctx.beginPath(); ctx.ellipse(r.x, r.y, r.r0 + (r.r1 - r.r0) * p, (r.r0 + (r.r1 - r.r0) * p) * (r.flat || 1), 0, 0, Math.PI * 2); ctx.stroke();
      ctx.restore();
    }
    // QTE
    if (this.qte) this.drawQte(ctx);
    ctx.restore();
    // textos flotantes
    for (const tx of this.texts) {
      ctx.save();
      ctx.globalAlpha = Math.min(1, tx.life * 2);
      const sc = tx.pop ? 1 + Math.max(0, (tx.life - tx.max + 0.15) / 0.15) * 0.6 : 1;
      ctx.font = `bold ${Math.round(tx.size * sc)}px "Trebuchet MS", sans-serif`;
      ctx.textAlign = 'center';
      ctx.lineWidth = 6; ctx.strokeStyle = '#000'; ctx.strokeText(tx.text, tx.x, tx.y);
      ctx.fillStyle = tx.color; ctx.fillText(tx.text, tx.x, tx.y);
      ctx.restore();
    }
    // HUD
    if (this.foe) this.drawHud(ctx, this.foe, 'e', 28, 26, false);
    if (this.me && this.P.alpha > 0.1) this.drawHud(ctx, this.me, 'p', W - 378, 296, true);
    // destello de pantalla
    if (this.flashScreen > 0) { ctx.fillStyle = this.flashColor; ctx.globalAlpha = Math.min(1, this.flashScreen); ctx.fillRect(0, 0, W, H); ctx.globalAlpha = 1; }
    // cortina de introducción
    if (this.intro > 0) {
      const h = (H / 2) * this.intro;
      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, W, h); ctx.fillRect(0, H - h, W, h);
      ctx.strokeStyle = '#a01010'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(0, h); ctx.lineTo(W, h); ctx.moveTo(0, H - h); ctx.lineTo(W, H - h); ctx.stroke();
    }
  }

  drawBg(ctx, W, H) {
    const b = this.bg, t = this.t;
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, b.sky1); g.addColorStop(0.55, b.sky2); g.addColorStop(0.56, b.ground1); g.addColorStop(1, b.ground2);
    ctx.fillStyle = g; ctx.fillRect(-20, -20, W + 40, H + 40);
    // luna
    ctx.save();
    ctx.shadowColor = b.moon; ctx.shadowBlur = 60;
    ctx.fillStyle = b.moon; ctx.beginPath(); ctx.arc(W * 0.82, 80, 46, 0, Math.PI * 2); ctx.fill();
    ctx.shadowBlur = 0; ctx.fillStyle = 'rgba(0,0,0,0.12)';
    for (const [cx, cy, cr] of [[-14, -10, 10], [12, 8, 7], [-4, 18, 6], [16, -16, 5]]) { ctx.beginPath(); ctx.arc(W * 0.82 + cx, 80 + cy, cr, 0, Math.PI * 2); ctx.fill(); }
    ctx.restore();
    // siluetas lejanas
    ctx.fillStyle = b.far;
    const hz = H * 0.55;
    ctx.beginPath(); ctx.moveTo(0, hz);
    for (let x = 0; x <= W; x += 24) {
      const k = Math.sin(x * 0.013) * 18 + Math.sin(x * 0.041) * 10;
      ctx.lineTo(x, hz - 30 - k - (b.spiky ? (x % 48 === 0 ? 40 : 0) : 0));
    }
    ctx.lineTo(W, hz); ctx.closePath(); ctx.fill();
    // árboles muertos / lápidas
    ctx.strokeStyle = b.far; ctx.fillStyle = b.far;
    for (let i = 0; i < 7; i++) {
      const x = (i * 157 + 40) % W, base = hz + 2;
      if (b.props === 'tombs') { ctx.fillRect(x, base - 26, 16, 26); ctx.beginPath(); ctx.arc(x + 8, base - 26, 8, Math.PI, 0); ctx.fill(); }
      else if (b.props === 'trees') {
        ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(x, base); ctx.lineTo(x + 4, base - 80);
        ctx.moveTo(x + 2, base - 50); ctx.lineTo(x - 20, base - 70); ctx.moveTo(x + 3, base - 65); ctx.lineTo(x + 24, base - 92); ctx.stroke();
      } else if (b.props === 'pillars') { ctx.fillRect(x, base - 120, 22, 120); ctx.fillRect(x - 6, base - 126, 34, 10); }
    }
    // niebla
    for (let i = 0; i < 4; i++) {
      const fx = ((t * (12 + i * 6) + i * 260) % (W + 400)) - 200;
      const fg = ctx.createRadialGradient(fx, hz + 30 + i * 40, 10, fx, hz + 30 + i * 40, 220);
      fg.addColorStop(0, b.fog); fg.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = fg; ctx.fillRect(fx - 240, hz - 120 + i * 40, 480, 300);
    }
    // ascuas/esporas ambientales
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 26; i++) {
      const x = (i * 97 + t * (8 + i % 5) * 3) % W;
      const y = H - ((t * (14 + (i % 7) * 4) + i * 53) % H);
      ctx.fillStyle = b.mote; ctx.globalAlpha = 0.3 + 0.3 * Math.sin(t * 3 + i);
      ctx.fillRect(x, y, 2, 2);
    }
    ctx.restore();
  }

  platform(ctx, x, y, rx, ry) {
    ctx.save();
    const g = ctx.createRadialGradient(x, y, 5, x, y, rx);
    g.addColorStop(0, this.bg.plat); g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = 'rgba(160,20,20,0.35)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.ellipse(x, y, rx * 0.8, ry * 0.8, 0, 0, Math.PI * 2); ctx.stroke();
    // runas
    ctx.fillStyle = 'rgba(200,40,40,0.4)'; ctx.font = '12px serif';
    for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2 + this.t * 0.2; ctx.fillText('ᚱᛟᚦᚨᛉᛗᚾᛞ'[i], x + Math.cos(a) * rx * 0.8 - 4, y + Math.sin(a) * ry * 0.8 + 4); }
    ctx.restore();
  }

  drawMon(ctx, c, V, isEnemy) {
    if (V.alpha <= 0) return;
    const sp = species(c);
    const sh = V.shake ? Math.sin(this.t * 80) * V.shake : 0;
    Art.draw(ctx, sp, V.x + V.offX + sh, V.y + V.offY, V.size * V.scale, this.t + (isEnemy ? 3.7 : 0), {
      flip: isEnemy, flash: V.flash > 0 ? Math.min(1, V.flash) : 0, alpha: V.alpha,
      silhouette: V.sil, squash: V.squash, rot: V.rot, buf: isEnemy ? 'bE' : 'bP', shadow: V.offY > -5,
    });
    // indicador de estado alterado: burbujas
    if (c.status && V.alpha > 0.5) {
      const col = STATUS_COLOR[c.status];
      for (let i = 0; i < 3; i++) {
        const ph = (this.t * 0.8 + i / 3) % 1;
        ctx.globalAlpha = (1 - ph) * 0.8;
        ctx.fillStyle = col;
        ctx.beginPath(); ctx.arc(V.x + V.offX - 30 + i * 30, V.y - V.size * 0.5 - ph * 50, 4, 0, Math.PI * 2); ctx.fill();
      }
      ctx.globalAlpha = 1;
    }
  }

  drawHud(ctx, c, side, x, y, isPlayer) {
    const sp = species(c), w = 350, h = isPlayer ? 92 : 76;
    ctx.save();
    ctx.fillStyle = 'rgba(14,8,14,0.88)';
    ctx.strokeStyle = '#6a1a1a'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(x + 14, y); ctx.lineTo(x + w, y); ctx.lineTo(x + w - 14, y + h); ctx.lineTo(x, y + h); ctx.closePath();
    ctx.fill(); ctx.stroke();
    ctx.font = 'bold 21px "Trebuchet MS", sans-serif'; ctx.fillStyle = '#eee'; ctx.textAlign = 'left';
    ctx.fillText(cname(c), x + 20, y + 27);
    ctx.font = 'bold 17px "Trebuchet MS", sans-serif'; ctx.fillStyle = '#d8b'; ctx.textAlign = 'right';
    ctx.fillText('Nv ' + c.level, x + w - 24, y + 26);
    // tipos
    let tx = x + 20;
    ctx.textAlign = 'left'; ctx.font = 'bold 11px sans-serif';
    for (const ty of sp.types) {
      const tw = ctx.measureText(TYPES[ty].name).width + 12;
      ctx.fillStyle = TYPES[ty].color; ctx.fillRect(tx, y + 34, tw, 15);
      ctx.fillStyle = '#fff'; ctx.fillText(TYPES[ty].name, tx + 6, y + 45); tx += tw + 5;
    }
    if (c.status) {
      ctx.fillStyle = STATUS_COLOR[c.status]; ctx.fillRect(tx + 4, y + 34, 38, 15);
      ctx.fillStyle = '#fff'; ctx.fillText(STATUS_NAMES[c.status], tx + 10, y + 45);
    }
    if (!this.wild && side === 'e') {
      for (let i = 0; i < this.enemyTeam.length; i++) {
        ctx.fillStyle = this.enemyTeam[i].hp > 0 ? '#c33' : '#333';
        ctx.beginPath(); ctx.arc(x + w - 30 - i * 14, y + 42, 5, 0, Math.PI * 2); ctx.fill();
      }
    }
    if (side === 'e' && this.game.dex.caught.has(sp.id)) {
      ctx.fillStyle = '#c9a227'; ctx.font = '14px serif'; ctx.fillText('⛧', x + w - 52, y + 46);
    }
    // barra PV
    const hh = this.hud[side] ? this.hud[side].hp : c.hp;
    const f = Math.max(0, hh / c.stats.hp);
    const bx = x + 60, by = y + 56, bw = w - 100;
    ctx.fillStyle = '#eee'; ctx.font = 'bold 13px sans-serif'; ctx.fillText('PV', x + 26, by + 11);
    ctx.fillStyle = '#220'; ctx.fillRect(bx, by, bw, 12);
    ctx.fillStyle = UI.hpColor(f); ctx.fillRect(bx, by, bw * f, 12);
    ctx.fillStyle = 'rgba(255,255,255,0.25)'; ctx.fillRect(bx, by, bw * f, 4);
    if (isPlayer) {
      ctx.textAlign = 'right'; ctx.fillStyle = '#ccc'; ctx.font = '14px sans-serif';
      ctx.fillText(`${Math.ceil(hh)}/${c.stats.hp}`, x + w - 40, by + 28);
      const e0 = expForLevel(c.level), e1 = expForLevel(c.level + 1);
      const ef = Math.max(0, Math.min(1, ((this.hud[side] ? this.hud[side].exp : c.exp) - e0) / (e1 - e0)));
      ctx.fillStyle = '#123'; ctx.fillRect(bx, by + 18 + 14, bw - 70, 5);
      ctx.fillStyle = '#4ab0ff'; ctx.fillRect(bx, by + 18 + 14, (bw - 70) * ef, 5);
    }
    ctx.restore();
  }

  drawBeam(ctx, b) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const w = b.w * (0.8 + Math.sin(this.t * 40) * 0.2) * b.k;
    const ang = Math.atan2(b.y2 - b.y1, b.x2 - b.x1), len = Math.hypot(b.x2 - b.x1, b.y2 - b.y1) * b.len;
    ctx.translate(b.x1, b.y1); ctx.rotate(ang);
    for (let i = 0; i < 3; i++) {
      ctx.strokeStyle = i === 2 ? 'rgba(255,255,255,0.9)' : Art.rgba(b.color, 0.5 - i * 0.1);
      ctx.lineWidth = w * (1 - i * 0.35);
      ctx.shadowColor = b.color; ctx.shadowBlur = 25;
      ctx.beginPath(); ctx.moveTo(0, 0);
      for (let x = 0; x <= len; x += 20) ctx.lineTo(x, Math.sin(x * 0.05 + this.t * 30) * w * 0.15 * (i === 0 ? 1 : 0.3));
      ctx.stroke();
    }
    ctx.restore();
  }

  drawSigil(ctx, s) {
    ctx.save();
    ctx.translate(s.x, s.y); ctx.rotate(s.rot);
    ctx.scale(s.scale, s.scale * (s.flat || 1));
    ctx.shadowColor = s.color; ctx.shadowBlur = 20;
    ctx.fillStyle = '#1a0a0a'; ctx.beginPath(); ctx.arc(0, 0, 22, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = s.color; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(0, 0, 20, 0, Math.PI * 2); ctx.stroke();
    ctx.beginPath();
    for (let i = 0; i <= 5; i++) { const a = -Math.PI / 2 + i * (Math.PI * 4 / 5); ctx.lineTo(Math.cos(a) * 17, Math.sin(a) * 17); }
    ctx.stroke();
    ctx.restore();
  }

  drawQte(ctx) {
    const q = this.qte;
    const p = Math.min(1, (performance.now() - q.start) / q.dur);
    const r = lerp(q.r0, 0, p);
    ctx.save();
    ctx.lineWidth = 4;
    // objetivo
    ctx.strokeStyle = 'rgba(255,255,255,0.55)';
    ctx.setLineDash([6, 6]);
    ctx.beginPath(); ctx.arc(q.x, q.y, q.target, 0, Math.PI * 2); ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = 'rgba(255,240,180,0.12)';
    ctx.beginPath(); ctx.arc(q.x, q.y, q.target + q.good, 0, Math.PI * 2); ctx.arc(q.x, q.y, Math.max(1, q.target - q.good), 0, Math.PI * 2, true); ctx.fill();
    // anillo que se cierra
    ctx.strokeStyle = q.color; ctx.shadowColor = q.color; ctx.shadowBlur = 15; ctx.lineWidth = 5;
    ctx.beginPath(); ctx.arc(q.x, q.y, Math.max(1, r), 0, Math.PI * 2); ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.font = 'bold 22px "Trebuchet MS", sans-serif'; ctx.textAlign = 'center';
    ctx.lineWidth = 5; ctx.strokeStyle = '#000'; ctx.strokeText(q.label, q.x, q.y - q.r0 * 0.5 - 20);
    ctx.fillStyle = '#fff'; ctx.fillText(q.label, q.x, q.y - q.r0 * 0.5 - 20);
    ctx.restore();
  }

  // ------------------------------------------------------------------
  //  EFECTOS
  // ------------------------------------------------------------------
  burst(x, y, color, n = 20, speed = 260, opts = {}) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, s = speed * (0.3 + Math.random() * 0.7);
      const life = (opts.life || 0.6) * (0.5 + Math.random() * 0.5);
      this.particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - (opts.up || 0), g: opts.g ?? 300, r: (opts.r || 4) * (0.5 + Math.random()), color, life, max: life, add: opts.add !== false, drag: 0.96, shrink: true, kind: opts.kind });
    }
  }
  floatText(text, x, y, color = '#fff', size = 30, pop = true) {
    this.texts.push({ text, x, y, color, size, vy: -90, life: 1.2, max: 1.2, pop });
  }
  ring(x, y, color, r0, r1, life = 0.5, w = 10, flat = 1) { this.rings.push({ x, y, color, r0, r1, life, max: life, w, flat }); }
  shake(n) { this.shakeAmt = Math.max(this.shakeAmt, n); }
  centerOf(V) { return [V.x + V.offX, V.y - V.size * 0.33]; }

  // Reflejos: devuelve multiplicador
  runQte(V, mode) {
    if (!this.game.settings.qte) return Promise.resolve(1);
    return new Promise(resolve => {
      const [x, y] = this.centerOf(V);
      const q = {
        x, y, r0: 150, target: 38, good: 16, dur: mode === 'atk' ? 900 : 750,
        start: performance.now(), color: mode === 'atk' ? '#ffcf3b' : '#3bd0ff',
        label: mode === 'atk' ? '¡GOLPEA!' : '¡BLOQUEA!',
      };
      this.qte = q;
      let done = false;
      const finish = (mult, label, color) => {
        if (done) return; done = true;
        off(); cv.removeEventListener('pointerdown', tap);
        clearTimeout(to);
        this.qte = null;
        if (label) { this.floatText(label, x, y - 70, color, 26); }
        resolve(mult);
      };
      const judge = () => {
        const p = (performance.now() - q.start) / q.dur;
        const r = lerp(q.r0, 0, Math.min(1, p));
        const d = Math.abs(r - q.target);
        if (d <= q.good * 0.5) { Sfx.play('perfect'); return mode === 'atk' ? finish(1.35, '¡PERFECTO!', '#ffd84a') : finish(0.5, '¡BLOQUEO PERFECTO!', '#7fe0ff'); }
        if (d <= q.good) { Sfx.play('select'); return mode === 'atk' ? finish(1.15, '¡Bien!', '#fff') : finish(0.75, '¡Bloqueo!', '#cfefff'); }
        finish(1, 'Fallo', '#999');
      };
      const off = Input.on(a => { if (a === 'ok') judge(); });
      const cv = document.getElementById('game');
      const tap = e => { e.preventDefault(); judge(); };
      cv.addEventListener('pointerdown', tap);
      const to = setTimeout(() => finish(1, null), q.dur + 60);
    });
  }

  // ------------------------------------------------------------------
  //  ANIMACIONES DE ATAQUE
  // ------------------------------------------------------------------
  async animateMove(move, A, D, isPlayer, onImpact) {
    const col = TYPES[move.type].glow, base = TYPES[move.type].color;
    const dir = isPlayer ? 1 : -1;
    const [ax, ay] = this.centerOf(A);
    const [dx, dy] = this.centerOf(D);
    let qtePromise = null;
    const startQte = () => { qtePromise = this.runQte(isPlayer ? D : A, isPlayer ? 'atk' : 'def'); };
    const getMult = async () => (qtePromise ? await qtePromise : 1);

    if (move.anim === 'buff') {
      const self = !!(move.eff && move.eff.self);
      const T = self ? A : D;
      const [tx, ty] = this.centerOf(T);
      Sfx.play(self ? 'buff' : 'debuff');
      await anim(500, p => { T.squash = Math.sin(p * Math.PI * 3) * 0.06; });
      for (let i = 0; i < 24; i++) {
        this.particles.push({ x: tx + (Math.random() - 0.5) * 120, y: ty + (self ? 60 : -80), vx: 0, vy: self ? -160 - Math.random() * 100 : 160 + Math.random() * 100, g: 0, r: 4, color: self ? col : '#5a3a7a', life: 0.8, max: 0.8, add: true, shrink: true });
      }
      this.ring(tx, ty + 50, self ? col : '#7a3aa0', 20, 120, 0.6, 6, 0.3);
      await wait(600);
      T.squash = 0;
      return 1;
    }

    if (move.anim === 'embestida') {
      Sfx.play('roar');
      await anim(220, p => { A.offX = -dir * 30 * ease.out(p); A.squash = 0.08 * p; });
      startQte();
      const tx = (D.x - A.x) * 0.78;
      const ty = (D.y - A.y) * 0.6;
      await anim(260, p => { const e = ease.in(p); A.offX = lerp(-dir * 30, tx, e); A.offY = ty * e - Math.sin(p * Math.PI) * 50; A.squash = -0.1; });
      const m = await getMult();
      onImpact(m);
      this.burst(dx, dy, col, 26, 380);
      this.burst(dx, dy, '#fff', 8, 200, { r: 3 });
      await anim(350, p => { const e = ease.out(p); A.offX = lerp(tx, 0, e); A.offY = lerp(ty, 0, e); A.squash = 0; });
      return m;
    }

    if (move.anim === 'zarpazo') {
      Sfx.play('roar');
      await anim(260, p => { A.offX = dir * 60 * ease.back(p); A.rot = dir * 0.12 * p; });
      startQte();
      await wait(560);
      const m = await getMult();
      Sfx.play('claw');
      for (let k = 0; k < 3; k++) {
        const ox = (k - 1) * 26;
        this.particles.push({ kind: 'slash', x: dx + ox, y: dy, dx: 50 * dir, dy: -70, color: col, r: 9, life: 0.35, max: 0.35, vx: 0, vy: 0, add: true });
        this.particles.push({ kind: 'slash', x: dx + ox, y: dy, dx: 40 * dir, dy: -60, color: '#fff', r: 3, life: 0.3, max: 0.3, vx: 0, vy: 0, add: true });
        await wait(70);
      }
      onImpact(m);
      this.burst(dx, dy, base, 18, 300, { add: false, g: 600, r: 5 });
      await anim(300, p => { A.offX = lerp(dir * 60, 0, ease.out(p)); A.rot = lerp(dir * 0.12, 0, p); });
      return m;
    }

    if (move.anim === 'proyectil') {
      const n = move.multi || 1;
      startQte();
      let m = 1;
      const travel = 560;
      for (let k = 0; k < n; k++) {
        Sfx.play('shoot');
        A.squash = 0.12; setTimeout(() => A.squash = 0, 120);
        const sx = ax + dir * 40, sy = ay - 10;
        const orb = { x: sx, y: sy };
        const delay = k * 120;
        (async () => {
          await wait(delay);
          await anim(travel, p => {
            orb.x = lerp(sx, dx, p); orb.y = lerp(sy, dy, p) - Math.sin(p * Math.PI) * 80;
            this.particles.push({ x: orb.x, y: orb.y, vx: (Math.random() - 0.5) * 40, vy: (Math.random() - 0.5) * 40, g: 0, r: 9, color: col, life: 0.25, max: 0.25, add: true, shrink: true });
            this.particles.push({ x: orb.x, y: orb.y, vx: 0, vy: 0, g: 0, r: 5, color: '#fff', life: 0.06, max: 0.06, add: true });
          });
        })();
      }
      await wait(travel + (n - 1) * 120 + 20);
      m = await getMult();
      onImpact(m);
      this.burst(dx, dy, col, 30, 340);
      this.ring(dx, dy, col, 10, 90, 0.4, 8);
      await wait(250);
      return m;
    }

    if (move.anim === 'rayo') {
      // carga
      Sfx.play('aura');
      await anim(560, p => {
        for (let i = 0; i < 2; i++) {
          const a = Math.random() * Math.PI * 2, r = 110;
          this.particles.push({ x: ax + Math.cos(a) * r, y: ay + Math.sin(a) * r, vx: -Math.cos(a) * r * 2.6, vy: -Math.sin(a) * r * 2.6, g: 0, r: 4, color: col, life: 0.38, max: 0.38, add: true });
        }
        A.shake = 3 * p;
      });
      A.shake = 0;
      startQte();
      const beam = { x1: ax + dir * 40, y1: ay - 10, x2: dx, y2: dy, w: 34, color: col, len: 0, k: 1 };
      this.beams.push(beam);
      Sfx.play('beam');
      await anim(260, p => { beam.len = ease.out(p); });
      await wait(Math.max(0, (this.game.settings.qte ? 900 : 200) - 260));
      const m = await getMult();
      onImpact(m);
      this.burst(dx, dy, col, 34, 360);
      this.shake(18);
      await anim(300, p => { beam.k = 1 - p; });
      this.beams.splice(this.beams.indexOf(beam), 1);
      return m;
    }

    if (move.anim === 'aura') {
      Sfx.play('aura');
      startQte();
      const t0 = performance.now();
      this.tint = Art.rgba(base, 0.0);
      await anim(950, p => {
        this.tint = Art.rgba(base, 0.35 * Math.sin(p * Math.PI));
        if (Math.random() < 0.3) this.ring(dx, dy, col, 140, 10, 0.5, 6);
        D.shake = 5 * p;
      });
      const m = await getMult();
      onImpact(m);
      D.shake = 0;
      this.tint = null;
      this.burst(dx, dy, col, 30, 300, { g: -100 });
      await wait(200);
      return m;
    }
    onImpact(1);
    return 1;
  }

  async hitReaction(D, dmg, crit, eff, isPlayerTarget) {
    const dir = isPlayerTarget ? -1 : 1;
    const [x, y] = this.centerOf(D);
    Sfx.play(crit ? 'crit' : eff > 1 ? 'super' : eff < 1 ? 'weak' : 'hit');
    this.shake(crit ? 26 : eff > 1 ? 20 : 10);
    if (crit || eff > 1) { this.flashScreen = 0.5; this.flashColor = crit ? '#fff' : '#ffeedd'; }
    this.floatText('-' + dmg, x + (Math.random() - 0.5) * 30, y - 20, eff > 1 ? '#ff5a3a' : eff < 1 ? '#bbb' : '#fff', crit ? 46 : 34);
    if (crit) this.floatText('¡CRÍTICO!', x, y - 80, '#ffd84a', 26);
    D.flash = 1.5;
    await anim(380, p => { D.offX = dir * 28 * Math.sin(p * Math.PI) * (1 - p) * 2; D.squash = Math.sin(p * Math.PI) * 0.12; });
    D.offX = 0; D.squash = 0;
  }

  // ------------------------------------------------------------------
  //  CÁLCULOS
  // ------------------------------------------------------------------
  calcDamage(att, def, move, stA, stD, qteMult) {
    const spA = species(att), spD = species(def);
    const atk = att.stats.atk * STAGE_MULT(stA.atk) * (att.status === 'quemado' ? 0.8 : 1);
    const df = def.stats.def * STAGE_MULT(stD.def);
    const eff = typeEffect(move.type, spD.types);
    const stab = spA.types.includes(move.type) ? 1.5 : 1;
    const crit = Math.random() < 0.0625 || (qteMult >= 1.35 && Math.random() < 0.35);
    const rnd = 0.85 + Math.random() * 0.15;
    let dmg = ((((2 * att.level) / 5 + 2) * move.pow * (atk / df)) / 50 + 2) * stab * eff * (crit ? 1.5 : 1) * rnd * qteMult;
    if (move.multi) dmg *= 1;
    dmg = eff === 0 ? 0 : Math.max(1, Math.floor(dmg));
    return { dmg, eff, crit };
  }

  // ------------------------------------------------------------------
  //  FLUJO DE TURNO
  // ------------------------------------------------------------------
  async useMove(att, def, moveId, isPlayer) {
    const move = MOVES[moveId];
    const A = isPlayer ? this.P : this.E, D = isPlayer ? this.E : this.P;
    const stA = isPlayer ? this.stagesP : this.stagesE, stD = isPlayer ? this.stagesE : this.stagesP;
    const who = isPlayer ? cname(att) : (this.wild ? `${cname(att)} salvaje` : `${cname(att)} enemigo`);

    if (att.status === 'terror') {
      if (Math.random() < 0.3) { att.status = null; await UI.say(`${who} superó su terror.`, { auto: 500 }); }
      else if (Math.random() < 0.35) {
        A.shake = 4; await UI.say(`¡${who} está paralizado de terror!`, { auto: 700 }); A.shake = 0; return;
      }
    }
    await UI.say(`¡${who} usa ${move.name}!`, { auto: 350 });
    if (Math.random() * 100 > move.acc) {
      Sfx.play('miss');
      await anim(300, p => { D.offX = (isPlayer ? 1 : -1) * 50 * Math.sin(p * Math.PI); });
      this.floatText('Esquivó', ...this.centerOf(D), '#aaa', 26);
      await UI.say('¡Pero falló!', { auto: 500 });
      return;
    }
    let result = null;
    const mult = await this.animateMove(move, A, D, isPlayer, m => {
      if (move.pow > 0) {
        const qm = isPlayer ? m : m; // atacante=QTE de ataque, defensor=QTE de bloqueo
        result = this.calcDamage(att, def, move, stA, stD, qm);
        def.hp = Math.max(0, def.hp - result.dmg);
      }
    });
    if (move.pow > 0 && result) {
      if (result.eff === 0) { await UI.say(`No afecta a ${cname(def)}...`, { auto: 600 }); return; }
      await this.hitReaction(D, result.dmg, result.crit, result.eff, !isPlayer);
      if (result.eff > 1) await UI.say('¡Es devastador!', { auto: 450 });
      else if (result.eff < 1) await UI.say('No es muy eficaz...', { auto: 450 });
      const e = move.eff || {};
      if (e.drain && att.hp > 0) {
        const h = Math.max(1, Math.floor(result.dmg * e.drain));
        att.hp = Math.min(att.stats.hp, att.hp + h);
        const [x, y] = this.centerOf(A);
        this.burst(x, y, '#ff3b3b', 16, 120, { g: -200 });
        this.floatText('+' + h, x, y - 30, '#5f5', 28);
        await UI.say(`${who} bebe la vitalidad de su presa.`, { auto: 450 });
      }
      if (e.st && def.hp > 0 && !def.status && Math.random() < e.ch) {
        def.status = e.st;
        const [x, y] = this.centerOf(D);
        this.burst(x, y, STATUS_COLOR[e.st], 20, 160);
        const msg = { sangrado: 'sangra', veneno: 'está envenenado', quemado: 'arde en llamas', terror: 'está aterrorizado' }[e.st];
        await UI.say(`¡${cname(def)} ${msg}!`, { auto: 500 });
      }
    } else if (move.eff) {
      const e = move.eff;
      if (e.self) for (const k in e.self) { stA[k] = Math.max(-6, Math.min(6, stA[k] + e.self[k])); await UI.say(`¡${k === 'atk' ? 'El ataque' : 'La defensa'} de ${who} aumenta${e.self[k] > 1 ? ' mucho' : ''}!`, { auto: 500 }); }
      if (e.foe) for (const k in e.foe) { stD[k] = Math.max(-6, Math.min(6, stD[k] + e.foe[k])); await UI.say(`¡${k === 'atk' ? 'El ataque' : 'La defensa'} de ${cname(def)} baja!`, { auto: 500 }); }
    }
  }

  async faintAnim(V, c) {
    Sfx.play('faint');
    const [x, y] = this.centerOf(V);
    await anim(800, p => {
      V.offY = 60 * ease.in(p); V.alpha = 1 - p; V.sil = p > 0.2 ? '#300' : false;
      if (Math.random() < 0.6) this.particles.push({ x: x + (Math.random() - 0.5) * 120, y: y + 40 + (Math.random() - 0.5) * 40, vx: 0, vy: -60, g: -40, r: 10, color: 'rgba(40,10,20,0.8)', life: 1, max: 1, add: false, shrink: false });
    });
    V.sil = false;
  }

  async statusTick(c, isPlayer) {
    if (!c || c.hp <= 0 || !c.status || c.status === 'terror') return;
    const V = isPlayer ? this.P : this.E;
    const dmg = Math.max(1, Math.floor(c.stats.hp / (c.status === 'veneno' ? 8 : 10)));
    c.hp = Math.max(0, c.hp - dmg);
    const [x, y] = this.centerOf(V);
    this.burst(x, y, STATUS_COLOR[c.status], 16, 140, { g: c.status === 'quemado' ? -200 : 300 });
    V.flash = 0.8;
    this.floatText('-' + dmg, x, y - 30, STATUS_COLOR[c.status], 26);
    const msg = { sangrado: 'pierde sangre', veneno: 'sufre por el veneno', quemado: 'se quema' }[c.status];
    await UI.say(`${cname(c)} ${msg}.`, { auto: 400 });
  }

  enemyChooseMove() {
    const foe = this.foe, me = this.me;
    const opts = foe.moves.map(id => {
      const m = MOVES[id];
      let score = m.pow ? m.pow * typeEffect(m.type, species(me).types) * (species(foe).types.includes(m.type) ? 1.5 : 1) : 35;
      if (m.pow === 0 && this.turn > 3) score = 10;
      return { id, score: Math.max(1, score) + Math.random() * 40 };
    });
    opts.sort((a, b) => b.score - a.score);
    return Math.random() < 0.8 ? opts[0].id : opts[Math.floor(Math.random() * opts.length)].id;
  }

  // ------------------------------------------------------------------
  //  ENTRADAS
  // ------------------------------------------------------------------
  async sendOutPlayer(first) {
    const c = this.me;
    this.stagesP = { atk: 0, def: 0 };
    this.participants.add(c.uid);
    this.hud.p = null;
    if (!first) await UI.say(`¡Adelante, ${cname(c)}!`, { auto: 300 });
    this.sigil = { x: this.P.x - 120, y: this.P.y - 60, rot: 0, scale: 1, color: '#ff3b3b' };
    Sfx.play('throw');
    await anim(320, p => { this.sigil.x = lerp(this.P.x - 160, this.P.x, p); this.sigil.y = lerp(this.P.y - 160, this.P.y - 20, p) - Math.sin(p * Math.PI) * 60; this.sigil.rot += 0.3; });
    this.sigil = null;
    const [x, y] = this.centerOf(this.P);
    this.burst(x, y + 40, '#ff3b3b', 30, 300);
    this.ring(this.P.x, this.P.y, '#ff3b3b', 10, 160, 0.6, 8, 0.3);
    Sfx.play('roar');
    this.P.offY = 0; this.P.offX = 0; this.P.sil = '#fff';
    await anim(400, p => { this.P.alpha = p; this.P.scale = ease.back(p); });
    this.P.sil = false; this.P.flash = 1;
  }

  async sendOutEnemy(first) {
    const c = this.foe;
    this.stagesE = { atk: 0, def: 0 };
    this.hud.e = null;
    this.game.dex.seen.add(c.sp);
    this.E.alpha = 1; this.E.offY = 0;
    if (this.wild) {
      this.E.sil = '#000'; this.E.offX = 500;
      await anim(700, p => { this.E.offX = 500 * (1 - ease.out(p)); });
      Sfx.play('roar');
      this.shake(14);
      const [x, y] = this.centerOf(this.E);
      this.ring(x, y, TYPES[species(c).types[0]].glow, 20, 200, 0.7, 10);
      await anim(400, p => { this.E.squash = Math.sin(p * Math.PI * 4) * 0.08 * (1 - p); });
      this.E.sil = false; this.E.flash = 1;
    } else {
      if (!first) await UI.say(`${this.opts.trainer.name} invoca a ${cname(c)}.`, { auto: 400 });
      this.E.offX = 0; this.E.alpha = 0; this.E.scale = 0.2;
      const [x, y] = this.centerOf(this.E);
      this.burst(x, y + 40, '#9b3bff', 30, 300);
      Sfx.play('roar');
      await anim(400, p => { this.E.alpha = p; this.E.scale = ease.back(p); });
      this.E.flash = 1;
    }
  }

  // ------------------------------------------------------------------
  //  MENÚS DEL JUGADOR
  // ------------------------------------------------------------------
  async chooseAction() {
    while (true) {
      const i = await UI.menu([
        { label: '⚔ Atacar', cls: 'big' }, { label: '☠ Criaturas', cls: 'big' },
        { label: '⚱ Objetos', cls: 'big' }, { label: '➶ Huir', cls: 'big', disabled: !this.wild },
      ], { cols: 2, cls: 'battlemenu', cancel: false, title: `¿Qué hará ${cname(this.me)}?` });
      if (i === 0) {
        const mv = await this.chooseMove();
        if (mv) return { kind: 'move', move: mv };
      } else if (i === 1) {
        const idx = await this.game.partyMenu({ battle: true, current: this.pi });
        if (idx >= 0 && idx !== this.pi && this.game.party[idx].hp > 0) return { kind: 'switch', idx };
      } else if (i === 2) {
        const r = await this.game.bagMenu({ battle: true, wild: this.wild });
        if (r) return { kind: 'item', ...r };
      } else if (i === 3) return { kind: 'run' };
    }
  }

  async chooseMove() {
    const me = this.me, foe = this.foe;
    const known = this.game.dex.caught.has(foe.sp) || this.game.dex.seen.has(foe.sp);
    const items = me.moves.map(id => {
      const m = MOVES[id];
      let hint = '';
      if (m.pow && known) {
        const e = typeEffect(m.type, species(foe).types);
        hint = e > 1 ? '<span class="eff up">▲ devastador</span>' : e === 0 ? '<span class="eff zero">✕ sin efecto</span>' : e < 1 ? '<span class="eff down">▼ débil</span>' : '';
      }
      return {
        html: `<div class="mvname">${m.name}</div><div class="mvinfo">${UI.typeBadge(m.type)} ${m.pow ? 'Pot ' + m.pow : 'Estado'} · Prec ${m.acc} ${hint}</div>`,
        cls: 'move', style: `border-color:${TYPES[m.type].color}`,
      };
    });
    const i = await UI.menu(items, { cols: 2, cls: 'battlemenu' });
    return i >= 0 ? me.moves[i] : null;
  }

  async forceSwitch() {
    const alive = this.game.party.filter(c => c.hp > 0);
    if (!alive.length) return false;
    let idx = -1;
    while (idx < 0 || this.game.party[idx].hp <= 0) idx = await this.game.partyMenu({ battle: true, forced: true, current: this.pi });
    this.pi = idx;
    await this.sendOutPlayer(false);
    return true;
  }

  // ------------------------------------------------------------------
  //  CAPTURA
  // ------------------------------------------------------------------
  async tryCatch(itemId) {
    const it = ITEMS[itemId];
    const foe = this.foe, sp = species(foe);
    await UI.say(`Lanzas un ${it.name}...`, { auto: 250 });
    const s = { x: this.P.x, y: this.P.y - 100, rot: 0, scale: 1, color: itemId === 'sellonegro' ? '#b48cff' : itemId === 'sellomayor' ? '#ff3b3b' : '#e8c060' };
    this.sigil = s;
    Sfx.play('throw');
    const [ex, ey] = this.centerOf(this.E);
    await anim(600, p => { s.x = lerp(this.P.x, ex, p); s.y = lerp(this.P.y - 100, ey - 40, p) - Math.sin(p * Math.PI) * 180; s.rot += 0.35; });
    // succión
    this.ring(s.x, s.y, s.color, 10, 120, 0.4, 8);
    Sfx.play('aura');
    await anim(500, p => { this.E.sil = s.color; this.E.scale = 1 - ease.in(p); this.E.offY = -50 * p; this.E.alpha = 1 - p * 0.5; });
    this.E.alpha = 0; this.E.sil = false;
    await anim(380, p => { s.y = lerp(ey - 40, this.E.y - 10, ease.in(p)); });
    Sfx.play('wobble'); this.shake(6);
    s.flat = 1;
    const a = ((3 * foe.stats.hp - 2 * foe.hp) * sp.catchRate * it.bonus) / (3 * foe.stats.hp) * (foe.status ? 1.6 : 1);
    const chance = Math.min(1, a / 255);
    const success = Math.random() < chance;
    const wobbles = success ? 3 : Math.floor(Math.random() * 3);
    for (let i = 0; i < wobbles; i++) {
      await wait(350);
      Sfx.play('wobble');
      await anim(450, p => { s.rot = Math.sin(p * Math.PI * 2) * 0.5; s.x = ex + Math.sin(p * Math.PI * 2) * 10; });
    }
    await wait(300);
    if (success) {
      Sfx.play('caught');
      this.burst(s.x, s.y, s.color, 40, 260, { g: -50 });
      for (let i = 0; i < 3; i++) this.floatText('✦', s.x + (i - 1) * 40, s.y - 30, s.color, 28);
      await UI.say(`¡${sp.name} quedó sellado!`);
      this.sigil = null;
      return true;
    }
    Sfx.play('break');
    this.burst(s.x, s.y, s.color, 30, 340, { kind: 'shard', add: false, r: 8 });
    this.sigil = null;
    this.E.scale = 1; this.E.offY = 0;
    await anim(300, p => { this.E.alpha = p; });
    this.E.flash = 1;
    await UI.say(['¡Rompió el sello!', '¡Casi! Se liberó...', '¡Ugh! Estuvo tan cerca...'][wobbles] || '¡Rompió el sello!', { auto: 600 });
    return false;
  }

  // ------------------------------------------------------------------
  //  RECOMPENSAS
  // ------------------------------------------------------------------
  async awardExp(defeated) {
    const sp = species(defeated);
    const base = Math.floor((sp.expYield * defeated.level) / 6 * (this.wild ? 1 : 1.5));
    for (const c of this.game.party) {
      if (c.hp <= 0) continue;
      const share = this.participants.has(c.uid) ? base : Math.floor(base * 0.35);
      if (share <= 0) continue;
      const evs = gainExp(c, share);
      if (c === this.me || this.participants.has(c.uid)) await UI.say(`${cname(c)} absorbe ${share} de esencia.`, { auto: 400 });
      for (const ev of evs) {
        if (ev.type === 'level') {
          if (c === this.me) {
            Sfx.play('level');
            const [x, y] = this.centerOf(this.P);
            this.burst(x, y, '#ffd84a', 30, 200, { g: -200 });
            this.ring(this.P.x, this.P.y, '#ffd84a', 10, 140, 0.6, 6, 0.3);
            this.hud.p.exp = expForLevel(c.level);
          }
          await UI.say(`¡${cname(c)} sube al nivel ${ev.level}!`, { auto: c === this.me ? 600 : 300 });
        } else if (ev.type === 'learn') {
          await this.game.learnMove(c, ev.move);
        }
      }
    }
  }

  // ------------------------------------------------------------------
  //  BUCLE PRINCIPAL
  // ------------------------------------------------------------------
  async run() {
    await anim(600, p => { this.intro = 1 - ease.out(p); });
    this.intro = 0;
    if (this.wild) {
      await this.sendOutEnemy(true);
      await UI.say(`¡Un ${cname(this.foe)} salvaje emerge de la oscuridad!`);
    } else {
      const tr = this.opts.trainer;
      await UI.say(tr.lines.intro, { speaker: tr.name });
      await this.sendOutEnemy(true);
      await UI.say(`${tr.name} invoca a ${cname(this.foe)}.`, { auto: 500 });
    }
    await this.sendOutPlayer(true);
    if (this.turn === 0 && this.game.settings.qte && !this.game.flags.qteTutorial) {
      this.game.flags.qteTutorial = true;
      await UI.say('Consejo: cuando aparezca un anillo, pulsa Z / Espacio o toca la pantalla justo cuando el anillo coincida con el círculo punteado. ¡Golpearás más fuerte o bloquearás daño!');
    }

    while (true) {
      this.turn++;
      const act = await this.chooseAction();
      if (act.kind === 'run') {
        const chance = this.me.stats.spd >= this.foe.stats.spd ? 1 : 0.5 + this.turn * 0.1;
        if (Math.random() < chance) {
          Sfx.play('move');
          await anim(400, p => { this.P.offX = -400 * ease.in(p); });
          await UI.say('Escapaste a salvo... por ahora.', { auto: 500 });
          return 'run';
        }
        await UI.say('¡No puedes escapar!', { auto: 500 });
        await this.enemyTurn();
      } else if (act.kind === 'switch') {
        await UI.say(`¡${cname(this.me)}, regresa!`, { auto: 300 });
        await anim(300, p => { this.P.alpha = 1 - p; this.P.scale = 1 - p * 0.5; });
        this.pi = act.idx; this.P.scale = 1;
        await this.sendOutPlayer(false);
        await this.enemyTurn();
      } else if (act.kind === 'item') {
        const it = ITEMS[act.item];
        if (it.kind === 'catch') {
          this.game.bag[act.item]--;
          const ok = await this.tryCatch(act.item);
          if (ok) { this.game.addCaught(this.foe); return 'caught'; }
          await this.enemyTurn();
        } else {
          this.game.bag[act.item]--;
          const target = this.game.party[act.target];
          this.game.applyItem(act.item, target);
          Sfx.play('heal');
          if (target === this.me) {
            const [x, y] = this.centerOf(this.P);
            this.burst(x, y, '#5f5', 24, 140, { g: -200 });
          }
          await UI.say(`Usas ${it.name} en ${cname(target)}.`, { auto: 500 });
          await this.enemyTurn();
        }
      } else if (act.kind === 'move') {
        const pFirst = this.me.stats.spd * STAGE_MULT(0) >= this.foe.stats.spd || (this.me.stats.spd === this.foe.stats.spd && Math.random() < 0.5);
        const eMove = this.enemyChooseMove();
        if (pFirst) {
          await this.useMove(this.me, this.foe, act.move, true);
          if (this.foe.hp > 0) await this.useMove(this.foe, this.me, eMove, false);
        } else {
          await this.useMove(this.foe, this.me, eMove, false);
          if (this.me.hp > 0) await this.useMove(this.me, this.foe, act.move, true);
        }
      }
      // estados
      await this.statusTick(this.me, true);
      await this.statusTick(this.foe, false);
      // resolución
      const r = await this.checkFaints();
      if (r) return r;
    }
  }

  async enemyTurn() {
    if (this.foe.hp > 0 && this.me.hp > 0) await this.useMove(this.foe, this.me, this.enemyChooseMove(), false);
  }

  async checkFaints() {
    if (this.foe.hp <= 0) {
      await this.faintAnim(this.E, this.foe);
      await UI.say(`¡${cname(this.foe)}${this.wild ? ' salvaje' : ''} se desvanece!`, { auto: 500 });
      await this.awardExp(this.foe);
      if (!this.wild && this.ei < this.enemyTeam.length - 1) {
        this.ei++;
        this.participants = new Set(this.me.hp > 0 ? [this.me.uid] : []);
        await this.sendOutEnemy(false);
      } else {
        if (!this.wild) {
          const tr = this.opts.trainer;
          await UI.say(tr.lines.lose, { speaker: tr.name });
          this.game.money += tr.reward;
          await UI.say(`Recibes ${tr.reward} monedas de hueso.`);
        } else {
          const coins = 5 + Math.floor(this.foe.level * 3 * Math.random());
          this.game.money += coins;
          await UI.say(`Encuentras ${coins} monedas de hueso entre los restos.`, { auto: 500 });
        }
        return 'win';
      }
    }
    if (this.me.hp <= 0) {
      await this.faintAnim(this.P, this.me);
      await UI.say(`¡${cname(this.me)} ha caído!`, { auto: 500 });
      if (!this.game.party.some(c => c.hp > 0)) {
        await UI.say('Todas tus criaturas han caído... La oscuridad te envuelve.');
        return 'lose';
      }
      this.P.offY = 0;
      await this.forceSwitch();
    }
    return null;
  }
}

// Paletas de fondo por zona
const ZONE_BG = {
  aldea:      { sky1: '#0b0a14', sky2: '#2a1a2a', ground1: '#2a2018', ground2: '#120c08', moon: '#e8d8b0', far: '#08060c', fog: 'rgba(120,100,120,0.18)', mote: '#ffb03b', plat: 'rgba(80,50,40,0.9)', props: 'trees' },
  bosque:     { sky1: '#07100c', sky2: '#1c2a1e', ground1: '#1e2a18', ground2: '#0a1008', moon: '#d8e8c0', far: '#040a06', fog: 'rgba(100,140,100,0.2)', mote: '#b6ff3b', plat: 'rgba(50,70,40,0.9)', props: 'trees' },
  pantano:    { sky1: '#060c14', sky2: '#13283a', ground1: '#142a2a', ground2: '#061010', moon: '#b0d8e8', far: '#030810', fog: 'rgba(80,140,160,0.22)', mote: '#3fd0ff', plat: 'rgba(30,70,70,0.9)', props: 'trees' },
  cementerio: { sky1: '#0c0814', sky2: '#2a1e3a', ground1: '#24202a', ground2: '#0c0a10', moon: '#e8e0f0', far: '#06040a', fog: 'rgba(160,140,180,0.2)', mote: '#c8f4ff', plat: 'rgba(70,60,80,0.9)', props: 'tombs' },
  cumbres:    { sky1: '#140606', sky2: '#3a1410', ground1: '#2a1a14', ground2: '#100604', moon: '#ff8a5a', far: '#0a0302', fog: 'rgba(180,80,40,0.18)', mote: '#ff6b1a', plat: 'rgba(90,40,20,0.9)', props: 'pillars', spiky: true },
  cripta:     { sky1: '#050008', sky2: '#1c0a24', ground1: '#1a0a14', ground2: '#050004', moon: '#c43030', far: '#030003', fog: 'rgba(140,40,80,0.2)', mote: '#ff3b3b', plat: 'rgba(80,10,30,0.9)', props: 'pillars' },
};
