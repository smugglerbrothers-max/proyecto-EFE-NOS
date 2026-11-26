import { describe, expect, test } from 'vitest';
import { calcularProyecto } from '../motor';
import { proyectoEjemplo } from '../motor/ejemplo';
import { filasCuadroCargas, COLUMNAS_CUADRO } from './cuadroCargas';
import { unilinealSVG } from './unilineal';
import { memoria } from './memoria';
import { definicionPDF } from './pdf';

const p = proyectoEjemplo();
const r = calcularProyecto(p);

describe('informes', () => {
  test('cuadro de cargas: 6 filas + totales', () => {
    const f = filasCuadroCargas(p, r);
    expect(f).toHaveLength(7);
    expect(f[6][1]).toBe('TOTALES');
    expect(f[6][COLUMNAS_CUADRO.indexOf('POT. (W)')]).toBe('8.700');
    expect(f[0][COLUMNAS_CUADRO.indexOf('% CARGA')]).toBe('27');
  });
  test('unilineal con empalme y los 6 circuitos', () => {
    const svg = unilinealSVG(p, r);
    expect(svg.startsWith('<svg')).toBe(true);
    expect(svg).toContain('EMPALME 25 A');
    for (const c of p.circuitos) expect(svg).toContain(c.nombre);
  });
  test('unilineal escapa caracteres especiales', () => {
    const q = proyectoEjemplo();
    q.circuitos[0].nombre = 'Luz <cocina> & baño';
    expect(unilinealSVG(q, calcularProyecto(q))).toContain('Luz &lt;cocina&gt; &amp; baño');
  });
  test('memoria del alimentador cita la Tabla 3.1', () => {
    const m = memoria(p, r);
    const ali = m.find((s) => s.titulo.startsWith('Alimentador'))!;
    expect(ali.pasos.some((x) => x.fuente.includes('RIC N°03 Tabla N°3.1'))).toBe(true);
  });
  test('definición PDF apaisada, sin NaN', () => {
    const d = definicionPDF(p, r, '<svg xmlns="http://www.w3.org/2000/svg"></svg>');
    expect(d.pageOrientation).toBe('landscape');
    expect(JSON.stringify(d)).not.toMatch(/NaN|undefined/);
  });
});

import { nombreArchivo } from '../ui/Encabezado';
test('nombre de archivo sin tildes ni símbolos', () => {
  expect(nombreArchivo('Proyecto Eléctrico RIC')).toBe('Proyecto-Electrico-RIC');
  expect(nombreArchivo('  ¿Ñuñoa / 2° piso?  ')).toBe('Nunoa-2-piso');
  expect(nombreArchivo('***')).toBe('proyecto');
});
