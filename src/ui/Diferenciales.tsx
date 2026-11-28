import { useProyecto } from '../estado';
import type { ResultadoProyecto } from '../motor';
import { MAX_CIRCUITOS_POR_DIFERENCIAL, PROTECCIONES } from '../motor/tablas/ric10';

export function Diferenciales({ r }: { r: ResultadoProyecto }) {
  const p = useProyecto((s) => s.proyecto);
  const { editarDiferencial, agregarDiferencial, eliminarDiferencial } = useProyecto.getState();
  return (
    <section className="tarjeta">
      <div className="cabecera">
        <h2>Diferenciales <small>(máx. {MAX_CIRCUITOS_POR_DIFERENCIAL} circuitos por diferencial)</small></h2>
        <button className="primario" onClick={agregarDiferencial}>+ Agregar diferencial</button>
      </div>
      <div className="diferenciales">
        {p.diferenciales.map((d) => {
          const idx = p.circuitos.map((c, i) => (c.diferencialId === d.id ? i : -1)).filter((i) => i >= 0);
          const suma = idx.reduce((s, i) => s + (r.circuitos[i]?.in ?? 0), 0);
          return (
            <div key={d.id} className="diferencial">
              <div className="cabecera">
                <input className="nombre" value={d.nombre} onChange={(e) => editarDiferencial(d.id, { nombre: e.target.value })} />
                <button className="icono" aria-label={`Eliminar ${d.nombre}`} onClick={() => eliminarDiferencial(d.id)}>🗑</button>
              </div>
              <label>In (A):{' '}
                <select value={d.in} onChange={(e) => editarDiferencial(d.id, { in: Number(e.target.value) })}>
                  {PROTECCIONES.filter((x) => x >= 16).map((x) => <option key={x} value={x}>{x} A</option>)}
                </select>
              </label>{' '}
              <label>
                <select value={d.sensibilidadMA} onChange={(e) => editarDiferencial(d.id, { sensibilidadMA: Number(e.target.value) })}>
                  {[10, 30, 300].map((x) => <option key={x} value={x}>{x} mA</option>)}
                </select>
              </label>
              <p className="tenue">{idx.length} circuitos · Σ In {suma} A</p>
            </div>
          );
        })}
      </div>
    </section>
  );
}
