import type { ResultadoProyecto } from '../motor';
import { esTrifasico } from '../motor/circuito';
import type { Proyecto } from '../motor/modelo';
import { NOMBRE_CONSUMIDOR } from '../motor/tablas/ric03';
import { num, secc } from '../ui/formato';

/* Diagrama unilineal del tablero general como SVG autónomo (símbolos IEC 60617). */

const COL = 80; // ancho por circuito
const GAP = 26; // separación entre grupos
const AZUL = '#1e3a8a';
const TRAZO = '#111';

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const corto = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);

function txt(x: number, y: number, s: string, o: { size?: number; anchor?: string; bold?: boolean; color?: string; rot?: number } = {}) {
  const rot = o.rot ? ` transform="rotate(${o.rot} ${x} ${y})"` : '';
  return `<text x="${x}" y="${y}" font-family="Helvetica, Arial, sans-serif" font-size="${o.size ?? 9}" text-anchor="${o.anchor ?? 'start'}"${o.bold ? ' font-weight="bold"' : ''} fill="${o.color ?? TRAZO}"${rot}>${esc(s)}</text>`;
}
const linea = (x1: number, y1: number, x2: number, y2: number, w = 1.2, extra = '') =>
  `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${TRAZO}" stroke-width="${w}"${extra}/>`;

/** Interruptor termomagnético (40 px de alto desde y). */
function simTM(x: number, y: number, clase = true) {
  return `<g${clase ? ' class="sim-tm"' : ''}>${linea(x, y, x, y + 12)}${linea(x - 3.5, y + 8.5, x + 3.5, y + 15.5)}${linea(x - 3.5, y + 15.5, x + 3.5, y + 8.5)}${linea(x, y + 28, x - 10, y + 13, 1.4)}${linea(x, y + 28, x, y + 40)}</g>`;
}
/** Interruptor diferencial: interruptor + toroide y su acople (40 px). */
function simDif(x: number, y: number, clase = true) {
  return `<g${clase ? ' class="sim-dif"' : ''}>${linea(x, y, x, y + 12)}${linea(x - 3.5, y + 8.5, x + 3.5, y + 15.5)}${linea(x - 3.5, y + 15.5, x + 3.5, y + 8.5)}${linea(x, y + 28, x - 10, y + 13, 1.4)}${linea(x, y + 28, x, y + 40)}<ellipse cx="${x}" cy="${y + 34}" rx="8" ry="3" fill="none" stroke="${TRAZO}" stroke-width="1"/>${linea(x - 8, y + 34, x - 14, y + 34, 0.8, ' stroke-dasharray="2 1.5"')}${linea(x - 14, y + 34, x - 14, y + 20, 0.8, ' stroke-dasharray="2 1.5"')}${linea(x - 14, y + 20, x - 6, y + 20, 0.8, ' stroke-dasharray="2 1.5"')}</g>`;
}
/** Puesta a tierra (desde y hacia abajo, 18 px). */
function simTierra(x: number, y: number, clase = true) {
  return `<g${clase ? ' class="sim-tierra"' : ''}>${linea(x, y, x, y + 9)}${linea(x - 9, y + 9, x + 9, y + 9, 1.4)}${linea(x - 6, y + 13, x + 6, y + 13, 1.4)}${linea(x - 3, y + 17, x + 3, y + 17, 1.4)}</g>`;
}
/** Medidor de energía: círculo con «kWh». */
function simMedidor(x: number, cy: number, r = 18) {
  return `<g class="sim-medidor"><circle cx="${x}" cy="${cy}" r="${r}" fill="#fff" stroke="${TRAZO}" stroke-width="1.4"/>${txt(x, cy + r * 0.2, 'kWh', { size: r * 0.55, anchor: 'middle', bold: true })}</g>`;
}
/** Trazos oblicuos que indican el n° de conductores. */
function trazos(x: number, y: number, n: number) {
  return Array.from({ length: n }, (_, i) => linea(x - 5, y + i * 4 + 3, x + 5, y + i * 4 - 3, 1)).join('');
}
const flecha = (x: number, y: number) => `<path d="M${x - 4} ${y - 7} L${x} ${y} L${x + 4} ${y - 7}" fill="none" stroke="${TRAZO}" stroke-width="1.2"/>`;

