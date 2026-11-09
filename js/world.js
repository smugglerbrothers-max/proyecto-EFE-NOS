// =====================================================================
//  UMBRAL — Mundo: mapa, zonas, NPCs, movimiento y render.
// =====================================================================
'use strict';

const T = { FLOOR: 0, TREE: 1, GRASS: 2, WATER: 3, PATH: 4, TOMB: 5, ROCK: 6, HOUSE: 7, ALTAR: 8, STONE: 9, BONES: 10, PILLAR: 11 };
const SOLID = new Set([T.TREE, T.WATER, T.TOMB, T.ROCK, T.HOUSE, T.ALTAR, T.PILLAR]);
const ENCOUNTER_TILES = new Set([T.GRASS, T.BONES]);
const TILE = 48;
const MAP_W = 56, MAP_H = 74;
const CX = 28; // columna de los pasos entre zonas

const ZONES = [
  { id: 'cripta',     name: 'Cripta del Umbral',   rect: [16, 1, 24, 5],  floor: T.STONE, grass: T.BONES, gd: 0.22, obst: T.PILLAR, od: 0.05, lv: [20, 26] },
  { id: 'cumbres',    name: 'Cumbres de Ceniza',   rect: [5, 8, 46, 11],  floor: T.FLOOR, grass: T.GRASS, gd: 0.42, obst: T.ROCK, od: 0.10, lv: [14, 19] },
  { id: 'cementerio', name: 'Cementerio Hundido',  rect: [5, 21, 46, 12], floor: T.FLOOR, grass: T.GRASS, gd: 0.40, obst: T.TOMB, od: 0.11, lv: [9, 14] },
  { id: 'pantano',    name: 'Pantano de Lágrimas', rect: [5, 35, 46, 12], floor: T.FLOOR, grass: T.GRASS, gd: 0.38, obst: T.WATER, od: 0.14, lv: [5, 9] },
  { id: 'bosque',     name: 'Bosque Marchito',     rect: [5, 49, 46, 12], floor: T.FLOOR, grass: T.GRASS, gd: 0.42, obst: T.TREE, od: 0.12, lv: [2, 5] },
  { id: 'aldea',      name: 'Aldea Ceniza',        rect: [16, 63, 24, 9], floor: T.FLOOR, grass: null, gd: 0, obst: null, od: 0, lv: [1, 1] },
];

const ENCOUNTERS = {
  bosque: ['chupacabra_1', 'cadejo_1', 'gul_1', 'harpia_1', 'nahual_1', 'tikbalang_1', 'baku_1'],
  pantano: ['kraken_1', 'nuckelavee_1', 'lamia_1', 'llorona_1', 'ammit_1', 'jorogumo_1', 'draugr_1', 'leviatan_1'],
  cementerio: ['banshee_1', 'strigoi_1', 'gashadokuro_1', 'tunche_1', 'rokurokubi_1', 'aswang_1', 'mara_1', 'gul_2', 'cadejo_2'],
  cumbres: ['wendigo_1', 'gorgona_1', 'fenrir_1', 'manticora_1', 'quimera_1', 'tzitzimitl_1', 'cerbero_1', 'moloch_1', 'tiamat_1'],
  cripta: ['ifrit_2', 'ahuizotl_2', 'basilisco_2', 'chupacabra_2', 'banshee_2', 'strigoi_2', 'leviatan_2', 'jorogumo_2', 'mara_2', 'gashadokuro_2', 'nahual_2', 'draugr_2'],
};

function zoneAt(y) {
  for (const z of ZONES) { const [, zy, , zh] = z.rect; if (y >= zy - 1 && y <= zy + zh) return z; }
  return ZONES[ZONES.length - 1];
}

