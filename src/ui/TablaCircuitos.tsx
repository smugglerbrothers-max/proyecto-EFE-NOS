import { useProyecto } from '../estado';
import type { ResultadoProyecto } from '../motor';
import { NOMBRE_TIPO, type Circuito, type Fase, type TipoCircuito } from '../motor/modelo';
import { CONDUCTORES, SECCIONES } from '../motor/tablas/ric04';
import { PROTECCIONES } from '../motor/tablas/ric10';
import { leer, num, secc } from './formato';

const TIPOS = Object.keys(NOMBRE_TIPO) as TipoCircuito[];

/** Fila/tarjeta de un circuito; `modo` cambia solo el contenedor. */
function useCampos(c: Circuito, n: number) {
  const p = useProyecto((s) => s.proyecto);
  const { editarCircuito } = useProyecto.getState();
  const set = (cambios: Partial<Circuito>) => editarCircuito(c.id, cambios);
  const entero = (k: 'portalamparas' | 'enchufes' | 'otros', etiqueta: string) => (
    <input aria-label={`${etiqueta} cto ${n}`} type="number" min={0} value={c[k]} onChange={(e) => set({ [k]: Math.max(0, Math.floor(leer(e.target.value))) })} />
  );
  const fases: Fase[] = p.sistema === 'mono' ? ['R'] : ['R', 'S', 'T', 'RST'];
  return {
    nombre: <input aria-label={`Nombre cto ${n}`} className="nombre" value={c.nombre} onChange={(e) => set({ nombre: e.target.value })} />,
    tipo: (
      <select aria-label={`Tipo cto ${n}`} value={c.tipo} onChange={(e) => set({ tipo: e.target.value as TipoCircuito })}>
        {TIPOS.map((t) => <option key={t} value={t}>{NOMBRE_TIPO[t]}</option>)}
      </select>
    ),
    port: entero('portalamparas', 'Portalámparas'),
    ench: entero('enchufes', 'Enchufes'),
    otros: entero('otros', 'Otros'),
    potUnit: (
      <input aria-label={`Potencia unitaria otros cto ${n}`} type="number" min={0} placeholder="W" value={c.potenciaUnitOtros || ''} onChange={(e) => set({ potenciaUnitOtros: leer(e.target.value) })} />
    ),
    fase: (
      <select aria-label={`Fase cto ${n}`} value={c.fase} onChange={(e) => set({ fase: e.target.value as Fase })}>
        {fases.map((f) => <option key={f}>{f}</option>)}
      </select>
    ),
    dif: (
      <select aria-label={`Diferencial cto ${n}`} value={c.diferencialId ?? ''} onChange={(e) => set({ diferencialId: e.target.value || null })}>
        <option value="">— sin diferencial —</option>
        {p.diferenciales.map((d) => <option key={d.id} value={d.id}>{d.nombre}</option>)}
      </select>
    ),
    disy: (
      <select aria-label={`Disyuntor cto ${n}`} value={c.disyuntorManual ?? ''} onChange={(e) => set({ disyuntorManual: e.target.value ? Number(e.target.value) : undefined })}>
        <option value="">Auto</option>
        {PROTECCIONES.map((x) => <option key={x} value={x}>{x}</option>)}
      </select>
    ),
    secc: (
      <select aria-label={`Sección cto ${n}`} value={c.seccionManual ?? ''} onChange={(e) => set({ seccionManual: e.target.value ? Number(e.target.value) : undefined })}>
        <option value="">Auto</option>
        {SECCIONES.map((x) => <option key={x} value={x}>{secc(x)}</option>)}
      </select>
    ),
    cable: (
      <select aria-label={`Conductor cto ${n}`} value={c.conductor} onChange={(e) => set({ conductor: e.target.value })}>
        {Object.keys(CONDUCTORES).map((k) => <option key={k}>{k}</option>)}
      </select>
    ),
    largo: <input aria-label={`Longitud cto ${n}`} type="number" min={0} value={c.longitud} onChange={(e) => set({ longitud: leer(e.target.value) })} />,
    ubic: <input aria-label={`Ubicación cto ${n}`} value={c.ubicacion} onChange={(e) => set({ ubicacion: e.target.value })} />,
  };
}

function Acciones({ c, n }: { c: Circuito; n: number }) {
  const { moverCircuito, eliminarCircuito } = useProyecto.getState();
  return (
    <span className="acciones">
      <button className="icono" aria-label={`Subir cto ${n}`} onClick={() => moverCircuito(c.id, -1)}>↑</button>
      <button className="icono" aria-label={`Bajar cto ${n}`} onClick={() => moverCircuito(c.id, 1)}>↓</button>
      <button className="icono" aria-label={`Eliminar cto ${n}`} onClick={() => eliminarCircuito(c.id)}>🗑</button>
    </span>
  );
}

