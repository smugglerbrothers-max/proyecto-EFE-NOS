import type { ResultadoProyecto } from '../motor';
import { useProyecto } from '../estado';
import { num, secc } from './formato';

const Dato = ({ k, v }: { k: string; v: string }) => (
  <div className="dato"><span>{k}</span><b>{v}</b></div>
);

export function PanelResumen({ r }: { r: ResultadoProyecto }) {
  const p = useProyecto((s) => s.proyecto);
  const a = r.alimentador;
  const errores = r.hallazgos.filter((h) => h.nivel === 'error');
  return (
    <aside className="panel" data-testid="panel-resumen">
      <section className={`tarjeta estado ${errores.length ? 'mal' : 'bien'}`}>
        <h3>Cumplimiento RIC <span>{errores.length ? `● ${errores.length} error(es)` : '● OK'}</span></h3>
        <Dato k="Potencia instalada" v={`${num(a.potInstalada / 1000)} kW`} />
        <Dato k="Demanda máxima" v={`${num(a.demanda / 1000)} kW`} />
        <Dato k="Factor de demanda" v={num(a.factorDemanda, 3)} />
        <Dato k="Factor simultaneidad" v={num(a.fs, 3)} />
        <Dato k="Circuitos" v={String(p.circuitos.length)} />
        <Dato k="Diferenciales" v={String(p.diferenciales.length)} />
      </section>
      <section className="tarjeta">
        <h3>Empalme normalizado</h3>
        {r.empalme ? (
          <>
            <p className="grande">{r.empalme.in} A</p>
            <p className="tenue">
              {r.empalme.fases === 1 ? 'Monofásico 220 V' : 'Trifásico 380 V'} · máx. {num(r.empalme.potMaxKVA, 1)} kVA
              {r.empalme.tipos && <><br />Tipos: {r.empalme.tipos}</>}<br />Tarifa: {r.empalme.tarifa}
              <br /><small>Tabla editable: confirmar con la distribuidora.</small>
            </p>
          </>
        ) : <p className="mal">Sin empalme que cubra la demanda</p>}
      </section>
      <section className="tarjeta">
        <h3>Resumen de alimentador</h3>
        <Dato k="Corriente Ib" v={`${num(a.ib)} A`} />
        <Dato k="Protección" v={`${a.in ?? '—'} A`} />
        <Dato k="Sección fase" v={`${secc(a.seccionFase)} mm²`} />
        <Dato k="Sección neutro" v={`${secc(a.seccionNeutro)} mm²`} />
        <Dato k="Tierra (TP)" v={`${secc(a.seccionTierra)} mm²`} />
        <Dato k="Ducto mínimo" v={`Ø ${a.ducto ?? '—'} mm`} />
        <Dato k="ΔV alimentador" v={`${num(a.dvPct)} %`} />
        <Dato k="Icc en TG" v={`${num(a.iccTG_kA)} kA`} />
      </section>
      <section className="tarjeta">
        <h3>Balance de fases</h3>
        {r.balance ? (
          <>
            <Dato k="R" v={`${num(r.balance.R, 0)} W`} />
            <Dato k="S" v={`${num(r.balance.S, 0)} W`} />
            <Dato k="T" v={`${num(r.balance.T, 0)} W`} />
            <Dato k="Desequilibrio" v={`${num(r.balance.desequilibrioPct, 0)} %`} />
          </>
        ) : <p className="tenue">Sistema monofásico: la carga se concentra en una única fase (R).</p>}
      </section>
      <section className="tarjeta">
        <h3>Auditoría normativa</h3>
        {r.hallazgos.length === 0 ? <p className="bien">✓ Proyecto conforme.</p> : (
          <ul className="hallazgos">
            {r.hallazgos.map((h, i) => (
              <li key={i} className={h.nivel}><b>{h.regla}</b> — {h.mensaje}</li>
            ))}
          </ul>
        )}
      </section>
    </aside>
  );
}
