import type { ResultadoProyecto } from '../motor';
import { NOMBRE_TIPO, type Proyecto } from '../motor/modelo';
import { num, secc } from '../ui/formato';

/** Columnas del cuadro de cargas (RIC N°18, Figura 18.4.1). */
export const COLUMNAS_CUADRO = [
  'CTO N°', 'NOMBRE / TIPO', 'PORT.', 'ENCH.', 'OTROS', 'TOTAL CENT.', 'POT. (W)', 'FASE', 'PROTEC. DIF.',
  'DISY. (A)', 'mm²', 'DUCTO Ø', 'CABLE', 'LONG. m', 'ΔV%', '% CARGA', 'UBICACIÓN',
];

export function filasCuadroCargas(p: Proyecto, r: ResultadoProyecto): string[][] {
  const filas = p.circuitos.map((c, i) => {
    const rc = r.circuitos[i];
    const d = p.diferenciales.find((x) => x.id === c.diferencialId);
    return [
      String(i + 1), `${c.nombre} · ${NOMBRE_TIPO[c.tipo].toLowerCase()}`, String(c.portalamparas), String(c.enchufes),
      String(c.otros), String(rc.centros), num(rc.potencia, 0), c.fase, d ? `${d.nombre} (${d.in} A)` : '—',
      rc.in != null ? String(rc.in) : '—', secc(rc.seccion), rc.ducto != null ? String(rc.ducto) : '—', c.conductor,
      num(c.longitud, 0), num(rc.dvPct), num(rc.pctCarga, 0), c.ubicacion,
    ];
  });
  const suma = (k: 'portalamparas' | 'enchufes' | 'otros') => String(p.circuitos.reduce((s, c) => s + c[k], 0));
  const total = COLUMNAS_CUADRO.map(() => '');
  total[1] = 'TOTALES';
  total[2] = suma('portalamparas');
  total[3] = suma('enchufes');
  total[4] = suma('otros');
  total[5] = String(r.circuitos.reduce((s, c) => s + c.centros, 0));
  total[6] = num(r.alimentador.potInstalada / Math.max(1, Math.floor(p.nViviendas || 1)), 0);
  return [...filas, total];
}
