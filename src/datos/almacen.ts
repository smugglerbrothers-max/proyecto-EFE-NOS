import { createStore, del, get, keys, set } from 'idb-keyval';
import type { Proyecto } from '../motor/modelo';

export interface ResumenProyecto {
  id: string;
  nombre: string;
  actualizado: string;
}

/** Persistencia de proyectos. Hoy IndexedDB; mañana puede ser la nube. */
export interface Almacen {
  listar(): Promise<ResumenProyecto[]>;
  cargar(id: string): Promise<Proyecto | null>;
  guardar(p: Proyecto): Promise<void>;
  borrar(id: string): Promise<void>;
}

const store = () => createStore('calculadora-ric', 'proyectos');

export const almacenIndexedDB: Almacen = {
  async listar() {
    const s = store();
    const ids = (await keys(s)) as string[];
    const ps = await Promise.all(ids.map((id) => get<Proyecto>(id, s)));
    return ps
      .filter((p): p is Proyecto => !!p)
      .map(({ id, nombre, actualizado }) => ({ id, nombre, actualizado }))
      .sort((a, b) => b.actualizado.localeCompare(a.actualizado));
  },
  async cargar(id) {
    return (await get<Proyecto>(id, store())) ?? null;
  },
  async guardar(p) {
    await set(p.id, p, store());
  },
  async borrar(id) {
    await del(id, store());
  },
};
