import type { Aislacion, Fuente, Metodo, TipoCircuito } from './tipos';

export const FUENTE_RIC04 = 'RIC N°04 (Res. Ex. 33.877, 30/12/2020)';

/** Secciones milimétricas de la Tabla N°4.4 usadas por la app [mm²]. */
export const SECCIONES = [1.5, 2.5, 4, 6, 10, 16, 25, 35, 50, 70, 95, 120] as const;

type Fila = (number | null)[];
/** Tabla N°4.4, en el orden de SECCIONES. Ambiente 30 °C (D1/D2: suelo 20 °C). */
const TABLA_4_4: Record<Aislacion, Partial<Record<Metodo, Fila>>> = {
  70: {
    A1: [14, 18, 24, 31, 42, 56, 73, 89, 108, 136, 164, 188],
    B1: [16, 21, 28, 36, 50, 68, 89, 110, 134, 171, 207, 239],
    E: [19, 24, 31, 43, 60, 80, 101, 126, 153, 196, 238, 276],
  },
  90: {
    A1: [17, 23, 31, 40, 54, 73, 95, 117, 141, 179, 216, 249],
    A2: [17, 22, 30, 38, 51, 68, 89, 109, 130, 164, 197, 227],
    B1: [18, 24, 37, 48, 66, 88, 117, 144, 175, 222, 269, 312],
    B2: [19, 24, 35, 44, 60, 80, 105, 128, 154, 194, 233, 268],
    D1: [19, 33, 42, 52, 68, 89, 113, 136, 159, 197, 232, 263],
    D2: [23, 38, 59, 74, 98, 126, 161, 194, 230, 282, 339, 386],
    E: [19, 32, 42, 54, 75, 100, 127, 158, 192, 246, 298, 346],
    F: [null, null, 42, 55, 77, 105, 141, 176, 216, 279, 342, 400],
  },
};
export const FUENTE_TABLA_4_4: Fuente = { pliego: FUENTE_RIC04, ref: 'Tabla N°4.4', verificado: true };

export const METODOS_POR_AISLACION: Record<Aislacion, Metodo[]> = {
  70: ['A1', 'B1', 'E'],
  90: ['A1', 'A2', 'B1', 'B2', 'D1', 'D2', 'E', 'F'],
};

export const DESCRIPCION_METODO: Record<Metodo, string> = {
  A1: 'A1 — Monopolares en ductos embutidos en paredes',
  A2: 'A2 — Multiconductor en ductos embutidos en paredes',
  B1: 'B1 — Monopolares en ductos o bandejas adosadas a paredes',
  B2: 'B2 — Multiconductor en ductos o bandejas adosadas a paredes',
  D1: 'D1 — En ductos enterrados',
  D2: 'D2 — Directamente enterrados',
  E: 'E — Multiconductor al aire / escalerilla / bandeja perforada',
  F: 'F — Monoconductores en contacto al aire / escalerilla',
};

/** Capacidad It [A] de la Tabla N°4.4, o null si la tabla no la define. */
export function capacidad(seccion: number, metodo: Metodo, aislacion: Aislacion): number | null {
  const i = SECCIONES.indexOf(seccion as (typeof SECCIONES)[number]);
  const fila = TABLA_4_4[aislacion][metodo];
  if (i < 0 || !fila) return null;
  return fila[i] ?? null;
}

/** Tabla N°4.6: factor fn por cantidad de conductores activos en un ducto. */
export function factorAgrupamiento(n: number): number {
  if (n <= 3) return 1;
  if (n <= 6) return 0.8;
  if (n <= 24) return 0.7;
  if (n <= 42) return 0.6;
  return 0.5;
}

const TRAMOS_T = [10, 15, 20, 25, 30, 35, 40, 45, 50, 55, 60];
const FT_70 = [1.22, 1.17, 1.12, 1.06, 1.0, 0.94, 0.87, 0.79, 0.71, 0.61, 0.5];
const FT_90 = [1.15, 1.12, 1.08, 1.04, 1.0, 0.96, 0.91, 0.87, 0.82, 0.76, 0.71];
const FT_90_ENTERRADO = [1.07, 1.04, 1.0, 0.96, 0.93, 0.89, 0.85, 0.8, 0.76, 0.71, 0.65];

/** Tabla N°4.7: factor ft. Fuera de 5–60 °C usa el tramo extremo y lo informa. */
export function factorTemperatura(
  tAmb: number,
  aislacion: Aislacion,
  metodo: Metodo,
): { f: number; fueraDeRango: boolean } {
  const fila =
    aislacion === 70 ? FT_70 : metodo === 'D1' || metodo === 'D2' ? FT_90_ENTERRADO : FT_90;
  const fueraDeRango = !(tAmb >= 5 && tAmb <= 60);
  let i = TRAMOS_T.findIndex((max) => Math.round(tAmb) <= max);
  if (i < 0) i = TRAMOS_T.length - 1;
  return { f: fila[i], fueraDeRango };
}

/** Tabla N°4.17: Ø nominal de ducto [mm] por sección y n° de conductores (1 a 5). */
const TABLA_4_17: Record<number, number[]> = {
  1.5: [16, 16, 16, 20, 20],
  2.5: [16, 16, 20, 20, 20],
  4: [16, 16, 20, 20, 25],
  6: [16, 16, 20, 25, 25],
  10: [16, 20, 25, 32, 32],
  16: [20, 25, 32, 40, 40],
  25: [20, 32, 40, 40, 50],
  35: [25, 32, 40, 50, 50],
  50: [32, 40, 50, 63, 63],
  70: [32, 50, 63, 63, 75],
  95: [40, 50, 63, 75, 100],
  120: [40, 63, 75, 100, 100],
};
export const FUENTE_TABLA_4_17: Fuente = {
  pliego: FUENTE_RIC04,
  ref: 'Tabla N°4.17',
  verificado: true,
  nota: 'La tabla oficial aplica a H07V/H07Z1; para THHN en mm² se usa como aproximación (Tabla 4.18 está en AWG).',
};

export function diametroDucto(seccion: number, nConductores: number): number | null {
  const fila = TABLA_4_17[seccion];
  if (!fila || nConductores < 1 || nConductores > 5) return null;
  return fila[nConductores - 1];
}

/** RIC N°04 5.4: secciones mínimas [mm²]. */
export const SECCION_MINIMA: Record<TipoCircuito | 'alimentador' | 'subalimentador', number> = {
  iluminacion: 1.5,
  enchufes: 2.5,
  mixto: 2.5,
  cocina: 2.5,
  horno: 2.5,
  otros: 2.5,
  subalimentador: 2.5,
  alimentador: 4,
};
export const FUENTE_SECCION_MINIMA: Fuente = {
  pliego: FUENTE_RIC04,
  ref: 'punto 5.4',
  verificado: true,
  nota: 'Cocina, horno y otros se tratan como enchufes (2,5 mm²): criterio del autor.',
};

/** Conductores y su temperatura de servicio (Tabla N°4.4). */
export const CONDUCTORES: Record<string, Aislacion> = {
  THHN: 90,
  'RV-K': 90,
  'RZ1-K': 90,
  THWN: 70,
  NYIFY: 70,
  H07V: 70,
  H07Z1: 70,
};

/** Resistividad del cobre [Ω·mm²/m] a la temperatura T [°C]. Criterio del autor (no normativo). */
export function resistividadCobre(t: number): number {
  return 0.0178 * (1 + 0.00393 * (t - 20));
}
