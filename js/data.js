// =====================================================================
//  UMBRAL — Datos del juego: tipos, tabla de efectividad, movimientos,
//  linajes de criaturas (34 linajes x 3 etapas = 102 criaturas).
// =====================================================================
'use strict';

const TYPES = {
  SOMBRA:   { name: 'Sombra',   color: '#6b4c9a', glow: '#b48cff' },
  SANGRE:   { name: 'Sangre',   color: '#9e1b1b', glow: '#ff3b3b' },
  HUESO:    { name: 'Hueso',    color: '#b8ad8e', glow: '#fff3c9' },
  ABISMO:   { name: 'Abismo',   color: '#1d5a73', glow: '#3fd0ff' },
  INFIERNO: { name: 'Infierno', color: '#c4501a', glow: '#ffb03b' },
  PLAGA:    { name: 'Plaga',    color: '#5f7a1c', glow: '#b6ff3b' },
  ESPECTRO: { name: 'Espectro', color: '#5d7f8f', glow: '#c8f4ff' },
  BESTIA:   { name: 'Bestia',   color: '#7a5233', glow: '#e0a36b' },
  TORMENTA: { name: 'Tormenta', color: '#3c4a8f', glow: '#8fa8ff' },
  LOCURA:   { name: 'Locura',   color: '#a3337f', glow: '#ff6be0' },
};

// Atacante -> { defensor: multiplicador }
const CHART = {
  INFIERNO: { PLAGA: 2, BESTIA: 2, ESPECTRO: 2, ABISMO: .5, INFIERNO: .5, HUESO: .5 },
  ABISMO:   { INFIERNO: 2, HUESO: 2, ABISMO: .5, PLAGA: .5, TORMENTA: .5 },
  PLAGA:    { BESTIA: 2, ABISMO: 2, SANGRE: 2, HUESO: .5, ESPECTRO: .5, PLAGA: .5 },
  BESTIA:   { LOCURA: 2, SANGRE: 2, HUESO: .5, ESPECTRO: 0 },
  SANGRE:   { BESTIA: 2, LOCURA: 2, HUESO: .5, SOMBRA: .5 },
  HUESO:    { TORMENTA: 2, INFIERNO: 2, BESTIA: .5, ABISMO: .5 },
  ESPECTRO: { ESPECTRO: 2, LOCURA: 2, SOMBRA: .5, BESTIA: 0 },
  SOMBRA:   { ESPECTRO: 2, LOCURA: 2, SOMBRA: .5, INFIERNO: .5 },
  TORMENTA: { ABISMO: 2, BESTIA: 2, HUESO: .5, TORMENTA: .5 },
  LOCURA:   { SANGRE: 2, PLAGA: 2, LOCURA: .5, SOMBRA: 0 },
};

function typeEffect(atkType, defTypes) {
  let m = 1;
  for (const d of defTypes) {
    const row = CHART[atkType] || {};
    if (row[d] !== undefined) m *= row[d];
  }
  return m;
}

