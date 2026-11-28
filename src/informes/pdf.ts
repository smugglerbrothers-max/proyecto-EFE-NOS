import type { TDocumentDefinitions, Content } from 'pdfmake/interfaces';
import type { ResultadoProyecto } from '../motor';
import type { Proyecto } from '../motor/modelo';
import { NOMBRE_CONSUMIDOR } from '../motor/tablas/ric03';
import { num } from '../ui/formato';
import { COLUMNAS_CUADRO, filasCuadroCargas } from './cuadroCargas';
import { memoria } from './memoria';
import { unilinealSVG } from './unilineal';

const AZUL = '#1e3a8a';
const TABLA_COMPACTA = {
  hLineWidth: (i: number) => (i === 0 ? 0 : 0.5),
  vLineWidth: () => 0,
  hLineColor: () => '#d1d5db',
  paddingLeft: () => 2,
  paddingRight: () => 2,
  paddingTop: () => 2,
  paddingBottom: () => 2,
};

/** Definición pdfmake (pura, probada sin generar el binario). */
export function definicionPDF(p: Proyecto, r: ResultadoProyecto, svg: string): TDocumentDefinitions {
  const v = (s: string) => s || '—';
  const datos: [string, string][] = [
    ['Proyecto', v(p.nombre)], ['Comuna', v(p.comuna)], ['Propietario', v(p.propietario)], ['Dirección', v(p.direccion)],
    ['Instalador', `${v(p.instalador.nombre)} · Clase ${p.instalador.clase} · Lic. ${v(p.instalador.licencia)}`],
    ['Destino', NOMBRE_CONSUMIDOR[p.destino]], ['Tipo de empalme', p.sistema === 'mono' ? 'Monofásico 220 V' : 'Trifásico 380 V'],
    ['Fecha', new Date().toLocaleDateString('es-CL', { day: 'numeric', month: 'long', year: 'numeric' })],
    ['Potencia instalada', `${num(r.alimentador.potInstalada / 1000)} kW`], ['Demanda máxima', `${num(r.alimentador.demanda / 1000)} kW`],
  ];
  const filas = filasCuadroCargas(p, r);
  const encabezado: Content = {
    columns: [
      [
        ...(p.logo ? [{ image: p.logo, fit: [90, 40] as [number, number], margin: [0, 0, 0, 4] as [number, number, number, number] }] : []),
        { text: 'CUADRO DE CARGAS DE ALUMBRADO', style: 'titulo' },
        { text: 'Pliego Técnico RIC N°18 — Figura 18.4.1 · SEC Chile', style: 'tenue' },
        ...(p.empresa ? [{ text: p.empresa, style: 'tenue' }] : []),
      ],
      {
        width: 260,
        table: { widths: [90, '*'], body: datos.map(([k, x]) => [{ text: k, style: 'tenue', alignment: 'right' }, { text: x, bold: true, fontSize: 8 }]) },
        layout: 'noBorders',
      },
    ],
  };
  const errores = r.hallazgos.filter((h) => h.nivel === 'error');
  const memo = memoria(p, r);
  return {
    pageSize: 'LETTER',
    pageOrientation: 'landscape',
    pageMargins: [30, 30, 30, 34],
    info: { title: p.nombre, creator: 'Calculadora RIC' },
    defaultStyle: { fontSize: 8 },
    footer: (pag, total) => ({
      columns: [{ text: p.nombre, style: 'tenue' }, { text: `Página ${pag} de ${total}`, alignment: 'center', style: 'tenue' }, { text: 'Generado con Calculadora RIC', alignment: 'right', style: 'tenue' }],
      margin: [30, 10, 30, 0],
    }),
    content: [
      encabezado,
      { canvas: [{ type: 'line', x1: 0, y1: 4, x2: 732, y2: 4, lineWidth: 1.5, lineColor: AZUL }], margin: [0, 4, 0, 8] },
      { text: 'Cuadro de Cargas de Alumbrado (Figura 18.4.1)', style: 'subtitulo' },
      {
        table: {
          headerRows: 1,
          widths: [22, '*', 24, 24, 24, 30, 34, 22, 70, 28, 22, 30, 32, 28, 24, 30, 60],
          body: [
            COLUMNAS_CUADRO.map((c) => ({ text: c, style: 'th' })),
            ...filas.map((f, i) => f.map((x) => ({ text: x, fontSize: 7, bold: i === filas.length - 1 }))),
          ],
        },
        layout: TABLA_COMPACTA,
      },
      { text: 'Diagrama Unilineal — Tablero General', style: 'subtitulo', pageBreak: 'before' },
      { svg, fit: [732, 520], alignment: 'center' },
      { text: 'Memoria de cálculo', style: 'subtitulo', pageBreak: 'before' },
      ...memo.flatMap((s): Content[] => [
        { text: s.titulo, bold: true, margin: [0, 8, 0, 3], color: AZUL },
        {
          table: {
            headerRows: 1,
            widths: [150, '*', 130, 170],
            body: [
              ['Fórmula', 'Datos', 'Resultado', 'Fuente'].map((t) => ({ text: t, style: 'th' })),
              ...s.pasos.map((x) => [x.formula, x.datos, { text: x.resultado, bold: true }, { text: x.fuente, style: 'tenue' }]),
            ],
          },
          layout: 'lightHorizontalLines',
        },
      ]),
      { text: 'Auditoría normativa', style: 'subtitulo', margin: [0, 14, 0, 4] },
      r.hallazgos.length === 0
        ? { text: '✓ Proyecto conforme con las reglas verificadas.', color: '#15803d' }
        : { ul: r.hallazgos.map((h) => ({ text: `${h.regla} — ${h.mensaje}`, color: h.nivel === 'error' ? '#b91c1c' : '#b45309' })) },
      {
        text: `${errores.length ? `${errores.length} error(es). ` : ''}Valores normativos transcritos de los Pliegos RIC N°03, N°04 y N°10 (SEC, Res. Ex. 33.877 de 2020). Tabla de empalmes, límite de ΔV total y conductor de protección deben confirmarse por el proyectista.`,
        style: 'tenue', margin: [0, 10, 0, 0],
      },
    ],
    styles: {
      titulo: { fontSize: 15, bold: true, color: AZUL },
      subtitulo: { fontSize: 10, bold: true, color: AZUL, margin: [0, 0, 0, 6] },
      tenue: { fontSize: 7, color: '#6b7280' },
      th: { fontSize: 6.5, bold: true, fillColor: '#eef2f8', alignment: 'center' },
    },
  };
}

/** Genera el PDF en el dispositivo (carga pdfmake solo al usarlo). */
export async function generarPDF(p: Proyecto, r: ResultadoProyecto): Promise<Blob> {
  const [{ default: pdfMake }, { default: fuentes }] = await Promise.all([
    import('pdfmake/build/pdfmake'),
    import('pdfmake/build/vfs_fonts'),
  ]);
  pdfMake.addVirtualFileSystem(fuentes);
  return pdfMake.createPdf(definicionPDF(p, r, unilinealSVG(p, r))).getBlob();
}
