// =====================================================================
//  UMBRAL — Entrada y UI (diálogos, menús) sobre capa DOM.
// =====================================================================
'use strict';

const Input = (() => {
  const held = {};
  const listeners = [];
  const MAP = {
    ArrowUp: 'up', KeyW: 'up', ArrowDown: 'down', KeyS: 'down',
    ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right',
    Enter: 'ok', Space: 'ok', KeyZ: 'ok', KeyE: 'ok',
    Escape: 'back', KeyX: 'back', Backspace: 'back', KeyM: 'menu', Tab: 'menu',
  };
  function emit(a) { for (const l of listeners.slice()) l(a); }
  window.addEventListener('keydown', e => {
    const a = MAP[e.code];
    if (!a) return;
    e.preventDefault();
    if (!held[a]) { held[a] = true; emit(a); }
    else if (['up', 'down', 'left', 'right'].includes(a)) emit(a); // auto-repetición en menús
  });
  window.addEventListener('keyup', e => { const a = MAP[e.code]; if (a) held[a] = false; });
  // controles táctiles
  function bindTouch() {
    document.querySelectorAll('[data-act]').forEach(btn => {
      const a = btn.dataset.act;
      const down = e => { e.preventDefault(); held[a] = true; emit(a); btn.classList.add('on'); };
      const up = e => { e.preventDefault(); held[a] = false; btn.classList.remove('on'); };
      btn.addEventListener('pointerdown', down);
      btn.addEventListener('pointerup', up);
      btn.addEventListener('pointerleave', up);
      btn.addEventListener('pointercancel', up);
    });
  }
  return {
    held, bindTouch,
    on(fn) { listeners.push(fn); return () => { const i = listeners.indexOf(fn); if (i >= 0) listeners.splice(i, 1); }; },
    emit,
  };
})();