// anim: zarpazo | embestida | proyectil | rayo | aura | buff
// eff: { st: 'sangrado'|'veneno'|'quemado'|'terror', ch: prob } | { drain: frac }
//      | { self: {atk|def: n} } | { foe: {atk|def: n} }
const MOVES = {
  // BESTIA
  zarpazo:     { name: 'Zarpazo',          type: 'BESTIA', pow: 40,  acc: 100, anim: 'zarpazo' },
  mordisco:    { name: 'Mordisco',         type: 'BESTIA', pow: 55,  acc: 100, anim: 'embestida' },
  embestida:   { name: 'Embestida Salvaje',type: 'BESTIA', pow: 80,  acc: 95,  anim: 'embestida' },
  desgarro:    { name: 'Desgarro Primal',  type: 'BESTIA', pow: 110, acc: 85,  anim: 'zarpazo', eff: { st: 'sangrado', ch: .2 } },
  // SANGRE
  sorber:      { name: 'Sorber',           type: 'SANGRE', pow: 40,  acc: 100, anim: 'embestida', eff: { drain: .5 } },
  lanzasangre: { name: 'Lanza de Sangre',  type: 'SANGRE', pow: 65,  acc: 100, anim: 'proyectil', eff: { st: 'sangrado', ch: .2 } },
  festin:      { name: 'Festín Carmesí',   type: 'SANGRE', pow: 85,  acc: 95,  anim: 'embestida', eff: { drain: .5 } },
  hemorragia:  { name: 'Hemorragia',       type: 'SANGRE', pow: 110, acc: 85,  anim: 'rayo', eff: { st: 'sangrado', ch: .3 } },
  // HUESO
  astilla:     { name: 'Astilla Ósea',     type: 'HUESO', pow: 40,  acc: 100, anim: 'proyectil' },
  lluviahueso: { name: 'Lluvia de Huesos', type: 'HUESO', pow: 65,  acc: 95,  anim: 'proyectil', multi: 3 },
  osario:      { name: 'Osario',           type: 'HUESO', pow: 90,  acc: 95,  anim: 'embestida' },
  danzamacabra:{ name: 'Danza Macabra',    type: 'HUESO', pow: 115, acc: 85,  anim: 'zarpazo' },
  // ABISMO
  salobre:     { name: 'Escupitajo Salobre',type: 'ABISMO', pow: 40, acc: 100, anim: 'proyectil' },
  mareanegra:  { name: 'Marea Negra',      type: 'ABISMO', pow: 65,  acc: 100, anim: 'rayo' },
  abrazoabisal:{ name: 'Abrazo Abisal',    type: 'ABISMO', pow: 90,  acc: 95,  anim: 'embestida' },
  ahogo:       { name: 'Tsunami Ahogado',  type: 'ABISMO', pow: 110, acc: 85,  anim: 'rayo' },
  // INFIERNO
  ascua:       { name: 'Ascua',            type: 'INFIERNO', pow: 40,  acc: 100, anim: 'proyectil', eff: { st: 'quemado', ch: .1 } },
  llamafatua:  { name: 'Llama Fatua',      type: 'INFIERNO', pow: 65,  acc: 100, anim: 'proyectil', eff: { st: 'quemado', ch: .2 } },
  aliento:     { name: 'Aliento Infernal', type: 'INFIERNO', pow: 90,  acc: 95,  anim: 'rayo', eff: { st: 'quemado', ch: .2 } },
  pira:        { name: 'Pira',             type: 'INFIERNO', pow: 115, acc: 85,  anim: 'rayo', eff: { st: 'quemado', ch: .3 } },
  // PLAGA
  puatoxica:   { name: 'Púa Tóxica',       type: 'PLAGA', pow: 40,  acc: 100, anim: 'proyectil', eff: { st: 'veneno', ch: .3 } },
  miasma:      { name: 'Miasma',           type: 'PLAGA', pow: 60,  acc: 100, anim: 'aura', eff: { st: 'veneno', ch: .4 } },
  colmillo:    { name: 'Colmillo Pútrido', type: 'PLAGA', pow: 85,  acc: 95,  anim: 'embestida', eff: { st: 'veneno', ch: .2 } },
  pestilencia: { name: 'Pestilencia',      type: 'PLAGA', pow: 110, acc: 85,  anim: 'rayo', eff: { st: 'veneno', ch: .4 } },
  // ESPECTRO
  toquegelido: { name: 'Toque Gélido',     type: 'ESPECTRO', pow: 40,  acc: 100, anim: 'embestida' },
  lamento:     { name: 'Lamento',          type: 'ESPECTRO', pow: 60,  acc: 100, anim: 'aura', eff: { st: 'terror', ch: .2 } },
  garrafantasma:{name: 'Garra Fantasma',   type: 'ESPECTRO', pow: 85,  acc: 100, anim: 'zarpazo' },
  aparicion:   { name: 'Aparición',        type: 'ESPECTRO', pow: 110, acc: 90,  anim: 'rayo' },
  // SOMBRA
  sombraviva:  { name: 'Sombra Viva',      type: 'SOMBRA', pow: 40,  acc: 100, anim: 'proyectil' },
  golpebajo:   { name: 'Golpe Bajo',       type: 'SOMBRA', pow: 60,  acc: 100, anim: 'zarpazo' },
  eclipse:     { name: 'Eclipse',          type: 'SOMBRA', pow: 90,  acc: 95,  anim: 'rayo' },
  nocheeterna: { name: 'Noche Eterna',     type: 'SOMBRA', pow: 115, acc: 85,  anim: 'aura', eff: { st: 'terror', ch: .2 } },
  // TORMENTA
  chispanegra: { name: 'Chispa Negra',     type: 'TORMENTA', pow: 40,  acc: 100, anim: 'proyectil' },
  vientoaull:  { name: 'Viento Aullante',  type: 'TORMENTA', pow: 65,  acc: 100, anim: 'rayo' },
  relampago:   { name: 'Relámpago Rojo',   type: 'TORMENTA', pow: 90,  acc: 95,  anim: 'rayo' },
  tempestad:   { name: 'Tempestad',        type: 'TORMENTA', pow: 115, acc: 80,  anim: 'aura' },
  // LOCURA
  susurro:     { name: 'Susurro',          type: 'LOCURA', pow: 40,  acc: 100, anim: 'aura', eff: { st: 'terror', ch: .1 } },
  migrana:     { name: 'Migraña',          type: 'LOCURA', pow: 65,  acc: 100, anim: 'aura' },
  visionrota:  { name: 'Visión Rota',      type: 'LOCURA', pow: 90,  acc: 95,  anim: 'rayo', eff: { st: 'terror', ch: .2 } },
  delirio:     { name: 'Delirio',          type: 'LOCURA', pow: 115, acc: 85,  anim: 'aura', eff: { st: 'terror', ch: .3 } },
  // ESTADO
  mirada:      { name: 'Mirada Fija',  type: 'LOCURA', pow: 0, acc: 100, anim: 'buff', eff: { foe: { def: -1 } } },
  aullido:     { name: 'Aullido',      type: 'BESTIA', pow: 0, acc: 100, anim: 'buff', eff: { foe: { atk: -1 } } },
  ritual:      { name: 'Ritual Oscuro',type: 'SOMBRA', pow: 0, acc: 100, anim: 'buff', eff: { self: { atk: 2 } } },
  coraza:      { name: 'Coraza Ósea',  type: 'HUESO',  pow: 0, acc: 100, anim: 'buff', eff: { self: { def: 2 } } },
};