// ---------------------------------------------------------------------
//  Generación del mapa (determinista)
// ---------------------------------------------------------------------
function buildMap() {
  const rnd = Art.seeded('umbral-mapa-v1');
  const m = Array.from({ length: MAP_H }, () => new Array(MAP_W).fill(T.TREE));
  const set = (x, y, v) => { if (x >= 0 && y >= 0 && x < MAP_W && y < MAP_H) m[y][x] = v; };
  const pathX = {};
  // ruido de valor simple
  const noise = (x, y, s) => { const n = Math.sin(x * 0.37 + s) * Math.cos(y * 0.41 - s * 1.3) + Math.sin((x + y) * 0.19 + s * 2.1) * 0.6; return (n + 1.6) / 3.2; };

  ZONES.forEach((z, zi) => {
    const [x0, y0, w, h] = z.rect;
    for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) set(x, y, z.floor);
    if (z.id === 'aldea') return;
    // maleza y obstáculos
    const s = zi * 3.7 + 1;
    for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) {
      const n = noise(x, y, s);
      if (z.grass !== null && n > 1 - z.gd) set(x, y, z.grass);
      else if (z.obst !== null && rnd() < z.od) set(x, y, z.obst);
    }
    // bordes irregulares
    for (let x = x0; x < x0 + w; x++) { if (rnd() < 0.35) set(x, y0, T.TREE); if (rnd() < 0.35) set(x, y0 + h - 1, T.TREE); }
    for (let y = y0; y < y0 + h; y++) { if (rnd() < 0.35) set(x0, y, T.TREE); if (rnd() < 0.35) set(x0 + w - 1, y, T.TREE); }
    // camino serpenteante
    let px = CX;
    for (let y = y0 + h - 1; y >= y0; y--) {
      const target = y === y0 ? CX : Math.round(CX + Math.sin(y * 0.55 + s) * Math.min(14, w / 2 - 4));
      while (px !== target) { set(px, y, T.PATH); px += Math.sign(target - px); }
      set(px, y, T.PATH);
      pathX[y] = px;
    }
  });
  // pasos entre zonas
  for (let y = 0; y < MAP_H; y++) if (m[y][CX] === T.TREE) {
    const z = ZONES.find(z => y >= z.rect[1] - 3 && y < z.rect[1]);
    if (z) set(CX, y, T.PATH);
  }
  // aldea
  const A = { x: 16, y: 63 };
  for (let y = 63; y < 72; y++) set(CX, y, T.PATH);
  for (let x = 19; x < 38; x++) set(x, 68, T.PATH);
  const house = (hx, hy, hw, hh) => { for (let y = hy; y < hy + hh; y++) for (let x = hx; x < hx + hw; x++) set(x, y, T.HOUSE); };
  house(18, 64, 4, 3); house(34, 64, 4, 3); house(19, 69, 3, 2); house(35, 69, 3, 2);
  for (let x = 17; x < 40; x++) for (let y = 63; y < 72; y++) if (m[y][x] === T.FLOOR && rnd() < 0.06) set(x, y, T.TOMB);
  set(25, 65, T.ALTAR); set(26, 66, T.FLOOR); set(25, 66, T.FLOOR); set(24, 66, T.FLOOR);

  // conecta un punto con el camino
  const connect = (x, y) => {
    const tx = pathX[y] !== undefined ? pathX[y] : CX;
    let cx = x;
    while (cx !== tx) { cx += Math.sign(tx - cx); if (SOLID.has(m[y][cx])) set(cx, y, T.FLOOR); }
  };
  const clearAround = (x, y) => { for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (SOLID.has(m[y + dy][x + dx])) set(x + dx, y + dy, T.FLOOR); };
  // altares extra
  for (const [x, y] of [[33, 30], [33, 16], [33, 44]]) { clearAround(x, y + 1); set(x, y, T.ALTAR); connect(x, y + 1); }
  return { m, connect, clearAround, pathX };
}

