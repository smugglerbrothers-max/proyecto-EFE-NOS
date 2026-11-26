import type { ResultadoProyecto } from '../motor';
import type { Proyecto } from '../motor/modelo';
import { num, secc } from '../ui/formato';

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** Diagrama unilineal del tablero general como SVG autónomo. */
export function unilinealSVG(p: Proyecto, r: ResultadoProyecto): string {
  const a = r.alimentador;
  const grupos = p.diferenciales.map((d) => ({
    titulo: d.nombre,
    sub: `In ${d.in} A · ${d.sensibilidadMA} mA`,
    idx: p.circuitos.map((c, i) => (c.diferencialId === d.id ? i : -1)).filter((i) => i >= 0),
  }));
  const sueltos = p.circuitos.map((c, i) => (c.diferencialId && p.diferenciales.some((d) => d.id === c.diferencialId) ? -1 : i)).filter((i) => i >= 0);
  if (sueltos.length) grupos.push({ titulo: 'Sin diferencial', sub: '⚠ no cumple RIC N°10 5.1.3.5', idx: sueltos });

  const W = Math.max(1000, grupos.length * 230 + 40);
  const maxC = Math.max(1, ...grupos.map((g) => g.idx.length));
  const H = 330 + maxC * 48 + 20;
  const cx = W / 2;
  const t = (x: number, y: number, s: string, o = '') =>
    `<text x="${x}" y="${y}" text-anchor="middle" font-family="Helvetica, Arial, sans-serif" ${o}>${esc(s)}</text>`;
  const caja = (x: number, y: number, w: number, h: number, fill: string, stroke: string) =>
    `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${fill}" stroke="${stroke}" stroke-width="1.5"/>`;
  const L = (x1: number, y1: number, x2: number, y2: number, w = 1.5, c = '#333') =>
    `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${c}" stroke-width="${w}"/>`;

  const s: string[] = [];
  const emp = r.empalme;
  s.push(caja(cx - 140, 10, 280, 56, '#dbe6fb', '#1e3a8a'));
  s.push(t(cx, 34, `EMPALME ${emp ? `${emp.in} A` : '—'}`, 'font-size="14" font-weight="bold" fill="#1e3a8a"'));
  s.push(t(cx, 54, `${emp?.tipos ? emp.tipos + ' · ' : ''}${p.sistema === 'mono' ? '220 V' : '380 V'}`, 'font-size="11"'));
  s.push(L(cx, 66, cx, 160));
  s.push(t(cx + 8, 112, `Alimentador: ${secc(a.seccionFase)}/${secc(a.seccionNeutro)}/${secc(a.seccionTierra)} mm² ${p.conductorAlimentador} · Ø ${a.ducto ?? '—'} mm · ΔV ${num(a.dvPct)} %`, 'font-size="10" fill="#555" text-anchor="start"'));
  s.push(caja(cx - 150, 160, 300, 52, '#fdf3c7', '#b45309'));
  s.push(t(cx, 183, 'PROTECCIÓN GENERAL OMNIPOLAR', 'font-size="12" font-weight="bold" fill="#92400e"'));
  s.push(t(cx, 201, `${a.in ?? '—'} A · Curva C`, 'font-size="11"'));
  s.push(L(cx, 212, cx, 240));
  s.push(t(cx, 232, 'BARRA DE DISTRIBUCIÓN', 'font-size="9" fill="#1e3a8a" dx="70"'));
  s.push(L(20, 240, W - 20, 240, 4, '#1e3a8a'));

  const paso = (W - 40) / Math.max(1, grupos.length);
  grupos.forEach((g, k) => {
    const gx = 20 + paso * (k + 0.5);
    s.push(L(gx, 240, gx, 260));
    s.push(caja(gx - 75, 260, 150, 44, '#e7f6ec', '#15803d'));
    s.push(t(gx, 279, g.titulo, 'font-size="11" font-weight="bold"'));
    s.push(t(gx, 295, g.sub, 'font-size="9"'));
    g.idx.forEach((i, j) => {
      const y = 320 + j * 48;
      const c = p.circuitos[i];
      const rc = r.circuitos[i];
      s.push(L(gx - 90, 304, gx - 90, y + 20, 1, '#999'));
      s.push(L(gx - 90, y + 20, gx - 80, y + 20, 1, '#999'));
      s.push(caja(gx - 80, y, 180, 40, '#fff', '#888'));
      s.push(t(gx + 10, y + 17, `Cto ${i + 1} · ${c.nombre}`, 'font-size="10"'));
      s.push(t(gx + 10, y + 32, `${rc.in ?? '—'} A · ${secc(rc.seccion)} mm² · Ø ${rc.ducto ?? '—'}`, 'font-size="9" fill="#555"'));
    });
  });
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">${s.join('')}</svg>`;
}