const UI = (() => {
  const root = () => document.getElementById('ui');
  let textSpeed = 28; // caracteres por segundo *  (más = más rápido)

  function el(tag, cls, html) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html !== undefined) e.innerHTML = html;
    return e;
  }

  // Cuadro de diálogo. opts: { speaker, auto (ms), keep }
  function say(text, opts = {}) {
    return new Promise(resolve => {
      let box = document.getElementById('dialog');
      if (!box) { box = el('div', 'dialog'); box.id = 'dialog'; root().appendChild(box); }
      box.innerHTML = '';
      if (opts.speaker) box.appendChild(el('div', 'speaker', opts.speaker));
      const p = el('div', 'dtext'); box.appendChild(p);
      const arrow = el('div', 'darrow', '▼'); box.appendChild(arrow);
      arrow.style.visibility = 'hidden';
      box.style.display = 'block';
      let i = 0, done = false, finished = false;
      const chars = [...text];
      const iv = setInterval(() => {
        i += 2;
        p.textContent = chars.slice(0, i).join('');
        if (i >= chars.length) { clearInterval(iv); done = true; arrow.style.visibility = 'visible'; if (opts.auto) setTimeout(finish, opts.auto); }
      }, 1000 / textSpeed);
      function finish() {
        if (finished) return; finished = true;
        off(); box.removeEventListener('pointerdown', click);
        if (!opts.keep) box.style.display = 'none';
        resolve();
      }
      function adv() {
        if (!done) { clearInterval(iv); p.textContent = text; done = true; arrow.style.visibility = 'visible'; if (opts.auto) setTimeout(finish, opts.auto); return; }
        finish();
      }
      const off = Input.on(a => { if (a === 'ok' || a === 'back') adv(); });
      const click = e => { e.stopPropagation(); adv(); };
      box.addEventListener('pointerdown', click);
    });
  }
  function hideDialog() { const b = document.getElementById('dialog'); if (b) b.style.display = 'none'; }

  /**
   * Menú genérico. items: [{label, html?, disabled?, cls?, value?}]
   * opts: { cols, cls, title, cancel (bool), onFocus(i), x,y via cls }
   * Devuelve índice elegido o -1 si se cancela.
   */
  function menu(items, opts = {}) {
    return new Promise(resolve => {
      const box = el('div', 'menu ' + (opts.cls || ''));
      if (opts.title) box.appendChild(el('div', 'mtitle', opts.title));
      const grid = el('div', 'mgrid');
      const cols = opts.cols || 1;
      grid.style.gridTemplateColumns = `repeat(${cols}, 1fr)`;
      box.appendChild(grid);
      const btns = items.map((it, i) => {
        const b = el('button', 'mitem ' + (it.cls || ''), it.html || it.label);
        if (it.disabled) b.classList.add('disabled');
        if (it.style) b.setAttribute('style', it.style);
        b.addEventListener('pointerenter', () => focus(i));
        b.addEventListener('click', e => { e.stopPropagation(); focus(i); choose(); });
        grid.appendChild(b);
        return b;
      });
      if (opts.cancel !== false) {
        const c = el('button', 'mitem mcancel', opts.cancelLabel || '← Volver');
        c.addEventListener('click', e => { e.stopPropagation(); close(-1); });
        box.appendChild(c);
      }
      root().appendChild(box);
      let idx = Math.max(0, items.findIndex(it => !it.disabled));
      if (opts.start !== undefined) idx = opts.start;
      function focus(i) {
        idx = i;
        btns.forEach((b, j) => b.classList.toggle('focus', j === i));
        if (opts.onFocus) opts.onFocus(i);
        btns[i] && btns[i].scrollIntoView({ block: 'nearest' });
      }
      function choose() {
        if (items[idx].disabled) { box.classList.add('shake'); setTimeout(() => box.classList.remove('shake'), 300); return; }
        Sfx.play('select');
        close(idx);
      }
      function close(v) { off(); box.remove(); resolve(v); }
      const off = Input.on(a => {
        const n = items.length;
        if (a === 'up') focus((idx - cols + n) % n);
        else if (a === 'down') focus((idx + cols) % n);
        else if (a === 'left') focus((idx - 1 + n) % n);
        else if (a === 'right') focus((idx + 1) % n);
        else if (a === 'ok') choose();
        else if (a === 'back' && opts.cancel !== false) close(-1);
        if (['up', 'down', 'left', 'right'].includes(a)) Sfx.play('move');
      });
      focus(idx);
    });
  }

  function clear() { root().querySelectorAll('.menu, .panel').forEach(e => e.remove()); hideDialog(); }

  function panel(html, cls = '') {
    const p = el('div', 'panel ' + cls, html);
    root().appendChild(p);
    return p;
  }

  function typeBadge(t) { return `<span class="tbadge" style="background:${TYPES[t].color}">${TYPES[t].name}</span>`; }
  function hpColor(f) { return f > 0.5 ? '#3fbf5a' : f > 0.2 ? '#e0b030' : '#d03030'; }

  function toast(msg) {
    const t = el('div', 'toast', msg); root().appendChild(t);
    setTimeout(() => t.classList.add('out'), 1600); setTimeout(() => t.remove(), 2100);
  }

  return { say, menu, clear, panel, el, typeBadge, hpColor, hideDialog, toast };
})();