// ---------------------------------------------------------------------
//  NPCs
// ---------------------------------------------------------------------
function L(id, lv) { return () => createCreature(id, lv); }
function buildNPCs(map) {
  const npcs = [
    { id: 'curandera', x: 26, y: 66, look: 'healer', name: 'La Curandera', kind: 'healer' },
    { id: 'mercader', x: 32, y: 67, look: 'merchant', name: 'Mercader de Huesos', kind: 'shop' },
    { id: 'viejo', x: 30, y: 70, look: 'elder', name: 'Anciano Tuerto', kind: 'talk', lines: [
      'Dicen que al norte, tras la Cripta, duerme el Sumo Sacerdote del Umbral.',
      'Las criaturas cambian al alcanzar el nivel 9... y otra vez al nivel 18. Se vuelven... peores.',
      'Si debilitas a una criatura antes de lanzar un sello, será más fácil atraparla.'] },
    { id: 'nina', x: 21, y: 67, look: 'child', name: 'Niña Pálida', kind: 'talk', lines: [
      'Mi gato volvió del bosque con tres ojos. Mamá dice que no lo mire.',
      'Si tocas en el momento justo cuando aparece el anillo... ¡las criaturas golpean más fuerte!'] },
    // Guardianes de paso
    { id: 'g1', x: CX, y: 47, look: 'gravedigger', name: 'Sepulturero Bruno', kind: 'trainer', gate: true, reward: 300,
      team: [L('cadejo_1', 6), L('chupacabra_1', 7)],
      lines: { intro: 'Nadie cruza al pantano sin enterrar antes a sus miedos. Empezaré por los tuyos.', lose: 'Bah... cava tu propia tumba más adelante, entonces.' } },
    { id: 'g2', x: CX, y: 33, look: 'witch', name: 'Bruja Inés', kind: 'trainer', gate: true, reward: 650,
      team: [L('lamia_1', 10), L('kraken_2', 11), L('llorona_2', 12)],
      lines: { intro: 'Las lágrimas del pantano son mías. ¿Quieres sumar las tuyas?', lose: 'El cementerio te espera, niño. Y nunca devuelve a nadie.' } },
    { id: 'g3', x: CX, y: 19, look: 'priest', name: 'Exorcista Ramiro', kind: 'trainer', gate: true, reward: 1100,
      team: [L('banshee_2', 15), L('gashadokuro_2', 15), L('mara_2', 16), L('strigoi_2', 17)],
      lines: { intro: 'He expulsado demonios de cien cuerpos. Ahora los colecciono.', lose: 'Arriba, en las cumbres, ni mis rezos llegan. Ve con cuidado.' } },
    { id: 'g4', x: CX, y: 6, look: 'knight', name: 'Caballera Ceniza Úrsula', kind: 'trainer', gate: true, reward: 1700,
      team: [L('fenrir_2', 21), L('cerbero_2', 22), L('moloch_2', 22), L('wendigo_2', 23)],
      lines: { intro: 'Juré custodiar la Cripta hasta convertirme en polvo. Aún no lo soy.', lose: 'Pasa... y que el Sacerdote tenga piedad. No la tendrá.' } },
    { id: 'boss', x: CX, y: 2, look: 'boss', name: 'Sumo Sacerdote del Umbral', kind: 'trainer', boss: true, reward: 5000,
      team: 'boss',
      lines: { intro: 'Así que tú eres quien ha estado sellando a mis hijos... Bienvenido al Umbral. De aquí nadie sale entero.', lose: '¡Imposible! El Umbral... se cierra... Eres... el nuevo guardián...' } },
    // Opcionales
    { id: 'o1', x: 14, y: 55, look: 'child', name: 'Niño Perdido', kind: 'trainer', reward: 150,
      team: [L('harpia_1', 4), L('baku_1', 5)],
      lines: { intro: 'No encuentro el camino a casa... ¿Juegas conmigo? ¡Para siempre!', lose: 'Je, je... mañana te busco otra vez.' } },
    { id: 'o2', x: 42, y: 40, look: 'drowned', name: 'Pescador Ahogado', kind: 'trainer', reward: 400,
      team: [L('ammit_1', 9), L('draugr_1', 10)],
      lines: { intro: 'Glub... lo que pesqué... aún tiene hambre...', lose: 'Glub... vuelvo al fondo...' } },
    { id: 'o3', x: 14, y: 26, look: 'nun', name: 'Monja sin Rostro', kind: 'trainer', reward: 800,
      team: [L('rokurokubi_2', 14), L('tunche_2', 14)],
      lines: { intro: '......... (no tiene boca, pero la oyes en tu cabeza: «reza»)', lose: '(La monja se inclina... y su cuello sigue estirándose hacia arriba.)' } },
    { id: 'o4', x: 42, y: 12, look: 'hunter', name: 'Cazador de Brujas', kind: 'trainer', reward: 1300,
      team: [L('manticora_2', 19), L('tzitzimitl_2', 19), L('quimera_2', 20)],
      lines: { intro: 'Huelo a azufre en ti. ¡Arderás como todos los demás!', lose: 'Tal vez... el monstruo no eras tú.' } },
  ];
  for (const n of npcs) {
    if (!n.gate && !n.boss) { map.clearAround(n.x, n.y); map.connect(n.x, n.y); }
    if (SOLID.has(map.m[n.y][n.x])) map.m[n.y][n.x] = T.FLOOR;
    n.dir = 'down';
  }
  return npcs;
}

function bossTeam(game) {
  const starterLine = game.flags.starter || 'ifrit';
  const counter = { ifrit: 'ahuizotl_3', ahuizotl: 'basilisco_3', basilisco: 'ifrit_3' }[starterLine];
  return [createCreature('quimera_3', 26), createCreature('gorgona_3', 27), createCreature('leviatan_3', 27),
    createCreature('aswang_3', 28), createCreature('tiamat_3', 29), createCreature(counter, 31)];
}

