import type { TipoCircuito } from './tipos';

export const FUENTE_RIC10 = 'RIC N°10 (Res. Ex. 33.877, 30/12/2020)';

/** 5.1.4.5 y 5.1.4.6: potencias unitarias por defecto [W]. */
export const POT_CENTRO_ILUMINACION = 100;
export const POT_ENCHUFE = 250;
/** 5.1.4.1: holgura de capacidad del circuito. */
export const HOLGURA_CIRCUITO = 1.1;
/** 5.1.4.4: la suma de potencias no supera el 90 % de la capacidad. */
export const USO_MAX_CIRCUITO = 0.9;
/** 5.1.3.7 */
export const MAX_CIRCUITOS_POR_DIFERENCIAL = 3;
/** 5.1.3.5 */
export const SENSIBILIDAD_MAX_MA = 30;
/** 5.2 */
export const EMPALME_MIN_VIVIENDA_A = 25;
/** 5.2 d) y e) */
export const IN_MIN_POR_TIPO: Partial<Record<TipoCircuito, number>> = { cocina: 16, horno: 16 };

/** Protecciones termomagnéticas comerciales [A] (criterio de mercado, no normativo). */
export const PROTECCIONES = [6, 10, 16, 20, 25, 32, 40, 50, 63, 80, 100, 125];
