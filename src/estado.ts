import { create } from 'zustand';
import { circuitoNuevo, nuevoId, type Circuito, type Diferencial, type Proyecto, type TipoCircuito } from './motor/modelo';
import { proyectoNuevo } from './motor/modelo';
import { MAX_CIRCUITOS_POR_DIFERENCIAL } from './motor/tablas/ric10';

/** Preset por tipo al agregar un circuito. */
const PRESET: Record<TipoCircuito, Partial<Circuito>> = {
  iluminacion: { portalamparas: 6 },
  enchufes: { enchufes: 6 },
  cocina: { enchufes: 3 },
  horno: { otros: 1, potenciaUnitOtros: 2000 },
  mixto: { portalamparas: 3, enchufes: 3 },
  otros: { otros: 1, potenciaUnitOtros: 1000 },
};

interface Estado {
  proyecto: Proyecto;
  cargar: (p: Proyecto) => void;
  editar: (cambios: Partial<Proyecto>) => void;
  editarCircuito: (id: string, cambios: Partial<Circuito>) => void;
  agregarCircuito: (tipo: TipoCircuito) => void;
  eliminarCircuito: (id: string) => void;
  moverCircuito: (id: string, delta: -1 | 1) => void;
  editarDiferencial: (id: string, cambios: Partial<Diferencial>) => void;
  agregarDiferencial: () => void;
  eliminarDiferencial: (id: string) => void;
}

const sello = (p: Proyecto): Proyecto => ({ ...p, actualizado: new Date().toISOString() });

export const useProyecto = create<Estado>((set) => {
  const mod = (f: (p: Proyecto) => Proyecto) => set((s) => ({ proyecto: sello(f(s.proyecto)) }));
  return {
    proyecto: proyectoNuevo(),
    cargar: (p) => set({ proyecto: p }),
    editar: (cambios) => mod((p) => ({ ...p, ...cambios })),
    editarCircuito: (id, cambios) =>
      mod((p) => ({ ...p, circuitos: p.circuitos.map((c) => (c.id === id ? { ...c, ...cambios } : c)) })),
    agregarCircuito: (tipo) =>
      mod((p) => {
        const usados = (d: Diferencial) => p.circuitos.filter((c) => c.diferencialId === d.id).length;
        const dif = p.diferenciales.find((d) => usados(d) < MAX_CIRCUITOS_POR_DIFERENCIAL) ?? p.diferenciales[0];
        const c = circuitoNuevo(tipo, { ...PRESET[tipo], diferencialId: dif?.id ?? null });
        return { ...p, circuitos: [...p.circuitos, c] };
      }),
    eliminarCircuito: (id) => mod((p) => ({ ...p, circuitos: p.circuitos.filter((c) => c.id !== id) })),
    moverCircuito: (id, delta) =>
      mod((p) => {
        const cs = [...p.circuitos];
        const i = cs.findIndex((c) => c.id === id);
        const j = i + delta;
        if (i < 0 || j < 0 || j >= cs.length) return p;
        [cs[i], cs[j]] = [cs[j], cs[i]];
        return { ...p, circuitos: cs };
      }),
    editarDiferencial: (id, cambios) =>
      mod((p) => ({ ...p, diferenciales: p.diferenciales.map((d) => (d.id === id ? { ...d, ...cambios } : d)) })),
    agregarDiferencial: () =>
      mod((p) => ({
        ...p,
        diferenciales: [
          ...p.diferenciales,
          { id: nuevoId(), nombre: `Diferencial ${p.diferenciales.length + 1}`, in: 40, sensibilidadMA: 30 },
        ],
      })),
    eliminarDiferencial: (id) =>
      mod((p) => ({
        ...p,
        diferenciales: p.diferenciales.filter((d) => d.id !== id),
        circuitos: p.circuitos.map((c) => (c.diferencialId === id ? { ...c, diferencialId: null } : c)),
      })),
  };
});