// ---------------------------------------------------------------------
//  Render de tiles (pre-renderizado con variantes)
// ---------------------------------------------------------------------
const TileArt = (() => {
  const cache = {};
  function make(type, variant, zoneId) {
    const key = type + ':' + variant + ':' + zoneId;
    if (cache[key]) return cache[key];
    const c = document.createElement('canvas'); c.width = c.height = TILE;
    const g = c.getContext('2d');
    const r = Art.seeded(key);
    const groundCol = { bosque: '#1f2616', pantano: '#18231f', cementerio: '#221e24', cumbres: '#2a1a14', cripta: '#1a1218', aldea: '#2a2218' }[zoneId] || '#222';
    const ground = () => {
      g.fillStyle = groundCol; g.fillRect(0, 0, TILE, TILE);
      for (let i = 0; i < 10; i++) { g.fillStyle = `rgba(0,0,0,${0.1 + r() * 0.2})`; g.fillRect(r() * TILE, r() * TILE, 2 + r() * 4, 2 + r() * 3); }
      for (let i = 0; i < 4; i++) { g.fillStyle = 'rgba(255,255,255,0.03)'; g.fillRect(r() * TILE, r() * TILE, 3, 2); }
    };
    switch (type) {
      case T.FLOOR: ground(); break;
      case T.PATH: {
        ground();
        g.fillStyle = zoneId === 'cumbres' ? '#3a2a20' : '#3a3026';
        g.fillRect(0, 0, TILE, TILE);
        for (let i = 0; i < 6; i++) { g.fillStyle = 'rgba(0,0,0,0.25)'; g.beginPath(); g.ellipse(r() * TILE, r() * TILE, 4 + r() * 5, 3 + r() * 3, 0, 0, 7); g.fill(); }
        break;
      }
      case T.STONE: {
        g.fillStyle = '#231a22'; g.fillRect(0, 0, TILE, TILE);
        g.strokeStyle = '#120a10'; g.lineWidth = 2;
        g.strokeRect(1, 1, TILE / 2 - 1, TILE / 2 - 1); g.strokeRect(TILE / 2, 1, TILE / 2 - 1, TILE / 2 - 1);
        g.strokeRect(1, TILE / 2, TILE - 2, TILE / 2 - 1);
        if (variant % 3 === 0) { g.fillStyle = 'rgba(120,10,20,0.4)'; g.beginPath(); g.ellipse(30, 30, 8, 5, 0, 0, 7); g.fill(); }
        break;
      }
      case T.GRASS: {
        ground();
        const col = { bosque: ['#2f4a1e', '#3d5a26'], pantano: ['#24443a', '#2f5a48'], cementerio: ['#3a3a2a', '#4a4632'], cumbres: ['#4a2a1a', '#5a3420'] }[zoneId] || ['#334', '#445'];
        for (let i = 0; i < 16; i++) {
          const x = r() * TILE, y = 10 + r() * (TILE - 10), h = 12 + r() * 14;
          g.strokeStyle = col[i % 2]; g.lineWidth = 2;
          g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + (r() - 0.5) * 8, y - h / 2, x + (r() - 0.5) * 10, y - h); g.stroke();
        }
        if (variant % 4 === 0) { g.fillStyle = '#7a1a1a'; g.beginPath(); g.arc(r() * TILE, r() * TILE, 2.5, 0, 7); g.fill(); }
        break;
      }
      case T.BONES: {
        g.fillStyle = '#231a22'; g.fillRect(0, 0, TILE, TILE);
        for (let i = 0; i < 6; i++) {
          g.save(); g.translate(r() * TILE, r() * TILE); g.rotate(r() * 6);
          g.fillStyle = '#c8bca0'; g.fillRect(-8, -1.5, 16, 3);
          g.beginPath(); g.arc(-8, -2, 2.5, 0, 7); g.arc(-8, 2, 2.5, 0, 7); g.arc(8, -2, 2.5, 0, 7); g.arc(8, 2, 2.5, 0, 7); g.fill();
          g.restore();
        }
        if (variant % 3 === 0) { g.fillStyle = '#d8ccb0'; g.beginPath(); g.arc(24, 24, 8, 0, 7); g.fill(); g.fillStyle = '#000'; g.fillRect(19, 22, 4, 4); g.fillRect(25, 22, 4, 4); }
        break;
      }
      case T.TREE: {
        ground();
        g.fillStyle = 'rgba(0,0,0,0.4)'; g.beginPath(); g.ellipse(24, 42, 16, 5, 0, 0, 7); g.fill();
        g.strokeStyle = '#120c08'; g.lineCap = 'round';
        g.lineWidth = 7; g.beginPath(); g.moveTo(24, 44); g.lineTo(24 + (r() - 0.5) * 6, 14); g.stroke();
        g.lineWidth = 3;
        for (let i = 0; i < 5; i++) {
          const y = 14 + r() * 20, d = r() < 0.5 ? -1 : 1;
          g.beginPath(); g.moveTo(24, y); g.lineTo(24 + d * (8 + r() * 14), y - 6 - r() * 12); g.lineTo(24 + d * (14 + r() * 10), y - 14 - r() * 6); g.stroke();
        }
        if (variant % 5 === 0) { g.strokeStyle = '#8a7a6a'; g.lineWidth = 1; g.beginPath(); g.moveTo(14, 18); g.lineTo(14, 30); g.stroke(); g.fillStyle = '#3a2a2a'; g.fillRect(11, 30, 6, 10); }
        break;
      }
      case T.WATER: {
        g.fillStyle = '#0b1c22'; g.fillRect(0, 0, TILE, TILE);
        for (let i = 0; i < 5; i++) { g.strokeStyle = 'rgba(80,160,180,0.25)'; g.lineWidth = 1.5; g.beginPath(); const y = r() * TILE; g.moveTo(r() * 20, y); g.lineTo(20 + r() * 28, y); g.stroke(); }
        if (variant % 4 === 0) { g.fillStyle = '#3fd0ff'; g.globalAlpha = 0.6; g.beginPath(); g.arc(14, 30, 2, 0, 7); g.arc(20, 30, 2, 0, 7); g.fill(); g.globalAlpha = 1; }
        break;
      }
      case T.TOMB: {
        ground();
        g.fillStyle = 'rgba(0,0,0,0.4)'; g.beginPath(); g.ellipse(24, 42, 14, 4, 0, 0, 7); g.fill();
        if (variant % 3 === 0) {
          g.fillStyle = '#5a5660'; g.fillRect(21, 8, 6, 34); g.fillRect(12, 16, 24, 6);
        } else {
          g.fillStyle = '#4a4650'; g.beginPath(); g.moveTo(12, 42); g.lineTo(12, 18); g.arc(24, 18, 12, Math.PI, 0); g.lineTo(36, 42); g.closePath(); g.fill();
          g.fillStyle = '#2a2630'; g.fillRect(18, 22, 12, 2); g.fillRect(18, 27, 12, 2); g.fillRect(18, 32, 8, 2);
        }
        g.fillStyle = '#2a3a1a'; g.fillRect(10, 40, 28, 3);
        break;
      }
      case T.ROCK: {
        ground();
        g.fillStyle = '#3a2a24'; g.beginPath(); g.moveTo(6, 42); g.lineTo(10, 18); g.lineTo(22, 8); g.lineTo(38, 14); g.lineTo(44, 42); g.closePath(); g.fill();
        g.strokeStyle = '#ff6b1a'; g.globalAlpha = 0.6; g.lineWidth = 1.5; g.beginPath(); g.moveTo(16, 38); g.lineTo(22, 24); g.lineTo(30, 30); g.lineTo(34, 18); g.stroke(); g.globalAlpha = 1;
        break;
      }
      case T.PILLAR: {
        g.fillStyle = '#231a22'; g.fillRect(0, 0, TILE, TILE);
        g.fillStyle = '#4a3a46'; g.fillRect(12, 4, 24, 40); g.fillStyle = '#5a4a56'; g.fillRect(8, 2, 32, 6); g.fillRect(8, 40, 32, 6);
        g.fillStyle = '#2a1a26'; g.fillRect(17, 10, 3, 28); g.fillRect(28, 10, 3, 28);
        break;
      }
      case T.HOUSE: {
        g.fillStyle = '#2a1a14'; g.fillRect(0, 0, TILE, TILE);
        g.strokeStyle = '#1a0e0a'; g.lineWidth = 2;
        for (let y = 6; y < TILE; y += 12) { g.beginPath(); g.moveTo(0, y); g.lineTo(TILE, y); g.stroke(); }
        if (variant % 3 === 0) { g.fillStyle = '#e8a040'; g.globalAlpha = 0.8; g.fillRect(16, 16, 14, 14); g.globalAlpha = 1; g.strokeStyle = '#1a0e0a'; g.strokeRect(16, 16, 14, 14); g.beginPath(); g.moveTo(23, 16); g.lineTo(23, 30); g.stroke(); }
        break;
      }
      case T.ALTAR: {
        ground();
        g.fillStyle = '#3a3036'; g.fillRect(8, 22, 32, 20); g.fillStyle = '#4a4046'; g.fillRect(6, 18, 36, 6);
        g.fillStyle = '#7a0a1a'; g.fillRect(14, 26, 20, 3);
        g.fillStyle = '#e8d8b0'; g.fillRect(12, 8, 4, 10); g.fillRect(32, 8, 4, 10);
        break;
      }
    }
    cache[key] = c;
    return c;
  }
  return { make };
})();

