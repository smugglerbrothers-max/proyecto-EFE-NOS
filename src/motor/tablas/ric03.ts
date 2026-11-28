import type { Fuente, TipoConsumidor } from './tipos';

export const FUENTE_RIC03 = 'RIC N°03 (Res. Ex. 33.877, 30/12/2020)';

/** 5.1.3: límites de caída de tensión [% de la tensión nominal]. */
export const LIMITES_DV = { alimentador: 3, total: 5 };
export const FUENTE_LIMITES_DV: Fuente = {
  pliego: FUENTE_RIC03,
  ref: 'punto 5.1.3',
  verificado: false,
  nota: '3 % verificado; el texto oficial está truncado antes del límite total (5 % por práctica habitual).',
};

/** 5.1.2: secciones mínimas de alimentador / subalimentador [mm²]. */
export const SECCION_MIN_ALIMENTADOR = 4;

interface Tramo {
  hastaKW: number;
  factor: number;
}
/** Tabla N°3.1: factores de demanda de alimentadores de alumbrado. */
export const FACTORES_DEMANDA: Record<TipoConsumidor, Tramo[]> = {
  casa: [
    { hastaKW: 3, factor: 1 },
    { hastaKW: 120, factor: 0.35 },
    { hastaKW: Infinity, factor: 0.25 },
  ],
  hospital: [
    { hastaKW: 50, factor: 0.4 },
    { hastaKW: Infinity, factor: 0.2 },
  ],
  hotel: [
    { hastaKW: 20, factor: 0.5 },
    { hastaKW: 100, factor: 0.4 },
    { hastaKW: Infinity, factor: 0.3 },
  ],
  bodega: [
    { hastaKW: 12.5, factor: 1 },
    { hastaKW: Infinity, factor: 0.5 },
  ],
  servicios: [{ hastaKW: Infinity, factor: 1 }],
  comercial: [
    { hastaKW: 50, factor: 1 },
    { hastaKW: Infinity, factor: 0.8 },
  ],
  otro: [{ hastaKW: Infinity, factor: 1 }],
};
export const NOMBRE_CONSUMIDOR: Record<TipoConsumidor, string> = {
  casa: 'Casa habitación',
  hospital: 'Hospital',
  hotel: 'Hotel / motel',
  bodega: 'Bodega',
  servicios: 'Servicios comunes',
  comercial: 'Local comercial / oficina',
  otro: 'Otro',
};

/** Demanda [kW] aplicando la Tabla N°3.1 por tramos a la potencia instalada [kW]. */
export function demandaAlumbrado(potKW: number, tipo: TipoConsumidor): number {
  let restante = Math.max(0, potKW);
  let desde = 0;
  let demanda = 0;
  for (const t of FACTORES_DEMANDA[tipo]) {
    const tramo = Math.min(restante, t.hastaKW - desde);
    demanda += tramo * t.factor;
    restante -= tramo;
    desde = t.hastaKW;
    if (restante <= 0) break;
  }
  return demanda;
}

const FS = [1, 1, 1, 0.95, 0.92, 0.9, 0.89, 0.88, 0.87, 0.85, 0.84, 0.83, 0.82, 0.81, 0.79, 0.78, 0.77, 0.76, 0.75, 0.74, 0.73];
/** Tabla N°3.2: factor de simultaneidad para n viviendas. */
export function factorSimultaneidad(n: number): number {
  const v = Math.max(1, Math.floor(n));
  if (v <= 21) return FS[v - 1];
  return (15.3 + (v - 21) * 0.5) / v;
}
