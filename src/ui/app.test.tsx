// @vitest-environment jsdom
import { afterEach, describe, expect, test } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import App from '../App';
import { proyectoEjemplo } from '../motor/ejemplo';
import type { Almacen } from '../datos/almacen';
import type { Proyecto } from '../motor/modelo';

function almacenMemoria(): Almacen {
  const m = new Map<string, Proyecto>();
  return {
    listar: async () => [...m.values()].map(({ id, nombre, actualizado }) => ({ id, nombre, actualizado })),
    cargar: async (id) => m.get(id) ?? null,
    guardar: async (p) => void m.set(p.id, p),
    borrar: async (id) => void m.delete(id),
  };
}

afterEach(cleanup);

describe('App', () => {
  test('muestra el resumen del proyecto de ejemplo', () => {
    render(<App almacen={almacenMemoria()} inicial={proyectoEjemplo()} />);
    const panel = screen.getByTestId('panel-resumen');
    expect(panel.textContent).toContain('8,70 kW');
    expect(panel.textContent).toContain('5,00 kW');
    expect(panel.textContent).toContain('25 A');
    expect(panel.textContent).toContain('Proyecto conforme');
  });
  test('agregar un 4.º circuito al Diferencial 1 genera el hallazgo 5.1.3.7', () => {
    render(<App almacen={almacenMemoria()} inicial={proyectoEjemplo()} />);
    fireEvent.click(screen.getByRole('button', { name: '+ Iluminación' }));
    expect(screen.getByTestId('panel-resumen').textContent).toContain('RIC N°10 5.1.3.7');
  });
  test('muestra el diagrama unilineal en pantalla', () => {
    render(<App almacen={almacenMemoria()} inicial={proyectoEjemplo()} />);
    const sec = screen.getByTestId('unilineal');
    expect(sec.querySelector('svg')).not.toBeNull();
    expect(sec.textContent).toContain('DIAGRAMA UNILINEAL');
  });
  test('editar portalámparas recalcula la potencia instalada', () => {
    render(<App almacen={almacenMemoria()} inicial={proyectoEjemplo()} />);
    const campo = screen.getAllByLabelText('Portalámparas cto 1')[0] as HTMLInputElement;
    fireEvent.change(campo, { target: { value: '10' } });
    expect(screen.getByTestId('panel-resumen').textContent).toContain('9,10 kW');
  });
});
