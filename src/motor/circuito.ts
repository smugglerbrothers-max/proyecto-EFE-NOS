import type { Circuito, Proyecto } from './modelo';
import {
  CONDUCTORES,
  SECCIONES,
  SECCION_MINIMA,
  capacidad,
  diametroDucto,
  factorAgrupamiento,
  factorTemperatura,
  resistividadCobre,
} from './tablas/ric04';
import {
  HOLGURA_CIRCUITO,
  IN_MIN_POR_TIPO,
  POT_CENTRO_ILUMINACION,
  POT_ENCHUFE,
  PROTECCIONES,
  USO_MAX_CIRCUITO,
} from './tablas/ric10';
import type { Aislacion, Metodo } from './tablas/tipos';

export const V_MONO = 220;
export const V_TRI = 380;
/** Protección mínima de circuito elegida automáticamente (criterio del autor). */
export const IN_MIN_CIRCUITO = 10;

export interface ResultadoCircuito {
  id: string;
  potencia: number;
  centros: number;
  ib: number | null;
  inMin: number | null;
  in: number | null;
  seccionMin: number | null;
  seccion: number | null;
  iz: number | null;
  dvVolt: number | null;
  dvPct: number | null;
  ducto: number | null;
  pctCarga: number | null;
  errores: string[];
}

export const esTrifasico = (c: Pick<Circuito, 'fase'>) => c.fase === 'RST';
export const aislacionDe = (conductor: string): Aislacion => CONDUCTORES[conductor] ?? 70;

export function potenciaCircuito(c: Circuito): number {
  return (
    c.portalamparas * POT_CENTRO_ILUMINACION + c.enchufes * POT_ENCHUFE + c.otros * c.potenciaUnitOtros
  );
}

/** Corriente admisible corregida Ic = It·fn·ft (RIC N°04 6.2.6). */
export function capacidadCorregida(
  seccion: number,
  metodo: Metodo,
  aisl: Aislacion,
  tAmb: number,
  activos: number,
): number | null {
  const it = capacidad(seccion, metodo, aisl);
  if (it == null) return null;
  return it * factorAgrupamiento(activos) * factorTemperatura(tAmb, aisl, metodo).f;
}

/** Menor sección ≥ mínima con Ic ≥ In, o null. */
export function seleccionarSeccion(
  inA: number,
  minima: number,
  metodo: Metodo,
  aisl: Aislacion,
  tAmb: number,
  activos: number,
): number | null {
  for (const s of SECCIONES) {
    if (s < minima) continue;
    const ic = capacidadCorregida(s, metodo, aisl, tAmb, activos);
    if (ic != null && ic >= inA) return s;
  }
  return null;
}

/** ΔV [V] de una línea: 2·L·I·ρ/S (mono) o √3·L·I·ρ/S (tri). */
export function caidaTension(tri: boolean, L: number, I: number, rho: number, S: number): number {
  return ((tri ? Math.sqrt(3) : 2) * L * I * rho) / S;
}

export function rhoProyecto(p: Proyecto, aisl: Aislacion): number {
  return resistividadCobre(p.resistividad === '20C' ? 20 : aisl);
}

export function calcularCircuito(c: Circuito, p: Proyecto): ResultadoCircuito {
  const errores: string[] = [];
  const potencia = potenciaCircuito(c);
  const centros = c.portalamparas + c.enchufes + c.otros;
  const tri = esTrifasico(c);
  const V = tri ? V_TRI : V_MONO;
  const aisl = aislacionDe(c.conductor);
  const seccionMin = SECCION_MINIMA[c.tipo];
  const vacio: ResultadoCircuito = {
    id: c.id, potencia, centros, ib: null, inMin: null, in: null, seccionMin, seccion: null,
    iz: null, dvVolt: null, dvPct: null, ducto: null, pctCarga: null, errores,
  };

  if (!(p.cosPhi > 0 && p.cosPhi <= 1)) errores.push('cos φ inválido');
  if (!(potencia >= 0) || [c.portalamparas, c.enchufes, c.otros].some((n) => n < 0)) errores.push('Potencia inválida');
  if (!(c.longitud >= 0)) errores.push('Longitud inválida');
  if (errores.length) return vacio;

  const ib = potencia / ((tri ? Math.sqrt(3) : 1) * V * p.cosPhi);
  // RIC N°10 5.1.4.1 (P·1,1) y 5.1.4.4 (P ≤ 0,9·In·V): se exige la más estricta.
  const requerida = Math.max(ib * HOLGURA_CIRCUITO, ib / USO_MAX_CIRCUITO, IN_MIN_POR_TIPO[c.tipo] ?? 0, IN_MIN_CIRCUITO);
  const inMin = PROTECCIONES.find((x) => x >= requerida - 1e-9) ?? null;
  const inA = c.disyuntorManual ?? inMin;
  if (inMin == null && c.disyuntorManual == null) errores.push('Carga excede la mayor protección disponible');
  if (c.disyuntorManual != null && inMin != null && c.disyuntorManual < inMin)
    errores.push(`Disyuntor ${c.disyuntorManual} A menor al requerido ${inMin} A (RIC N°10 5.1.4.1/5.1.4.4)`);

  const auto = inA != null ? seleccionarSeccion(inA, seccionMin, p.metodo, aisl, p.tAmbiente, p.activosPorDucto) : null;
  const seccion = c.seccionManual ?? auto;
  if (seccion == null) errores.push(`Ninguna sección hasta ${SECCIONES[SECCIONES.length - 1]} mm² soporta la carga en ${p.metodo}`);
  if (c.seccionManual != null && c.seccionManual < seccionMin)
    errores.push(`Sección ${c.seccionManual} mm² bajo la sección mínima ${seccionMin} mm² (RIC N°04 5.4)`);

  const iz = seccion != null ? capacidadCorregida(seccion, p.metodo, aisl, p.tAmbiente, p.activosPorDucto) : null;
  if (seccion != null && iz == null) errores.push(`Método ${p.metodo} no define capacidad para ${seccion} mm²`);
  if (iz != null && inA != null && inA > iz + 1e-9)
    errores.push(`Protección ${inA} A supera la capacidad Iz ${iz.toFixed(1)} A (RIC N°04 6.2)`);

  const dvVolt = seccion != null ? caidaTension(tri, c.longitud, ib, rhoProyecto(p, aisl), seccion) : null;
  const dvPct = dvVolt != null ? (dvVolt / V) * 100 : null;
  const ducto = seccion != null ? diametroDucto(seccion, tri ? 5 : 3) : null;
  const pctCarga = inA ? (ib / inA) * 100 : null;
  return { ...vacio, ib, inMin, in: inA, seccion, iz, dvVolt, dvPct, ducto, pctCarga };
}
