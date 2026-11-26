import { V_MONO, V_TRI, aislacionDe, capacidadCorregida, caidaTension, rhoProyecto } from './circuito';
import type { ResultadoCircuito } from './circuito';
import type { Proyecto } from './modelo';
import { LIMITES_DV, SECCION_MIN_ALIMENTADOR, demandaAlumbrado, factorSimultaneidad } from './tablas/ric03';
import { SECCIONES, diametroDucto } from './tablas/ric04';
import { EMPALME_MIN_VIVIENDA_A, PROTECCIONES } from './tablas/ric10';

export interface ResultadoAlimentador {
  potInstalada: number;
  demanda: number;
  factorDemanda: number;
  fs: number;
  ib: number | null;
  in: number | null;
  seccionFase: number | null;
  seccionNeutro: number | null;
  seccionTierra: number | null;
  iz: number | null;
  ducto: number | null;
  dvPct: number | null;
  errores: string[];
}

const siguienteSeccion = (min: number) => SECCIONES.find((s) => s >= min - 1e-9) ?? null;

/** Conductor de protección según IEC 60364-5-54 Tabla 54.2 (RIC N°06 no verificado). */
export function seccionTierra(fase: number): number | null {
  if (fase <= 16) return fase;
  if (fase <= 35) return 16;
  return siguienteSeccion(fase / 2);
}

export function calcularAlimentador(p: Proyecto, circuitos: ResultadoCircuito[]): ResultadoAlimentador {
  const errores: string[] = [];
  const nViv = Math.max(1, Math.floor(p.nViviendas || 1));
  const potUna = circuitos.reduce((s, c) => s + (c.potencia > 0 ? c.potencia : 0), 0);
  const potInstalada = potUna * nViv;
  const fs = factorSimultaneidad(nViv);
  const demanda = demandaAlumbrado(potUna / 1000, p.destino) * 1000 * nViv * fs;
  const factorDemanda = potInstalada > 0 ? demanda / potInstalada : 1;
  const base: ResultadoAlimentador = {
    potInstalada, demanda, factorDemanda, fs, ib: null, in: null, seccionFase: null,
    seccionNeutro: null, seccionTierra: null, iz: null, ducto: null, dvPct: null, errores,
  };
  if (!(p.cosPhi > 0 && p.cosPhi <= 1)) {
    errores.push('cos φ inválido');
    return base;
  }
  const tri = p.sistema === 'tri';
  const V = tri ? V_TRI : V_MONO;
  const ib = demanda / ((tri ? Math.sqrt(3) : 1) * V * p.cosPhi);
  const minIn = p.destino === 'casa' ? EMPALME_MIN_VIVIENDA_A : 0;
  const inA = PROTECCIONES.find((x) => x >= Math.max(ib, minIn) - 1e-9) ?? null;
  if (inA == null) {
    errores.push('La corriente del alimentador excede la mayor protección disponible');
    return { ...base, ib };
  }
  const aisl = aislacionDe(p.conductorAlimentador);
  const rho = rhoProyecto(p, aisl);
  const L = Math.max(0, p.longitudAlimentador || 0);
  let seccionFase: number | null = null;
  let iz: number | null = null;
  let dvPct: number | null = null;
  for (const s of SECCIONES) {
    if (s < SECCION_MIN_ALIMENTADOR) continue;
    const ic = capacidadCorregida(s, p.metodo, aisl, p.tAmbiente, p.activosPorDucto);
    if (ic == null || ic < inA) continue;
    const dv = (caidaTension(tri, L, ib, rho, s) / V) * 100;
    seccionFase = s;
    iz = ic;
    dvPct = dv;
    if (dv <= LIMITES_DV.alimentador) break; // RIC N°03 5.1.3: se sube la sección hasta cumplir ΔV
  }
  if (seccionFase == null) errores.push(`Ninguna sección soporta ${inA} A en método ${p.metodo}`);
  let seccionNeutro = seccionFase;
  if (seccionFase != null && tri && p.noLineales === 'concentrado') seccionNeutro = siguienteSeccion(seccionFase * 1.5);
  const tierra = seccionFase != null ? seccionTierra(seccionFase) : null;
  const ducto = seccionFase != null ? diametroDucto(seccionFase, tri ? 5 : 3) : null;
  return { ...base, ib, in: inA, seccionFase, seccionNeutro, seccionTierra: tierra, iz, ducto, dvPct };
}
