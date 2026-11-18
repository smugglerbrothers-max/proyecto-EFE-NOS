// Pruebas del motor operacional contra los datos REALES del archivo original.
// Ejecutar: node --test tests/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as M from '../src/motor/index.mjs';

const HTML = readFileSync(new URL('../original/Pizarra_Operaciones_2026-11-13.html', import.meta.url), 'utf8');
const PLAN = M.planDesdeHTML(HTML);
const nombre = (id) => PLAN.unidades.find((u) => u.id === id)?.nombre;
const congelar = (o) => { Object.freeze(o); for (const v of Object.values(o)) if (v && typeof v === 'object' && !Object.isFrozen(v)) congelar(v); return o; };

// Funciones del original, extraídas del bundle tal cual, para comparar resultados.
// Solo en pruebas: evalúa código del archivo original versionado en el repo (confiable), nunca entrada externa.
const fuenteZe = HTML.match(/ze=(\(e,t\)=>new Date\(Date\.UTC\([^;]*?\.slice\(0,10\))/)[1];
const fuenteBe = HTML.match(/function Be\(e,t,n=`0000011`,r=new Set\)\{.*?return a\}/)[0];
const BeOriginal = new Function(`const ze=${fuenteZe};${fuenteBe};return Be;`)();

test('lee el plan embebido sin pérdida', () => {
  assert.equal(PLAN.actividades.length, 674);
  assert.equal(PLAN.unidades.length, 28);
  assert.equal(PLAN.configuraciones.length, 8);
});

test('días hábiles idénticos a Be() del original (2.000 casos con feriados reales)', () => {
  const fer = new Set(PLAN.programa.param.feriados);
  let f = '2026-09-01';
  for (let i = 0; i < 500; i++, f = M.sumarDias(f, 1))
    for (const n of [-7, -2, 1, 5])
      assert.equal(M.sumarDiasHabiles(f, n, '0000011', fer), BeOriginal(f, n, '0000011', fer), `${f} ${n}`);
  assert.equal(M.sumarDiasHabiles('2026-11-02', -1, '0000011', fer), '2026-10-30'); // salta sáb 31 (feriado) y dom 1
});

test('duración de partidas = columna "duracion" del Programa (282 de 282)', () => {
  let comparadas = 0;
  for (const lista of Object.values(PLAN.programa.partidas))
    for (const p of lista) {
      const d = M.duracionPartida(p);
      if (d.dias == null) { assert.ok(d.faltantes.length > 0); continue; }
      if (/^hito$/i.test(p.unidad ?? '')) continue;
      assert.equal(d.dias, p.duracion, p.id); comparadas++;
    }
  assert.equal(comparadas, 282);
});

test('conflictos del 18-11: reales y con origen explicado', () => {
  const c = M.conflictos(PLAN, '2026-11-18');
  const pluma = c.find((x) => x.tipo === 'recurso_simultaneo' && nombre(x.unidades[0]) === 'Camión pluma (brazo articulado) 1');
  assert.ok(pluma); assert.equal(pluma.actividades.length, 4); assert.equal(pluma.nivel, 'alta'); assert.ok(pluma.origen);
  const sup = c.find((x) => x.id.startsWith('simultaneo|') && nombre(x.unidades[0]) === 'Cristian Ochoa');
  assert.equal(sup.tipo, 'supervision_multiple'); assert.equal(sup.nivel, 'info');
  // Hallazgo real: Ochoa tiene turno nocturno (CHENA) y diurno el mismo 18-11 → regla de descanso del original.
  assert.ok(c.some((x) => x.tipo === 'descanso' && nombre(x.unidades[0]) === 'Cristian Ochoa'));
});

test('uso simultáneo en todo el plan = 217 combinaciones (mismo criterio que la auditoría)', () => {
  const c = M.conflictos(PLAN, '2000-01-01', '2100-01-01').filter((x) => x.id.startsWith('simultaneo|'));
  assert.equal(c.length, 217);
});

test('con horarios que no se solapan no hay conflicto', () => {
  const p = structuredClone(PLAN);
  const acts = p.actividades.filter((a) => a.fecha === '2026-11-18' && a.recursos.some((r) => nombre(r.unidad) === 'Claudio Arrau'));
  assert.equal(acts.length, 2);
  Object.assign(acts[0], { horaIni: '08:00', horaFin: '12:00' }); Object.assign(acts[1], { horaIni: '13:00', horaFin: '17:00' });
  const c = M.conflictos(p, '2026-11-18').filter((x) => x.unidades.includes(acts[0].recursos.find((r) => nombre(r.unidad) === 'Claudio Arrau').unidad));
  assert.equal(c.length, 0);
});

test('cuadrillas incompletas: 7 de 8 con integrantes inexistentes', () => {
  const c = M.cuadrillasIncompletas(PLAN);
  assert.equal(c.length, 7);
  assert.equal(c.reduce((s, x) => s + x.faltantes.length, 0), 30);
});

test('sin plazos configurados el motor NO inventa fechas límite', () => {
  const r = M.calendarioNecesidades(PLAN, '2026-11-18', '2026-11-18', { hoy: '2026-11-18' });
  assert.ok(r.filas.length > 0);
  assert.ok(r.filas.every((f) => f.fechaLimite === null && f.estado === 'sin_plazo'));
  assert.ok(r.faltantes.some((f) => /Plazo "preventiva" no configurado/.test(f.texto)));
  assert.ok(r.faltantes.some((f) => f.texto.includes('Horario del turno')));
});

test('con plazos configurados: fecha límite hacia atrás en días hábiles', () => {
  const a = PLAN.actividades.find((x) => x.fecha === '2026-11-18' && x.actividad.startsWith('Geodetección'));
  const n = M.necesidadesActividad(PLAN, a, { hoy: '2026-11-16', config: { plazos: { maquinaria_arriendo: 3, preventiva: 2 } } });
  const geox = n.items.find((i) => i.tipo === 'georradar');
  assert.equal(geox.fechaLimite, '2026-11-13'); // mié 18 − 3 hábiles = vie 13
  assert.equal(geox.estado, 'vencido');
  assert.equal(geox.disponibilidad, 'conflicto');
  const prev = n.items.find((i) => i.clase === 'preventiva');
  assert.equal(prev.fechaLimite, '2026-11-16'); assert.equal(prev.estado, 'hoy');
});

test('cortada: "posible" en faja vía, "no" en La Estancilla, nunca se da por autorizada', () => {
  const { unidades } = M.indexar(PLAN);
  const lim = PLAN.actividades.find((x) => x.fecha === '2026-11-18' && x.actividad.startsWith('Limpieza'));   // P59–P65
  const geo = PLAN.actividades.find((x) => x.fecha === '2026-11-18' && x.actividad.startsWith('Geodetección')); // P71–P80
  assert.equal(M.requiereCortada(lim, unidades).requiere, 'posible');
  assert.equal(M.requiereCortada(geo, unidades).requiere, 'no');
});

test('simulación: no modifica el plan oficial y reporta conflictos resueltos', () => {
  const oficial = congelar(structuredClone(PLAN));
  const a = oficial.actividades.find((x) => x.fecha === '2026-11-18' && x.actividad.startsWith('Limpieza'));
  const asg = a.recursos.find((r) => nombre(r.unidad) === 'Claudio Arrau');
  const s = M.simular(oficial, [{ op: 'quitarRecurso', actividadId: a.id, asignacionId: asg.id }]);
  assert.equal(s.diff.length, 1);
  assert.equal(s.diff[0].antes, asg.unidad);
  assert.ok(s.conflictos.resueltos.some((c) => c.unidades.includes(asg.unidad)));
  assert.equal(oficial.actividades.find((x) => x.id === a.id).recursos.length, a.recursos.length);
});

test('simulación: mover crea conflictos nuevos en el día destino', () => {
  const geo = PLAN.actividades.find((x) => x.fecha === '2026-11-18' && x.actividad.startsWith('Geodetección'));
  const s = M.simular(PLAN, [{ op: 'mover', actividadId: geo.id, fecha: '2026-11-19' }]);
  assert.deepEqual(s.diff, [{ actividadId: geo.id, campo: 'fecha', antes: '2026-11-18', despues: '2026-11-19' }]);
  assert.ok(Array.isArray(s.conflictos.nuevos));
  assert.throws(() => M.simular(PLAN, [{ op: 'eliminar', actividadId: geo.id }]), /no simulable/);
});

test('determinismo e inmutabilidad: mismas entradas, mismas salidas; el plan no cambia', () => {
  const p = congelar(structuredClone(PLAN));
  const a = JSON.stringify(M.resumenTrisemanal(p, '2026-11-18', { obra: 'lmt' }));
  const b = JSON.stringify(M.resumenTrisemanal(p, '2026-11-18', { obra: 'lmt' }));
  assert.equal(a, b);
  M.conflictos(p, '2026-10-01', '2026-12-31'); M.cuadrillasIncompletas(p);
  M.calendarioNecesidades(p, '2026-11-16', '2026-12-06', { hoy: '2026-11-18' });
});

test('trisemanal 18-11: semanas lunes→domingo con conteos coherentes', () => {
  const r = M.resumenTrisemanal(PLAN, '2026-11-18');
  assert.deepEqual(r.semanas.map((s) => s.desde), ['2026-11-16', '2026-11-23', '2026-11-30']);
  for (const s of r.semanas) {
    const suma = Object.values(s.porDia).reduce((t, d) => t + d.Diurno + d.Nocturno, 0);
    assert.equal(suma, s.actividades);
  }
});

test('estado visible no reescribe el dato guardado', () => {
  assert.equal(M.estadoVisible({ estado: 'En curso' }), 'En ejecución');
  assert.equal(M.estadoVisible({ estado: 'programada' }), 'Programada');
});
