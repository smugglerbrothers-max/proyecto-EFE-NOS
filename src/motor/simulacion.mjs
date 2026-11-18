// Simulación de cambios sobre una COPIA del plan. Nunca muta el plan original.
import { conflictos } from './disponibilidad.mjs';
import { sumarDias } from './calendario.mjs';

const OPS = {
  mover(plan, c) {
    const a = plan.actividades.find((x) => x.id === c.actividadId);
    if (!a) throw new Error(`Actividad inexistente: ${c.actividadId}`);
    const cambios = [];
    for (const campo of ['fecha', 'turno', 'horaIni', 'horaFin'])
      if (c[campo] !== undefined && c[campo] !== a[campo]) { cambios.push({ actividadId: a.id, campo, antes: a[campo] ?? null, despues: c[campo] }); a[campo] = c[campo]; }
    return cambios;
  },
  reasignar(plan, c) {
    const a = plan.actividades.find((x) => x.id === c.actividadId);
    const r = a?.recursos.find((x) => x.id === c.asignacionId);
    if (!r) throw new Error(`Asignación inexistente: ${c.actividadId}/${c.asignacionId}`);
    if (!plan.unidades.some((u) => u.id === c.unidadId)) throw new Error(`Unidad inexistente: ${c.unidadId}`);
    const antes = r.unidad; r.unidad = c.unidadId;
    return [{ actividadId: a.id, campo: `recursos[${r.id}].unidad`, antes, despues: c.unidadId }];
  },
  quitarRecurso(plan, c) {
    const a = plan.actividades.find((x) => x.id === c.actividadId);
    const i = a?.recursos.findIndex((x) => x.id === c.asignacionId) ?? -1;
    if (i < 0) throw new Error(`Asignación inexistente: ${c.actividadId}/${c.asignacionId}`);
    const [r] = a.recursos.splice(i, 1);
    return [{ actividadId: a.id, campo: `recursos[${r.id}]`, antes: r.unidad, despues: null }];
  },
  agregarRecurso(plan, c) {
    const a = plan.actividades.find((x) => x.id === c.actividadId);
    if (!a) throw new Error(`Actividad inexistente: ${c.actividadId}`);
    if (!plan.unidades.some((u) => u.id === c.unidadId)) throw new Error(`Unidad inexistente: ${c.unidadId}`);
    const id = c.asignacionId ?? `sim-${a.recursos.length + 1}-${c.unidadId}`;
    a.recursos.push({ id, unidad: c.unidadId });
    return [{ actividadId: a.id, campo: `recursos[${id}]`, antes: null, despues: c.unidadId }];
  },
};

export const OPERACIONES_SIMULABLES = Object.keys(OPS);

/**
 * @param plan  plan oficial (no se modifica)
 * @param cambios  [{op:'mover'|'reasignar'|'quitarRecurso'|'agregarRecurso', ...}]
 * @returns {plan, diff, conflictos:{nuevos, resueltos, persistentes}, rango}
 */
export function simular(plan, cambios) {
  const copia = structuredClone(plan);
  const diff = [];
  for (const c of cambios) {
    if (!OPS[c.op]) throw new Error(`Operación no simulable: ${c.op}`);
    diff.push(...OPS[c.op](copia, c));
  }
  const fechas = new Set();
  for (const d of diff) {
    fechas.add(plan.actividades.find((a) => a.id === d.actividadId)?.fecha);
    fechas.add(copia.actividades.find((a) => a.id === d.actividadId)?.fecha);
  }
  const lista = [...fechas].filter(Boolean).sort();
  if (!lista.length) return { plan: copia, diff, conflictos: { nuevos: [], resueltos: [], persistentes: [] }, rango: null };
  // +1 día para capturar la regla de descanso (noche → día siguiente).
  const desde = sumarDias(lista[0], -1), hasta = sumarDias(lista.at(-1), 1);
  const antes = new Map(conflictos(plan, desde, hasta).map((c) => [c.id, c]));
  const despues = new Map(conflictos(copia, desde, hasta).map((c) => [c.id, c]));
  return {
    plan: copia, diff, rango: { desde, hasta },
    conflictos: {
      nuevos: [...despues.values()].filter((c) => !antes.has(c.id)),
      resueltos: [...antes.values()].filter((c) => !despues.has(c.id)),
      persistentes: [...despues.values()].filter((c) => antes.has(c.id)),
    },
  };
}