function Fila({ c, n, r }: { c: Circuito; n: number; r: ResultadoProyecto['circuitos'][number] }) {
  const f = useCampos(c, n);
  const auto = (manual: number | undefined, valor: number | null) => (manual == null ? <em className="tenue">{secc(valor)}</em> : null);
  return (
    <tr className={r.errores.length ? 'con-error' : ''}>
      <td><Acciones c={c} n={n} /></td>
      <td className="centro">{n}</td>
      <td>{f.nombre}{f.tipo}</td>
      <td>{f.port}</td><td>{f.ench}</td><td>{f.otros}</td><td>{f.potUnit}</td>
      <td className="centro">{r.centros}</td>
      <td className="derecha">{num(r.potencia, 0)}</td>
      <td>{f.fase}</td><td>{f.dif}</td>
      <td>{f.disy}{auto(c.disyuntorManual, r.in)}</td>
      <td>{f.secc}{auto(c.seccionManual, r.seccion)}</td>
      <td className="centro">{r.ducto ?? '—'}</td>
      <td>{f.cable}</td><td>{f.largo}</td>
      <td className="derecha">{num(r.dvPct)}</td>
      <td className="derecha">{num(r.pctCarga, 0)}</td>
      <td>{f.ubic}</td>
    </tr>
  );
}

function Tarjeta({ c, n, r }: { c: Circuito; n: number; r: ResultadoProyecto['circuitos'][number] }) {
  const f = useCampos(c, n);
  return (
    <details className={`tarjeta-circuito ${r.errores.length ? 'con-error' : ''}`}>
      <summary>
        <b>Cto {n}</b> {c.nombre} · {num(r.potencia, 0)} W · {r.in ?? '—'} A · {secc(r.seccion)} mm² · ΔV {num(r.dvPct)} %
      </summary>
      <div className="rejilla">
        <label>Nombre {f.nombre}</label><label>Tipo {f.tipo}</label>
        <label>Portalámparas {f.port}</label><label>Enchufes {f.ench}</label>
        <label>Otros {f.otros}</label><label>Pot. unit. otros (W) {f.potUnit}</label>
        <label>Fase {f.fase}</label><label>Diferencial {f.dif}</label>
        <label>Disyuntor (A) {f.disy}</label><label>Sección (mm²) {f.secc}</label>
        <label>Conductor {f.cable}</label><label>Longitud (m) {f.largo}</label>
        <label>Ubicación {f.ubic}</label>
      </div>
      <p className="tenue">Ducto Ø{r.ducto ?? '—'} mm · Carga {num(r.pctCarga, 0)} %</p>
      <Acciones c={c} n={n} />
    </details>
  );
}

export function TablaCircuitos({ r }: { r: ResultadoProyecto }) {
  const p = useProyecto((s) => s.proyecto);
  const { agregarCircuito } = useProyecto.getState();
  return (
    <section className="tarjeta">
      <div className="cabecera">
        <h2>Circuitos</h2>
        <div className="botones">
          {TIPOS.map((t) => <button key={t} onClick={() => agregarCircuito(t)}>+ {NOMBRE_TIPO[t]}</button>)}
        </div>
      </div>
      <div className="solo-escritorio desplazable">
        <table className="circuitos">
          <thead>
            <tr>
              <th></th><th>Cto N°</th><th>Nombre / tipo</th><th>Port.</th><th>Ench.</th><th>Otros</th><th>Pot. unit. (W)</th>
              <th>Total cent.</th><th>Pot. total (W)</th><th>Fase</th><th>Dif.</th><th>Disy. (A)</th><th>Cond. mm²</th>
              <th>Ducto Ø</th><th>Cable</th><th>Long. m</th><th>ΔV %</th><th>% Carga</th><th>Ubicación</th>
            </tr>
          </thead>
          <tbody>
            {p.circuitos.map((c, i) => <Fila key={c.id} c={c} n={i + 1} r={r.circuitos[i]} />)}
          </tbody>
        </table>
      </div>
      <div className="solo-movil">
        {p.circuitos.map((c, i) => <Tarjeta key={c.id} c={c} n={i + 1} r={r.circuitos[i]} />)}
      </div>
      {p.circuitos.length === 0 && <p className="tenue">Agrega un circuito con los botones de arriba.</p>}
    </section>
  );
}