/** «2×2,5 + T 2,5 mm²» o «3×4 + N 4 + T 4 mm²». */
export function leyendaConductores(tri: boolean, fase: number | null, neutro: number | null, tierra: number | null) {
  return tri
    ? `3×${secc(fase)} + N ${secc(neutro)} + T ${secc(tierra)} mm²`
    : `2×${secc(fase)} + T ${secc(tierra)} mm²`;
}

interface Grupo {
  dif: Proyecto['diferenciales'][number] | null;
  idx: number[];
  xs: number[];
  cx: number;
}

export function unilinealSVG(p: Proyecto, r: ResultadoProyecto): string {
  const a = r.alimentador;
  const tri = p.sistema === 'tri';
  const s: string[] = [];

  // ── Agrupación de circuitos por diferencial ──
  const valido = (id: string | null) => !!id && p.diferenciales.some((d) => d.id === id);
  const grupos: Grupo[] = p.diferenciales.map((d) => ({
    dif: d,
    idx: p.circuitos.map((c, i) => (c.diferencialId === d.id ? i : -1)).filter((i) => i >= 0),
    xs: [],
    cx: 0,
  }));
  const sueltos = p.circuitos.map((c, i) => (valido(c.diferencialId) ? -1 : i)).filter((i) => i >= 0);
  if (sueltos.length) grupos.push({ dif: null, idx: sueltos, xs: [], cx: 0 });

  const x0 = 90; // borde izquierdo del tablero
  let cursor = x0 + 24;
  for (const g of grupos) {
    const n = Math.max(1, g.idx.length);
    g.xs = Array.from({ length: n }, (_, j) => cursor + COL / 2 + j * COL);
    g.cx = (g.xs[0] + g.xs[g.xs.length - 1]) / 2;
    cursor += n * COL + GAP;
  }
  const x1 = Math.max(cursor - GAP + 24, x0 + 340); // borde derecho del tablero
  const xc = grupos.length ? (grupos[0].cx + grupos[grupos.length - 1].cx) / 2 : (x0 + x1) / 2;

  // ── Red, empalme y medidor ──
  const emp = r.empalme;
  s.push(txt(xc + 8, 30, 'RED DE DISTRIBUCIÓN', { size: 8, color: '#555' }));
  s.push(linea(xc, 22, xc, 72));
  s.push(`<rect x="${xc - 70}" y="44" width="140" height="96" fill="none" stroke="${AZUL}" stroke-width="1" stroke-dasharray="6 3"/>`);
  s.push(simMedidor(xc, 90));
  s.push(linea(xc, 108, xc, 250));
  s.push(linea(xc, 116, xc + 40, 116) + simTierra(xc + 40, 116));
  s.push(txt(xc + 52, 132, 'TS', { size: 8, bold: true }));
  s.push(txt(xc + 80, 64, `EMPALME ${emp ? `${emp.in} A` : '—'}`, { size: 11, bold: true, color: AZUL }));
  s.push(txt(xc + 80, 78, emp ? `${emp.tipos ? emp.tipos + ' · ' : ''}Tarifa ${emp.tarifa}` : 'Sin empalme en tabla', { size: 8 }));
  s.push(txt(xc + 80, 90, tri ? 'Trifásico 380/220 V · 50 Hz' : 'Monofásico 220 V · 50 Hz', { size: 8 }));
  s.push(txt(xc + 80, 102, `Demanda máx. ${num(a.demanda / 1000)} kW`, { size: 8 }));

  // ── Alimentador ──
  s.push(trazos(xc, 178, tri ? 5 : 3));
  s.push(txt(xc + 14, 186, 'ALIMENTADOR', { size: 8, bold: true }));
  s.push(txt(xc + 14, 198, `${leyendaConductores(tri, a.seccionFase, a.seccionNeutro, a.seccionTierra)} ${p.conductorAlimentador}`, { size: 8 }));
  s.push(txt(xc + 14, 210, `Ø${a.ducto ?? '—'} mm · L=${num(p.longitudAlimentador, 0)} m · ΔV ${num(a.dvPct)} %`, { size: 8 }));

  // ── Tablero general ──
  const yT0 = 250;
  const yT1 = 500;
  s.push(`<rect x="${x0}" y="${yT0}" width="${x1 - x0}" height="${yT1 - yT0}" fill="none" stroke="${AZUL}" stroke-width="1.2" stroke-dasharray="8 4"/>`);
  s.push(txt(x0 + 8, yT0 + 15, 'TABLERO GENERAL (TG)', { size: 9, bold: true, color: AZUL }));
  s.push(simTM(xc, 268));
  s.push(linea(xc, 308, xc, 330));
  s.push(txt(xc + 14, 284, 'PROTECCIÓN GENERAL', { size: 8, bold: true }));
  s.push(txt(xc + 14, 296, `${a.in ?? '—'} A · ${tri ? '4P' : '2P'} · Curva C`, { size: 8 }));
  const bx0 = Math.min(xc, ...grupos.map((g) => g.cx)) - 10;
  const bx1 = Math.max(xc, ...grupos.map((g) => g.cx)) + 10;
  s.push(linea(bx0, 330, bx1, 330, 4));

  // ── Grupos y circuitos ──
  const yCol = 418; // inicio de los termomagnéticos de circuito
  const yFin = 770;
  for (const g of grupos) {
    s.push(linea(g.cx, 330, g.cx, 345));
    if (g.dif) {
      s.push(simDif(g.cx, 345));
      s.push(txt(g.cx + 12, 360, corto(g.dif.nombre, 16), { size: 8, bold: true }));
      s.push(txt(g.cx + 12, 371, `${g.dif.in} A · 2P`, { size: 7.5 }));
      s.push(txt(g.cx + 12, 381, `IΔn ${g.dif.sensibilidadMA} mA`, { size: 7.5 }));
    } else {
      s.push(linea(g.cx, 345, g.cx, 385));
      s.push(txt(g.cx + 8, 368, 'SIN DIFERENCIAL', { size: 7.5, bold: true, color: '#b91c1c' }));
    }
    s.push(linea(g.cx, 385, g.cx, 402));
    if (g.xs.length > 1) s.push(linea(g.xs[0], 402, g.xs[g.xs.length - 1], 402, 2.5));
    g.idx.forEach((i, j) => {
      const x = g.xs[j];
      const c = p.circuitos[i];
      const rc = r.circuitos[i];
      const ctri = esTrifasico(c);
      s.push(linea(x, 402, x, yCol));
      s.push(simTM(x, yCol));
      s.push(txt(x + 7, yCol + 33, `${rc.in ?? '—'} A`, { size: 7.5, bold: true }));
      s.push(txt(x + 7, yCol + 42, ctri ? '4P' : '2P', { size: 7 }));
      s.push(linea(x, yCol + 40, x, yFin));
      s.push(trazos(x, yT1 + 12, ctri ? 5 : 3));
      s.push(flecha(x, yFin));
      const yTxt = yT1 + 34;
      s.push(txt(x - 5, yTxt, corto(`Cto ${i + 1} · ${c.nombre}`, 40), { size: 8.5, bold: true, anchor: 'end', rot: -90 }));
      s.push(txt(x + 11, yTxt, corto(`${num(rc.potencia, 0)} W · ${leyendaConductores(ctri, rc.seccion, rc.seccion, rc.seccion)} ${c.conductor} Ø${rc.ducto ?? '—'} · ${c.fase}`, 52), { size: 7.5, anchor: 'end', rot: -90 }));
    });
  }

  // ── Tierra de protección ──
  s.push(linea(x0, yT1 - 18, x0 + 30, yT1 - 18, 2.5));
  s.push(linea(x0, yT1 - 18, x0 - 30, yT1 - 18) + simTierra(x0 - 30, yT1 - 18));
  s.push(txt(x0 - 30, yT1 + 14, 'TP', { size: 8, bold: true, anchor: 'middle' }));
  s.push(txt(x0 + 4, yT1 - 23, `Barra TP · ${secc(a.seccionTierra)} mm²`, { size: 7, color: '#555' }));

  // ── Panel derecho: simbología y cajetín ──
  const px = x1 + 40;
  const pw = 300;
  const items: [string, string][] = [
    [`<g transform="translate(14 0)">${simMedidor(0, 14, 10)}</g>`, 'Medidor de energía'],
    [`<g transform="translate(14 -4) scale(0.8)">${simTM(0, 0, false)}</g>`, 'Interruptor termomagnético'],
    [`<g transform="translate(16 -4) scale(0.8)">${simDif(0, 0, false)}</g>`, 'Interruptor diferencial'],
    [`<g transform="translate(14 2)">${simTierra(0, 0, false)}</g>`, 'Puesta a tierra (TS servicio / TP protección)'],
    [`<g transform="translate(14 2)">${linea(0, 0, 0, 28)}${trazos(0, 12, 3)}</g>`, 'Conductores (n° de trazos = n° de conductores)'],
    [`<g transform="translate(0 14)">${linea(0, 0, 28, 0, 4)}</g>`, 'Barra de distribución'],
    [`<rect x="2" y="4" width="24" height="20" fill="none" stroke="${AZUL}" stroke-dasharray="5 2.5"/>`, 'Límite de tablero / empalme'],
    [flecha(14, 26), 'Salida de circuito'],
  ];
  s.push(`<rect x="${px}" y="30" width="${pw}" height="${items.length * 38 + 34}" fill="none" stroke="${TRAZO}" stroke-width="1"/>`);
  s.push(txt(px + 10, 48, 'SIMBOLOGÍA', { size: 10, bold: true, color: AZUL }));
  items.forEach(([g, t], k) => {
    const y = 58 + k * 38;
    s.push(`<g transform="translate(${px + 12} ${y})">${g}</g>`);
    s.push(txt(px + 60, y + 20, t, { size: 8.5 }));
  });

  const v = (x: string) => x || '—';
  const filas: [string, string][] = [
    ['Proyecto', p.nombre],
    ['Propietario', p.propietario],
    ['Dirección', p.direccion],
    ['Comuna', p.comuna],
    ['Destino', NOMBRE_CONSUMIDOR[p.destino]],
    ['Instalador', p.instalador.nombre],
    ['Clase / Licencia', `${p.instalador.clase} / ${v(p.instalador.licencia)}`],
    ['Empresa', p.empresa],
    ['Potencia / Demanda', `${num(a.potInstalada / 1000)} kW / ${num(a.demanda / 1000)} kW`],
  ];
  const cy0 = yFin - (filas.length * 17 + 74);
  s.push(`<rect x="${px}" y="${cy0}" width="${pw}" height="${yFin + 10 - cy0}" fill="none" stroke="${TRAZO}" stroke-width="1.2"/>`);
  s.push(`<rect x="${px}" y="${cy0}" width="${pw}" height="30" fill="${AZUL}"/>`);
  s.push(txt(px + pw / 2, cy0 + 20, 'DIAGRAMA UNILINEAL', { size: 12, bold: true, anchor: 'middle', color: '#fff' }));
  filas.forEach(([k, x], i) => {
    const y = cy0 + 30 + i * 17;
    s.push(linea(px, y, px + pw, y, 0.5));
    s.push(txt(px + 8, y + 12, k, { size: 7.5, color: '#555' }));
    s.push(txt(px + 100, y + 12, corto(v(x), 36), { size: 8.5, bold: true }));
  });
  const yPie = cy0 + 30 + filas.length * 17;
  s.push(linea(px, yPie, px + pw, yPie, 0.5));
  const fecha = new Date().toLocaleDateString('es-CL');
  [['Lámina', '1 / 1'], ['Escala', 'S/E'], ['Fecha', fecha]].forEach(([k, x], i) => {
    const xx = px + (pw / 3) * i;
    if (i) s.push(linea(xx, yPie, xx, yFin + 10, 0.5));
    s.push(txt(xx + 8, yPie + 13, k, { size: 7, color: '#555' }));
    s.push(txt(xx + 8, yPie + 28, x, { size: 9, bold: true }));
  });
  s.push(txt(px + pw, yFin + 22, 'Norma: Pliegos Técnicos RIC (DS 8/2019) · Símbolos IEC 60617', { size: 6.5, anchor: 'end', color: '#777' }));

  const W = px + pw + 20;
  const H = yFin + 34;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}"><rect x="0" y="0" width="${W}" height="${H}" fill="#fff"/><rect x="6" y="6" width="${W - 12}" height="${H - 12}" fill="none" stroke="${TRAZO}" stroke-width="1.5"/>${s.join('')}</svg>`;
}