const TIERS = {
  BESTIA:   ['zarpazo', 'mordisco', 'embestida', 'desgarro'],
  SANGRE:   ['sorber', 'lanzasangre', 'festin', 'hemorragia'],
  HUESO:    ['astilla', 'lluviahueso', 'osario', 'danzamacabra'],
  ABISMO:   ['salobre', 'mareanegra', 'abrazoabisal', 'ahogo'],
  INFIERNO: ['ascua', 'llamafatua', 'aliento', 'pira'],
  PLAGA:    ['puatoxica', 'miasma', 'colmillo', 'pestilencia'],
  ESPECTRO: ['toquegelido', 'lamento', 'garrafantasma', 'aparicion'],
  SOMBRA:   ['sombraviva', 'golpebajo', 'eclipse', 'nocheeterna'],
  TORMENTA: ['chispanegra', 'vientoaull', 'relampago', 'tempestad'],
  LOCURA:   ['susurro', 'migrana', 'visionrota', 'delirio'],
};

const STATUS_NAMES = { sangrado: 'SAN', veneno: 'VEN', quemado: 'QUE', terror: 'TER' };
const STATUS_COLOR = { sangrado: '#c21d1d', veneno: '#7bbf1d', quemado: '#e8711c', terror: '#a64fd6' };

