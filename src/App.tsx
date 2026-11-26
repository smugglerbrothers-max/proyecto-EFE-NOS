import { useEffect, useMemo, useState } from 'react';
import { almacenIndexedDB, type Almacen } from './datos/almacen';
import { useProyecto } from './estado';
import { calcularProyecto } from './motor';
import type { Proyecto } from './motor/modelo';
import { ConfigProyecto } from './ui/ConfigProyecto';
import { Diferenciales } from './ui/Diferenciales';
import { Encabezado } from './ui/Encabezado';
import { PanelResumen } from './ui/PanelResumen';
import { TablaCircuitos } from './ui/TablaCircuitos';
import { descargar, nombreArchivo } from './ui/Encabezado';
import './ui/estilos.css';

const CLAVE_ULTIMO = 'calculadora-ric:ultimo';

export default function App({ almacen = almacenIndexedDB, inicial }: { almacen?: Almacen; inicial?: Proyecto }) {
  useState(() => inicial && useProyecto.getState().cargar(inicial));
  const p = useProyecto((s) => s.proyecto);
  const r = useMemo(() => calcularProyecto(p), [p]);
  const [estado, setEstado] = useState('');

  // Abre el último proyecto usado.
  useEffect(() => {
    if (inicial) return;
    const id = localStorage.getItem(CLAVE_ULTIMO);
    if (id) almacen.cargar(id).then((q) => q && useProyecto.getState().cargar(q)).catch(() => {});
  }, []);

  // Autoguardado con 1 s de espera.
  useEffect(() => {
    const t = setTimeout(() => {
      almacen
        .guardar(p)
        .then(() => {
          try { localStorage.setItem(CLAVE_ULTIMO, p.id); } catch { /* sin almacenamiento */ }
          setEstado(`Guardado ${new Date().toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' })}`);
        })
        .catch(() => setEstado('⚠ No se pudo guardar'));
    }, 1000);
    return () => clearTimeout(t);
  }, [p, almacen]);

  return (
    <div className="app">
      <Encabezado
        almacen={almacen}
        estadoGuardado={estado}
        onPDF={async () => {
          const { generarPDF } = await import('./informes/pdf');
          try {
            descargar(`${nombreArchivo(p.nombre)}.pdf`, await generarPDF(p, r));
          } catch (e) {
            alert(`No se pudo generar el PDF: ${(e as Error).message}`);
          }
        }}
      />
      <div className="cuerpo">
        <main>
          <ConfigProyecto />
          <Diferenciales r={r} />
          <TablaCircuitos r={r} />
        </main>
        <PanelResumen r={r} />
      </div>
    </div>
  );
}
