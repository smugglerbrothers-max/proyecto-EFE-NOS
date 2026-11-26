import type { Proyecto } from '../motor/modelo';
import { useProyecto } from '../estado';
import { NOMBRE_CONSUMIDOR } from '../motor/tablas/ric03';
import { CONDUCTORES, DESCRIPCION_METODO, METODOS_POR_AISLACION } from '../motor/tablas/ric04';
import type { Metodo, TipoConsumidor } from '../motor/tablas/tipos';
import { Campo } from './Campo';
import { leer } from './formato';

export function ConfigProyecto() {
  const p = useProyecto((s) => s.proyecto);
  const editar = useProyecto((s) => s.editar);
  const texto = (k: 'nombre' | 'comuna' | 'propietario' | 'direccion' | 'empresa', etiqueta: string) => (
    <Campo etiqueta={etiqueta}>
      <input value={p[k]} onChange={(e) => editar({ [k]: e.target.value })} />
    </Campo>
  );
  const numero = (
    k: 'longitudAlimentador' | 'tAmbiente' | 'nViviendas' | 'cosPhi' | 'superficieM2' | 'activosPorDucto',
    etiqueta: string,
    paso = 1,
  ) => (
    <Campo etiqueta={etiqueta} ancho="corto">
      <input type="number" step={paso} value={p[k]} onChange={(e) => editar({ [k]: leer(e.target.value) })} />
    </Campo>
  );
  const metodos = METODOS_POR_AISLACION[CONDUCTORES[p.conductorAlimentador] ?? 90];
  const subirLogo = (f: File | undefined) => {
    if (!f) return;
    if (f.size > 400_000) return alert('El logo debe pesar menos de 400 KB.');
    const r = new FileReader();
    r.onload = () => editar({ logo: String(r.result) });
    r.readAsDataURL(f);
  };

  return (
    <section className="tarjeta">
      <h2>Configuración del proyecto</h2>
      <div className="rejilla">
        {texto('nombre', 'Nombre del proyecto')}
        {texto('comuna', 'Comuna')}
        {texto('propietario', 'Propietario')}
        {texto('direccion', 'Dirección')}
        <Campo etiqueta="Instalador SEC (nombre)">
          <input value={p.instalador.nombre} onChange={(e) => editar({ instalador: { ...p.instalador, nombre: e.target.value } })} />
        </Campo>
        <div className="fila-doble">
          <Campo etiqueta="Clase">
            <select value={p.instalador.clase} onChange={(e) => editar({ instalador: { ...p.instalador, clase: e.target.value } })}>
              {['A', 'B', 'C', 'D'].map((c) => <option key={c}>{c}</option>)}
            </select>
          </Campo>
          <Campo etiqueta="Licencia">
            <input value={p.instalador.licencia} onChange={(e) => editar({ instalador: { ...p.instalador, licencia: e.target.value } })} />
          </Campo>
        </div>
        {texto('empresa', 'Empresa / Razón social')}
        <Campo etiqueta="Logo para PDF (máx. 400 KB)">
          <input type="file" accept="image/png,image/jpeg" onChange={(e) => subirLogo(e.target.files?.[0])} />
        </Campo>
        <Campo etiqueta="Destino">
          <select value={p.destino} onChange={(e) => editar({ destino: e.target.value as TipoConsumidor })}>
            {Object.entries(NOMBRE_CONSUMIDOR).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </Campo>
        <Campo etiqueta="Tipo de empalme">
          <select value={p.sistema} onChange={(e) => editar({ sistema: e.target.value as 'mono' | 'tri' })}>
            <option value="mono">Monofásico 220 V</option>
            <option value="tri">Trifásico 380 V</option>
          </select>
        </Campo>
        {numero('superficieM2', 'Superficie (m²)')}
        {numero('longitudAlimentador', 'Longitud alimentador (m)')}
        <Campo etiqueta="Conductor">
          <select
            value={p.conductorAlimentador}
            onChange={(e) => {
              const metodosNuevos = METODOS_POR_AISLACION[CONDUCTORES[e.target.value]];
              editar({
                conductorAlimentador: e.target.value,
                metodo: metodosNuevos.includes(p.metodo) ? p.metodo : metodosNuevos[0],
              });
            }}
          >
            {Object.entries(CONDUCTORES).map(([k, t]) => <option key={k} value={k}>{k} ({t} °C)</option>)}
          </select>
        </Campo>
        <Campo etiqueta="Método de instalación (Tabla 4.4)">
          <select value={p.metodo} onChange={(e) => editar({ metodo: e.target.value as Metodo })}>
            {metodos.map((m) => <option key={m} value={m}>{DESCRIPCION_METODO[m]}</option>)}
          </select>
        </Campo>
        {numero('tAmbiente', 'Temperatura ambiente (°C)')}
        {numero('activosPorDucto', 'Conductores activos por ducto')}
        {numero('nViviendas', 'N° de viviendas')}
        {numero('cosPhi', 'Factor de potencia (cos φ)', 0.01)}
        <Campo etiqueta="Resistividad para ΔV">
          <select value={p.resistividad} onChange={(e) => editar({ resistividad: e.target.value as 'servicio' | '20C' })}>
            <option value="servicio">A temperatura de servicio (conservador)</option>
            <option value="20C">A 20 °C</option>
          </select>
        </Campo>
        <Campo etiqueta="Cargas no lineales (neutro trifásico)">
          <select value={p.noLineales} onChange={(e) => editar({ noLineales: e.target.value as Proyecto['noLineales'] })}>
            <option value="no">No / filtro distribuido</option>
            <option value="concentrado">Con filtro concentrado (neutro ≥ 1,5 × fase)</option>
          </select>
        </Campo>
        <label className="check"><input type="checkbox" checked={p.reunionPersonas} onChange={(e) => editar({ reunionPersonas: e.target.checked })} /> Recinto de reunión de personas</label>
        <label className="check"><input type="checkbox" checked={p.subterraneo} onChange={(e) => editar({ subterraneo: e.target.checked })} /> Tendido subterráneo</label>
      </div>
    </section>
  );
}
