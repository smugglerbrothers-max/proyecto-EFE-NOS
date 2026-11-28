import { proyectoNuevo, type Proyecto } from '../motor/modelo';

export const VERSION_ARCHIVO = 1;

export function exportarJSON(p: Proyecto): string {
  return JSON.stringify({ version: VERSION_ARCHIVO, proyecto: p }, null, 2);
}

export type ResultadoImportar = { ok: true; proyecto: Proyecto } | { ok: false; error: string };

export function importarJSON(txt: string): ResultadoImportar {
  let datos: unknown;
  try {
    datos = JSON.parse(txt);
  } catch {
    return { ok: false, error: 'El archivo no es un archivo JSON válido.' };
  }
  if (typeof datos !== 'object' || datos === null) return { ok: false, error: 'Contenido vacío o inválido.' };
  const d = datos as { version?: unknown; proyecto?: unknown };
  if (d.version !== VERSION_ARCHIVO)
    return { ok: false, error: `La versión del archivo (${String(d.version)}) no es compatible.` };
  const p = d.proyecto as Partial<Proyecto> | undefined;
  if (!p || typeof p !== 'object') return { ok: false, error: 'El archivo no contiene un proyecto.' };
  if (!Array.isArray(p.circuitos)) return { ok: false, error: 'El proyecto no tiene la lista de circuitos.' };
  if (!Array.isArray(p.diferenciales)) return { ok: false, error: 'El proyecto no tiene la lista de diferenciales.' };
  const base = proyectoNuevo();
  return { ok: true, proyecto: { ...base, ...p, instalador: { ...base.instalador, ...p.instalador } } as Proyecto };
}
