/** Referencia normativa de un dato. `verificado` = transcrito del PDF oficial SEC. */
export interface Fuente {
  pliego: string;
  ref: string;
  verificado: boolean;
  nota?: string;
}

export type Metodo = 'A1' | 'A2' | 'B1' | 'B2' | 'D1' | 'D2' | 'E' | 'F';
export type Aislacion = 70 | 90;
export type TipoCircuito = 'iluminacion' | 'enchufes' | 'cocina' | 'horno' | 'mixto' | 'otros';
export type TipoConsumidor =
  | 'casa'
  | 'hospital'
  | 'hotel'
  | 'bodega'
  | 'servicios'
  | 'comercial'
  | 'otro';