// Personajes (jugador / NPC) dibujados con vectores
function drawCharacter(ctx, x, y, look, dir, t, moving) {
  const bob = moving ? Math.abs(Math.sin(t * 12)) * 3 : Math.sin(t * 2) * 0.8;
  const pal = {
    player: ['#2a1e2e', '#5a1a1a', '#d8b89a'], healer: ['#3a2a1a', '#6a5a2a', '#c8a888'], merchant: ['#2a2a1a', '#7a5a1a', '#b89878'],
    elder: ['#2a2a2a', '#4a4a4a', '#c8b8a8'], child: ['#3a1a2a', '#8a8a9a', '#e8e0e8'], gravedigger: ['#1a1a14', '#3a3a2a', '#b8a888'],
    witch: ['#1a2a1a', '#2a4a2a', '#a8c898'], priest: ['#0a0a0a', '#e8e8e8', '#d8c8b8'], knight: ['#3a3a40', '#8a8a90', '#c8b8a8'],
    boss: ['#2a0008', '#a01020', '#e8e0d8'], drowned: ['#1a2a2a', '#3a5a5a', '#8ab8b8'], nun: ['#0a0a0a', '#e8e8e8', '#f0f0f0'], hunter: ['#2a1a0a', '#6a3a1a', '#c8a888'],
  }[look] || ['#333', '#555', '#ccc'];
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = 'rgba(0,0,0,0.45)'; ctx.beginPath(); ctx.ellipse(0, 20, 13, 5, 0, 0, 7); ctx.fill();
  ctx.translate(0, -bob);
  // capa
  ctx.fillStyle = pal[0];
  ctx.beginPath(); ctx.moveTo(-12, 20); ctx.lineTo(-9, -6); ctx.lineTo(9, -6); ctx.lineTo(12, 20); ctx.closePath(); ctx.fill();
  ctx.fillStyle = pal[1]; ctx.fillRect(-9, 2, 18, 3);
  // capucha / cabeza
  const hood = ['player', 'healer', 'witch', 'boss', 'nun', 'gravedigger', 'drowned'].includes(look);
  ctx.fillStyle = hood ? pal[0] : pal[2];
  ctx.beginPath(); ctx.arc(0, -12, 10, 0, 7); ctx.fill();
  if (look === 'witch') { ctx.fillStyle = pal[0]; ctx.beginPath(); ctx.moveTo(-14, -16); ctx.lineTo(14, -16); ctx.lineTo(4, -38); ctx.closePath(); ctx.fill(); }
  if (look === 'knight') { ctx.fillStyle = pal[1]; ctx.fillRect(-10, -22, 20, 14); ctx.fillStyle = '#000'; ctx.fillRect(-7, -16, 14, 2); }
  if (look === 'boss') { ctx.fillStyle = '#c8a040'; ctx.beginPath(); ctx.moveTo(-8, -20); ctx.lineTo(-6, -32); ctx.lineTo(0, -24); ctx.lineTo(6, -32); ctx.lineTo(8, -20); ctx.fill(); }
  if (look === 'nun') { ctx.fillStyle = pal[1]; ctx.fillRect(-8, -16, 16, 3); }
  if (look === 'hunter') { ctx.fillStyle = '#1a1008'; ctx.fillRect(-14, -22, 28, 4); ctx.fillRect(-8, -30, 16, 9); }
  if (dir !== 'up') {
    ctx.fillStyle = hood ? '#05030a' : pal[2];
    if (hood) { ctx.beginPath(); ctx.ellipse(dir === 'left' ? -3 : dir === 'right' ? 3 : 0, -11, 6, 7, 0, 0, 7); ctx.fill(); }
    const ex = dir === 'left' ? -3 : dir === 'right' ? 3 : 0;
    const eyeCol = look === 'boss' ? '#ff2020' : look === 'nun' ? null : look === 'player' ? '#ffcf6b' : '#ddd';
    if (eyeCol) {
      ctx.fillStyle = eyeCol; ctx.shadowColor = eyeCol; ctx.shadowBlur = look === 'boss' || look === 'player' ? 6 : 0;
      ctx.fillRect(ex - 4, -13, 2.5, 2.5); ctx.fillRect(ex + 2, -13, 2.5, 2.5);
      ctx.shadowBlur = 0;
    }
  }
  // farol del jugador
  if (look === 'player') {
    const lx = dir === 'left' ? -14 : 14, ly = 4 + Math.sin(t * 3) * 1.5;
    ctx.strokeStyle = '#555'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(lx, ly - 8); ctx.lineTo(lx, ly - 3); ctx.stroke();
    ctx.fillStyle = '#ffcf6b'; ctx.shadowColor = '#ffb03b'; ctx.shadowBlur = 16;
    ctx.fillRect(lx - 3, ly - 3, 6, 8); ctx.shadowBlur = 0;
  }
  if (look === 'merchant') { ctx.fillStyle = '#5a3a1a'; ctx.fillRect(-16, -4, 8, 12); }
  ctx.restore();
}

