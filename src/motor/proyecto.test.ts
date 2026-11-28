import { describe, expect, test } from 'vitest';
import { calcularProyecto } from './index';
import { seleccionarEmpalme } from './empalme';
import { proyectoEjemplo } from './ejemplo';
import { circuitoNuevo } from './modelo';

const reglas = (p: ReturnType<typeof proyectoEjemplo>) =>
  calcularProyecto(p).hallazgos.filter((h) => h.nivel === 'error').map((h) => h.regla);

describe('alimentador — caso captura', () => {
  const r = calcularProyecto(proyectoEjemplo()).alimentador;
  test('demanda y corriente', () => {
    expect(r.potInstalada).toBe(8700);
    expect(r.demanda).toBeCloseTo(4995, 6);
    expect(r.ib).toBeCloseTo(22.70, 2);
    expect(r.in).toBe(25);
  });
  test('secciones', () => {
    expect(r.seccionFase).toBe(4);
    expect(r.seccionNeutro).toBe(4);
    expect(r.seccionTierra).toBe(4);
  });
  test('ΔV con ρ a 90 °C', () => {
    const rho = 0.0178 * (1 + 0.00393 * 70);
    expect(r.dvPct).toBeCloseTo(((2 * 10 * (4995 / 220) * rho) / 4 / 220) * 100, 6);
  });
});

describe('empalme', () => {
  const p = proyectoEjemplo();
  test('4995 W mono → 25 A, 5,5 kVA', () => {
    const e = seleccionarEmpalme(p, 4.995)!;
    expect(e.in).toBe(25);
    expect(e.potMaxKVA).toBeCloseTo(5.5, 6);
  });
  test('12 kW mono → 63 A', () => expect(seleccionarEmpalme(p, 12)!.in).toBe(63));
  test('30 kW mono → null y hallazgo', () => {
    expect(seleccionarEmpalme(p, 30)).toBeNull();
    const q = proyectoEjemplo();
    q.circuitos[5].potenciaUnitOtros = 80000;
    q.circuitos[5].tipo = 'otros';
    expect(reglas(q)).toContain('Empalme');
  });
});

describe('auditoría', () => {
  test('caso captura sin errores', () => expect(reglas(proyectoEjemplo())).toEqual([]));
  test('4 circuitos en un diferencial', () => {
    const p = proyectoEjemplo();
    p.circuitos.push(circuitoNuevo('iluminacion', { portalamparas: 2, diferencialId: 'd1' }));
    expect(reglas(p)).toContain('RIC N°10 5.1.3.7');
  });
  test('vivienda ≥ 30 m² con 2 circuitos', () => {
    const p = proyectoEjemplo();
    p.circuitos = p.circuitos.slice(4);
    expect(reglas(p)).toContain('RIC N°10 5.2 b)');
  });
  test('sin circuito de cocina', () => {
    const p = proyectoEjemplo();
    p.circuitos = p.circuitos.filter((c) => c.tipo !== 'cocina');
    expect(reglas(p)).toContain('RIC N°10 5.2 d)');
  });
  test('Σ In aguas abajo > In diferencial', () => {
    const p = proyectoEjemplo();
    p.diferenciales[1].in = 20; // < protección general 25 A y < Σ 48 A
    expect(reglas(p)).toContain('RIC N°10 5.1.3.6');
  });
  test('un diferencial para todos los circuitos', () => {
    const p = proyectoEjemplo();
    p.circuitos = p.circuitos.slice(0, 3);
    p.circuitos.push(circuitoNuevo('cocina', { enchufes: 2, diferencialId: 'd1' }));
    p.circuitos = p.circuitos.slice(1);
    expect(reglas(p)).toContain('RIC N°10 5.1.3.7');
  });
  test('ΔV alimentador > 3 %', () => {
    const p = proyectoEjemplo();
    p.longitudAlimentador = 80;
    p.conductorAlimentador = 'THHN';
    const r = calcularProyecto(p);
    // el motor sube la sección para cumplir; con sección manual imposible se informa
    expect(r.alimentador.dvPct!).toBeLessThanOrEqual(3);
    expect(r.alimentador.seccionFase!).toBeGreaterThan(4);
  });
  test('balance trifásico desequilibrado → aviso', () => {
    const p = proyectoEjemplo();
    p.sistema = 'tri';
    const avisos = calcularProyecto(p).hallazgos.filter((h) => h.nivel === 'aviso').map((h) => h.regla);
    expect(avisos).toContain('Balance de fases');
  });
  test('circuito sin diferencial', () => {
    const p = proyectoEjemplo();
    p.circuitos[0].diferencialId = null;
    expect(reglas(p)).toContain('RIC N°10 5.1.3.5');
  });
});
