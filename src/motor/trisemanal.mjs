// Vista consolidada de tres semanas (base para el planificador trisemanal y la programación semanal).
import { ventanaTrisemanal, sumarDias } from './calendario.mjs';
import { actividadesEntre, estadoVisible, obraDe } from './plan.mjs';
import { conflictos, cuadrillasIncompletas } from './disponibilidad.mjs';
import { calendarioNecesidades, cargaRecursos } from './necesidades.mjs';

export function resumenTrisemanal(plan, fecha, opciones = {}) {
  const semanas = ventanaTrisemanal(fecha).map(({ desde, hasta }) => {
    const acts = actividadesEntre(plan, desde, hasta, opciones.obra);
    const porDia = {};
    for (let i = 0; i < 7; i++) porDia[sumarDias(desde, i)] = { Diurno: 0, Nocturno: 0 };
    const porPartida = {}, porEstado = {};
    for (const a of acts) {
      porDia[a.fecha][a.turno] = (porDia[a.fecha][a.turno] ?? 0) + 1;
      const k = `${obraDe(a)}|${a.partida ?? '(sin partida)'}`;
      porPartida[k] = (porPartida[k] ?? 0) + 1;
      const e = estadoVisible(a);
      porEstado[e] = (porEstado[e] ?? 0) + 1;
    }
    const conf = conflictos(plan, desde, hasta).filter((c) => !opciones.obra || c.actividades.some((id) => acts.some((a) => a.id === id)));
    return {
      desde, hasta, actividades: acts.length, porDia, porPartida, porEstado,
      conflictos: { total: conf.length, alta: conf.filter((c) => c.nivel === 'alta').length },
      carga: cargaRecursos(plan, desde, hasta, opciones.obra).map((c) => ({ fecha: c.fecha, turno: c.turno,
        personal: c.personal.length, maquinaria: c.maquinaria.length, equipos: c.equipos.length })),
    };
  });
  const v = ventanaTrisemanal(fecha);
  const nec = calendarioNecesidades(plan, v[0].desde, v[2].hasta, opciones);
  return { fecha, obra: opciones.obra ?? null, semanas, necesidadesFaltantes: nec.faltantes,
    cuadrillasIncompletas: cuadrillasIncompletas(plan).length };
}
