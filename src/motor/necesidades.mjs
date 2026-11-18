// Planificación anticipada de recursos: qué se necesita, cuándo y hasta cuándo se puede gestionar.
import { tipoDe } from './catalogo.mjs';
import { sumarDiasHabiles } from './calendario.mjs';
import { indexar, actividadesEntre, estaCerrada } from './plan.mjs';
import { ocupacion } from './disponibilidad.mjs';
import { requierePreventiva, requiereCortada } from './reglas.mjs';
import { conConfig } from './config.mjs';

const feriadosDe = (plan) => new Set(plan.programa?.param?.feriados ?? []);
const mascaraDe = (plan, turno) => plan.programa?.param?.cal?.[turno] ?? '0000011';

/** Plazo → acción con fecha límite. Si el plazo no está configurado, se informa como faltante. */
function accion(plan, a, clavePlazo, texto, cfg, hoy) {
  const dias = cfg.plazos[clavePlazo];
  if (dias == null) return { accion: texto, plazo: clavePlazo, fechaLimite: null, estado: 'sin_plazo',
    faltante: `Plazo "${clavePlazo}" no configurado` };
  const fechaLimite = sumarDiasHabiles(a.fecha, -dias, mascaraDe(plan, a.turno), feriadosDe(plan));
  const estado = !hoy ? 'pendiente' : fechaLimite < hoy ? 'vencido' : fechaLimite === hoy ? 'hoy' : 'pendiente';
  return { accion: texto, plazo: clavePlazo, diasAnticipacion: dias, fechaLimite, estado };
}

const horario = (a, cfg) => {
  if (a.horaIni && a.horaFin) return { horaIni: a.horaIni, horaFin: a.horaFin, origenHorario: 'actividad' };
  const h = cfg.horarios[a.turno];
  if (h) return { horaIni: h.ini, horaFin: h.fin, origenHorario: 'configuración del turno' };
  return { horaIni: null, horaFin: null, origenHorario: 'faltante' };
};

/** Necesidades de una actividad. `hoy` permite marcar plazos vencidos. */
export function necesidadesActividad(plan, a, opciones = {}) {
  const cfg = conConfig(opciones.config);
  const { unidades } = opciones.indices ?? indexar(plan);
  const oc = ocupacion(plan, a.fecha, a.turno);
  const h = horario(a, cfg);
  const items = [];
  const faltantes = new Set();
  if (h.origenHorario === 'faltante') faltantes.add(`Horario del turno ${a.turno} no configurado y la actividad no tiene hora`);

  for (const r of a.recursos ?? []) {
    const u = unidades.get(r.unidad), t = tipoDe(u);
    const cat = t?.categoria ?? 'desconocida';
    const usos = (oc.get(r.unidad) ?? []).filter((x) => !estaCerrada(x));
    const disponibilidad = !u ? 'inexistente' : u.activo === false ? 'inactivo' : usos.length > 1 ? 'conflicto' : 'asignado';
    const prop = u?.propiedad ?? t?.propiedad;
    const [plazo, texto, resp] = cat === 'personal' ? ['personal', 'Confirmar dotación', 'personal']
      : cat === 'maquinaria' ? [prop === 'arriendo' ? 'maquinaria_arriendo' : 'maquinaria_propia',
        prop === 'arriendo' ? 'Solicitar/reservar arriendo' : 'Confirmar maquinaria', 'maquinaria']
      : ['material', 'Disponer equipo', 'material'];
    const acc = accion(plan, a, plazo, texto, cfg, opciones.hoy);
    if (acc.faltante) faltantes.add(acc.faltante);
    const tiempo = (k) => cfg.tiempos[k][cat] ?? null;
    items.push({
      clase: 'recurso', categoria: cat, tipo: u?.tipo ?? null, unidadId: r.unidad, nombre: u?.nombre ?? '(no existe)',
      cantidad: 1, fecha: a.fecha, turno: a.turno, ...h,
      preparacionH: tiempo('preparacion'), trasladoH: tiempo('traslado'), devolucionH: tiempo('devolucion'),
      responsableCoordinacion: cfg.responsables[resp] ?? null, propiedad: prop ?? null,
      disponibilidad, otrasActividades: usos.filter((x) => x.id !== a.id).map((x) => x.id), ...acc,
    });
  }

  const prev = requierePreventiva(a, unidades);
  if (prev.requiere) {
    const acc = accion(plan, a, 'preventiva', 'Preparar tarjeta preventiva EPF', cfg, opciones.hoy);
    if (acc.faltante) faltantes.add(acc.faltante);
    items.push({ clase: 'preventiva', fecha: a.fecha, turno: a.turno, motivo: prev.motivo,
      respaldo: a.preventiva ?? null, responsableCoordinacion: cfg.responsables.preventiva, ...acc,
      estado: a.preventiva ? 'con_respaldo' : acc.estado });
  }
  const cor = requiereCortada(a, unidades);
  if (cor.requiere !== 'no') {
    const acc = accion(plan, a, 'cortada', cor.requiere === 'si' ? 'Gestionar cortada' : 'Confirmar si requiere cortada', cfg, opciones.hoy);
    if (acc.faltante) faltantes.add(acc.faltante);
    items.push({ clase: 'cortada', fecha: a.fecha, turno: a.turno, requiere: cor.requiere, motivo: cor.motivo,
      respaldo: a.cortada ?? null, responsableCoordinacion: cfg.responsables.cortada, ...acc,
      estado: a.cortada ? 'con_respaldo' : acc.estado });
  }
  for (const req of (plan.abast?.requerimientos ?? []).filter((x) => x.actividad === a.id)) {
    const acc = accion(plan, a, 'material', 'Pedir material', cfg, opciones.hoy);
    if (acc.faltante) faltantes.add(acc.faltante);
    items.push({ clase: 'material', descripcion: req.descripcion, cantidad: req.cantidad ?? null, unidad: req.unidad ?? null,
      fecha: req.necesario ?? a.fecha, responsableCoordinacion: cfg.responsables.material, requerimientoId: req.id, ...acc });
  }
  return { actividadId: a.id, actividad: a.actividad, fecha: a.fecha, turno: a.turno, items, faltantes: [...faltantes] };
}

