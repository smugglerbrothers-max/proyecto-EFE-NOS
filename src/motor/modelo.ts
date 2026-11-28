import type { Metodo, TipoCircuito, TipoConsumidor } from './tablas/tipos';
export type { Metodo, TipoCircuito, TipoConsumidor } from './tablas/tipos';

export type Sistema = 'mono' | 'tri';
export type Fase = 'R' | 'S' | 'T' | 'RST';

export interface Diferencial {
  id: string;
  nombre: string;
  in: number;
  sensibilidadMA: number;
}

export interface Circuito {
  id: string;
  nombre: string;
  tipo: TipoCircuito;
  portalamparas: number;
  enchufes: number;
  otros: number;
  potenciaUnitOtros: number;
  fase: Fase;
  diferencialId: string | null;
  disyuntorManual?: number;
  seccionManual?: number;
  conductor: string;
  longitud: number;
  ubicacion: string;
}

export interface Proyecto {
  version: 1;
  id: string;
  nombre: string;
  comuna: string;
  propietario: string;
  direccion: string;
  instalador: { nombre: string; clase: string; licencia: string };
  empresa: string;
  logo?: string;
  destino: TipoConsumidor;
  superficieM2: number;
  sistema: Sistema;
  longitudAlimentador: number;
  metodo: Metodo;
  tAmbiente: number;
  nViviendas: number;
  cosPhi: number;
  conductorAlimentador: string;
  /** N° de conductores activos que comparten un ducto (Tabla N°4.6). */
  activosPorDucto: number;
  reunionPersonas: boolean;
  subterraneo: boolean;
  noLineales: 'no' | 'concentrado' | 'distribuido';
  /** ρ del cobre: a la temperatura de servicio del conductor o a 20 °C. */
  resistividad: 'servicio' | '20C';
  /** Corriente de cortocircuito en el punto de empalme [kA] (dato de la distribuidora). */
  iccEmpalmeKA: number;
  /** Capacidad de ruptura de la protección general y de las de circuito [kA]. */
  icuGeneralKA: number;
  icuCircuitosKA: number;
  diferenciales: Diferencial[];
  circuitos: Circuito[];
  actualizado: string;
}

export const nuevoId = () => Math.random().toString(36).slice(2, 10);

export function proyectoNuevo(): Proyecto {
  return {
    version: 1,
    id: nuevoId(),
    nombre: 'Proyecto Eléctrico RIC',
    comuna: '',
    propietario: '',
    direccion: '',
    instalador: { nombre: '', clase: 'A', licencia: '' },
    empresa: '',
    destino: 'casa',
    superficieM2: 60,
    sistema: 'mono',
    longitudAlimentador: 10,
    metodo: 'B1',
    tAmbiente: 30,
    nViviendas: 1,
    cosPhi: 1,
    conductorAlimentador: 'THHN',
    activosPorDucto: 3,
    reunionPersonas: false,
    subterraneo: false,
    noLineales: 'no',
    resistividad: 'servicio',
    iccEmpalmeKA: 10,
    icuGeneralKA: 10,
    icuCircuitosKA: 6,
    diferenciales: [],
    circuitos: [],
    actualizado: new Date().toISOString(),
  };
}

export const NOMBRE_TIPO: Record<TipoCircuito, string> = {
  iluminacion: 'Iluminación',
  enchufes: 'Enchufes',
  cocina: 'Cocina / Lavadero 16 A',
  horno: 'Horno / Clima',
  mixto: 'Mixto',
  otros: 'Otros',
};

export function circuitoNuevo(tipo: TipoCircuito, over: Partial<Circuito> = {}): Circuito {
  return {
    id: nuevoId(),
    nombre: NOMBRE_TIPO[tipo],
    tipo,
    portalamparas: 0,
    enchufes: 0,
    otros: 0,
    potenciaUnitOtros: 0,
    fase: 'R',
    diferencialId: null,
    conductor: 'THHN',
    longitud: 10,
    ubicacion: '',
    ...over,
  };
}
