// Ejecuta el motor JavaScript con un escenario JSON y escribe el estado después de cada scan.
// Uso: node tests/correr_motor_js.js Programa_IL_GXWorks2.txt escenario.json salida.txt
const fs = require("fs");
const path = require("path");
const M = require(path.join(__dirname, "..", "interactivo", "motor_plc.js"));
const [prog, esc, salida] = process.argv.slice(2);
const plc = new M.PLC(M.cargarPrograma(fs.readFileSync(prog, "utf8")));
const pasos = JSON.parse(fs.readFileSync(esc, "utf8"));
const lineas = [];
const estado = () => {
  const b = Object.keys(plc.bits).filter((k) => plc.bits[k]).sort().join(",");
  const d = Object.keys(plc.D).map(Number).sort((a, c) => a - c).filter((k) => plc.D[k] !== 0)
    .map((k) => `${k}=${plc.D[k]}`).join(",");
  const t = Object.keys(plc.tempAcum).map(Number).sort((a, c) => a - c).filter((k) => plc.tempAcum[k])
    .map((k) => `${k}=${plc.tempAcum[k]}`).join(",");
  const ev = plc.eventos.length ? plc.eventos[plc.eventos.length - 1] : null;
  return `${b}|${d}|${t}|${[...plc.lineasScan].sort((a, c) => a - c).join(",")}`;
};
for (const p of pasos) {
  Object.assign(plc.entradas, p.X);
  for (const [k, v] of Object.entries(p.D)) plc.D[k] = v;
  if ("M100" in p) plc.bits.M100 = p.M100;
  for (let i = 0; i < p.n; i++) { plc.scan(); lineas.push(estado()); }
}
fs.writeFileSync(salida, lineas.join("\n") + "\n");
