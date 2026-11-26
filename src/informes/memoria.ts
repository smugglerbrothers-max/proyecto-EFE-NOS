import type { ResultadoProyecto } from '../motor';
import { V_MONO, V_TRI, aislacionDe, esTrifasico, rhoProyecto } from '../motor/circuito';
import type { Proyecto } from '../motor/modelo';
import { NOMBRE_CONSUMIDOR } from '../motor/tablas/ric03';
import { num, secc } from '../ui/formato';

export interface Paso {
  formula: string;
  datos: string;
  resultado: string;
  fuente: string;
}
export interface SeccionMemoria {
  titulo: string;
  pasos: Paso[];
}

/** Memoria de cálculo trazable: fórmula, datos, resultado y fuente de cada paso. */
export function memoria(p: Proyecto, r: ResultadoProyecto): SeccionMemoria[] {
  const out: SeccionMemoria[] = [];
  p.circuitos.forEach((c, i) => {
    const rc = r.circuitos[i];
    const tri = esTrifasico(c);
    const V = tri ? V_TRI : V_MONO;
    const rho = rhoProyecto(p, aislacionDe(c.conductor));
    out.push({
      titulo: `Circuito ${i + 1} — ${c.nombre}`,
      pasos: [
        { formula: 'P = 100·Nport + 250·Nench + Notros·Punit', datos: `${c.portalamparas}·100 + ${c.enchufes}·250 + ${c.otros}·${c.potenciaUnitOtros}`, resultado: `${num(rc.potencia, 0)} W`, fuente: 'RIC N°10 5.1.4.5 / 5.1.4.6' },
        { formula: tri ? 'Ib = P / (√3·V·cos φ)' : 'Ib = P / (V·cos φ)', datos: `V = ${V} V, cos φ = ${num(p.cosPhi)}`, resultado: `${num(rc.ib)} A`, fuente: 'Ley de Ohm' },
        { formula: 'In ≥ máx(1,1·Ib ; Ib/0,9)', datos: `Mínimo por tipo/criterio aplicado`, resultado: `${rc.in ?? '—'} A`, fuente: 'RIC N°10 5.1.4.1 / 5.1.4.4' },
        { formula: 'Iz = It·fn·ft ≥ In', datos: `Método ${p.metodo}, ${c.conductor}, ${p.tAmbiente} °C, ${p.activosPorDucto} activos/ducto`, resultado: `${secc(rc.seccion)} mm² (Iz ${num(rc.iz, 1)} A)`, fuente: 'RIC N°04 Tablas N°4.4, 4.6, 4.7; sección mínima 5.4' },
        { formula: tri ? 'ΔV = √3·L·Ib·ρ / S' : 'ΔV = 2·L·Ib·ρ / S', datos: `L = ${num(c.longitud, 1)} m, ρ = ${num(rho, 4)} Ω·mm²/m`, resultado: `${num(rc.dvVolt)} V = ${num(rc.dvPct)} %`, fuente: 'RIC N°03 5.1.3 (≤ 3 %)' },
        { formula: 'Ducto según n° y sección de conductores', datos: `${tri ? 5 : 3} conductores de ${secc(rc.seccion)} mm²`, resultado: `Ø ${rc.ducto ?? '—'} mm`, fuente: 'RIC N°04 Tabla N°4.17' },
      ],
    });
  });
  const a = r.alimentador;
  const tri = p.sistema === 'tri';
  out.push({
    titulo: 'Alimentador',
    pasos: [
      { formula: 'Pinst = Σ P circuitos × n viviendas', datos: `${p.nViviendas} vivienda(s)`, resultado: `${num(a.potInstalada / 1000)} kW`, fuente: 'RIC N°03 6.1' },
      { formula: 'Dmax = Σ tramos·Fd × Fs', datos: `${NOMBRE_CONSUMIDOR[p.destino]}, Fs = ${num(a.fs, 3)}`, resultado: `${num(a.demanda / 1000)} kW (Fd global ${num(a.factorDemanda, 3)})`, fuente: 'RIC N°03 Tabla N°3.1 y Tabla N°3.2' },
      { formula: tri ? 'Ib = D / (√3·380·cos φ)' : 'Ib = D / (220·cos φ)', datos: `cos φ = ${num(p.cosPhi)}`, resultado: `${num(a.ib)} A → protección ${a.in ?? '—'} A`, fuente: 'RIC N°03 5.2.2; RIC N°10 5.2 (mín. 25 A vivienda)' },
      { formula: 'Iz ≥ In y ΔV ≤ 3 %; S ≥ 4 mm²', datos: `L = ${num(p.longitudAlimentador, 1)} m, ${p.conductorAlimentador}, método ${p.metodo}`, resultado: `${secc(a.seccionFase)} mm² (Iz ${num(a.iz, 1)} A), ΔV ${num(a.dvPct)} %`, fuente: 'RIC N°03 5.1.2 / 5.1.3; RIC N°04 Tabla N°4.4' },
      { formula: 'Neutro', datos: tri ? `Cargas no lineales: ${p.noLineales}` : 'Monofásico', resultado: `${secc(a.seccionNeutro)} mm²`, fuente: 'RIC N°03 6.4' },
      { formula: 'Conductor de protección', datos: 'S ≤ 16 → S; 16–35 → 16; > 35 → S/2', resultado: `${secc(a.seccionTierra)} mm²`, fuente: 'IEC 60364-5-54 (verificar con RIC N°06)' },
    ],
  });
  const e = r.empalme;
  out.push({
    titulo: 'Empalme',
    pasos: [{
      formula: 'Menor empalme con In ≥ Ib demanda', datos: `Demanda ${num(a.demanda / 1000)} kW`,
      resultado: e ? `${e.in} A ${e.fases === 1 ? 'monofásico' : 'trifásico'} · ${num(e.potMaxKVA, 1)} kVA ${e.tipos} ${e.tarifa}` : 'Sin empalme en tabla',
      fuente: 'Norma de la distribuidora (tabla editable, no verificada)',
    }],
  });
  return out;
}
