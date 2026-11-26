import { V_MONO, V_TRI } from './circuito';
import type { Proyecto } from './modelo';
import { EMPALMES, type Empalme } from './tablas/empalmes';
import { EMPALME_MIN_VIVIENDA_A } from './tablas/ric10';

/** Menor empalme normalizado del sistema del proyecto que cubre la demanda [kW]. */
export function seleccionarEmpalme(p: Proyecto, demandaKW: number, tabla: Empalme[] = EMPALMES): Empalme | null {
  const tri = p.sistema === 'tri';
  const cos = p.cosPhi > 0 && p.cosPhi <= 1 ? p.cosPhi : 1;
  const ib = (demandaKW * 1000) / ((tri ? Math.sqrt(3) * V_TRI : V_MONO) * cos);
  const minIn = p.destino === 'casa' ? EMPALME_MIN_VIVIENDA_A : 0;
  return (
    tabla
      .filter((e) => e.fases === (tri ? 3 : 1))
      .sort((a, b) => a.in - b.in)
      .find((e) => e.in >= Math.max(ib, minIn) - 1e-9) ?? null
  );
}
