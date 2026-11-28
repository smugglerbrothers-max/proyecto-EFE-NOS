import { describe, expect, test } from 'vitest';
import { exportarJSON, importarJSON } from './serializar';
import { proyectoEjemplo } from '../motor/ejemplo';

describe('exportar / importar JSON', () => {
  test('ida y vuelta conserva el proyecto', () => {
    const p = proyectoEjemplo();
    const r = importarJSON(exportarJSON(p));
    expect(r).toEqual({ ok: true, proyecto: p });
  });
  test('JSON inválido', () => {
    const r = importarJSON('{no es json');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/no es un archivo JSON válido/);
  });
  test('versión desconocida', () => {
    const r = importarJSON(JSON.stringify({ version: 99, proyecto: proyectoEjemplo() }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/versión/);
  });
  test('falta circuitos', () => {
    const { circuitos: _c, ...resto } = proyectoEjemplo();
    const r = importarJSON(JSON.stringify({ version: 1, proyecto: resto }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/circuitos/);
  });
  test('completa campos nuevos con valores por defecto', () => {
    const { activosPorDucto: _a, ...resto } = proyectoEjemplo();
    const r = importarJSON(JSON.stringify({ version: 1, proyecto: resto }));
    expect(r.ok && r.proyecto.activosPorDucto).toBe(3);
  });
});
