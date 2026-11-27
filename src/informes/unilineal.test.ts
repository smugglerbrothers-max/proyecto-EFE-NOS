import { describe, expect, test } from 'vitest';
import { calcularProyecto } from '../motor';
import { proyectoEjemplo } from '../motor/ejemplo';
import { unilinealSVG } from './unilineal';

const cuenta = (s: string, clase: string) => (s.match(new RegExp(`class="${clase}"`, 'g')) ?? []).length;

describe('unilineal profesional', () => {
  const p = proyectoEjemplo();
  p.nombre = 'Casa Pérez';
  const svg = unilinealSVG(p, calcularProyecto(p));

  test('un termomagnético por circuito + general, un símbolo por diferencial', () => {
    expect(cuenta(svg, 'sim-tm')).toBe(p.circuitos.length + 1);
    expect(cuenta(svg, 'sim-dif')).toBe(p.diferenciales.length);
  });
  test('medidor, tierra, simbología y cajetín', () => {
    expect(svg).toContain('kWh');
    expect(cuenta(svg, 'sim-tierra')).toBeGreaterThanOrEqual(2);
    expect(svg).toContain('SIMBOLOGÍA');
    expect(svg).toContain('Casa Pérez');
    expect(svg).toContain('DIAGRAMA UNILINEAL');
  });
  test('leyendas de conductores y alimentador', () => {
    expect(svg).toContain('2×1,5 + T 1,5 mm² THHN Ø16');
    expect(svg).toContain('2×4 + T 4 mm² THHN');
    expect(svg).toContain('25 A · 2P');
    expect(svg).toContain('IΔn 30 mA');
  });
  test('trifásico: 3 fases + neutro y general 4P', () => {
    const q = proyectoEjemplo();
    q.sistema = 'tri';
    const s = unilinealSVG(q, calcularProyecto(q));
    expect(s).toMatch(/3×\S+ \+ N \S+ \+ T \S+ mm²/);
    expect(s).toContain('4P');
  });
  test('circuito sin diferencial cuelga de la barra principal con advertencia', () => {
    const q = proyectoEjemplo();
    q.circuitos[0].diferencialId = null;
    const s = unilinealSVG(q, calcularProyecto(q));
    expect(cuenta(s, 'sim-tm')).toBe(q.circuitos.length + 1);
    expect(s).toContain('SIN DIFERENCIAL');
  });
  test('sin NaN ni undefined, incluso sin circuitos', () => {
    const q = proyectoEjemplo();
    q.circuitos = [];
    q.diferenciales = [];
    for (const s of [svg, unilinealSVG(q, calcularProyecto(q))]) expect(s).not.toMatch(/NaN|undefined/);
  });
});