// ---------------------------------------------------------------------
//  LINAJES: [clave, origen, [nombre1, nombre2, nombre3], tipos, plan, base stats
//            {hp,atk,def,spd}, arte, [desc1, desc2, desc3]]
//  Planes de cuerpo: bestia | humanoide | serpiente | tentaculo | espectro
//                    | alado | arana | craneo | masa
// ---------------------------------------------------------------------
const LINEAGES = [
  ['ifrit', 'Arabia', ['Chispín', 'Ifrit', 'Sultán Ifrit'], ['INFIERNO'], 'espectro',
    { hp: 44, atk: 58, def: 42, spd: 62 },
    { c1: '#3a1206', c2: '#ff7b1a', eye: '#fff36b', fire: 1, horns: 2, arms: 1 },
    ['Una brasa que aprendió a odiar. Susurra el nombre de quien la apagará.',
     'Genio de humo y ceniza. Cumple deseos torciéndolos hasta que queman.',
     'Señor de un palacio de hueso fundido. Su risa derrite las campanas.']],
  ['ahuizotl', 'Azteca', ['Ahuizín', 'Ahuizotl', 'Ahuizotl Tlaloque'], ['ABISMO'], 'bestia',
    { hp: 50, atk: 52, def: 50, spd: 52 },
    { c1: '#0f2a33', c2: '#3fa6c4', eye: '#d6ff3f', tail: 'mano', snout: .8, spikes: 3 },
    ['Perrito de agua con una mano al final de la cola. No te acerques a la orilla.',
     'Arrastra a los pescadores al fondo y devuelve sus cuerpos sin uñas ni ojos.',
     'Servidor de la lluvia. Cuando aúlla, los lagos se tragan aldeas enteras.']],
  ['basilisco', 'Europa', ['Basilisquín', 'Régulo', 'Basilisco'], ['PLAGA'], 'serpiente',
    { hp: 46, atk: 50, def: 56, spd: 48 },
    { c1: '#1f2a0a', c2: '#9bd11e', eye: '#ffef3b', crown: 1, spikes: 2 },
    ['Nació de un huevo empollado por un sapo. Su aliento marchita la hierba.',
     'El pequeño rey. Lleva una corona de hueso y su mirada pudre la fruta.',
     'Quien sostiene su mirada se convierte en un cadáver de piedra verde.']],
  ['chupacabra', 'Puerto Rico / México', ['Chupín', 'Chupacabra', 'Desangrador'], ['SANGRE', 'BESTIA'], 'bestia',
    { hp: 42, atk: 60, def: 38, spd: 66 },
    { c1: '#22261f', c2: '#7d8a6b', eye: '#ff2b2b', spikes: 7, snout: 1.1, ribs: 1 },
    ['Deja tres agujeros en el cuello de las cabras. Sus púas brillan de noche.',
     'Corre en dos patas cuando nadie mira. Huele a óxido y a establo.',
     'Ya no se conforma con cabras. Las fincas amanecen vacías y blancas.']],
  ['cadejo', 'Centroamérica', ['Cadejito', 'Cadejo', 'Cadejo Negro'], ['SOMBRA'], 'bestia',
    { hp: 48, atk: 54, def: 44, spd: 64 },
    { c1: '#0b0b10', c2: '#2c2c3a', eye: '#ff3b1f', chains: 1, snout: 1, mane: 1 },
    ['Cachorro de ojos de brasa que sigue a los borrachos por los caminos.',
     'Arrastra cadenas que nadie le puso. Si te muerde, olvidas tu casa.',
     'El perro negro del fin del camino. Su sombra pesa como una lápida.']],
  ['gul', 'Arabia', ['Gulito', 'Gul', 'Gul Devorasepulcros'], ['HUESO', 'SOMBRA'], 'humanoide',
    { hp: 52, atk: 56, def: 48, spd: 40 },
    { c1: '#2e2a22', c2: '#8f8466', eye: '#d1ff5a', claws: 1, hunch: 1, jaw: 1 },
    ['Escarba tumbas recientes con uñas negras. Imita la voz de tu madre.',
     'Encorvado y paciente. Prefiere la carne de tres días.',
     'Ha devorado tantos muertos que lleva sus rostros cosidos al pecho.']],
  ['harpia', 'Grecia', ['Graznilla', 'Harpía', 'Celeno'], ['TORMENTA', 'SANGRE'], 'alado',
    { hp: 40, atk: 56, def: 36, spd: 74 },
    { c1: '#2a1f2a', c2: '#7a5a6a', eye: '#ffd43b', face: 1, talons: 1 },
    ['Polluelo con rostro de anciana. Grita como un bebé para atraerte.',
     'Ladrona de comida y de niños. Sus plumas cortan como navajas.',
     'La oscura. Trae tormentas de plumas y hambre que nunca se sacia.']],
  ['nahual', 'Mesoamérica', ['Nahualito', 'Nahual', 'Tecuani'], ['SOMBRA', 'BESTIA'], 'bestia',
    { hp: 46, atk: 62, def: 42, spd: 60 },
    { c1: '#1a120a', c2: '#c98a2e', eye: '#ffe23b', spots: 1, snout: .9, upright: 1 },
    ['Un brujo que aún no termina de convertirse. Le sobran dedos.',
     'Jaguar de medianoche con ojos de hombre. Se ríe al cazar.',
     'La bestia que come gente. Ya no recuerda haber sido humano.']],
  ['tikbalang', 'Filipinas', ['Cascorín', 'Tikbalang', 'Tikbalang Señor'], ['TORMENTA', 'LOCURA'], 'humanoide',
    { hp: 48, atk: 58, def: 40, spd: 62 },
    { c1: '#1c1410', c2: '#6b4a32', eye: '#9effff', horse: 1, mane: 1, longlimbs: 1 },
    ['Potro de patas demasiado largas. Hace que los viajeros caminen en círculos.',
     'Cabeza de caballo, cuerpo de hombre flaco. Desvía caminos con risas.',
     'Rey de los senderos perdidos. Nadie que lo siguió volvió igual.']],
  ['baku', 'Japón', ['Bakuín', 'Baku', 'Baku Devorasueños'], ['LOCURA', 'BESTIA'], 'bestia',
    { hp: 58, atk: 46, def: 54, spd: 40 },
    { c1: '#241a2a', c2: '#8f6fa8', eye: '#ff6be0', trunk: 1, snout: 1.2, tusks: 1 },
    ['Come pesadillas pequeñas. A veces se equivoca y come recuerdos.',
     'Su trompa se mete por la oreja de quien duerme. Nadie despierta igual.',
     'Ya no distingue sueños de almas. Las aldeas enteras dejan de soñar.']],
  ['kraken', 'Escandinavia', ['Krakín', 'Krakenhol', 'Kraken Primigenio'], ['ABISMO'], 'tentaculo',
    { hp: 60, atk: 52, def: 52, spd: 36 },
    { c1: '#160b1f', c2: '#7a2f5a', eye: '#ffef6b', tentacles: 6 },
    ['Larva de las profundidades. Se pega a los cascos y succiona la brea.',
     'Sus tentáculos tienen dientes. Hunde barcas para jugar.',
     'Cuando se mueve, el mar entero se hunde un palmo. Es una isla que respira.']],
  ['nuckelavee', 'Escocia', ['Nuckín', 'Desollado', 'Nuckelavee'], ['ABISMO', 'PLAGA'], 'bestia',
    { hp: 54, atk: 60, def: 46, spd: 44 },
    { c1: '#4a0f0f', c2: '#d14a3a', eye: '#ff2b2b', skinless: 1, rider: 1, snout: 1.1 },
    ['Potro sin piel que sale del mar. Su aliento marchita cosechas.',
     'Un jinete crece de su lomo. Se ven sus venas negras latir.',
     'El demonio de los orcadianos. Trae sequía, peste y caballos muertos.']],
  ['lamia', 'Grecia', ['Lamiela', 'Lamia', 'Empusa Reina'], ['SANGRE', 'PLAGA'], 'serpiente',
    { hp: 50, atk: 56, def: 46, spd: 54 },
    { c1: '#2a0f1a', c2: '#b0386a', eye: '#ffe0f0', torso: 1, hair: 1 },
    ['Pequeña serpiente con cara de niña. Llora para que la levantes.',
     'Mitad mujer, mitad serpiente. Se quita los ojos para dormir.',
     'Reina de las devoradoras. Bebe la juventud de los viajeros.']],
  ['llorona', 'México', ['Lagrimilla', 'Llorona', 'Cihuacóatl'], ['ESPECTRO', 'ABISMO'], 'espectro',
    { hp: 50, atk: 52, def: 44, spd: 58 },
    { c1: '#cfd8dc', c2: '#5e7a8a', eye: '#000000', veil: 1, hair: 1, tears: 1 },
    ['Una lágrima que aprendió a caminar. Busca algo en el río.',
     '¡Ay, mis hijos! Su grito se oye lejos cuando está cerca.',
     'La madre serpiente. Su llanto anuncia la caída de imperios.']],
  ['ammit', 'Egipto', ['Ammitín', 'Ammut', 'Ammit Devoradora'], ['ABISMO', 'BESTIA'], 'bestia',
    { hp: 56, atk: 58, def: 52, spd: 38 },
    { c1: '#2b2412', c2: '#8f7a3a', eye: '#ffb03b', croc: 1, mane: 1, snout: 1.5 },
    ['Cría de cocodrilo con melena. Espera bajo la balanza.',
     'Devora los corazones más pesados que una pluma.',
     'La devoradora de muertos. Quien es tragado no renace jamás.']],
  ['jorogumo', 'Japón', ['Hilacha', 'Tsuchigumo', 'Jorōgumo'], ['PLAGA', 'SOMBRA'], 'arana',
    { hp: 46, atk: 58, def: 46, spd: 56 },
    { c1: '#140f12', c2: '#b8862e', eye: '#ff2b2b', stripes: 1 },
    ['Araña del tamaño de un puño. Teje hilos que suenan como koto.',
     'Araña de tierra. Su tela atrapa jabalíes y leñadores.',
     'Mujer-araña. Te invita a su casa en la cascada. Nunca hay casa.']],
  ['draugr', 'Escandinavia', ['Túmulo', 'Draugr', 'Draugr Rey'], ['HUESO', 'ABISMO'], 'humanoide',
    { hp: 60, atk: 56, def: 58, spd: 30 },
    { c1: '#1b2a2a', c2: '#6f8f8a', eye: '#3fd0ff', crown: 1, drowned: 1 },
    ['Un dedo hinchado que se arrastra fuera de un túmulo.',
     'Ahogado y azul. Custodia tesoros con un hedor insoportable.',
     'Rey bajo la turba. Puede crecer hasta tapar la luna.']],
  ['leviatan', 'Hebrea', ['Escamín', 'Rahab', 'Leviatán'], ['ABISMO', 'TORMENTA'], 'serpiente',
    { hp: 62, atk: 56, def: 54, spd: 40 },
    { c1: '#0b1a2a', c2: '#2f6fa8', eye: '#ffef3b', spikes: 4, fins: 1 },
    ['Anguila de escamas negras. Muerde los anzuelos y tira hacia abajo.',
     'La serpiente del caos marino. Rompe olas con el lomo.',
     'Ningún arpón lo atraviesa. Su bostezo es un remolino sin fondo.']],
  ['banshee', 'Irlanda', ['Sollozo', 'Bean Sídhe', 'Banshee Plañidera'], ['ESPECTRO', 'LOCURA'], 'espectro',
    { hp: 44, atk: 60, def: 38, spd: 64 },
    { c1: '#dfe7e9', c2: '#7f97a1', eye: '#ff2b2b', hair: 1, mouth: 1 },
    ['Un pequeño encapuchado que flota sobre la niebla. Bajo la capucha solo hay dos luces violetas.',
     'Heraldo de la muerte envuelto en cadenas. Su grito anuncia quién no verá el amanecer.',
     'La Plañidera coronada. Arrastra las cadenas de todas las almas que ha reclamado.']],
  ['strigoi', 'Rumanía', ['Moroi', 'Strigoi', 'Strigoi Mort'], ['SANGRE', 'SOMBRA'], 'alado',
    { hp: 48, atk: 62, def: 42, spd: 60 },
    { c1: '#1a0a12', c2: '#5a1a2a', eye: '#ff2b2b', bat: 1, fangs: 1 },
    ['Murciélago con cara pálida. Nació con una membrana en la cabeza.',
     'Sale del ataúd sin abrirlo. Prefiere a sus propios parientes.',
     'El muerto que no acepta morir. Las campanas no le asustan ya.']],
  ['gashadokuro', 'Japón', ['Huesín', 'Osario', 'Gashadokuro'], ['HUESO', 'ESPECTRO'], 'craneo',
    { hp: 58, atk: 58, def: 60, spd: 30 },
    { c1: '#e8e0c8', c2: '#8a8066', eye: '#7dffcf', jaw: 1, spine: 1 },
    ['Un cráneo pequeño que rueda tras los viajeros. Rechina los dientes.',
     'Muchos huesos de muertos de hambre unidos en uno.',
     'Esqueleto de quince cuerpos de altura. Arranca cabezas al pasar.']],
  ['tunche', 'Amazonía', ['Silbín', 'Tunche', 'Tunche del Monte'], ['PLAGA', 'ESPECTRO'], 'espectro',
    { hp: 46, atk: 56, def: 42, spd: 62 },
    { c1: '#2a3a2a', c2: '#6f8f5a', eye: '#ffffff', whistle: 1, horns: 0 },
    ['Un brote con ojos que silba entre las raíces. Si respondes, te encuentra.',
     'Alma del monte hecha de madera y hojas. Silba más fuerte cuanto más cerca está.',
     'El bosque entero camina con él. Su silbido apaga los fuegos y paraliza a los cazadores.']],
  ['rokurokubi', 'Japón', ['Cuellín', 'Nukekubi', 'Rokurokubi'], ['LOCURA', 'ESPECTRO'], 'craneo',
    { hp: 46, atk: 56, def: 44, spd: 58 },
    { c1: '#e8c8b0', c2: '#2a1a1a', eye: '#1a0a0a', flesh: 1, neck: 1, hair: 1 },
    ['Una cabeza de muñeca que se mueve sola por las noches.',
     'Su cabeza se separa del cuerpo y vuela buscando sangre.',
     'Su cuello se estira por los pasillos. Te mira desde el techo.']],
  ['aswang', 'Filipinas', ['Tiyanak', 'Manananggal', 'Aswang'], ['SANGRE', 'ESPECTRO'], 'alado',
    { hp: 46, atk: 62, def: 40, spd: 60 },
    { c1: '#2a0a0a', c2: '#a03a3a', eye: '#ffef3b', half: 1, tongue: 1 },
    ['Llora como un bebé en el bosque. Tiene colmillos de anciano.',
     'Separa su torso y vuela. Sus entrañas cuelgan bajo ella.',
     'Mil formas, un hambre. Su lengua atraviesa los techos.']],
  ['mara', 'Germánico', ['Duermevela', 'Pesadilla', 'Mara'], ['LOCURA', 'SOMBRA'], 'masa',
    { hp: 50, atk: 58, def: 44, spd: 52 },
    { c1: '#1a0f24', c2: '#5a3a7a', eye: '#ff6be0', mouths: 1 },
    ['Un diablillo de sombra que se esconde en el techo y cambia de forma cuando parpadeas.',
     'Se sienta en tu pecho mientras duermes. Sus garras de humo violeta no te dejan moverte.',
     'Ha cabalgado mil sueños. Su cuerpo es la oscuridad de todas las pesadillas juntas.']],
  ['wendigo', 'Algonquino', ['Astilla', 'Wendigo', 'Wíndigo Voraz'], ['BESTIA', 'HUESO'], 'humanoide',
    { hp: 56, atk: 64, def: 44, spd: 52 },
    { c1: '#2a2a2a', c2: '#d8d0bc', eye: '#ffffff', antlers: 1, skullface: 1, longlimbs: 1 },
    ['Una cría peluda que aparece en las ventiscas. Tiene hambre en invierno.',
     'Fue un cazador que comió a su hermano. El hielo le creció en la piel y su hambre crece al comer.',
     'Bestia de la tormenta helada cubierta de cristales. Donde ruge, el invierno nunca termina.']],
  ['gorgona', 'Grecia', ['Serpelina', 'Gorgónide', 'Euríale'], ['PLAGA', 'LOCURA'], 'serpiente',
    { hp: 48, atk: 60, def: 50, spd: 50 },
    { c1: '#1f2a1a', c2: '#6fa83a', eye: '#ffef3b', torso: 1, snakehair: 1 },
    ['Su cabello aún son gusanos. Su mirada solo entumece.',
     'Las serpientes de su cabeza discuten entre ellas.',
     'Hermana inmortal. Sus lamentos petrifican el aire.']],
  ['fenrir', 'Escandinavia', ['Lobezno', 'Garm', 'Fenrir'], ['BESTIA', 'TORMENTA'], 'bestia',
    { hp: 56, atk: 68, def: 46, spd: 60 },
    { c1: '#1c1c22', c2: '#5a5a6a', eye: '#ffd43b', mane: 1, chains: 1, snout: 1.2 },
    ['Lobezno encadenado con un hilo hecho de silencio.',
     'El perro de la entrada de Hel. Su pecho está manchado de sangre.',
     'Su mandíbula toca cielo y tierra. Romperá las cadenas al final.']],
  ['manticora', 'Persia', ['Mantiquín', 'Mantícora', 'Martyaxwar'], ['BESTIA', 'PLAGA'], 'bestia',
    { hp: 54, atk: 64, def: 46, spd: 54 },
    { c1: '#3a1a0a', c2: '#c4501a', eye: '#3bff9e', tail: 'escorpion', humanface: 1, mane: 1 },
    ['Leoncito con sonrisa humana. Su cola aún no tiene aguijón.',
     'Tres filas de dientes. Su cola dispara púas venenosas.',
     'La devoradora de hombres. Imita flautas para atraerte.']],
  ['quimera', 'Grecia', ['Quimerín', 'Quimera', 'Quimera Tifónica'], ['INFIERNO', 'PLAGA'], 'bestia',
    { hp: 54, atk: 62, def: 48, spd: 52 },
    { c1: '#2a1a0a', c2: '#a8742a', eye: '#ff6b1a', tail: 'serpiente', horns: 2, mane: 1 },
    ['Un cachorro con cola de serpiente que sisea por su cuenta.',
     'León, cabra y serpiente. Las tres cabezas sueñan cosas distintas.',
     'Hija de Tifón. Escupe fuego por tres bocas a la vez.']],
  ['tzitzimitl', 'Azteca', ['Tzitzín', 'Tzitzimitl', 'Tzitzimime Estelar'], ['HUESO', 'TORMENTA'], 'craneo',
    { hp: 52, atk: 62, def: 50, spd: 48 },
    { c1: '#e8e0c8', c2: '#3a3a8f', eye: '#ffef3b', stars: 1, jaw: 1, claws: 1 },
    ['Una estrella caída con forma de calavera. Tintinea al rodar.',
     'Demonio estelar. Baja durante los eclipses a devorar a los vivos.',
     'Cuando el sol muera, ella y sus hermanas comerán el mundo.']],
  ['cerbero', 'Grecia', ['Cancerbín', 'Ortro', 'Cerbero'], ['INFIERNO', 'BESTIA'], 'bestia',
    { hp: 58, atk: 64, def: 50, spd: 50 },
    { c1: '#1a0a0a', c2: '#5a1a1a', eye: '#ffb03b', heads: [1, 2, 3], mane: 1, snout: 1.1, fire: 1 },
    ['Cachorro de los infiernos. Su babeo hace brotar acónito.',
     'Dos cabezas, una hambre. Hermano del guardián.',
     'Guardián de las puertas. Ninguna alma sale mientras él vigila.']],
  ['moloch', 'Canaán', ['Becerro', 'Molok', 'Moloch'], ['INFIERNO', 'HUESO'], 'humanoide',
    { hp: 64, atk: 64, def: 56, spd: 30 },
    { c1: '#2a0a00', c2: '#c4501a', eye: '#fff36b', bullhorns: 1, belly: 1 },
    ['Un ídolo de roca volcánica con un solo ojo de magma. Pide ofrendas.',
     'Coloso de piedra encadenado. Su pecho es un horno y los tambores tapan los gritos.',
     'El dios-horno. Donde pisa, la tierra se vuelve lava y nadie vuelve a sembrar.']],
  ['tiamat', 'Mesopotamia', ['Lodín', 'Mušḫuššu', 'Tiamat'], ['ABISMO', 'SOMBRA'], 'bestia',
    { hp: 62, atk: 62, def: 54, spd: 46 },
    { c1: '#0a1a1a', c2: '#2a6a5a', eye: '#ff3b3b', wings: 1, tail: 'serpiente', horns: 2, heads: [1, 1, 3] },
    ['Lagartija de barro primordial. Aún huele a creación.',
     'Dragón-serpiente de Babilonia. Guarda la puerta de Ishtar.',
     'Madre del caos. De su cuerpo partido nacieron cielo y tierra.']],
];

