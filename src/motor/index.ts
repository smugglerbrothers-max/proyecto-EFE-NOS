import { calcularAlimentador, type ResultadoAlimentador } from './alimentador';
import { auditar, balanceFases, type Balance, type Hallazgo } from './auditoria';
import { calcularCircuito, type ResultadoCircuito } from './circuito';
import { seleccionarEmpalme } from './empalme';
import type { Proyecto } from './modelo';
import type { Empalme } from './tablas/empalmes';

export interface ResultadoProyecto {
  circuitos: ResultadoCircuito[];
  alimentador: ResultadoAlimentador;
  empalme: Empalme | null;
  hallazgos: Hallazgo[];
  balance: Balance;
}

export function calcularProyecto(p: Proyecto): ResultadoProyecto {
  const circuitos = p.circuitos.map((c) => calcularCircuito(c, p));
  const alimentador = calcularAlimentador(p, circuitos);
  const empalme = seleccionarEmpalme(p, alimentador.demanda / 1000);
  const balance = balanceFases(p, circuitos);
  const hallazgos = auditar(p, circuitos, alimentador, empalme, balance);
  return { circuitos, alimentador, empalme, hallazgos, balance };
}

export type { ResultadoAlimentador, ResultadoCircuito, Hallazgo, Balance, Empalme };
