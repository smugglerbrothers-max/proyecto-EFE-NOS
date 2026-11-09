// =====================================================================
//  UMBRAL — Juego principal: escenas, menús, guardado.
// =====================================================================
'use strict';

const W = 960, H = 640;
const SAVE_KEY = 'umbral_save_v1';

const thumbURLs = {};
function thumbURL(sp, size = 84, sil = false) {
  const k = sp.id + size + sil;
  if (!thumbURLs[k]) thumbURLs[k] = Art.thumb(sp, size, sil).toDataURL();
  return thumbURLs[k];
}
function esc(s) { return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }

const Game = {
  canvas: null, ctx: null,
  scene: 'title', world: null, battle: null, evo: null,
  party: [], box: [], bag: {}, money: 0,
  dex: { seen: new Set(), caught: new Set() },
  flags: {}, player: { x: CX, y: 70, dir: 'up' }, respawn: { x: 25, y: 66 },
  settings: { qte: true },
  t: 0, titleT: 0,

  init() {
    this.canvas = document.getElementById('game');
    this.ctx = this.canvas.getContext('2d');
    this.world = new World(this);
    Input.bindTouch();
    Input.on(a => this.onAction(a));
    let last = performance.now();
    const loop = now => {
      const dt = Math.max(0, Math.min(0.05, (now - last) / 1000)); last = now;
      this.update(dt); this.render();
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
    Cloud.init().finally(() => this.titleScreen());
  },

  update(dt) {
    this.t += dt;
    if (this.scene === 'world') this.world.update(dt);
    else if (this.scene === 'battle' && this.battle) this.battle.update(dt);
    else if (this.scene === 'evolution' && this.evo) this.evo.update(dt);
  },

  render() {
    const ctx = this.ctx;
    if (this.scene === 'world') this.world.render(ctx, W, H);
    else if (this.scene === 'battle' && this.battle) this.battle.render(ctx, W, H);
    else if (this.scene === 'evolution' && this.evo) this.evo.render(ctx, W, H);
    else if (this.scene === 'title') this.renderTitle(ctx);
    else if (this.scene === 'starter') this.renderStarter(ctx);
    else if (this.scene === 'ending') this.renderEnding(ctx);
  },

  onAction(a) {
    if (this.scene !== 'world' || this.world.busy || document.querySelector('.menu')) return;
    if (a === 'ok') this.world.interact();
    else if (a === 'menu' || a === 'back') this.pauseMenu();
  },

  // ------------------------------------------------------------------
  //  TÍTULO
  // ------------------------------------------------------------------
  renderTitle(ctx) {
    const t = this.t;
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#05020a'); g.addColorStop(1, '#2a0a12');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    // criaturas en desfile
    const ids = ['cerbero_3', 'kraken_3', 'wendigo_3', 'gashadokuro_3', 'tiamat_3', 'banshee_3', 'jorogumo_3', 'moloch_3', 'quimera_3', 'mara_3'];
    const i = Math.floor(t / 4) % ids.length, f = (t % 4) / 4;
    const sp = SPECIES_BY_ID[ids[i]];
    const a = Math.min(1, f * 4, (1 - f) * 4);
    Art.draw(ctx, sp, W / 2, H * 0.86, 360, t, { alpha: a * 0.9, buf: 'title' });
    ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.fillRect(0, 0, W, H);
    // lluvia de ceniza
    ctx.fillStyle = 'rgba(255,120,80,0.5)';
    for (let k = 0; k < 60; k++) ctx.fillRect((k * 137 + t * 20 * (1 + k % 3)) % W, (k * 91 + t * 40 * (1 + k % 4)) % H, 2, 2);
    ctx.save();
    ctx.textAlign = 'center';
    ctx.font = 'bold 110px Georgia, serif';
    ctx.shadowColor = '#ff1a1a'; ctx.shadowBlur = 30 + Math.sin(t * 3) * 10;
    ctx.fillStyle = '#c41a1a'; ctx.fillText('UMBRAL', W / 2 + Math.sin(t * 20) * (Math.random() < 0.03 ? 6 : 0), 170);
    ctx.shadowBlur = 0;
    ctx.font = 'italic 24px Georgia, serif'; ctx.fillStyle = '#d8c8b8';
    ctx.fillText('Bestiario de las criaturas que no debieron despertar', W / 2, 212);
    ctx.font = '15px Georgia, serif'; ctx.fillStyle = '#8a7a7a';
    ctx.fillText(`${SPECIES.length} criaturas mitológicas · 3 etapas de evolución (Nv 9 y Nv 18)`, W / 2, 240);
    ctx.restore();
  },

  async titleScreen() {
    this.scene = 'title';
    UI.clear();
    let has = false;
    try { has = !!localStorage.getItem(SAVE_KEY); } catch (e) { }
    const canCloud = Cloud.enabled && Cloud.user;
    const items = [{ label: 'Nueva partida' }, { label: 'Continuar', disabled: !has && !canCloud }, { label: 'Bestiario completo' }];
    if (Cloud.enabled) items.push({ label: Cloud.user ? `☁ Nube: ${esc(Cloud.alias || 'conectado')}` : '☁ Cuenta en la nube' });
    const i = await UI.menu(items, { cls: 'titlemenu', cancel: false, start: has || canCloud ? 1 : 0 });
    if (i === 3) { await this.cloudMenu(); return this.titleScreen(); }
    Sfx.unlock();
    if (i === 0) {
      if (has) {
        const c = await UI.menu([{ label: 'Sí, empezar de nuevo' }, { label: 'No' }], { cls: 'titlemenu', cancel: false, title: 'Se borrará la partida guardada. ¿Seguro?' });
        if (c !== 0) return this.titleScreen();
      }
      this.newGame();
    } else if (i === 1) { await this.continueGame(); }
    else { await this.dexScreen(true); this.titleScreen(); }
  },

  async continueGame() {
    let local = null;
    try { local = JSON.parse(localStorage.getItem(SAVE_KEY)); } catch (e) { }
    let remote = null;
    if (Cloud.user) { try { const r = await Cloud.load(); remote = r && r.datos; } catch (e) { } }
    if (remote && !(remote.party && remote.party.length)) remote = null;
    if (local && !(local.party && local.party.length)) local = null;
    let pick = local;
    if (remote && (!local || (remote.savedAt || 0) > (local.savedAt || 0))) {
      pick = remote;
      UI.toast('Partida cargada desde la nube ☁');
    }
    if (!pick) return this.titleScreen();
    this.loadData(pick);
    this.enterWorld();
  },

  async cloudMenu() {
    if (!Cloud.enabled) { await UI.say('La nube no está configurada en esta versión. Tu partida se guarda en este dispositivo.'); return; }
    while (true) {
      const u = Cloud.user;
      const title = u ? `Conectado como ${esc(Cloud.alias || 'Sellador')}${u.email ? ' (' + esc(u.email) + ')' : ' (invitado)'}` : 'Guarda tu partida en la nube y juega en cualquier dispositivo.';
      const items = u
        ? [{ label: '⬆ Subir mi partida ahora' }, { label: '⬇ Cargar la partida de la nube' }, { label: '✎ Cambiar mi alias' }, { label: '🏆 Ranking del Bestiario' }, { label: 'Cerrar sesión' }]
        : [{ label: '✉ Entrar con mi correo' }, { label: '👤 Entrar como invitado' }, { label: '🏆 Ranking del Bestiario' }];
      const i = await UI.menu(items, { cls: 'pausemenu', title });
      if (i < 0) return;
      try {
        if (!u && i === 0) {
          const email = await UI.input('Tu correo electrónico. Te enviaremos un enlace para entrar:', { type: 'email', placeholder: 'tucorreo@ejemplo.com', okLabel: 'Enviar enlace' });
          if (email && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) { await Cloud.loginEmail(email); await UI.say('Revisa tu correo y abre el enlace en este dispositivo para entrar.'); }
          else if (email) await UI.say('Ese correo no parece válido.', { auto: 900 });
        } else if (!u && i === 1) {
          await Cloud.loginAnon();
          await this.askAlias();
          UI.toast('Conectado como invitado ☁');
        } else if ((!u && i === 2) || (u && i === 3)) {
          await this.showRanking();
        } else if (u && i === 0) {
          if (!this.party.length) { await UI.say('Aún no tienes una partida en curso.', { auto: 900 }); continue; }
          const ok = await Cloud.save(this.saveData());
          UI.toast(ok ? 'Partida subida a la nube ☁' : 'No se pudo subir la partida');
        } else if (u && i === 1) {
          const r = await Cloud.load();
          if (!r || !(r.datos.party && r.datos.party.length)) { await UI.say('No hay partida en la nube todavía.', { auto: 900 }); continue; }
          this.loadData(r.datos);
          try { localStorage.setItem(SAVE_KEY, JSON.stringify(r.datos)); } catch (e) { }
          UI.toast('Partida de la nube cargada ☁');
        } else if (u && i === 2) {
          await this.askAlias();
        } else if (u && i === 4) {
          await Cloud.logout(); UI.toast('Sesión cerrada');
        }
      } catch (e) {
        await UI.say('Error de la nube: ' + (e.message || e), { auto: 1500 });
      }
    }
  },

  async askAlias() {
    const a = await UI.input('¿Con qué nombre aparecerás en el ranking?', { value: Cloud.alias || '', max: 24, placeholder: 'Sellador' });
    if (a !== null) await Cloud.setAlias(a);
  },

  async showRanking() {
    const rows = await Cloud.ranking(20);
    const me = Cloud.alias;
    const html = rows.length
      ? `<h2 style="margin-top:0">🏆 Ranking del Bestiario</h2><table>${rows.map((r, k) => `<tr class="${r.alias === me ? 'me' : ''}"><td>${k + 1}</td><td>${esc(r.alias)}${r.campeon ? ' 👑' : ''}</td><td>${r.sellados} / ${SPECIES.length}</td></tr>`).join('')}</table>`
      : '<h2>🏆 Ranking</h2><p>Aún no hay nadie en el ranking. ¡Sé el primero!</p>';
    const p = UI.panel(html, 'ranking');
    await UI.menu([{ label: 'Cerrar' }], { cls: 'confirm bottom', cancel: false });
    p.remove();
  },

  // ------------------------------------------------------------------
  //  NUEVA PARTIDA / INICIAL
  // ------------------------------------------------------------------
  async newGame() {
    Object.assign(this, { party: [], box: [], bag: { sello: 5, elixir: 3 }, money: 500, flags: {}, dex: { seen: new Set(), caught: new Set() } });
    this.player = { x: CX, y: 69, dir: 'up' };
    this.respawn = { x: 25, y: 66 };
    this.world = new World(this);
    this.scene = 'starter';
    this.starterFocus = 0;
    await UI.say('Despiertas en la Aldea Ceniza. Las campanas no han dejado de doblar desde que se abrió el Umbral.', { speaker: 'La Curandera' });
    await UI.say('Las criaturas de los mitos han vuelto... y tienen hambre. Necesitarás una a tu lado. Elige, y no mires atrás.', { speaker: 'La Curandera' });
    const ids = ['ifrit_1', 'ahuizotl_1', 'basilisco_1'];
    while (true) {
      const i = await UI.menu(ids.map(id => {
        const sp = SPECIES_BY_ID[id];
        return { html: `<b>${sp.name}</b> ${sp.types.map(UI.typeBadge).join('')}<div class="small">${sp.origin}</div>` };
      }), { cls: 'startermenu', cancel: false, cols: 3, onFocus: k => { this.starterFocus = k; this.showStarterInfo(ids[k]); } });
      const sp = SPECIES_BY_ID[ids[i]];
      const ok = await UI.menu([{ label: `Sí, elijo a ${sp.name}` }, { label: 'Déjame pensarlo' }], { cls: 'confirm', cancel: false });
      if (ok === 0) {
        document.querySelectorAll('.starterinfo').forEach(e => e.remove());
        const c = createCreature(ids[i], 5);
        this.party.push(c);
        this.dex.seen.add(c.sp); this.dex.caught.add(c.sp);
        this.flags.starter = sp.line;
        Sfx.play('caught');
        await UI.say(`¡${sp.name} se une a ti! Su mirada te atraviesa... pero te obedece.`);
        await UI.say('Toma estos 5 Sellos de Cera y 3 Elixires. Habla con el Mercader si necesitas más. Ve al norte, al Bosque Marchito.', { speaker: 'La Curandera' });
        await UI.say('Controles: flechas/WASD para moverte · Z/Espacio para hablar · X/Esc para el menú.');
        this.save();
        return this.enterWorld();
      }
    }
  },

  showStarterInfo(id) {
    document.querySelectorAll('.starterinfo').forEach(e => e.remove());
    const sp = SPECIES_BY_ID[id];
    const chain = [sp.id, sp.evolvesTo, SPECIES_BY_ID[sp.evolvesTo].evolvesTo].map(x => SPECIES_BY_ID[x]);
    UI.panel(`<div class="small">${esc(sp.desc)}</div><div class="chain">${chain.map((s, i) => `<span>${i ? '→ <i>Nv ' + (i === 1 ? 9 : 18) + '</i> ' : ''}${s.name}</span>`).join(' ')}</div>`, 'starterinfo');
  },

  renderStarter(ctx) {
    const t = this.t;
    ctx.fillStyle = '#07040a'; ctx.fillRect(0, 0, W, H);
    const ids = ['ifrit_1', 'ahuizotl_1', 'basilisco_1'];
    ids.forEach((id, i) => {
      const x = W / 2 + (i - 1) * 300, y = 360;
      const foc = i === this.starterFocus;
      const g = ctx.createRadialGradient(x, y - 60, 10, x, y - 60, 200);
      g.addColorStop(0, foc ? 'rgba(255,200,140,0.25)' : 'rgba(255,200,140,0.06)'); g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g; ctx.fillRect(x - 200, 0, 400, H);
      Art.draw(ctx, SPECIES_BY_ID[id], x, y, foc ? 300 : 240, t + i, { alpha: foc ? 1 : 0.55, buf: 'st' + i });
    });
  },

  // ------------------------------------------------------------------
  //  MUNDO
  // ------------------------------------------------------------------
  enterWorld() {
    UI.clear();
    this.scene = 'world';
    this.world.busy = false;
    this.world.zoneShown = null;
    this.world.onStepZoneOnly = true;
    const z = zoneAt(this.player.y);
    this.world.zoneShown = z.id; this.world.zoneBanner = 2.5;
    document.body.classList.add('inworld');
  },

  async pauseMenu() {
    this.world.busy = true;
    while (true) {
      const i = await UI.menu([
        { label: '☠ Criaturas' }, { label: '📖 Bestiario' }, { label: '⚱ Mochila' }, { label: '⚰ Osario (caja)' },
        { label: '💾 Guardar' }, { label: '⚙ Opciones' }, { label: '☁ Nube y ranking' },
      ], { cls: 'pausemenu', title: `Monedas de hueso: ${this.money} · Sellados: ${this.dex.caught.size}/${SPECIES.length}`, cancelLabel: '✕ Cerrar' });
      if (i === -1) break;
      if (i === 0) await this.partyMenu({});
      if (i === 1) await this.dexScreen(false);
      if (i === 2) await this.bagMenu({});
      if (i === 3) await this.boxMenu();
      if (i === 4) { this.save(); await UI.say(Cloud.user ? 'Partida guardada en las sombras... y en la nube.' : 'Partida guardada en las sombras.', { auto: 700 }); }
      if (i === 5) await this.optionsMenu();
      if (i === 6) await this.cloudMenu();
    }
    this.world.busy = false;
  },

  async optionsMenu() {
    while (true) {
      const i = await UI.menu([
        { label: `Reflejos en batalla (anillos): ${this.settings.qte ? 'SÍ' : 'NO'}` },
        { label: 'Sonido: alternar' },
        { label: 'Volver al título' },
      ], { cls: 'pausemenu' });
      if (i === -1) return;
      if (i === 0) this.settings.qte = !this.settings.qte;
      if (i === 1) UI.toast(Sfx.toggle() ? 'Sonido activado' : 'Sonido silenciado');
      if (i === 2) { this.save(); document.body.classList.remove('inworld'); UI.clear(); this.world.busy = false; this.titleScreen(); throw new Error('__title__'); }
    }
  },

  async talkTo(n) {
    if (n.kind === 'healer') {
      await UI.say('Déjame ver a tus criaturas... Hmm. Siguen hambrientas, pero vivas.', { speaker: n.name });
      this.healParty(); Sfx.play('heal');
      this.respawn = { x: this.player.x, y: this.player.y };
      this.save();
      await UI.say('Listo. Que la luna no te encuentre solo.', { speaker: n.name });
      return;
    }
    if (n.kind === 'shop') return this.shop(n);
    if (n.kind === 'talk') {
      const line = n.lines[(this.flags['talk_' + n.id] = ((this.flags['talk_' + n.id] || 0) + 1)) % n.lines.length];
      return UI.say(line, { speaker: n.name });
    }
    if (n.kind === 'trainer') {
      if (this.flags['beat_' + n.id]) return UI.say(n.lines.lose, { speaker: n.name });
      const team = n.team === 'boss' ? bossTeam(this) : n.team.map(f => f());
      const res = await this.startBattle({ trainer: { name: n.name, team, reward: n.reward, lines: n.lines }, bg: ZONE_BG[zoneAt(n.y).id] });
      if (res === 'win') {
        this.flags['beat_' + n.id] = true;
        if (n.gate) { this.flags['gone_' + n.id] = true; await UI.say(`${n.name} se desvanece entre la niebla. El camino está libre.`); }
        if (n.boss) return this.ending();
        this.save();
      }
    }
  },

  // ------------------------------------------------------------------
  //  BATALLA
  // ------------------------------------------------------------------
  async startBattle(opts) {
    if (!this.party.some(c => c.hp > 0) || this.scene === 'battle' || this.inBattle) return;
    this.inBattle = true;
    this.world.busy = true;
    Sfx.play('encounter');
    // transición: destellos
    const prev = this.scene;
    for (let i = 0; i < 3; i++) { this.canvas.classList.add('flashin'); await wait(90); this.canvas.classList.remove('flashin'); await wait(70); }
    this.battle = new Battle(this, opts);
    this.scene = 'battle';
    document.body.classList.remove('inworld');
    let res;
    try { res = await this.battle.run(); }
    catch (e) { if (e.message === '__title__') return; console.error(e); res = 'run'; }
    UI.clear();
    if (res === 'lose') {
      const lost = Math.floor(this.money / 2);
      this.money -= lost;
      this.scene = 'world';
      this.healParty();
      this.player.x = this.respawn.x; this.player.y = this.respawn.y; this.player.dir = 'down';
      await UI.say(`Despiertas junto al último altar... Has perdido ${lost} monedas de hueso.`);
    } else {
      await this.checkEvolutions();
    }
    for (const c of this.party) if (c.status === 'terror') c.status = null;
    this.battle = null;
    this.inBattle = false;
    this.enterWorld();
    return res;
  },

  async checkEvolutions() {
    for (const c of this.party) {
      if (c.hp > 0 && pendingEvolution(c)) await this.evolutionScene(c);
    }
  },

  async evolutionScene(c) {
    const from = species(c), to = SPECIES_BY_ID[from.evolvesTo];
    this.scene = 'evolution';
    const E = this.evo = { t: 0, a: from, b: to, mix: 0, sil: true, flash: 0, parts: [], showB: false, update(dt) { this.t += dt; this.flash = Math.max(0, this.flash - dt * 1.5); for (const p of this.parts) { p.x += p.vx * dt; p.y += p.vy * dt; p.life -= dt; } this.parts = this.parts.filter(p => p.life > 0); },
      render(ctx) {
        ctx.fillStyle = '#05020a'; ctx.fillRect(0, 0, W, H);
        const g = ctx.createRadialGradient(W / 2, H / 2, 20, W / 2, H / 2, 420);
        g.addColorStop(0, Art.rgba(TYPES[to.types[0]].glow, 0.25 + this.mix * 0.2)); g.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
        for (let i = 0; i < 12; i++) {
          const ang = this.t * 0.7 + i / 12 * Math.PI * 2;
          ctx.strokeStyle = Art.rgba(TYPES[to.types[0]].glow, 0.15); ctx.lineWidth = 3;
          ctx.beginPath(); ctx.moveTo(W / 2, H / 2 - 40); ctx.lineTo(W / 2 + Math.cos(ang) * 800, H / 2 - 40 + Math.sin(ang) * 800); ctx.stroke();
        }
        const sp = this.showB ? this.b : this.a;
        Art.draw(ctx, sp, W / 2, H * 0.72, 340, this.t, { silhouette: this.sil ? '#fff' : false, buf: 'evo' });
        ctx.save(); ctx.globalCompositeOperation = 'lighter';
        for (const p of this.parts) { ctx.fillStyle = p.c; ctx.globalAlpha = Math.max(0, p.life); ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, 7); ctx.fill(); }
        ctx.restore();
        if (this.flash > 0) { ctx.fillStyle = `rgba(255,255,255,${Math.min(1, this.flash)})`; ctx.fillRect(0, 0, W, H); }
      } };
    await UI.say(`¿Qué...? ¡${cname(c)} está cambiando!`);
    E.sil = true;
    Sfx.play('evolve');
    // alternancia acelerada de siluetas
    let interval = 600;
    for (let i = 0; i < 14; i++) {
      E.showB = !E.showB; E.mix = i / 14;
      for (let k = 0; k < 10; k++) {
        const ang = Math.random() * Math.PI * 2;
        E.parts.push({ x: W / 2 + Math.cos(ang) * 300, y: H / 2 + Math.sin(ang) * 300, vx: -Math.cos(ang) * 500, vy: -Math.sin(ang) * 500, r: 3, c: TYPES[to.types[0]].glow, life: 0.6 });
      }
      if (i % 3 === 0) Sfx.play('wobble');
      await wait(interval);
      interval = Math.max(70, interval * 0.78);
    }
    E.showB = true; E.flash = 1.5; Sfx.play('roar');
    for (let k = 0; k < 80; k++) { const ang = Math.random() * Math.PI * 2, s = 100 + Math.random() * 400; E.parts.push({ x: W / 2, y: H / 2, vx: Math.cos(ang) * s, vy: Math.sin(ang) * s, r: 2 + Math.random() * 4, c: k % 2 ? '#fff' : TYPES[to.types[0]].glow, life: 1.2 }); }
    await wait(500);
    E.sil = false;
    const oldName = cname(c);
    evolve(c);
    this.dex.seen.add(c.sp); this.dex.caught.add(c.sp);
    Sfx.play('caught');
    await UI.say(`¡${oldName} se ha transformado en ${to.name}!`);
    await UI.say(to.desc);
    this.evo = null;
  },

  // ------------------------------------------------------------------
  //  CRIATURAS
  // ------------------------------------------------------------------
  creatureRow(c, i, opts = {}) {
    const sp = species(c), f = c.hp / c.stats.hp;
    return {
      html: `<img class="mini" src="${thumbURL(sp, 64)}"><div class="cinfo"><div><b>${esc(cname(c))}</b> <span class="lv">Nv ${c.level}</span> ${c.status ? `<span class="st" style="background:${STATUS_COLOR[c.status]}">${STATUS_NAMES[c.status]}</span>` : ''}</div>
        <div>${sp.types.map(UI.typeBadge).join('')}</div>
        <div class="hpbar"><div style="width:${f * 100}%;background:${UI.hpColor(f)}"></div></div><div class="small">${c.hp}/${c.stats.hp} PV${i === opts.current ? ' · <i>en combate</i>' : ''}</div></div>`,
      cls: 'crow' + (c.hp <= 0 ? ' fainted' : ''),
      disabled: opts.forced && c.hp <= 0,
    };
  },

  async partyMenu(opts) {
    while (true) {
      const i = await UI.menu(this.party.map((c, k) => this.creatureRow(c, k, opts)), { cls: 'partymenu', cols: 2, title: opts.forced ? 'Elige quién luchará' : 'Tus criaturas', cancel: !opts.forced });
      if (i < 0) return -1;
      const c = this.party[i];
      const acts = opts.battle ? [{ label: 'Enviar al combate', disabled: c.hp <= 0 || i === opts.current }, { label: 'Detalles' }] : [{ label: 'Detalles' }, { label: 'Poner al frente', disabled: i === 0 }];
      const a = await UI.menu(acts, { cls: 'confirm' });
      if (opts.battle) {
        if (a === 0) return i;
        if (a === 1) await this.details(c);
      } else {
        if (a === 0) await this.details(c);
        if (a === 1) { this.party.splice(i, 1); this.party.unshift(c); }
      }
    }
  },

  async details(c) {
    const sp = species(c);
    const nextLv = expForLevel(c.level + 1);
    const evo = sp.evolvesTo ? `Evoluciona a <b>${SPECIES_BY_ID[sp.evolvesTo].name}</b> en el Nv ${sp.evoLevel}` : 'Forma final';
    const p = UI.panel(`<div class="det"><img src="${thumbURL(sp, 180)}"><div>
      <h2>#${String(sp.num).padStart(3, '0')} ${esc(cname(c))} <span class="lv">Nv ${c.level}</span></h2>
      <div>${sp.types.map(UI.typeBadge).join('')} <span class="small">Origen: ${sp.origin}</span></div>
      <p class="desc">${esc(sp.desc)}</p>
      <table class="stats"><tr><td>PV</td><td>${c.hp}/${c.stats.hp}</td><td>Ataque</td><td>${c.stats.atk}</td></tr><tr><td>Defensa</td><td>${c.stats.def}</td><td>Velocidad</td><td>${c.stats.spd}</td></tr></table>
      <div class="small">Esencia: ${c.exp} / ${nextLv} · ${evo}</div>
      <div class="moves">${c.moves.map(m => `<div class="mv" style="border-color:${TYPES[MOVES[m].type].color}">${MOVES[m].name} ${UI.typeBadge(MOVES[m].type)} <span class="small">${MOVES[m].pow ? 'Pot ' + MOVES[m].pow : 'Estado'}</span></div>`).join('')}</div>
      </div></div>`, 'detailpanel');
    await UI.menu([{ label: 'Cerrar' }], { cls: 'confirm bottom', cancel: false });
    p.remove();
  },

  async learnMove(c, moveId) {
    const m = MOVES[moveId];
    if (c.moves.includes(moveId)) return;
    if (c.moves.length < 4) { c.moves.push(moveId); Sfx.play('level'); return UI.say(`¡${cname(c)} aprendió ${m.name}!`, { auto: 600 }); }
    await UI.say(`${cname(c)} quiere aprender ${m.name}, pero ya conoce 4 ataques. ¿Olvidar uno?`);
    const i = await UI.menu([...c.moves.map(id => ({ html: `${MOVES[id].name} ${UI.typeBadge(MOVES[id].type)} <span class="small">${MOVES[id].pow ? 'Pot ' + MOVES[id].pow : 'Estado'}</span>` })),
      { html: `<i>No aprender ${m.name}</i>` }], { cls: 'confirm', cancel: false, title: `Nuevo: ${m.name} (${TYPES[m.type].name}, ${m.pow ? 'Pot ' + m.pow : 'Estado'})` });
    if (i < 4) { const old = MOVES[c.moves[i]].name; c.moves[i] = moveId; await UI.say(`${cname(c)} olvidó ${old} y aprendió ${m.name}.`); }
    else await UI.say(`${cname(c)} no aprendió ${m.name}.`);
  },

  addCaught(c) {
    this.dex.caught.add(c.sp); this.dex.seen.add(c.sp);
    c.status = null;
    if (this.party.length < 6) this.party.push(c);
    else { this.box.push(c); UI.toast(`${cname(c)} fue enviado al Osario.`); }
  },

  healParty() { this.party.forEach(healCreature); },

  // ------------------------------------------------------------------
  //  MOCHILA / TIENDA / OSARIO
  // ------------------------------------------------------------------
  async bagMenu(opts) {
    while (true) {
      const ids = Object.keys(ITEMS).filter(k => this.bag[k] > 0);
      if (!ids.length) { await UI.say('La mochila está vacía.', { auto: 600 }); return null; }
      const i = await UI.menu(ids.map(k => {
        const it = ITEMS[k];
        const usable = it.kind === 'catch' ? !!(opts.battle && opts.wild) : true;
        return { html: `<b>${it.name}</b> ×${this.bag[k]}<div class="small">${it.desc}</div>`, disabled: !usable };
      }), { cls: 'bagmenu', title: 'Mochila' });
      if (i < 0) return null;
      const id = ids[i], it = ITEMS[id];
      if (it.kind === 'catch') return { item: id };
      const t = await UI.menu(this.party.map((c, k) => this.creatureRow(c, k)), { cls: 'partymenu', cols: 2, title: `¿En quién usar ${it.name}?` });
      if (t < 0) continue;
      const c = this.party[t];
      const valid = it.kind === 'revive' ? c.hp <= 0 : it.kind === 'cure' ? (c.hp > 0 && c.status) : (c.hp > 0 && c.hp < c.stats.hp);
      if (!valid) { await UI.say('No tendría ningún efecto.', { auto: 600 }); continue; }
      if (opts.battle) return { item: id, target: t };
      this.bag[id]--;
      this.applyItem(id, c); Sfx.play('heal');
      await UI.say(`Usas ${it.name} en ${cname(c)}.`, { auto: 600 });
    }
  },

  applyItem(id, c) {
    const it = ITEMS[id];
    if (it.kind === 'heal') c.hp = Math.min(c.stats.hp, c.hp + it.amount);
    if (it.kind === 'cure') c.status = null;
    if (it.kind === 'revive') c.hp = Math.floor(c.stats.hp / 2);
  },

  async shop(n) {
    await UI.say('Huesos por objetos, objetos por huesos. ¿Qué buscas?', { speaker: n.name });
    while (true) {
      const ids = Object.keys(ITEMS);
      const i = await UI.menu(ids.map(k => ({ html: `<b>${ITEMS[k].name}</b> — ${ITEMS[k].price} ☠<div class="small">${ITEMS[k].desc} (tienes ${this.bag[k] || 0})</div>`, disabled: this.money < ITEMS[k].price })),
        { cls: 'bagmenu', title: `Monedas de hueso: ${this.money}` });
      if (i < 0) break;
      const k = ids[i];
      const q = await UI.menu([1, 5, 10].map(n => ({ label: `×${n} (${ITEMS[k].price * n} ☠)`, disabled: this.money < ITEMS[k].price * n })), { cls: 'confirm', title: ITEMS[k].name });
      if (q < 0) continue;
      const n2 = [1, 5, 10][q];
      this.money -= ITEMS[k].price * n2;
      this.bag[k] = (this.bag[k] || 0) + n2;
      Sfx.play('caught');
      UI.toast(`Compraste ${n2} × ${ITEMS[k].name}`);
    }
    await UI.say('Vuelve antes de que se ponga la luna...', { speaker: n.name });
  },

  async boxMenu() {
    while (true) {
      if (!this.box.length) { await UI.say('El Osario está vacío. Cuando tengas más de 6 criaturas, las demás descansarán aquí.'); return; }
      const i = await UI.menu(this.box.map((c, k) => this.creatureRow(c, k)), { cls: 'partymenu', cols: 2, title: `Osario (${this.box.length})` });
      if (i < 0) return;
      const c = this.box[i];
      const acts = [{ label: this.party.length < 6 ? 'Llevar al equipo' : 'Intercambiar con alguien del equipo' }, { label: 'Detalles' }];
      const a = await UI.menu(acts, { cls: 'confirm' });
      if (a === 1) await this.details(c);
      if (a === 0) {
        if (this.party.length < 6) { this.box.splice(i, 1); healCreature(c); this.party.push(c); }
        else {
          const j = await UI.menu(this.party.map((p, k) => this.creatureRow(p, k)), { cls: 'partymenu', cols: 2, title: '¿A quién dejas en el Osario?' });
          if (j >= 0) { const out = this.party[j]; this.party[j] = c; healCreature(c); this.box[i] = out; }
        }
      }
    }
  },

  // ------------------------------------------------------------------
  //  BESTIARIO
  // ------------------------------------------------------------------
  async dexScreen(all) {
    const items = SPECIES.map(sp => {
      const seen = all || this.dex.seen.has(sp.id) || this.dex.caught.has(sp.id), caught = all || this.dex.caught.has(sp.id);
      return { html: `<img src="${thumbURL(sp, 72, !seen)}"><div class="small">#${String(sp.num).padStart(3, '0')}</div><div class="dn">${seen ? sp.name : '???'}</div>${caught && !all ? '<span class="cg">⛧</span>' : ''}`, cls: 'dexcell' };
    });
    let info = UI.panel('', 'dexinfo');
    const show = k => {
      const sp = SPECIES[k];
      const seen = all || this.dex.seen.has(sp.id) || this.dex.caught.has(sp.id);
      if (!seen) { info.innerHTML = `<b>#${String(sp.num).padStart(3, '0')} ???</b><div class="small">Aún no has visto esta criatura.</div>`; return; }
      const chain = [];
      let first = SPECIES_BY_ID[sp.line + '_1'];
      for (let s = first; s; s = s.evolvesTo && SPECIES_BY_ID[s.evolvesTo]) chain.push(s);
      info.innerHTML = `<img src="${thumbURL(sp, 150)}"><div><b>#${String(sp.num).padStart(3, '0')} ${sp.name}</b> ${sp.types.map(UI.typeBadge).join('')}
        <div class="small">Mitología: ${sp.origin} · Etapa ${sp.stage}/3</div><p class="desc">${sp.desc}</p>
        <div class="small chain">${chain.map((s, i) => (i ? ` → <i>Nv ${s.stage === 2 ? 9 : 18}</i> ` : '') + (s.id === sp.id ? `<b>${s.name}</b>` : (all || this.dex.seen.has(s.id) ? s.name : '???'))).join('')}</div>
        <div class="small">Base: PV ${sp.base.hp} · Ata ${sp.base.atk} · Def ${sp.base.def} · Vel ${sp.base.spd}</div></div>`;
    };
    await UI.menu(items, { cls: 'dexmenu', cols: 6, title: all ? `Bestiario completo — ${SPECIES.length} criaturas` : `Bestiario — Vistas ${this.dex.seen.size} · Selladas ${this.dex.caught.size} / ${SPECIES.length}`, onFocus: show, cancelLabel: '✕ Cerrar' });
    info.remove();
  },

  // ------------------------------------------------------------------
  //  FINAL
  // ------------------------------------------------------------------
  async ending() {
    this.flags.champion = true;
    this.save();
    this.scene = 'ending';
    this.endT = 0;
    await UI.say('El Umbral se cierra con un gemido que se oye en todos los mundos.');
    await UI.say('Las campanas de la Aldea Ceniza dejan de doblar por primera vez en cien años.');
    await UI.say(`Has sellado ${this.dex.caught.size} de ${SPECIES.length} criaturas. Pero en la oscuridad... aún quedan más esperando.`);
    await UI.say('FIN — Gracias por jugar UMBRAL. (Puedes seguir explorando y completando el Bestiario.)');
    this.player = { x: 25, y: 67, dir: 'down' };
    this.enterWorld();
  },
  renderEnding(ctx) {
    ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);
    const sp = SPECIES[Math.floor(this.t / 1.5) % SPECIES.length];
    Art.draw(ctx, sp, W / 2, H * 0.75, 300, this.t, { alpha: 0.8, buf: 'end' });
    ctx.fillStyle = '#c41a1a'; ctx.font = 'bold 60px Georgia, serif'; ctx.textAlign = 'center';
    ctx.fillText('EL UMBRAL SE CIERRA', W / 2, 110);
  },

  // ------------------------------------------------------------------
  //  GUARDADO
  // ------------------------------------------------------------------
  saveData() {
    return {
      party: this.party, box: this.box, bag: this.bag, money: this.money, flags: this.flags,
      dex: { seen: [...this.dex.seen], caught: [...this.dex.caught] },
      player: this.player, respawn: this.respawn, settings: this.settings, savedAt: Date.now(),
    };
  },
  save() {
    const data = this.saveData();
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(data)); } catch (e) { console.warn(e); }
    Cloud.saveSoon(data);
  },
  load() {
    let d = null;
    try { d = JSON.parse(localStorage.getItem(SAVE_KEY)); } catch (e) { }
    this.loadData(d);
  },
  loadData(d) {
    try {
      const valid = c => c && SPECIES_BY_ID[c.sp];
      this.party = (d.party || []).filter(valid); this.box = (d.box || []).filter(valid);
      [...this.party, ...this.box].forEach(c => { c.moves = (c.moves || []).filter(m => MOVES[m]); refreshStats(c); c.hp = Math.min(c.hp, c.stats.hp); });
      this.bag = d.bag || {}; this.money = d.money || 0; this.flags = d.flags || {};
      this.dex = { seen: new Set(d.dex.seen), caught: new Set(d.dex.caught) };
      this.player = d.player; this.respawn = d.respawn || this.respawn;
      this.settings = Object.assign({ qte: true }, d.settings);
      this.world = new World(this);
    } catch (e) { console.error('Partida dañada', e); this.newGame(); }
  },
};

window.addEventListener('load', () => Game.init());
// Errores de "volver al título" lanzados a propósito
window.addEventListener('unhandledrejection', e => { if (e.reason && e.reason.message === '__title__') e.preventDefault(); });