// ---------------------------------------------------------------------
//  Escena del mundo
// ---------------------------------------------------------------------
class World {
  constructor(game) {
    this.game = game;
    this.map = buildMap();
    this.npcs = buildNPCs(this.map);
    this.t = 0;
    this.moving = null;
    this.busy = false;
    this.light = document.createElement('canvas');
    this.zoneShown = null;
    this.zoneBanner = 0;
  }
  get p() { return this.game.player; }
  tile(x, y) { if (x < 0 || y < 0 || x >= MAP_W || y >= MAP_H) return T.TREE; return this.map.m[y][x]; }
  npcAt(x, y) { return this.npcs.find(n => n.x === x && n.y === y && !this.game.flags['gone_' + n.id]); }
  blocked(x, y) { return SOLID.has(this.tile(x, y)) || !!this.npcAt(x, y); }

  update(dt) {
    this.t += dt;
    this.zoneBanner = Math.max(0, this.zoneBanner - dt);
    const p = this.p;
    if (this.moving) {
      this.moving.p += dt / 0.17;
      if (this.moving.p >= 1) {
        p.x = this.moving.tx; p.y = this.moving.ty; this.moving = null;
        this.onStep();
      }
      return;
    }
    if (this.busy) return;
    const H = Input.held;
    let dx = 0, dy = 0, dir = null;
    if (H.up) { dy = -1; dir = 'up'; } else if (H.down) { dy = 1; dir = 'down'; }
    else if (H.left) { dx = -1; dir = 'left'; } else if (H.right) { dx = 1; dir = 'right'; }
    if (dir) {
      p.dir = dir;
      const nx = p.x + dx, ny = p.y + dy;
      if (!this.blocked(nx, ny)) { this.moving = { fx: p.x, fy: p.y, tx: nx, ty: ny, p: 0 }; if (Math.random() < 0.5) Sfx.play('step'); }
    }
  }