const EVO_LEVELS = [9, 18];

// Construye las 102 especies a partir de los linajes
const SPECIES = [];
const SPECIES_BY_ID = {};
(function buildSpecies() {
  let num = 1;
  LINEAGES.forEach((L, li) => {
    const [key, origin, names, types, plan, base, art, descs] = L;
    for (let s = 0; s < 3; s++) {
      const mult = [1, 1.32, 1.68][s];
      const id = `${key}_${s + 1}`;
      const sp = {
        id, num: num++, line: key, lineIndex: li, stage: s + 1, origin,
        name: names[s], types, plan, desc: descs[s],
        base: {
          hp: Math.round(base.hp * mult), atk: Math.round(base.atk * mult),
          def: Math.round(base.def * mult), spd: Math.round(base.spd * mult),
        },
        art: Object.assign({ glow: TYPES[types[0]].glow }, art, { stage: s + 1 }),
        evolvesTo: s < 2 ? `${key}_${s + 2}` : null,
        evoLevel: s < 2 ? EVO_LEVELS[s] : null,
        expYield: [55, 120, 210][s],
        catchRate: [190, 90, 30][s],
      };
      if (Array.isArray(art.heads)) sp.art.heads = art.heads[s];
      sp.learnset = buildLearnset(types);
      SPECIES.push(sp);
      SPECIES_BY_ID[id] = sp;
    }
  });
})();