const ORDEN_ESTADO = { vencido: 0, hoy: 1, pendiente: 2, sin_plazo: 3, con_respaldo: 4 };

/** Calendario consolidado de necesidades en [desde, hasta], ordenado por urgencia y fecha límite. */
export function calendarioNecesidades(plan, desde, hasta, opciones = {}) {
  const indices = indexar(plan);
  const acts = actividadesEntre(plan, desde, hasta, opciones.obra).filter((a) => !estaCerrada(a));
  const filas = [], faltantes = new Map();
  for (const a of acts) {
    const n = necesidadesActividad(plan, a, { ...opciones, indices });
    for (const f of n.faltantes) faltantes.set(f, (faltantes.get(f) ?? 0) + 1);
    for (const it of n.items) filas.push({ actividadId: a.id, actividad: a.actividad, obra: a.proyecto ?? 'lmt', ...it });
  }
  filas.sort((x, y) => ORDEN_ESTADO[x.estado] - ORDEN_ESTADO[y.estado]
    || (x.fechaLimite ?? x.fecha).localeCompare(y.fechaLimite ?? y.fecha) || x.actividadId.localeCompare(y.actividadId));
  return { desde, hasta, filas, faltantes: [...faltantes].map(([texto, actividades]) => ({ texto, actividades })) };
}

/** Recursos por día y turno (personas, máquinas, equipos) en [desde, hasta]. */
export function cargaRecursos(plan, desde, hasta, obra) {
  const { unidades } = indexar(plan);
  const res = {};
  for (const a of actividadesEntre(plan, desde, hasta, obra).filter((x) => !estaCerrada(x))) {
    const k = `${a.fecha}|${a.turno}`;
    res[k] ??= { fecha: a.fecha, turno: a.turno, personal: new Set(), maquinaria: new Set(), equipos: new Set() };
    for (const r of a.recursos ?? []) {
      const cat = tipoDe(unidades.get(r.unidad))?.categoria;
      if (res[k][cat]) res[k][cat].add(r.unidad);
    }
  }
  return Object.values(res).sort((x, y) => (x.fecha + x.turno).localeCompare(y.fecha + y.turno))
    .map((x) => ({ ...x, personal: [...x.personal], maquinaria: [...x.maquinaria], equipos: [...x.equipos] }));
}