  onStep() {
    const p = this.p;
    const z = zoneAt(p.y);
    if (z.id !== this.zoneShown) { this.zoneShown = z.id; this.zoneBanner = 2.5; this.game.lastZone = z.id; }
    if (ENCOUNTER_TILES.has(this.tile(p.x, p.y)) && Math.random() < 0.1) {
      const list = ENCOUNTERS[z.id];
      if (list) {
        const id = list[Math.floor(Math.random() * list.length)];
        const lv = z.lv[0] + Math.floor(Math.random() * (z.lv[1] - z.lv[0] + 1));
        this.game.startBattle({ wild: createCreature(id, lv), bg: ZONE_BG[z.id] });
      }
    }
  }

  async interact() {
    if (this.busy || this.moving) return;
    const p = this.p;
    const d = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] }[p.dir];
    const fx = p.x + d[0], fy = p.y + d[1];
    const n = this.npcAt(fx, fy);
    if (this.tile(fx, fy) === T.ALTAR) {
      this.busy = true;
      await UI.say('Un altar cubierto de velas negras. Ofreces una gota de sangre...');
      this.game.healParty(); Sfx.play('heal');
      this.game.respawn = { x: p.x, y: p.y };
      await UI.say('Tus criaturas se recuperan por completo. (Progreso guardado)');
      this.game.save();
      this.busy = false;
      return;
    }
    if (!n) return;
    this.busy = true;
    n.dir = { up: 'down', down: 'up', left: 'right', right: 'left' }[p.dir];
    await this.game.talkTo(n);
    this.busy = false;
  }

  render(ctx, W, H) {
    const p = this.p;
    let px = p.x, py = p.y;
    if (this.moving) { const m = this.moving; px = lerp(m.fx, m.tx, m.p); py = lerp(m.fy, m.ty, m.p); }
    const camX = Math.round(px * TILE + TILE / 2 - W / 2), camY = Math.round(py * TILE + TILE / 2 - H / 2);
    ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);
    const x0 = Math.floor(camX / TILE), y0 = Math.floor(camY / TILE);
    const x1 = x0 + Math.ceil(W / TILE) + 1, y1 = y0 + Math.ceil(H / TILE) + 1;
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const tt = this.tile(x, y);
      const z = zoneAt(Math.max(0, y));
      const v = ((x * 7 + y * 13) ^ (x * y)) & 7;
      ctx.drawImage(TileArt.make(tt, v, z.id), x * TILE - camX, y * TILE - camY);
      if (tt === T.ALTAR) {
        const fl = 0.7 + Math.sin(this.t * 9 + x) * 0.3;
        ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = `rgba(255,170,60,${0.8 * fl})`;
        ctx.beginPath(); ctx.arc(x * TILE - camX + 14, y * TILE - camY + 7, 3, 0, 7); ctx.arc(x * TILE - camX + 34, y * TILE - camY + 7, 3, 0, 7); ctx.fill(); ctx.restore();
      }
      if (tt === T.GRASS && this.moving === null && x === p.x && y === p.y) { /* jugador sobre maleza */ }
    }
    // tejados de las casas
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      if (this.tile(x, y) === T.HOUSE && this.tile(x, y - 1) !== T.HOUSE) {
        const sx = x * TILE - camX, sy = y * TILE - camY;
        ctx.fillStyle = '#3a1612'; ctx.beginPath(); ctx.moveTo(sx - 2, sy + 10); ctx.lineTo(sx + TILE / 2, sy - 18); ctx.lineTo(sx + TILE + 2, sy + 10); ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#4a1e18'; ctx.fillRect(sx - 2, sy + 6, TILE + 4, 8);
        if (this.tile(x, y + 1) !== T.HOUSE && (x + y) % 2 === 0) { ctx.fillStyle = '#120806'; ctx.fillRect(sx + 16, sy + 22, 16, 26); }
      }
      if (this.tile(x, y) === T.HOUSE && this.tile(x, y + 1) !== T.HOUSE && this.tile(x - 1, y) === T.HOUSE && this.tile(x + 1, y) !== T.HOUSE) {
        const sx = x * TILE - camX, sy = y * TILE - camY;
        ctx.fillStyle = '#120806'; ctx.fillRect(sx + 14, sy + 18, 18, 30); ctx.fillStyle = '#c8a040'; ctx.fillRect(sx + 27, sy + 32, 3, 3);
      }
    }
    // entidades ordenadas por y
    const ents = this.npcs.filter(n => !this.game.flags['gone_' + n.id]).map(n => ({ y: n.y, draw: () => drawCharacter(ctx, n.x * TILE - camX + 24, n.y * TILE - camY + 22, n.look, n.dir, this.t + n.x, false) }));
    ents.push({ y: py, draw: () => drawCharacter(ctx, px * TILE - camX + 24, py * TILE - camY + 22, 'player', p.dir, this.t, !!this.moving) });
    ents.sort((a, b) => a.y - b.y).forEach(e => e.draw());
    // maleza delante del jugador (se "hunde")
    if (ENCOUNTER_TILES.has(this.tile(Math.round(px), Math.round(py)))) {
      ctx.save(); ctx.beginPath(); ctx.rect(Math.round(px) * TILE - camX, Math.round(py) * TILE - camY + 30, TILE, 18); ctx.clip();
      const tx = Math.round(px), ty = Math.round(py);
      ctx.drawImage(TileArt.make(this.tile(tx, ty), ((tx * 7 + ty * 13) ^ (tx * ty)) & 7, zoneAt(ty).id), tx * TILE - camX, ty * TILE - camY);
      ctx.restore();
    }
    // signos sobre entrenadores no vencidos
    for (const n of this.npcs) {
      if (n.kind === 'trainer' && !this.game.flags['beat_' + n.id] && !this.game.flags['gone_' + n.id]) {
        const bx = n.x * TILE - camX + 24, by = n.y * TILE - camY - 22 + Math.sin(this.t * 4) * 3;
        ctx.fillStyle = '#c21d1d'; ctx.font = 'bold 18px serif'; ctx.textAlign = 'center'; ctx.fillText('☠', bx, by);
      }
    }
    // niebla
    ctx.save();
    for (let i = 0; i < 5; i++) {
      const fx = ((this.t * (10 + i * 5) + i * 300 - camX * 0.3) % (W + 600)) - 300;
      const fy = ((i * 170 - camY * 0.3) % (H + 200) + H + 200) % (H + 200) - 100;
      const g = ctx.createRadialGradient(fx, fy, 10, fx, fy, 260);
      g.addColorStop(0, 'rgba(140,130,160,0.10)'); g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g; ctx.fillRect(fx - 260, fy - 260, 520, 520);
    }
    ctx.restore();
    // oscuridad + farol
    const L = this.light;
    if (L.width !== W) { L.width = W; L.height = H; }
    const lc = L.getContext('2d');
    lc.globalCompositeOperation = 'source-over';
    const zid = zoneAt(p.y).id;
    lc.fillStyle = zid === 'aldea' ? 'rgba(5,2,10,0.55)' : zid === 'cripta' ? 'rgba(5,0,5,0.86)' : 'rgba(4,2,8,0.78)';
    lc.clearRect(0, 0, W, H); lc.fillRect(0, 0, W, H);
    lc.globalCompositeOperation = 'destination-out';
    const flick = 1 + Math.sin(this.t * 13) * 0.02 + Math.sin(this.t * 7) * 0.02;
    const hole = (x, y, r) => { const g = lc.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, 'rgba(0,0,0,1)'); g.addColorStop(0.55, 'rgba(0,0,0,0.75)'); g.addColorStop(1, 'rgba(0,0,0,0)'); lc.fillStyle = g; lc.fillRect(x - r, y - r, r * 2, r * 2); };
    hole(px * TILE - camX + 24, py * TILE - camY + 22, 230 * flick);
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if (this.tile(x, y) === T.ALTAR) hole(x * TILE - camX + 24, y * TILE - camY + 10, 150 * flick);
    for (let i = 0; i < 12; i++) { // luciérnagas / almas
      const fx = (i * 211 + Math.sin(this.t * 0.5 + i) * 80 - camX * 0.6) % W, fy = (i * 137 + Math.cos(this.t * 0.4 + i * 2) * 60 - camY * 0.6) % H;
      const ax = (fx + W) % W, ay = (fy + H) % H;
      hole(ax, ay, 14);
    }
    ctx.drawImage(L, 0, 0);
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 12; i++) {
      const fx = (i * 211 + Math.sin(this.t * 0.5 + i) * 80 - camX * 0.6) % W, fy = (i * 137 + Math.cos(this.t * 0.4 + i * 2) * 60 - camY * 0.6) % H;
      ctx.fillStyle = `rgba(150,255,200,${0.4 + Math.sin(this.t * 3 + i) * 0.3})`;
      ctx.beginPath(); ctx.arc((fx + W) % W, (fy + H) % H, 2, 0, 7); ctx.fill();
    }
    ctx.restore();
    // viñeta
    const vg = ctx.createRadialGradient(W / 2, H / 2, H * 0.35, W / 2, H / 2, H * 0.85);
    vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,0.6)');
    ctx.fillStyle = vg; ctx.fillRect(0, 0, W, H);
    // cartel de zona
    if (this.zoneBanner > 0) {
      const a = Math.min(1, this.zoneBanner, (2.5 - this.zoneBanner) * 3);
      ctx.save(); ctx.globalAlpha = a;
      ctx.fillStyle = 'rgba(10,4,8,0.85)'; ctx.fillRect(W / 2 - 220, 26, 440, 54);
      ctx.strokeStyle = '#7a1a1a'; ctx.lineWidth = 2; ctx.strokeRect(W / 2 - 220, 26, 440, 54);
      ctx.fillStyle = '#e8d8c8'; ctx.font = 'bold 26px Georgia, serif'; ctx.textAlign = 'center';
      ctx.fillText(zoneAt(p.y).name, W / 2, 62);
      ctx.restore();
    }
  }
}
