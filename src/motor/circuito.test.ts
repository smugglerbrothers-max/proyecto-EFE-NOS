import { describe, expect, test } from 'vitest';
import { calcularCircuito } from './circuito';
import { circuitoNuevo, proyectoNuevo } from './modelo';

const p = proyectoNuevo();
const c = (over: Parameters<typeof circuitoNuevo>[1] = {}, tipo: Parameters<typeof circuitoNuevo>[0] = 'iluminacion') =>
  circuitoNuevo(tipo, { longitud: 10, ...over });

describe('calcularCircuito — caso de la captura (220 V, cos φ 1, B1, 30 °C, THHN, 10 m)', () => {
  test('alumbrado 6 portalámparas', () => {
    const r = calcularCircuito(c({ portalamparas: 6 }), p);
    expect(r.potencia).toBe(600);
    expect(r.in).toBe(10);
    expect(r.seccion).toBe(1.5);
    expect(Math.round(r.pctCarga!)).toBe(27);
    expect(r.ducto).toBe(16);
    expect(r.errores).toEqual([]);
  });
  test('enchufes 8 → 2000 W, 16 A, 2,5 mm², Ø20', () => {
    const r = calcularCircuito(c({ enchufes: 8 }, 'enchufes'), p);
    expect(r.potencia).toBe(2000);
    expect(r.ib).toBeCloseTo(9.0909, 3);
    expect(r.in).toBe(16);
    expect(r.seccion).toBe(2.5);
    expect(r.ducto).toBe(20);
  });
  test('horno 3000 W → 16 A, 85 %, ΔV ≈ 1,13 %', () => {
    const r = calcularCircuito(c({ otros: 1, potenciaUnitOtros: 3000 }, 'horno'), p);
    expect(r.in).toBe(16);
    expect(Math.round(r.pctCarga!)).toBe(85);
    expect(r.dvPct).toBeCloseTo(1.13, 2);
  });
});

describe('casos límite', () => {
  test('30 kW monofásico: sin sección, con error, sin NaN', () => {
    const r = calcularCircuito(c({ otros: 1, potenciaUnitOtros: 30000 }, 'otros'), p);
    expect(r.seccion).toBeNull();
    expect(r.errores.length).toBeGreaterThan(0);
    expect(Object.values(r).some((v) => typeof v === 'number' && Number.isNaN(v))).toBe(false);
  });
  test('longitud 0 → ΔV 0', () => {
    expect(calcularCircuito(c({ portalamparas: 6, longitud: 0 }), p).dvPct).toBe(0);
  });
  test('cos φ 0 → error', () => {
    const r = calcularCircuito(c({ portalamparas: 6 }), { ...p, cosPhi: 0 });
    expect(r.errores).toContain('cos φ inválido');
    expect(r.ib).toBeNull();
  });
  test('sección manual bajo el mínimo se respeta y se informa', () => {
    const r = calcularCircuito(c({ enchufes: 8, seccionManual: 1.5 }, 'enchufes'), p);
    expect(r.seccion).toBe(1.5);
    expect(r.errores.join(' ')).toMatch(/sección mínima/);
  });
  test('disyuntor manual mayor que Iz se informa', () => {
    const r = calcularCircuito(c({ portalamparas: 6, disyuntorManual: 25, seccionManual: 1.5 }), p);
    expect(r.in).toBe(25);
    expect(r.errores.join(' ')).toMatch(/Iz/);
  });
  test('potencia negativa → error', () => {
    const r = calcularCircuito(c({ otros: 1, potenciaUnitOtros: -100 }, 'otros'), p);
    expect(r.errores).toContain('Potencia inválida');
  });
});
