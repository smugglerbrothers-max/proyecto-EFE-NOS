/*
 * Motor de simulación del programa PLC (Mitsubishi FX3GE) — versión JavaScript.
 *
 * Es una traducción directa de simulador.py: lee el mismo archivo IL y lo
 * ejecuta por ciclos de scan de 10 ms con la semántica del FX. La prueba
 * tests/test_motor_js.py corre los dos motores con las mismas entradas y
 * exige que el estado sea idéntico en cada scan.
 *
 * Funciona en el navegador (window.MotorPLC) y en Node (require).
 */
(function (raiz) {
  "use strict";

  const SCAN_MS = 10;

  // ---------------------------------------------------------------- E/S
  // Memoria del programa, sección 2. "NC": en reposo vale 1 y se abre al accionarlo.
  const ENTRADAS = [
    ["S1", "X000", "Partida general", "NA", "pulsador"],
    ["S0", "X001", "Parada general", "NC", "pulsador"],
    ["S00", "X002", "Emergencia general", "NC", "hongo"],
    ["S01", "X003", "Emergencia G1", "NC", "hongo"],
    ["S02", "X004", "Emergencia G2", "NC", "hongo"],
    ["S03", "X005", "Emergencia G3", "NC", "hongo"],
    ["S11", "X006", "Selector G1 A/B", "NA", "selector"],
    ["S21", "X007", "Selector G2 C/D", "NA", "selector"],
    ["S31", "X010", "Selector G3 E/F", "NA", "selector"],
    ["S12", "X011", "Marcha G1", "NA", "pulsador"],
    ["S13", "X012", "Parada G1", "NC", "pulsador"],
    ["S22", "X013", "Marcha G2", "NA", "pulsador"],
    ["S23", "X014", "Parada G2", "NC", "pulsador"],
    ["S32", "X015", "Marcha G3", "NA", "pulsador"],
    ["S33", "X020", "Parada G3", "NC", "pulsador"],
    ["S41", "X021", "Habilitar torre", "NA", "pulsador"],
    ["S42", "X022", "Deshabilitar torre", "NA", "pulsador"],
    ["S51", "X023", "Relleno manual", "NA", "pulsador"],
    ["S52", "X024", "Reset alarmas", "NA", "pulsador"],
    ["FV34", "X025", "Falla VDF3/VDF4", "NC", "falla"],
    ["FPS34", "X026", "Falla PS3/PS4", "NC", "falla"],
    ["FV12", "X027", "Falla VDF1/VDF2", "NC", "falla"],
    ["FQM7", "X030", "Falla QM7 ventilador", "NC", "falla"],
  ].map(([tag, direccion, descripcion, contacto, tipo]) => ({ tag, direccion, descripcion, contacto, tipo }));
  const ENTRADA_POR_TAG = Object.fromEntries(ENTRADAS.map((e) => [e.tag, e]));

  const SALIDAS = {
    Y000: ["P-3701A", "Marcha P-3701A"], Y001: ["P-3701B", "Marcha P-3701B"],
    Y002: ["P-3702C", "Marcha P-3702C"], Y003: ["P-3702D", "Marcha P-3702D"],
    Y004: ["P-3702E", "Marcha P-3702E"], Y005: ["P-3702F", "Marcha P-3702F"],
    Y006: ["M-3703", "Ventilador torre"], Y007: ["VA-01", "Descarga P-3701A"],
    Y010: ["VA-02", "Descarga P-3701B"], Y011: ["VA-03", "Entrada torre"],
    Y020: ["VA-04", "By-pass torre"], Y021: ["VA-05", "Descarga P-3702C"],
    Y022: ["VA-06", "Descarga P-3702D"], Y023: ["VA-07", "Descarga P-3702E"],
    Y024: ["VA-08", "Descarga P-3702F"], Y025: ["VA-09", "Reposición osmosis"],
    Y026: ["H7", "Nivel bajo T-3701"], Y027: ["H8", "Nivel alto T-3701"],
    Y030: ["H9", "Nivel bajo T-3702"], Y031: ["H10", "Nivel alto T-3702"],
    Y032: ["H11", "Alta temp. T-3701"], Y033: ["HA1", "Bocina"],
    Y034: ["H12", "Sistema en servicio"], Y035: ["H13", "Torre habilitada"],
    Y036: ["KA1", "Vel. reducida G1/G3"], Y037: ["H14", "Baja presión"],
  };
  const SALIDA_POR_TAG = Object.fromEntries(Object.entries(SALIDAS).map(([d, v]) => [v[0], d]));
  // H1–H6 no son salidas del PLC (relé "en marcha" del VDF); siguen a Y000–Y005.
  const LUCES_BOMBA = { H1: "Y000", H2: "Y001", H3: "Y002", H4: "Y003", H5: "Y004", H6: "Y005" };

  // ---------------------------------------------------------------- programa
  const RE_LINEA = /^;\s*L[íi]nea\s+(\d+)\s*:\s*(.*)$/;
  const RE_COMPARACION = /^(LD|AND|OR)(<>|>=|<=|=|>|<)$/;

  function cargarPrograma(texto) {
    const instrucciones = [];
    const comentarios = {};
    let linea = -1;
    for (const cruda of texto.split(/\r?\n/)) {
      const s = cruda.trim();
      if (!s) continue;
      if (s.startsWith(";")) {
        const m = s.match(RE_LINEA);
        if (m) { linea = parseInt(m[1], 10); comentarios[linea] = m[2].trim(); }
        continue;
      }
      const partes = s.split(/\s+/);
      instrucciones.push({ op: partes[0].toUpperCase(), args: partes.slice(1), linea, indice: instrucciones.length });
    }
    const conocidas = new Set(["LD", "LDI", "AND", "ANI", "OR", "ORI", "ANB", "ORB", "LDP", "ORP", "ANDP",
      "OUT", "SET", "RST", "PLS", "MUL", "DIV", "MOV", "DADD", "TO", "FROM", "END"]);
    for (const ins of instrucciones) {
      if (!conocidas.has(ins.op) && !RE_COMPARACION.test(ins.op)) {
        throw new Error(`Instrucción no soportada en la línea ${ins.linea}: ${ins.op} ${ins.args.join(" ")}`);
      }
    }
    const textoLinea = (n) => instrucciones.filter((i) => i.linea === n)
      .map((i) => [i.op, ...i.args].join(" ")).join(" ; ");
    const lineas = [...new Set(instrucciones.map((i) => i.linea))].sort((a, b) => a - b);
    return { instrucciones, comentarios, textoLinea, lineas };
  }

  // ---------------------------------------------------------------- PLC
  const s16 = (v) => { v &= 0xFFFF; return v & 0x8000 ? v - 0x10000 : v; };
  const s32 = (v) => { v = Number(BigInt.asUintN(32, BigInt(v))); return v >= 0x80000000 ? v - 0x100000000 : v; };
  const COMPARA = { "=": (a, b) => a === b, "<>": (a, b) => a !== b, ">": (a, b) => a > b,
                    "<": (a, b) => a < b, ">=": (a, b) => a >= b, "<=": (a, b) => a <= b };

  class PLC {
    constructor(programa, scanMs = SCAN_MS) {
      this.programa = programa;
      this.scanMs = scanMs;
      this.tMs = 0;
      this.nScan = 0;
      this.entradas = {};       // estado físico de los X
      this.bits = {};           // imagen X, Y, M, T
      this.D = {};              // registros de datos
      this.tempAcum = {};       // ms acumulados por temporizador
      this.bfm = {};            // buffer del FX3U-4AD
      this.flancos = {};        // memoria por instrucción
      this.eventos = [];        // {tMs, linea, dispositivo, valor}
      this.lineasScan = new Set();
      this.maxEventos = 4000;
    }

    bit(n) { return !!this.bits[n]; }
    leerBit(op) { return op === "M8000" ? true : !!this.bits[op]; }

    valor(op) {
      if (op[0] === "K") return parseInt(op.slice(1), 10);
      if (op[0] === "H") return parseInt(op.slice(1), 16);
      if (op[0] === "D") return this.D[parseInt(op.slice(1), 10)] || 0;
      throw new Error("Operando de palabra no soportado: " + op);
    }

    valor32(op) {
      if (op[0] === "K") return parseInt(op.slice(1), 10);
      const n = parseInt(op.slice(1), 10);
      const bajo = (this.D[n] || 0) & 0xFFFF;
      const alto = (this.D[n + 1] || 0) & 0xFFFF;
      return s32(alto * 0x10000 + bajo);
    }

    escribirD32(op, valor) {
      const n = parseInt(op.slice(1), 10);
      const v = Number(BigInt.asUintN(32, BigInt(valor)));
      this.D[n] = s16(v & 0xFFFF);
      this.D[n + 1] = s16(Math.floor(v / 0x10000));
    }

    escribirBit(nombre, valor, linea) {
      const anterior = !!this.bits[nombre];
      this.bits[nombre] = valor;
      if (anterior !== valor) {
        this.lineasScan.add(linea);
        if (!nombre.startsWith("M8")) {
          this.eventos.push({ tMs: this.tMs, linea, dispositivo: nombre, valor });
          if (this.eventos.length > this.maxEventos) this.eventos.splice(0, this.eventos.length - this.maxEventos);
        }
      }
    }

    contacto(ins) {
      const op = ins.op, v = this.leerBit(ins.args[0]);
      if (op === "LDP" || op === "ORP" || op === "ANDP") {
        const previo = !!this.flancos[ins.indice];
        this.flancos[ins.indice] = v;
        return v && !previo;
      }
      if (op === "LDI" || op === "ANI" || op === "ORI") return !v;
      return v;
    }

    temporizador(n, k, entrada, linea) {
      const baseMs = n < 200 ? 100 : 10;
      if (entrada) this.tempAcum[n] = Math.min((this.tempAcum[n] || 0) + this.scanMs, k * baseMs);
      else this.tempAcum[n] = 0;
      this.escribirBit("T" + n, entrada && this.tempAcum[n] >= k * baseMs, linea);
    }

    scan() {
      this.lineasScan = new Set();
      this.bits.M8002 = this.nScan === 0;
      this.bits.M8013 = (this.tMs % 1000) >= 500;
      for (const [d, v] of Object.entries(this.entradas)) this.bits[d] = v;

      let acc = false, pila = [], lineaActual = null;
      for (const ins of this.programa.instrucciones) {
        if (ins.linea !== lineaActual) { lineaActual = ins.linea; pila = []; }
        const op = ins.op, a = ins.args;
        const m = op.match(RE_COMPARACION);
        if (m) {
          const r = COMPARA[m[2]](this.valor(a[0]), this.valor(a[1]));
          if (m[1] === "LD") { pila.push(acc); acc = r; }
          else if (m[1] === "AND") acc = acc && r;
          else acc = acc || r;
        } else if (op === "LD" || op === "LDI" || op === "LDP") {
          pila.push(acc); acc = this.contacto(ins);
        } else if (op === "AND" || op === "ANI" || op === "ANDP") {
          const c = this.contacto(ins); acc = acc && c;
        } else if (op === "OR" || op === "ORI" || op === "ORP") {
          const c = this.contacto(ins); acc = acc || c;
        } else if (op === "ANB") {
          acc = pila.pop() && acc;
        } else if (op === "ORB") {
          acc = pila.pop() || acc;
        } else if (op === "OUT") {
          if (a[0][0] === "T") this.temporizador(parseInt(a[0].slice(1), 10), this.valor(a[1]), acc, ins.linea);
          else this.escribirBit(a[0], acc, ins.linea);
        } else if (op === "SET") {
          if (acc) this.escribirBit(a[0], true, ins.linea);
        } else if (op === "RST") {
          if (acc) {
            if (a[0][0] === "T") this.tempAcum[parseInt(a[0].slice(1), 10)] = 0;
            this.escribirBit(a[0], false, ins.linea);
          }
        } else if (op === "PLS") {
          const previo = !!this.flancos[ins.indice];
          this.flancos[ins.indice] = acc;
          this.escribirBit(a[0], acc && !previo, ins.linea);
        } else if (op === "MUL") {
          if (acc) this.escribirD32(a[2], s16(this.valor(a[0])) * s16(this.valor(a[1])));
        } else if (op === "DIV") {
          if (acc) {
            const x = s16(this.valor(a[0])), y = s16(this.valor(a[1]));
            if (y !== 0) {
              const q = Math.trunc(x / y), r = x - q * y, n = parseInt(a[2].slice(1), 10);
              this.D[n] = s16(q); this.D[n + 1] = s16(r);
            }
          }
        } else if (op === "MOV") {
          if (acc) this.D[parseInt(a[1].slice(1), 10)] = s16(this.valor(a[0]));
        } else if (op === "DADD") {
          if (acc) this.escribirD32(a[2], this.valor32(a[0]) + this.valor32(a[1]));
        } else if (op === "TO") {
          if (acc) for (let k = 0; k < this.valor(a[3]); k++) this.bfm[this.valor(a[1]) + k] = this.valor(a[2]);
        } else if (op === "FROM") {
          if (acc) {
            const base = parseInt(a[2].slice(1), 10);
            for (let k = 0; k < this.valor(a[3]); k++) this.D[base + k] = s16(this.bfm[this.valor(a[1]) + k] || 0);
          }
        } else if (op === "END") {
          break;
        }
      }
      this.nScan += 1;
      this.tMs += this.scanMs;
    }
  }

  // ---------------------------------------------------------------- tablero y proceso
  class Tablero {
    constructor(plc) {
      this.plc = plc;
      plc.bits.M100 = true;                      // modo simulación (Memoria, sección 5)
      for (const e of ENTRADAS) plc.entradas[e.direccion] = e.contacto === "NC";
      this.nivelT1 = 60; this.nivelT2 = 60; this.tempT1 = 30; this.tempT2 = 30;
      this.caudal = 0; this.presion = 10;
      this.escribirAnalogicas();
    }
    static crudoNivel(p) { return Math.max(0, Math.min(3200, Math.round(p * 32))); }
    static crudoTemp(c) { return Math.max(0, Math.min(4000, Math.round(c * 40))); }
    static crudoCaudal(q) { return Math.max(0, Math.min(4000, Math.round(q * 4000 / 30))); }
    static crudoPresion(b) { return Math.max(0, Math.min(4000, Math.round(b * 250))); }
    escribirAnalogicas() {
      const D = this.plc.D;
      D[8280] = Tablero.crudoNivel(this.nivelT1);
      D[8281] = Tablero.crudoNivel(this.nivelT2);
      const crudos = [Tablero.crudoTemp(this.tempT1), Tablero.crudoTemp(this.tempT2),
                      Tablero.crudoCaudal(this.caudal), Tablero.crudoPresion(this.presion)];
      crudos.forEach((v, k) => { if (this.plc.bit("M100")) D[10 + k] = v; else this.plc.bfm[10 + k] = v; });
    }
    accionar(tag, accionado = true) {
      const e = ENTRADA_POR_TAG[tag];
      this.plc.entradas[e.direccion] = e.contacto === "NA" ? accionado : !accionado;
    }
    accionado(tag) {
      const e = ENTRADA_POR_TAG[tag];
      const v = this.plc.entradas[e.direccion];
      return e.contacto === "NA" ? v : !v;
    }
    y(tag) {
      if (LUCES_BOMBA[tag]) return this.plc.bit(LUCES_BOMBA[tag]);
      return this.plc.bit(SALIDA_POR_TAG[tag]);
    }
  }

  /** Proceso simple: presión de la línea G3, caudal de reposición y llenado de T-3702 con VA-09. */
  class Planta {
    constructor(tab) {
      this.tab = tab;
      this.presionDisponible = 10;   // bar que entrega G3 en marcha (el usuario lo cambia)
      this.caudalOsmosis = 12;       // m³/h con VA-09 abierta
      this.rellenoPctS = 1.0;        // % por segundo
    }
    paso(dt) {
      const t = this.tab;
      const g3 = t.y("P-3702E") || t.y("P-3702F");
      const objetivo = g3 ? this.presionDisponible : 0;
      t.presion += (objetivo - t.presion) * Math.min(1, dt / 1.2);
      const va09 = t.y("VA-09");
      t.caudal += ((va09 ? this.caudalOsmosis : 0) - t.caudal) * Math.min(1, dt / 0.8);
      if (va09) t.nivelT2 = Math.min(100, t.nivelT2 + this.rellenoPctS * dt);
    }
  }

  const api = { SCAN_MS, ENTRADAS, ENTRADA_POR_TAG, SALIDAS, SALIDA_POR_TAG, LUCES_BOMBA,
                cargarPrograma, PLC, Tablero, Planta, s16, s32 };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else raiz.MotorPLC = api;
})(typeof window !== "undefined" ? window : globalThis);
