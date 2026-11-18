// Ocupación y conflictos de recursos. Determinístico: mismas entradas → mismas salidas, en el mismo orden.
import { esPersonal, esMando, tipoDe } from './catalogo.mjs';
import { intervalo, seSolapan, sumarDias } from './calendario.mjs';
import { indexar, actividadesEntre, estaCerrada } from './plan.mjs';

/** Mapa unidadId → actividades que la usan en (fecha, turno). */
export function ocupacion(plan, fecha, turno) {
  const m = new Map();
  for (const a of plan.actividades)
    if (a.fecha === fecha && (!turno || a.turno === turno))
      for (const r of a.recursos ?? []) {
        if (!m.has(r.unidad)) m.set(r.unidad, []);
        if (!m.get(r.unidad).includes(a)) m.get(r.unidad).push(a);
      }
  return m;
}

/** Unidades activas del tipo dado que no están ocupadas en (fecha, turno). */
export function disponibles(plan, tipo, fecha, turno) {
  const oc = ocupacion(plan, fecha, turno);
  return plan.unidades.filter((u) => u.tipo === tipo && u.activo !== false && !oc.has(u.id));
}

const clave = (...p) => p.join('|');

/**
 * Conflictos en [desde, hasta]. Cada conflicto: {id, tipo, nivel, texto, origen, actividades[], unidades[]}.
 * No corrige nada. Las actividades cerradas (terminadas/reprogramadas/suspendidas) no generan conflicto de uso.
 */
export function conflictos(plan, desde, hasta = desde) {
  const { unidades } = indexar(plan);
  const acts = actividadesEntre(plan, desde, hasta).filter((a) => !estaCerrada(a));
  const out = [];

  // 1) Uso simultáneo: mismo recurso, misma fecha y turno; si ambas tienen horario, se exige solape real.
  const grupos = new Map();
  for (const a of acts) for (const r of a.recursos ?? []) {
    const k = clave(r.unidad, a.fecha, a.turno);
    if (!grupos.has(k)) grupos.set(k, []);
    if (!grupos.get(k).includes(a)) grupos.get(k).push(a);
  }
  for (const [k, lista] of grupos) {
    if (lista.length < 2) continue;
    const ivs = lista.map((a) => intervalo(a.fecha, a.horaIni, a.horaFin));
    if (ivs.every(Boolean) && !ivs.some((x, i) => ivs.some((y, j) => i < j && seSolapan(x, y)))) continue;
    const [uid, fecha, turno] = k.split('|');
    const u = unidades.get(uid);
    const mando = esMando(u);
    out.push({
      id: `simultaneo|${k}`, tipo: mando ? 'supervision_multiple' : 'recurso_simultaneo', nivel: mando ? 'info' : 'alta',
      texto: `${u?.nombre ?? uid} está asignado a ${lista.length} actividades el ${fecha} (${turno}).`,
      origen: mando ? 'Mando en varios frentes: normal si supervisa, revisar si debe estar presente en todos.'
        : 'Mismo recurso, misma fecha y turno, sin horarios que demuestren que no se solapan.',
      actividades: lista.map((a) => a.id), unidades: [uid], fecha,
    });
  }

  // 2) Descanso: persona en turno nocturno y turno diurno el mismo día o el siguiente (regla del original).
  const usoPersona = new Map();
  for (const a of acts) for (const r of a.recursos ?? []) {
    if (!esPersonal(unidades.get(r.unidad))) continue;
    if (!usoPersona.has(r.unidad)) usoPersona.set(r.unidad, []);
    usoPersona.get(r.unidad).push(a);
  }
  for (const [uid, lista] of usoPersona)
    for (const n of lista.filter((a) => a.turno === 'Nocturno')) {
      const d = lista.find((a) => a.turno === 'Diurno' && (a.fecha === n.fecha || a.fecha === sumarDias(n.fecha, 1)));
      if (d) out.push({
        id: clave('descanso', uid, n.id, d.id), tipo: 'descanso', nivel: 'alta',
        texto: `${unidades.get(uid)?.nombre} trabaja de noche el ${n.fecha} y de día el ${d.fecha}.`,
        origen: 'Turno nocturno seguido de turno diurno: revisar descanso entre turnos.',
        actividades: [n.id, d.id], unidades: [uid], fecha: n.fecha,
      });
    }

  // 3) Referencias inválidas y recursos inactivos.
  for (const a of acts) for (const r of a.recursos ?? []) {
    const u = unidades.get(r.unidad);
    if (!u) out.push({ id: clave('inexistente', a.id, r.id), tipo: 'recurso_inexistente', nivel: 'alta',
      texto: `«${a.actividad}» referencia un recurso que no existe en la dotación (${r.unidad}).`,
      origen: 'actividad.recursos[].unidad no está en unidades.', actividades: [a.id], unidades: [r.unidad], fecha: a.fecha });
    else if (u.activo === false) out.push({ id: clave('inactivo', a.id, r.id), tipo: 'recurso_inactivo', nivel: 'media',
      texto: `${u.nombre} está inactivo y asignado a «${a.actividad}».`,
      origen: 'unidad.activo = false.', actividades: [a.id], unidades: [u.id], fecha: a.fecha });
  }
  return out.sort((x, y) => (x.fecha ?? '').localeCompare(y.fecha ?? '') || x.id.localeCompare(y.id));
}

/** Cuadrillas (configuraciones) con integrantes inexistentes o inactivos. */
export function cuadrillasIncompletas(plan) {
  const { unidades } = indexar(plan);
  return plan.configuraciones.flatMap((c) => {
    const faltan = c.miembros.filter((m) => !unidades.has(m));
    const inactivos = c.miembros.filter((m) => unidades.get(m)?.activo === false);
    return faltan.length || inactivos.length ? [{
      id: `cuadrilla|${c.id}`, tipo: 'cuadrilla_incompleta', nivel: 'media',
      texto: `«${c.nombre}»: ${faltan.length} integrante(s) inexistente(s) y ${inactivos.length} inactivo(s) de ${c.miembros.length}.`,
      origen: 'configuraciones.miembros referencia unidades que no existen o están inactivas.',
      configuracion: c.id, faltantes: faltan, inactivos, actividades: [], unidades: [...faltan, ...inactivos],
    }] : [];
  });
}

export { tipoDe };
