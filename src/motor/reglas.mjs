// Reglas de dominio derivadas del original (AUDITORIA.md §5). Cada regla devuelve también su motivo.
import { TRAMOS_LMT, tipoDe } from './catalogo.mjs';
import { obraDe } from './plan.mjs';

const usaEquipoVia = (a, unidades) => (a.recursos ?? []).some((r) => tipoDe(unidades.get(r.unidad))?.esVia);

const postes = (a) => {
  if (!a.posteIni) return null;
  const x = a.posteIni, y = a.posteFin || a.posteIni;
  return { ini: Math.max(x, y), fin: Math.min(x, y) };
};

/** Tramos LMT que toca la actividad (por rango de postes). */
export function tramosDe(a) {
  const p = postes(a);
  if (obraDe(a) !== 'lmt' || !p) return [];
  return TRAMOS_LMT.filter((t) => p.ini >= t.fin && p.fin <= t.ini);
}

/** Igual que Ar/kr del original: el campo explícito manda; si no existe, vía/zona vías/equipo ferroviario. */
export function requierePreventiva(a, unidades) {
  if (a.requierePreventiva != null) return { requiere: !!a.requierePreventiva, motivo: 'Indicado en la actividad.' };
  if (a.disciplina === 'via') return { requiere: true, motivo: 'Disciplina vía.' };
  if (a.zona === 'vias') return { requiere: true, motivo: 'Zona vías.' };
  if (usaEquipoVia(a, unidades)) return { requiere: true, motivo: 'Usa equipo ferroviario.' };
  return { requiere: false, motivo: 'Sin indicación ni condición de vía.' };
}

/**
 * Necesidad de cortada. El original no tiene un campo explícito: se propone `actividad.requiereCortada`.
 * Sin él, el motor solo dice "sí" con equipo ferroviario y "posible" en faja vía; nunca lo da por hecho.
 */
export function requiereCortada(a, unidades) {
  if (a.requiereCortada != null) return { requiere: a.requiereCortada ? 'si' : 'no', motivo: 'Indicado en la actividad.' };
  if (usaEquipoVia(a, unidades)) return { requiere: 'si', motivo: 'Usa equipo ferroviario (Hi-Rail / diplory).' };
  const via = tramosDe(a).filter((t) => t.via);
  if (via.length) return { requiere: 'posible', motivo: `Postes en ${via.map((t) => t.nombre).join(', ')}: confirmar si invade gálibo.` };
  if (obraDe(a) !== 'lmt' && a.zona === 'vias') return { requiere: 'posible', motivo: 'Zona vías.' };
  return { requiere: 'no', motivo: 'Sin equipo ferroviario ni tramo de faja vía.' };
}

/** Duración en días de una partida del Programa: misma fórmula que Ve() del original. */
export function duracionPartida(p) {
  const num = (x) => (typeof x === 'number' && Number.isFinite(x) ? x : 0);
  if (/^hito$/i.test(String(p.unidad ?? ''))) return { dias: 0, faltantes: [] };
  const faltantes = [];
  if (p.cantidad == null || p.cantidad === '') faltantes.push('cantidad');
  if (!num(p.rendimiento)) faltantes.push('rendimiento');
  if (!num(p.equipos)) faltantes.push('equipos');
  if (faltantes.length) return { dias: null, faltantes };
  return { dias: Math.ceil(num(p.cantidad) / (num(p.rendimiento) * num(p.equipos))), faltantes };
}

/** Avance plan vs real de una partida (solo con datos existentes). */
export function avancePartida(p, avanceRegistrado) {
  const ejecutado = avanceRegistrado?.ejecutado ?? p.ejecutado ?? null;
  if (ejecutado == null || !p.cantidad) return { porcentaje: null, ejecutado, faltantes: ['ejecutado o cantidad'] };
  return { porcentaje: Math.round((1000 * ejecutado) / p.cantidad) / 10, ejecutado, cantidad: p.cantidad, faltantes: [] };
}