// ---------------------------------------------------------------------
//  Sonido sintetizado (WebAudio) — sin archivos externos
// ---------------------------------------------------------------------
const Sfx = (() => {
  let ac = null, master = null, muted = false;
  function ctx() {
    if (!ac) {
      try { ac = new (window.AudioContext || window.webkitAudioContext)(); master = ac.createGain(); master.gain.value = 0.25; master.connect(ac.destination); } catch (e) { ac = null; }
    }
    if (ac && ac.state === 'suspended') ac.resume();
    return ac;
  }
  function tone(freq, dur, type = 'square', vol = 0.3, slide = 0, delay = 0) {
    const a = ctx(); if (!a || muted) return;
    const o = a.createOscillator(), g = a.createGain();
    const t0 = a.currentTime + delay;
    o.type = type; o.frequency.setValueAtTime(freq, t0);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, freq + slide), t0 + dur);
    g.gain.setValueAtTime(vol, t0); g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    o.connect(g); g.connect(master); o.start(t0); o.stop(t0 + dur + 0.02);
  }
  function noise(dur, vol = 0.3, delay = 0, hp = 800) {
    const a = ctx(); if (!a || muted) return;
    const len = Math.floor(a.sampleRate * dur);
    const buf = a.createBuffer(1, len, a.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const s = a.createBufferSource(); s.buffer = buf;
    const f = a.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = hp;
    const g = a.createGain(); g.gain.value = vol;
    s.connect(f); f.connect(g); g.connect(master); s.start(a.currentTime + delay);
  }
  const SOUNDS = {
    move: () => tone(440, 0.04, 'square', 0.08),
    select: () => tone(660, 0.06, 'square', 0.12),
    hit: () => { noise(0.18, 0.5, 0, 300); tone(120, 0.15, 'sawtooth', 0.3, -60); },
    crit: () => { noise(0.3, 0.6, 0, 200); tone(90, 0.3, 'sawtooth', 0.4, -50); },
    super: () => { noise(0.25, 0.5, 0, 400); tone(200, 0.2, 'square', 0.25, 300); },
    weak: () => tone(150, 0.15, 'triangle', 0.2, -50),
    miss: () => tone(300, 0.2, 'sine', 0.15, -200),
    claw: () => { noise(0.08, 0.4, 0, 2000); noise(0.08, 0.4, 0.08, 2000); noise(0.08, 0.4, 0.16, 2000); },
    shoot: () => tone(500, 0.2, 'sawtooth', 0.15, -350),
    beam: () => { tone(80, 0.6, 'sawtooth', 0.2, 40); tone(160, 0.6, 'square', 0.08, 80); },
    aura: () => { tone(220, 0.5, 'sine', 0.2, 220); tone(233, 0.5, 'sine', 0.2, 233); },
    buff: () => { tone(330, 0.1, 'square', 0.15); tone(440, 0.1, 'square', 0.15, 0, 0.1); tone(660, 0.15, 'square', 0.15, 0, 0.2); },
    debuff: () => { tone(440, 0.1, 'square', 0.15); tone(330, 0.1, 'square', 0.15, 0, 0.1); tone(220, 0.15, 'square', 0.15, 0, 0.2); },
    faint: () => tone(400, 0.9, 'sawtooth', 0.25, -380),
    roar: () => { tone(90, 0.5, 'sawtooth', 0.3, 60); noise(0.4, 0.3, 0, 200); },
    throw: () => tone(300, 0.3, 'triangle', 0.2, 400),
    wobble: () => tone(200, 0.08, 'square', 0.2, 50),
    caught: () => { [523, 659, 784, 1046].forEach((f, i) => tone(f, 0.15, 'square', 0.18, 0, i * 0.1)); },
    break: () => { noise(0.3, 0.5, 0, 1000); tone(600, 0.3, 'square', 0.15, -400); },
    level: () => { [392, 523, 659, 784].forEach((f, i) => tone(f, 0.12, 'triangle', 0.25, 0, i * 0.08)); },
    heal: () => { [523, 659, 784].forEach((f, i) => tone(f, 0.25, 'sine', 0.2, 0, i * 0.15)); },
    evolve: () => { for (let i = 0; i < 8; i++) tone(200 + i * 80, 0.2, 'sine', 0.15, 0, i * 0.12); },
    encounter: () => { tone(110, 0.3, 'sawtooth', 0.3, -40); tone(116, 0.3, 'sawtooth', 0.3, -40, 0.15); noise(0.5, 0.2, 0.1, 500); },
    step: () => noise(0.03, 0.05, 0, 3000),
    perfect: () => { tone(880, 0.08, 'square', 0.2); tone(1320, 0.12, 'square', 0.2, 0, 0.06); },
    block: () => { tone(180, 0.1, 'square', 0.3); noise(0.06, 0.3, 0, 3000); },
  };
  return {
    play(n) { try { SOUNDS[n] && SOUNDS[n](); } catch (e) { } },
    toggle() { muted = !muted; return !muted; },
    unlock: ctx,
  };
})();
