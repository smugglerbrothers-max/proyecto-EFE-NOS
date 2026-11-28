import { describe, expect, test } from 'vitest';
import { calcularProyecto } from './index';
import { proyectoEjemplo } from './ejemplo';
import { proyectoNuevo } from './modelo';

describe('cortocircuito y capacidad de ruptura', () => {
  test('valores por defecto del proyecto', () => {
    const p = proyectoNuevo();
    expect(p.iccEmpalmeKA).toBe(10);
    expect(p.icuGeneralKA).toBe(10);
    expect(p.icuCircuitosKA).toBe(6);
  });
  test('Icc en el TG (monofásico): V / (V/Icc0 + 2·L·ρ20/S)', () => {
    const r = calcularProyecto(proyectoEjemplo());
    const zRed = 220 / 10000;
    const zAli = (2 * 10 * 0.0178) / 4;
    expect(r.alimentador.iccTG_kA!).toBeCloseTo(220 / (zRed + zAli) / 1000, 4);
  });
  test('Icc en el TG (trifásico): (V/√3) / (Zred + L·ρ20/S)', () => {
    const p = proyectoEjemplo();
    p.sistema = 'tri';
    const r = calcularProyecto(p);
    const vf = 380 / Math.sqrt(3);
    const s = r.alimentador.seccionFase!;
    expect(r.alimentador.iccTG_kA!).toBeCloseTo(vf / (vf / 10000 + (10 * 0.0178) / s) / 1000, 4);
  });
  test('caso ejemplo cumple', () => {
    const errores = calcularProyecto(proyectoEjemplo()).hallazgos.filter((h) => h.regla === 'RIC N°10 5.1.4.2');
    expect(errores).toEqual([]);
  });
  test('Icu menor que Icc → error en general y circuitos', () => {
    const p = proyectoEjemplo();
    p.longitudAlimentador = 0;
    p.iccEmpalmeKA = 12;
    p.icuGeneralKA = 10;
    p.icuCircuitosKA = 6;
    const h = calcularProyecto(p).hallazgos.filter((x) => x.regla === 'RIC N°10 5.1.4.2');
    expect(h.map((x) => x.mensaje).join(' ')).toMatch(/general/i);
    expect(h.map((x) => x.mensaje).join(' ')).toMatch(/circuitos/i);
  });
  test('Icc empalme inválido → sin NaN y con error', () => {
    const p = proyectoEjemplo();
    p.iccEmpalmeKA = 0;
    const r = calcularProyecto(p);
    expect(r.alimentador.iccTG_kA).toBeNull();
    expect(r.hallazgos.some((h) => h.mensaje.includes('Icc'))).toBe(true);
  });
});
