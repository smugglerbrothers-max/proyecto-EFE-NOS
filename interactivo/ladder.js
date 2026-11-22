/*
 * Ladder en vivo: convierte cada línea del programa IL en un circuito escalera
 * (contactos en serie y en paralelo + bobinas) y lo dibuja en SVG.
 *
 * El flujo de corriente se pinta con lo que el PLC evaluó en el último scan
 * (plc.vistoContacto), igual que el modo monitor de GX Works2. Las bobinas
 * muestran el estado real del dispositivo.
 *
 * La conversión IL → árbol se verifica en tests/test_ladder_js.py: evaluado con
 * valores al azar, el árbol da lo mismo que la lista de instrucciones.
 */
(function (raiz) {
  "use strict";

  const RE_CMP = /^(LD|AND|OR)(<>|>=|<=|=|>|<)$/;
  const ES_LD = (op) => op === "LD" || op === "LDI" || op === "LDP" || /^LD(<>|>=|<=|=|>|<)$/.test(op);
  const ES_AND = (op) => op === "AND" || op === "ANI" || op === "ANDP" || /^AND(<>|>=|<=|=|>|<)$/.test(op);
  const ES_OR = (op) => op === "OR" || op === "ORI" || op === "ORP" || /^OR(<>|>=|<=|=|>|<)$/.test(op);

  // ------------------------------------------------------------------ IL → árbol
  function serie(a, b) {
    const h = [...(a.t === "s" ? a.hijos : [a]), ...(b.t === "s" ? b.hijos : [b])];
    return { t: "s", hijos: h };
  }
  function paralelo(a, b) {
    const h = [...(a.t === "p" ? a.hijos : [a]), ...(b.t === "p" ? b.hijos : [b])];
    return { t: "p", hijos: h };
  }

  /** Devuelve [{linea, logica, salidas:[ins]}] para cada línea del programa. */
  function construirCircuitos(programa) {
    const porLinea = new Map();
    for (const ins of programa.instrucciones) {
      if (!porLinea.has(ins.linea)) porLinea.set(ins.linea, []);
      porLinea.get(ins.linea).push(ins);
    }
    const circuitos = [];
    for (const [linea, lista] of porLinea) {
      const pila = [];
      let actual = null;
      const salidas = [];
      for (const ins of lista) {
        const op = ins.op;
        if (ES_LD(op) || ES_AND(op) || ES_OR(op) || op === "ANB" || op === "ORB") {
          if (salidas.length) throw new Error(`Línea ${linea}: contacto después de una salida (no soportado en el Ladder)`);
          const c = { t: "c", ins };
          if (ES_LD(op)) { if (actual) pila.push(actual); actual = c; }
          else if (ES_AND(op)) actual = serie(actual, c);
          else if (ES_OR(op)) actual = paralelo(actual, c);
          else if (op === "ANB") actual = serie(pila.pop(), actual);
          else actual = paralelo(pila.pop(), actual);
        } else {
          salidas.push(ins);
        }
      }
      if (pila.length) throw new Error(`Línea ${linea}: bloques sin cerrar (falta ANB/ORB)`);
      circuitos.push({ linea, logica: actual, salidas });
    }
    return circuitos;
  }

  /** Evalúa el árbol con una función que da el valor de cada contacto (para la prueba). */
  function evaluar(nodo, valorContacto) {
    if (!nodo) return true;
    if (nodo.t === "c") return valorContacto(nodo.ins);
    if (nodo.t === "s") return nodo.hijos.every((h) => evaluar(h, valorContacto));
    return nodo.hijos.map((h) => evaluar(h, valorContacto)).some(Boolean);
  }

  // ------------------------------------------------------------------ textos
  const COMENTARIOS_M = {
    M0: "En servicio", M1: "Sin emergencia", M2: "Torre habilitada", M10: "Marcha G1",
    M11: "Permiso G1", M12: "Rearranque G1", M13: "G1 parado n. bajo", M14: "G1 parado n. alto",
    M15: "Rearranque G1", M20: "Marcha G2", M21: "Permiso G2", M22: "Recirc. temp.", M23: "Demanda recirc.",
    M30: "Marcha G3", M31: "Permiso G3", M32: "Bloqueo T-3702", M33: "Rearranque G3", M34: "G3 parado auto",
    M40: "N. bajo T-3701", M41: "N. alto T-3701", M42: "N. bajo T-3702", M43: "N. alto T-3702",
    M44: "Alarma temp.", M45: "Alarma presión", M46: "Bocina reconoc.", M50: "Repos. auto",
    M51: "Repos. manual", M100: "Modo simulación", M8000: "Siempre ON", M8002: "Pulso inicial",
    M8013: "Reloj 1 s", M8280: "AI CH1 corriente", M8281: "AI CH2 corriente",
    T0: "Retardo P-3701A", T1: "Retardo P-3701B", T2: "Retardo P-3702C", T3: "Retardo P-3702D",
    T4: "Retardo P-3702E", T5: "Retardo P-3702F", T10: "Temp. 5 min", T11: "Presión 30 s",
    D100: "Nivel T-3701", D101: "Nivel T-3702", D110: "Temp. T-3701", D111: "Temp. T-3702",
    D112: "Caudal FIT-01", D113: "Presión PIT-01",
  };
  function comentario(dev, M) {
    if (dev in COMENTARIOS_M) return COMENTARIOS_M[dev];
    const e = M.ENTRADAS.find((x) => x.direccion === dev);
    if (e) return e.tag + (e.contacto === "NC" ? " (NC)" : "");
    if (M.SALIDAS[dev]) return M.SALIDAS[dev][0];
    return "";
  }
  const corto = (s, n = 15) => (s.length > n ? s.slice(0, n - 1) + "…" : s);
  const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

  // ------------------------------------------------------------------ dibujo
  const CW = 104, CH = 58, WY = 30, X0 = 26, COIL_W = 210, TOP = 30;

  function medir(n) {
    if (!n) { return { w: 1, h: 1 }; }
    if (n.t === "c") { n.w = 1; n.h = 1; }
    else if (n.t === "s") { n.hijos.forEach(medir); n.w = n.hijos.reduce((a, h) => a + h.w, 0); n.h = Math.max(...n.hijos.map((h) => h.h)); }
    else { n.hijos.forEach(medir); n.w = Math.max(...n.hijos.map((h) => h.w)); n.h = n.hijos.reduce((a, h) => a + h.h, 0); }
    return n;
  }

  /** Crea el SVG de un circuito. Devuelve {svg, actualizar(plc)}. */
  function dibujarCircuito(circ, M, anchoLogica, programa) {
    const partes = [];
    let idn = 0;
    const nuevoId = () => "k" + (idn++);
    const linea = (x1, y1, x2, y2) => { const id = nuevoId(); partes.push(`<line data-k="${id}" class="lw" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"/>`); return id; };

    function layout(n, x, y) {
      if (n.t === "c") {
        const ins = n.ins, op = ins.op, cy = y + WY, cx = x + CW / 2;
        n.eIn = linea(x, cy, cx - 13, cy);
        n.eOut = linea(cx + 13, cy, x + CW, cy);
        n.eSym = nuevoId();
        const cmp = op.match(RE_CMP);
        if (cmp) {
          const t = `${ins.args[0]} ${cmp[2]} ${ins.args[1]}`;
          partes.push(`<g data-k="${n.eSym}" class="sym cmp"><rect x="${x + 4}" y="${cy - 11}" width="${CW - 8}" height="22" rx="4"/>` +
            `<text x="${cx}" y="${cy + 4}" text-anchor="middle">${esc(t)}</text></g>`);
          // el rectángulo tapa los cables cortos: se dibujan igual por debajo
          n.eVal = nuevoId();
          partes.push(`<text data-k="${n.eVal}" class="dev2" x="${cx}" y="${y + 52}" text-anchor="middle"></text>`);
          partes.push(`<text class="dev" x="${cx}" y="${y + 13}" text-anchor="middle">${esc(corto(comentario(ins.args[0], M)))}</text>`);
        } else {
          const nc = op === "LDI" || op === "ANI" || op === "ORI";
          const flanco = op === "LDP" || op === "ANDP" || op === "ORP";
          partes.push(`<g data-k="${n.eSym}" class="sym"><rect x="${cx - 9}" y="${cy - 12}" width="18" height="24" class="fondo"/>` +
            `<line x1="${cx - 9}" y1="${cy - 12}" x2="${cx - 9}" y2="${cy + 12}"/><line x1="${cx + 9}" y1="${cy - 12}" x2="${cx + 9}" y2="${cy + 12}"/>` +
            (nc ? `<line x1="${cx - 13}" y1="${cy + 13}" x2="${cx + 13}" y2="${cy - 13}"/>` : "") +
            (flanco ? `<text x="${cx}" y="${cy + 5}" text-anchor="middle" class="flecha">↑</text>` : "") + `</g>`);
          partes.push(`<text class="dev" x="${cx}" y="${y + 13}" text-anchor="middle">${esc(ins.args[0])}</text>`);
          partes.push(`<text class="dev2" x="${cx}" y="${y + 53}" text-anchor="middle"><title>${esc(comentario(ins.args[0], M))}</title>${esc(corto(comentario(ins.args[0], M)))}</text>`);
        }
        return;
      }
      if (n.t === "s") {
        let xx = x;
        for (const h of n.hijos) {
          layout(h, xx, y);
          if (h.h < n.h || true) { /* cada hijo ocupa su ancho */ }
          xx += h.w * CW;
        }
        return;
      }
      // paralelo
      let yy = y;
      const W = n.w * CW;
      n.eExt = [];
      for (const h of n.hijos) {
        layout(h, x, yy);
        n.eExt.push(h.w < n.w ? linea(x + h.w * CW, yy + WY, x + W, yy + WY) : null);
        yy += h.h * CH;
      }
      const yUlt = y + (n.h - n.hijos[n.hijos.length - 1].h) * CH + WY;
      n.eL = linea(x, y + WY, x, yUlt);
      n.eR = linea(x + W, y + WY, x + W, yUlt);
    }

    const logica = circ.logica ? medir(circ.logica) : null;
    if (logica) layout(logica, X0, TOP);
    const wLog = logica ? logica.w : 0;
    const hLog = logica ? logica.h : 1;
    const xFin = X0 + wLog * CW;
    const xBob = X0 + anchoLogica * CW + 12;
    const nSal = Math.max(1, circ.salidas.length);
    const alto = TOP + Math.max(hLog, nSal) * CH + 4;
    const eTramo = logica ? linea(xFin, TOP + WY, xBob, TOP + WY) : null;
    const eJunta = nSal > 1 ? linea(xBob, TOP + WY, xBob, TOP + (nSal - 1) * CH + WY) : null;
    const bobinas = [];
    circ.salidas.forEach((ins, k) => {
      const cy = TOP + k * CH + WY;
      const id = nuevoId();
      const a = ins.args;
      let cuerpo, nombre = "", extra = "";
      if (ins.op === "OUT" && a[0][0] !== "T") {
        cuerpo = `<path d="M${xBob + 70} ${cy - 13} q -9 13 0 26 M${xBob + 100} ${cy - 13} q 9 13 0 26"/>`;
        nombre = a[0]; extra = comentario(a[0], M);
      } else if (ins.op === "OUT") {
        cuerpo = `<path d="M${xBob + 70} ${cy - 13} q -9 13 0 26 M${xBob + 100} ${cy - 13} q 9 13 0 26"/>`;
        nombre = `${a[0]} ${a[1]}`; extra = comentario(a[0], M);
      } else if (ins.op === "END") {
        cuerpo = `<rect x="${xBob + 20}" y="${cy - 12}" width="${COIL_W - 40}" height="24" rx="3"/><text x="${xBob + COIL_W / 2}" y="${cy + 5}" text-anchor="middle">END</text>`;
      } else {
        cuerpo = `<rect x="${xBob + 14}" y="${cy - 12}" width="${COIL_W - 28}" height="24" rx="3"/>` +
          `<text x="${xBob + COIL_W / 2}" y="${cy + 5}" text-anchor="middle">${esc([ins.op, ...a].join(" "))}</text>`;
        if (ins.op === "SET" || ins.op === "RST" || ins.op === "PLS") extra = comentario(a[0], M);
      }
      const hilo = linea(xBob, cy, xBob + (ins.op === "OUT" ? 70 : 14), cy);
      partes.push(`<g data-k="${id}" class="bob">${cuerpo}` +
        (nombre ? `<text class="dev" x="${xBob + 85}" y="${cy - 17}" text-anchor="middle">${esc(nombre)}</text>` : "") +
        (extra ? `<text class="dev2 ext" x="${xBob + 85}" y="${cy + 25}" text-anchor="middle">${esc(extra)}</text>` : "") + `</g>`);
      bobinas.push({ ins, id, hilo });
    });
    const ancho = xBob + COIL_W + 16;
    partes.unshift(`<line class="riel" x1="${X0}" y1="${TOP - 6}" x2="${X0}" y2="${alto - 6}"/>` +
      `<line class="riel" x1="${xBob + COIL_W}" y1="${TOP - 6}" x2="${xBob + COIL_W}" y2="${alto - 6}"/>`);
    const titulo = `<text class="tit" x="4" y="14"><tspan class="num">Línea ${circ.linea}</tspan>  ${esc(programa.comentarios[circ.linea] || "")}</text>`;
    const svgTxt = `<svg viewBox="0 0 ${ancho} ${alto}" width="${ancho}" height="${alto}" class="rung">${titulo}${partes.join("")}</svg>`;

    let mapa = null;
    function nodos(svg) {
      mapa = {};
      for (const e of svg.querySelectorAll("[data-k]")) mapa[e.dataset.k] = e;
    }
    const pon = (id, on, cls = "on") => { if (id && mapa[id]) mapa[id].classList.toggle(cls, on); };

    function evaluarVista(n, pin, plc) {
      if (n.t === "c") {
        const v = !!plc.vistoContacto[n.ins.indice];
        pon(n.eIn, pin); pon(n.eSym, v, "cerrado"); pon(n.eSym, pin && v); pon(n.eOut, pin && v);
        if (n.eVal) {
          const a = n.ins.args.filter((x) => x[0] === "D").map((d) => `${d}=${plc.D[parseInt(d.slice(1), 10)] || 0}`).join(" ");
          mapa[n.eVal].textContent = a;
        }
        return pin && v;
      }
      if (n.t === "s") { let p = pin; for (const h of n.hijos) p = evaluarVista(h, p, plc); return p; }
      const outs = n.hijos.map((h) => evaluarVista(h, pin, plc));
      outs.forEach((o, i) => pon(n.eExt[i], o));
      const any = outs.some(Boolean);
      pon(n.eL, pin); pon(n.eR, any);
      return any;
    }

    function actualizar(svg, plc) {
      if (!mapa) nodos(svg);
      const p = logica ? evaluarVista(logica, true, plc) : true;
      pon(eTramo, p); pon(eJunta, p);
      for (const b of bobinas) {
        pon(b.hilo, p);
        const a = b.ins.args;
        let estado;
        if (b.ins.op === "OUT" || b.ins.op === "SET" || b.ins.op === "RST" || b.ins.op === "PLS") estado = plc.bit(a[0]);
        if (b.ins.op === "OUT" || b.ins.op === "PLS") pon(b.id, !!estado);
        else pon(b.id, p);                       // instrucciones: resaltadas cuando se ejecutan
        if (b.ins.op === "SET" || b.ins.op === "RST") pon(b.id, !!estado, "dev-on");
        if (b.ins.op === "OUT" && a[0][0] === "T") {
          const n = parseInt(a[0].slice(1), 10), ext = mapa[b.id].querySelector(".ext");
          if (ext) ext.textContent = `${((plc.tempAcum[n] || 0) / 1000).toFixed(1).replace(".", ",")} / ${(plc.valor(a[1]) / 10).toFixed(1).replace(".", ",")} s`;
        }
      }
    }
    return { svgTxt, actualizar };
  }

  /** Títulos de sección ("; ===== GRUPO 1 … =====") con la primera línea de cada uno. */
  function secciones(textoIL) {
    const res = [];
    let pend = null;
    for (const cruda of textoIL.split(/\r?\n/)) {
      const s = cruda.trim();
      const m1 = s.match(/^;\s*=+\s*(.*?)\s*=+\s*$/);
      if (m1) { pend = m1[1]; continue; }
      const m2 = s.match(/^;\s*L[íi]nea\s+(\d+)/);
      if (m2 && pend) { res.push({ titulo: pend, linea: parseInt(m2[1], 10) }); pend = null; }
    }
    return res;
  }

  function anchoMaximo(circuitos) {
    return Math.max(1, ...circuitos.map((c) => (c.logica ? medir(c.logica).w : 0)));
  }

  const api = { construirCircuitos, evaluar, dibujarCircuito, secciones, anchoMaximo, comentario };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else raiz.LadderPLC = api;
})(typeof window !== "undefined" ? window : globalThis);