function buildLearnset(types) {
  const [a, b] = types;
  const sec = b || (a === 'BESTIA' ? 'SOMBRA' : 'BESTIA');
  const ls = [
    [1, TIERS[a][0]], [1, b ? 'mirada' : 'aullido'],
    [4, TIERS[sec][0]], [7, TIERS[a][1]],
    [11, b ? 'ritual' : 'coraza'], [13, TIERS[sec][1]],
    [16, TIERS[a][2]], [21, TIERS[sec][2]],
    [26, TIERS[a][3]], [32, TIERS[sec][3]],
  ];
  return ls;
}

// ---------------------------------------------------------------------
//  OBJETOS
// ---------------------------------------------------------------------
const ITEMS = {
  sello:      { name: 'Sello de Cera',     price: 150,  desc: 'Atrapa criaturas debilitadas.', kind: 'catch', bonus: 1 },
  sellomayor: { name: 'Sello de Sangre',   price: 500,  desc: 'Sello potente. Mejor captura.', kind: 'catch', bonus: 1.8 },
  sellonegro: { name: 'Sello Negro',       price: 1200, desc: 'Casi nada escapa a este sello.', kind: 'catch', bonus: 3 },
  elixir:     { name: 'Elixir Turbio',     price: 120,  desc: 'Restaura 30 PV.', kind: 'heal', amount: 30 },
  elixirmayor:{ name: 'Elixir de Médula',  price: 400,  desc: 'Restaura 100 PV.', kind: 'heal', amount: 100 },
  sal:        { name: 'Sal Bendita',       price: 200,  desc: 'Cura cualquier estado alterado.', kind: 'cure' },
  vela:       { name: 'Vela de Difunto',   price: 900,  desc: 'Revive a una criatura con la mitad de PV.', kind: 'revive' },
};
