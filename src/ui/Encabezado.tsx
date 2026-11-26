import { useRef, useState } from 'react';
import type { Almacen } from '../datos/almacen';
import { exportarJSON, importarJSON } from '../datos/serializar';
import { useProyecto } from '../estado';
import { proyectoEjemplo } from '../motor/ejemplo';
import { nuevoId, proyectoNuevo } from '../motor/modelo';
import { MisProyectos } from './MisProyectos';

export function descargar(nombre: string, blob: Blob) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nombre;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export const nombreArchivo = (s: string) => s.trim().replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-|-$/g, '') || 'proyecto';

export function Encabezado({ almacen, estadoGuardado, onPDF }: { almacen: Almacen; estadoGuardado: string; onPDF?: () => void }) {
  const [verLista, setVerLista] = useState(false);
  const archivo = useRef<HTMLInputElement>(null);
  const p = useProyecto((s) => s.proyecto);
  const { cargar } = useProyecto.getState();
  const importar = async (f: File | undefined) => {
    if (!f) return;
    const r = importarJSON(await f.text());
    if (!r.ok) return alert(`No se pudo importar: ${r.error}`);
    cargar({ ...r.proyecto, id: nuevoId() });
  };
  return (
    <header className="tarjeta encabezado">
      <div className="marca">
        <span className="logo">⚡</span>
        <div>
          <h1>Calculadora RIC</h1>
          <p className="tenue">Cuadros de carga y memorias de cálculo — Pliegos Técnicos RIC (DS 8/2019)</p>
        </div>
        <span className="guardado tenue">{estadoGuardado}</span>
      </div>
      <nav className="botones">
        <button onClick={() => setVerLista(true)}>📁 Mis proyectos</button>
        <button onClick={() => cargar(proyectoNuevo())}>＋ Nuevo</button>
        <button onClick={() => cargar({ ...proyectoEjemplo(), id: nuevoId() })}>Ejemplo</button>
        <button onClick={() => descargar(`${nombreArchivo(p.nombre)}.json`, new Blob([exportarJSON(p)], { type: 'application/json' }))}>⬇ Exportar JSON</button>
        <button onClick={() => archivo.current?.click()}>⬆ Importar JSON</button>
        <input ref={archivo} type="file" accept="application/json,.json" hidden onChange={(e) => { importar(e.target.files?.[0]); e.target.value = ''; }} />
        {onPDF && <button className="primario" onClick={onPDF}>⬇ Exportar PDF</button>}
      </nav>
      {verLista && <MisProyectos almacen={almacen} cerrar={() => setVerLista(false)} />}
    </header>
  );
}
