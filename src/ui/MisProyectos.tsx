import { useEffect, useState } from 'react';
import type { Almacen, ResumenProyecto } from '../datos/almacen';
import { useProyecto } from '../estado';

export function MisProyectos({ almacen, cerrar }: { almacen: Almacen; cerrar: () => void }) {
  const [lista, setLista] = useState<ResumenProyecto[] | null>(null);
  const actual = useProyecto((s) => s.proyecto.id);
  const refrescar = () => almacen.listar().then(setLista).catch(() => setLista([]));
  useEffect(() => void refrescar(), []);
  const abrir = async (id: string) => {
    const p = await almacen.cargar(id);
    if (p) useProyecto.getState().cargar(p);
    cerrar();
  };
  const borrar = async (r: ResumenProyecto) => {
    if (!confirm(`¿Eliminar el proyecto «${r.nombre}»? No se puede deshacer.`)) return;
    await almacen.borrar(r.id);
    refrescar();
  };
  return (
    <div className="modal" role="dialog" aria-label="Mis proyectos" onClick={cerrar}>
      <div className="tarjeta" onClick={(e) => e.stopPropagation()}>
        <div className="cabecera"><h2>Mis proyectos</h2><button onClick={cerrar}>Cerrar</button></div>
        {lista == null ? <p>Cargando…</p> : lista.length === 0 ? <p className="tenue">Aún no hay proyectos guardados.</p> : (
          <ul className="lista">
            {lista.map((r) => (
              <li key={r.id} className={r.id === actual ? 'actual' : ''}>
                <button className="enlace" onClick={() => abrir(r.id)}>{r.nombre}</button>
                <span className="tenue">{new Date(r.actualizado).toLocaleString('es-CL')}</span>
                {r.id !== actual && <button className="icono" aria-label={`Eliminar ${r.nombre}`} onClick={() => borrar(r)}>🗑</button>}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
