// Verifica la conversión IL → Ladder: para cada línea, con valores al azar en los contactos,
// el árbol del Ladder debe dar el mismo resultado que la lista de instrucciones evaluada con pila.
const fs = require("fs");
const path = require("path");
const M = require(path.join(__dirname, "..", "interactivo", "motor_plc.js"));
const L = require(path.join(__dirname, "..", "interactivo", "ladder.js"));
const prog = M.cargarPrograma(fs.readFileSync(process.argv[2], "utf8"));
const circuitos = L.construirCircuitos(prog);
const ES_CONTACTO = /^(LD|LDI|LDP|AND|ANI|ANDP|OR|ORI|ORP)$|^(LD|AND|OR)(<>|>=|<=|=|>|<)$/;

function evaluarIL(lista, val) {
  let acc = false, pila = [];
  for (const ins of lista) {
    const op = ins.op;
    if (!ES_CONTACTO.test(op) && op !== "ANB" && op !== "ORB") break;
    if (op.startsWith("LD")) { pila.push(acc); acc = val(ins); }
    else if (op.startsWith("AND") || op === "ANI") acc = acc && val(ins);
    else if (op.startsWith("OR")) acc = acc || val(ins);
    else if (op === "ANB") acc = pila.pop() && acc;
    else if (op === "ORB") acc = pila.pop() || acc;
  }
  return acc;
}
function contactos(n, out = []) {
  if (!n) return out;
  if (n.t === "c") out.push(n.ins.indice); else n.hijos.forEach((h) => contactos(h, out));
  return out;
}
let pruebas = 0, errores = [];
let semilla = 12345;
const azar = () => { semilla = (semilla * 1103515245 + 12345) % 2147483648; return semilla / 2147483648; };
for (const c of circuitos) {
  const lista = prog.instrucciones.filter((i) => i.linea === c.linea);
  const esperados = lista.filter((i) => ES_CONTACTO.test(i.op)).map((i) => i.indice);
  const enArbol = contactos(c.logica);
  if (JSON.stringify(esperados) !== JSON.stringify(enArbol)) errores.push(`línea ${c.linea}: contactos ${enArbol} vs ${esperados}`);
  for (let k = 0; k < 300; k++) {
    const v = {};
    for (const i of esperados) v[i] = azar() < 0.5;
    const a = esperados.length ? evaluarIL(lista, (ins) => v[ins.indice]) : true;
    const b = L.evaluar(c.logica, (ins) => v[ins.indice]);
    pruebas++;
    if (a !== b) { errores.push(`línea ${c.linea}: IL=${a} Ladder=${b}`); break; }
  }
}
console.log(JSON.stringify({ lineas: circuitos.length, pruebas, errores,
  conParalelo: circuitos.filter((c) => JSON.stringify(c.logica || {}).includes('"t":"p"')).map((c) => c.linea) }));
