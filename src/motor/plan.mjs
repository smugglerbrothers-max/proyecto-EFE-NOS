// Lectura e índices del plan. Nunca modifica el objeto recibido.

const INI = '/*PLAN_INICIAL_INI*/', FIN = '/*PLAN_INICIAL_FIN*/';

/** Extrae el plan embebido de un HTML guardado por la pizarra (mismo criterio que dr() del original). */
export function planDesdeHTML(texto) {
  const a = texto.indexOf(INI), b = texto.indexOf(FIN);
  if (a < 0 || b < a) throw new Error('El HTML no contiene una planificación guardada por la pizarra.');
  return JSON.parse(texto.slice(a + INI.length, b));
}

/** Índices de solo lectura. Se recalculan si cambia el plan (son baratos: ~1 ms con 674 actividades). */
export function indexar(plan) {
  const unidades = new Map(plan.unidades.map((u) => [u.id, u]));
  const actividades = new Map(plan.actividades.map((a) => [a.id, a]));
  const porFecha = new Map();
  for (const a of plan.actividades) {
    if (!porFecha.has(a.fecha)) porFecha.set(a.fecha, []);
    porFecha.get(a.fecha).push(a);
  }
  const partidas = new Map();
  for (const [obra, lista] of Object.entries(plan.programa?.partidas ?? {}))
    for (const p of lista) partidas.set(`${obra}|${p.id}`, { ...p, obra });
  return { plan, unidades, actividades, porFecha, partidas };
}

export const obraDe = (a) => a.proyecto ?? 'lmt';

/** Estado visible. El valor guardado no se reescribe ("En curso" se muestra como "En ejecución"). */
export function estadoVisible(a) {
  const e = String(a.estado ?? '').trim().toLowerCase();
  return ({ programada: 'Programada', 'en curso': 'En ejecución', terminada: 'Terminada', suspendida: 'Suspendida',
    bloqueada: 'Bloqueada', reprogramada: 'Reprogramada' })[e] ?? (a.estado || 'Sin estado');
}

export const estaCerrada = (a) => ['Terminada', 'Reprogramada', 'Suspendida'].includes(estadoVisible(a));

export function actividadesEntre(plan, desde, hasta, obra) {
  return plan.actividades.filter((a) => a.fecha >= desde && a.fecha <= hasta && (!obra || obraDe(a) === obra));
}
