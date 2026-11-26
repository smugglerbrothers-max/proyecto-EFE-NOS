import type { Fuente } from './tipos';

export interface Empalme {
  fases: 1 | 3;
  in: number;
  tipos: string;
  tarifa: string;
  /** Potencia máxima [kVA] = In·V (mono) o √3·V·In (tri). */
  potMaxKVA: number;
}

const mono = (inA: number, tipos = '', tarifa = 'BT-1'): Empalme => ({
  fases: 1,
  in: inA,
  tipos,
  tarifa,
  potMaxKVA: (inA * 220) / 1000,
});
const tri = (inA: number, tipos = '', tarifa = 'BT-1'): Empalme => ({
  fases: 3,
  in: inA,
  tipos,
  tarifa,
  potMaxKVA: (Math.sqrt(3) * 380 * inA) / 1000,
});

export const EMPALMES: Empalme[] = [
  mono(25, 'A-9 / S-9'),
  mono(32),
  mono(40),
  mono(50),
  mono(63),
  ...[25, 32, 40, 50, 63, 80, 100, 125].map((i) => tri(i)),
];
export const FUENTE_EMPALMES: Fuente = {
  pliego: 'Norma de empalmes de la distribuidora',
  ref: 'tabla editable',
  verificado: false,
  nota: 'Escalones, tipos y tarifas a confirmar con la norma de la distribuidora (Enel, CGE, etc.).',
};
