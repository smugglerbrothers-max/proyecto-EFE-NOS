import { circuitoNuevo, proyectoNuevo, type Proyecto } from './modelo';

/** Proyecto de las capturas de referencia: casa de 2 pisos, 6 circuitos, 8,7 kW. */
export function proyectoEjemplo(): Proyecto {
  const p = proyectoNuevo();
  p.diferenciales = [
    { id: 'd1', nombre: 'Diferencial 1', in: 40, sensibilidadMA: 30 },
    { id: 'd2', nombre: 'Diferencial 2', in: 40, sensibilidadMA: 30 },
  ];
  p.circuitos = [
    circuitoNuevo('iluminacion', { id: 'c1', nombre: 'Alumbrado 1° piso', portalamparas: 6, diferencialId: 'd1', ubicacion: 'Primer piso' }),
    circuitoNuevo('iluminacion', { id: 'c2', nombre: 'Alumbrado 2° piso', portalamparas: 6, diferencialId: 'd1', ubicacion: 'Segundo piso' }),
    circuitoNuevo('enchufes', { id: 'c3', nombre: 'Enchufes dormitorios', enchufes: 8, diferencialId: 'd1', ubicacion: 'Dormitorios' }),
    circuitoNuevo('enchufes', { id: 'c4', nombre: 'Enchufes living/comedor', enchufes: 8, diferencialId: 'd2', ubicacion: 'Living / Comedor' }),
    circuitoNuevo('cocina', { id: 'c5', nombre: 'Cocina / Lavadero', enchufes: 2, diferencialId: 'd2', ubicacion: 'Cocina' }),
    circuitoNuevo('horno', { id: 'c6', nombre: 'Horno eléctrico', otros: 1, potenciaUnitOtros: 3000, diferencialId: 'd2', ubicacion: 'Cocina' }),
  ];
  return p;
}
