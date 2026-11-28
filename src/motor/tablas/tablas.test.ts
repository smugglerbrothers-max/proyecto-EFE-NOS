import { describe, expect, test } from 'vitest';
import { capacidad, factorTemperatura, factorAgrupamiento, diametroDucto } from './ric04';
import { factorSimultaneidad, demandaAlumbrado } from './ric03';

describe('RIC N°04', () => {
  test('Tabla 4.4 capacidades', () => {
    expect(capacidad(2.5, 'B1', 90)).toBe(24);
    expect(capacidad(4, 'B1', 90)).toBe(37);
    expect(capacidad(1.5, 'B1', 70)).toBe(16);
    expect(capacidad(1.5, 'F', 90)).toBeNull();
    expect(capacidad(120, 'D2', 90)).toBe(386);
  });
  test('Tabla 4.7 temperatura', () => {
    expect(factorTemperatura(30, 90, 'B1')).toEqual({ f: 1, fueraDeRango: false });
    expect(factorTemperatura(38, 70, 'B1').f).toBe(0.87);
    expect(factorTemperatura(20, 90, 'D1').f).toBe(1);
    expect(factorTemperatura(70, 90, 'B1')).toEqual({ f: 0.71, fueraDeRango: true });
  });
  test('Tabla 4.6 agrupamiento', () => {
    expect(factorAgrupamiento(3)).toBe(1);
    expect(factorAgrupamiento(5)).toBe(0.8);
    expect(factorAgrupamiento(43)).toBe(0.5);
  });
  test('Tabla 4.17 ductos', () => {
    expect(diametroDucto(2.5, 3)).toBe(20);
    expect(diametroDucto(1.5, 3)).toBe(16);
    expect(diametroDucto(4, 5)).toBe(25);
  });
});

describe('RIC N°03', () => {
  test('Tabla 3.2 simultaneidad', () => {
    expect(factorSimultaneidad(1)).toBe(1);
    expect(factorSimultaneidad(4)).toBe(0.95);
    expect(factorSimultaneidad(25)).toBeCloseTo((15.3 + 2) / 25, 6);
  });
  test('Tabla 3.1 casa habitación 8,7 kW → 4,995 kW', () => {
    expect(demandaAlumbrado(8.7, 'casa')).toBeCloseTo(4.995, 6);
    expect(demandaAlumbrado(2, 'casa')).toBeCloseTo(2, 6);
    expect(demandaAlumbrado(130, 'casa')).toBeCloseTo(3 + 117 * 0.35 + 10 * 0.25, 6);
    expect(demandaAlumbrado(60, 'comercial')).toBeCloseTo(50 + 8, 6);
  });
});
