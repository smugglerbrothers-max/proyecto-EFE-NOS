// Catálogos copiados del bundle original (Je, qe, yt). No inventar: si cambia el original, actualizar aquí.
// Fuente: original/Pizarra_Operaciones_2026-11-13.html, bundle minificado (ver AUDITORIA.md §1).

const T = (id, nombre, categoria, extra = {}) => ({ id, nombre, categoria, esMando: false, esVia: false, ...extra });

export const TIPOS_RECURSO = Object.fromEntries([
  T('supervisor', 'Supervisor', 'personal', { esMando: true }),
  T('jefe_terreno', 'Jefe de terreno', 'personal', { esMando: true }),
  T('m1_oocc', 'M1 OOCC', 'personal'),
  T('m1_ooee', 'M1 OOEE', 'personal'),
  T('electromecanico', 'Electromecánico', 'personal'),
  T('topografo', 'Topógrafo', 'personal'),
  T('capataz', 'Capataz', 'personal', { esMando: true }),
  T('operador_grua', 'Operador camión grúa', 'personal'),
  T('rigger', 'Rigger', 'personal'),
  T('prevencionista', 'Prevencionista', 'personal'),
  T('operador', 'Operador maquinaria', 'personal'),
  T('ayudante', 'Ayudante', 'personal'),
  T('habilitado_via', 'Habilitado vía EFE (P5.1 / P6)', 'personal'),
  T('supervisor_electrico', 'Supervisor eléctrico', 'personal', { esMando: true }),
  T('trabajador_electrico', 'Trabajador eléctrico', 'personal'),
  T('excavador', 'Excavador', 'personal'),
  T('cuadrilla', 'Grupo genérico (versión anterior)', 'personal'),
  T('retroexcavadora', 'Retroexcavadora', 'maquinaria', { propiedad: 'arriendo' }),
  T('excavadora', 'Excavadora', 'maquinaria', { propiedad: 'arriendo' }),
  T('camion_grua', 'Camión grúa', 'maquinaria', { propiedad: 'arriendo' }),
  T('camion_pluma', 'Camión pluma (brazo articulado)', 'maquinaria', { propiedad: 'propio' }),
  T('camion_rampla', 'Camión rampla extensible', 'maquinaria', { propiedad: 'arriendo' }),
  T('mixer', 'Camión mixer', 'maquinaria', { propiedad: 'arriendo' }),
  T('bomba_hormigon', 'Bomba de hormigón', 'maquinaria', { propiedad: 'arriendo' }),
  T('camioneta', 'Camioneta', 'maquinaria', { propiedad: 'propio' }),
  T('camion_tolva', 'Camión tolva', 'maquinaria', { propiedad: 'arriendo' }),
  T('aljibe', 'Camión aljibe', 'maquinaria', { propiedad: 'arriendo' }),
  T('hincadora', 'Hincadora horizontal (cruce bajo vía)', 'maquinaria', { propiedad: 'arriendo' }),
  T('georradar', 'Máquina Georradar (carro GEO-X)', 'maquinaria', { propiedad: 'arriendo' }),
  T('hirail', 'Hi-Rail', 'maquinaria', { esVia: true, propiedad: 'arriendo' }),
  T('diplory', 'Diplory / vagón plano', 'maquinaria', { esVia: true, propiedad: 'arriendo' }),
  T('portacarretes', 'Portacarretes', 'equipos', { propiedad: 'arriendo' }),
  T('equipo_tendido', 'Equipo de tendido', 'equipos', { propiedad: 'arriendo' }),
  T('cabrestante', 'Cabrestante / winche', 'equipos', { propiedad: 'arriendo' }),
  T('bidon_agua', 'Bidón de agua 1.000 L', 'equipos', { propiedad: 'propio' }),
  T('poleas', 'Poleas', 'equipos'),
  T('espaciadores', 'Espaciadores', 'equipos'),
  T('poste', 'Postes de hormigón', 'equipos'),
  T('portico', 'Pórtico metálico', 'equipos'),
  T('aisladores', 'Aisladores', 'equipos'),
  T('conductor', 'Conductor eléctrico', 'equipos'),
  T('anclaje', 'Anclaje y arriostramiento', 'equipos'),
].map((t) => [t.id, t]));

/** Tramos de la LMT (postes, numeración descendente ini>=fin). `via: true` = faja vía EFE. */
export const TRAMOS_LMT = [
  { id: 'faja5', nombre: 'Faja vía EFE', ini: 128, fin: 94, via: true },
  { id: 'pma', nombre: 'Puente Maipo (cruce aéreo)', ini: 93, fin: 89, via: true },
  { id: 'est', nombre: 'La Estancilla · bajo talud · calle', ini: 88, fin: 68, via: false },
  { id: 'faja1', nombre: 'Faja vía EFE · calle de servicio / Ruta 5', ini: 67, fin: 18, via: true },
  { id: 'faja4', nombre: 'Faja vía EFE · calle Portales', ini: 17, fin: 1, via: true },
];

export const tipoDe = (unidad) => TIPOS_RECURSO[unidad?.tipo];
export const esPersonal = (u) => tipoDe(u)?.categoria === 'personal';
export const esMando = (u) => !!tipoDe(u)?.esMando;
