// =====================================================================
//  UMBRAL — Instancias de criaturas: stats, experiencia, evolución.
// =====================================================================
'use strict';

const MAX_LEVEL = 50;

function expForLevel(l) { return Math.floor(Math.pow(l, 3) * 0.8); }

function calcStats(sp, level) {
  const b = sp.base;
  return {
    hp: Math.floor((b.hp * 2 * level) / 100) + level + 12,
    atk: Math.floor((b.atk * 2 * level) / 100) + 5,
    def: Math.floor((b.def * 2 * level) / 100) + 5,
    spd: Math.floor((b.spd * 2 * level) / 100) + 5,
  };
}

function createCreature(speciesId, level, nickname) {
  const sp = SPECIES_BY_ID[speciesId];
  const c = {
    uid: Math.random().toString(36).slice(2, 10),
    sp: speciesId, level, nick: nickname || null,
    exp: expForLevel(level), status: null,
    moves: [],
  };
  // últimos 4 ataques aprendibles a este nivel
  const learn = sp.learnset.filter(([l]) => l <= level).map(([, m]) => m);
  const uniq = [...new Set(learn)];
  c.moves = uniq.slice(-4);
  c.stats = calcStats(sp, level);
  c.hp = c.stats.hp;
  return c;
}

function species(c) { return SPECIES_BY_ID[c.sp]; }
function cname(c) { return c.nick || species(c).name; }

function refreshStats(c) {
  const old = c.stats ? c.stats.hp : 0;
  c.stats = calcStats(species(c), c.level);
  if (old) c.hp = Math.min(c.stats.hp, c.hp + (c.stats.hp - old));
}

// Gana exp; devuelve lista de eventos {type:'level',level} {type:'learn',move} {type:'evolve',to}
function gainExp(c, amount) {
  const events = [];
  if (c.level >= MAX_LEVEL) return events;
  c.exp += amount;
  while (c.level < MAX_LEVEL && c.exp >= expForLevel(c.level + 1)) {
    c.level++;
    refreshStats(c);
    events.push({ type: 'level', level: c.level });
    for (const [l, m] of species(c).learnset) {
      if (l === c.level && !c.moves.includes(m)) events.push({ type: 'learn', move: m });
    }
  }
  return events;
}

function pendingEvolution(c) {
  const sp = species(c);
  if (sp.evolvesTo && c.level >= sp.evoLevel) return sp.evolvesTo;
  return null;
}

function evolve(c) {
  const to = pendingEvolution(c);
  if (!to) return false;
  const hpFrac = c.hp / c.stats.hp;
  c.sp = to;
  c.stats = calcStats(species(c), c.level);
  c.hp = Math.max(1, Math.round(c.stats.hp * hpFrac));
  return true;
}

function healCreature(c) { c.hp = c.stats.hp; c.status = null; }
