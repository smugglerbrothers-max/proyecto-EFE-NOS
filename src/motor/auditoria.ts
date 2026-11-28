import type { ResultadoAlimentador } from './alimentador';
import type { ResultadoCircuito } from './circuito';
import type { Proyecto } from './modelo';
import type { Empalme } from './tablas/empalmes';
import { LIMITES_DV } from './tablas/ric03';
import { factorTemperatura } from './tablas/ric04';
import { MAX_CIRCUITOS_POR_DIFERENCIAL, SENSIBILIDAD_MAX_MA } from './tablas/ric10';
import { aislacionDe } from './circuito';

export interface Hallazgo {
  nivel: 'error' | 'aviso';
  regla: string;
  mensaje: string;
}
export type Balance = { R: number; S: number; T: number; desequilibrioPct: number } | null;

/** Desequilibrio máximo aceptado entre fases [%] (criterio del autor, no normativo). */
export const DESEQUILIBRIO_MAX = 20;

export function balanceFases(p: Proyecto, rc: ResultadoCircuito[]): Balance {
  if (p.sistema !== 'tri') return null;
  const b = { R: 0, S: 0, T: 0 };
  p.circuitos.forEach((c, i) => {
    const w = rc[i]?.potencia ?? 0;
    if (c.fase === 'RST') (['R', 'S', 'T'] as const).forEach((f) => (b[f] += w / 3));
    else b[c.fase] += w;
  });
  const max = Math.max(b.R, b.S, b.T);
  const min = Math.min(b.R, b.S, b.T);
  return { ...b, desequilibrioPct: max > 0 ? ((max - min) / max) * 100 : 0 };
}

export function auditar(
  p: Proyecto,
  rc: ResultadoCircuito[],
  ra: ResultadoAlimentador,
  empalme: Empalme | null,
  balance: Balance,
): Hallazgo[] {
  const h: Hallazgo[] = [];
  const err = (regla: string, mensaje: string) => h.push({ nivel: 'error', regla, mensaje });
  const aviso = (regla: string, mensaje: string) => h.push({ nivel: 'aviso', regla, mensaje });
  const nombre = (i: number) => `Cto ${i + 1} (${p.circuitos[i].nombre})`;

  rc.forEach((r, i) => r.errores.forEach((e) => err(`Circuito ${i + 1}`, `${nombre(i)}: ${e}`)));
  p.circuitos.forEach((c, i) => {
    if (!c.diferencialId || !p.diferenciales.some((d) => d.id === c.diferencialId))
      err('RIC N°10 5.1.3.5', `${nombre(i)} no tiene protección diferencial`);
    if (p.sistema === 'mono' && c.fase !== 'R') err('Sistema', `${nombre(i)}: fase ${c.fase} en sistema monofásico`);
    const dv = rc[i]?.dvPct;
    if (dv != null && dv > LIMITES_DV.alimentador)
      err('RIC N°03 5.1.3', `${nombre(i)}: ΔV ${dv.toFixed(2)} % supera ${LIMITES_DV.alimentador} %`);
    if (dv != null && ra.dvPct != null && dv + ra.dvPct > LIMITES_DV.total)
      err('RIC N°03 5.1.3', `${nombre(i)}: ΔV total ${(dv + ra.dvPct).toFixed(2)} % supera ${LIMITES_DV.total} %`);
  });

  for (const d of p.diferenciales) {
    const idx = p.circuitos.map((c, i) => (c.diferencialId === d.id ? i : -1)).filter((i) => i >= 0);
    if (d.sensibilidadMA > SENSIBILIDAD_MAX_MA)
      err('RIC N°10 5.1.3.5', `${d.nombre}: sensibilidad ${d.sensibilidadMA} mA mayor a ${SENSIBILIDAD_MAX_MA} mA`);
    if (idx.length > MAX_CIRCUITOS_POR_DIFERENCIAL)
      err('RIC N°10 5.1.3.7', `${d.nombre}: ${idx.length} circuitos (máximo ${MAX_CIRCUITOS_POR_DIFERENCIAL})`);
    if (idx.length > 1 && idx.length === p.circuitos.length)
      err('RIC N°10 5.1.3.7', `${d.nombre} agrupa varios circuitos y opera sobre el 100 % de la instalación`);
    const suma = idx.reduce((s, i) => s + (rc[i]?.in ?? 0), 0);
    if (suma > d.in && (ra.in == null || d.in < ra.in))
      err('RIC N°10 5.1.3.6', `${d.nombre}: Σ In aguas abajo ${suma} A > ${d.in} A y menor que la protección general`);
  }

  if (p.destino === 'casa') {
    const min = p.superficieM2 < 30 ? 2 : 3;
    if (p.circuitos.length < min) err('RIC N°10 5.2 b)', `La vivienda requiere al menos ${min} circuitos`);
    if (!p.circuitos.some((c) => c.tipo === 'cocina'))
      err('RIC N°10 5.2 d)', 'Falta un circuito exclusivo de enchufes de cocina/lavadero de 16 A');
  }

  ra.errores.forEach((e) => err('Alimentador', e));
  if (ra.dvPct != null && ra.dvPct > LIMITES_DV.alimentador)
    err('RIC N°03 5.1.3', `Alimentador: ΔV ${ra.dvPct.toFixed(2)} % supera ${LIMITES_DV.alimentador} %`);
  if (ra.iccTG_kA != null) {
    const icc = ra.iccTG_kA;
    const f = (x: number) => x.toFixed(2).replace('.', ',');
    if (p.icuGeneralKA < icc)
      err('RIC N°10 5.1.4.2', `Protección general: capacidad de ruptura ${p.icuGeneralKA} kA menor que Icc ${f(icc)} kA en el TG`);
    if (p.circuitos.length && p.icuCircuitosKA < icc)
      err('RIC N°10 5.1.4.2', `Protecciones de circuitos: capacidad de ruptura ${p.icuCircuitosKA} kA menor que Icc ${f(icc)} kA en el TG`);
  }
  if (!empalme) err('Empalme', 'Ningún empalme normalizado de la tabla cubre la demanda');
  if (factorTemperatura(p.tAmbiente, aislacionDe(p.conductorAlimentador), p.metodo).fueraDeRango)
    aviso('RIC N°04 Tabla 4.7', `Temperatura ${p.tAmbiente} °C fuera de 5–60 °C: se usa el tramo extremo`);
  if (balance && balance.desequilibrioPct > DESEQUILIBRIO_MAX)
    aviso('Balance de fases', `Desequilibrio ${balance.desequilibrioPct.toFixed(0)} % (> ${DESEQUILIBRIO_MAX} %)`);
  return h;
}
