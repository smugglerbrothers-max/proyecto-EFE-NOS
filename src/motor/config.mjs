// Configuración operacional. TODO valor null = "no configurado": el motor lo reporta como dato faltante,
// nunca lo reemplaza por un supuesto. Los valores se cargan desde plan.config2 (futuro) o desde el usuario.

export function configBase() {
  return {
    horarios: { Diurno: null, Nocturno: null },        // { ini: 'HH:MM', fin: 'HH:MM' }
    // Días hábiles de anticipación respecto de la ejecución.
    plazos: {
      material: null, maquinaria_propia: null, maquinaria_arriendo: null,
      transporte: null, personal: null, preventiva: null, cortada: null,
    },
    // Horas antes/después de la actividad, por categoría de recurso.
    tiempos: { preparacion: {}, traslado: {}, devolucion: {} },
    responsables: {                                     // responsable de coordinación por tipo de necesidad
      material: null, maquinaria: null, transporte: null, personal: null, preventiva: null, cortada: null,
    },
  };
}

/** Mezcla profunda simple (solo objetos planos). */
export function conConfig(parcial = {}) {
  const base = configBase();
  const mezclar = (a, b) => {
    for (const [k, v] of Object.entries(b ?? {}))
      a[k] = v && typeof v === 'object' && !Array.isArray(v) && a[k] && typeof a[k] === 'object' ? mezclar({ ...a[k] }, v) : v;
    return a;
  };
  return mezclar(base, parcial);
}
