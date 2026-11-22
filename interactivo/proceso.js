/*
 * Proceso automático (modelo simplificado para la simulación, NO son datos de la planta):
 * balance de agua y de calor de los dos estanques según lo que el PLC tiene en marcha.
 *
 *  - G1 saca agua caliente de T-3701 y la envía a la torre (VA-03) o por el by-pass (VA-04) a T-3702.
 *  - G3 saca agua fría de T-3702, la pasa por el condensador (que la calienta) y la devuelve a T-3701.
 *  - G2 recircula agua de T-3702 por la torre (no cambia niveles, sí enfría).
 *  - La torre enfría hacia la temperatura de bulbo húmedo: mucho con el ventilador, poco sin él.
 *  - VA-09 repone agua de osmosis a T-3702. La torre evapora un poco de agua.
 *
 * Caudales: 30 m³/h por grupo a velocidad normal; 15 m³/h con KA1 (segunda velocidad); G2 15 m³/h.
 * Supuesto: 5 m³ de capacidad por estanque.
 */
(function (raiz) {
  "use strict";

  class ProcesoAutomatico {
    constructor(tab) {
      this.tab = tab;
      this.activo = true;
      this.volumen = 5;            // m³ por estanque (supuesto)
      this.cargaCondensador = 8;   // °C que sube el agua en el condensador a 30 m³/h
      this.bulboHumedo = 22;       // °C, límite de enfriamiento de la torre
      this.tReposicion = 18;       // °C del agua de osmosis
      this.eficienciaVent = 0.6;   // fracción del salto hacia el bulbo húmedo, con ventilador
      this.eficienciaSinVent = 0.15;
      this.evaporacion = 0.015;    // fracción del caudal que pasa por la torre
      this.bloqueados = new Set(); // variables que el usuario está moviendo a mano
    }

    caudales() {
      const y = (t) => this.tab.y(t);
      const ka1 = y("KA1");
      const q1 = (y("P-3701A") && y("VA-01")) || (y("P-3701B") && y("VA-02")) ? (ka1 ? 15 : 30) : 0;
      const q2 = (y("P-3702C") && y("VA-05")) || (y("P-3702D") && y("VA-06")) ? 15 : 0;
      const q3 = (y("P-3702E") && y("VA-07")) || (y("P-3702F") && y("VA-08")) ? (ka1 ? 15 : 30) : 0;
      const qRep = y("VA-09") ? 12 : 0;
      const porTorre = y("VA-03");                     // VA-03 abierta: G1 entra a la torre
      return { q1, q2, q3, qRep, porTorre, vent: y("M-3703") };
    }

    paso(dt) {
      if (!this.activo) return;
      const t = this.tab, b = this.bloqueados;
      const { q1, q2, q3, qRep, porTorre, vent } = this.caudales();
      const ef = vent ? this.eficienciaVent : this.eficienciaSinVent;
      const enfriar = (T) => T - ef * (T - this.bulboHumedo);
      const V = this.volumen;
      const v1 = Math.max(0.25, V * t.nivelT1 / 100);   // m³ de agua en cada estanque
      const v2 = Math.max(0.25, V * t.nivelT2 / 100);
      const h = dt / 3600;                                // m³/h → m³ en este paso

      // agua
      const qTorre = (porTorre ? q1 : 0) + q2;
      const evap = this.evaporacion * qTorre * (vent ? 1 : 0.5);
      const d1 = (q3 - q1) * h;
      const d2 = (q1 + qRep - q3 - evap) * h;

      // calor (mezcla perfecta en cada estanque)
      const tVuelta3 = q3 > 0 ? t.tempT2 + this.cargaCondensador * 30 / q3 : t.tempT2;
      const tLlega1 = porTorre ? enfriar(t.tempT1) : t.tempT1;
      const tLlega2 = enfriar(t.tempT2);
      const pierde1 = (t.tempT1 - 25) * dt / 7200;     // pérdidas leves al ambiente
      const pierde2 = (t.tempT2 - 25) * dt / 7200;
      const dT1 = (q3 * h * (tVuelta3 - t.tempT1)) / v1 - pierde1;
      const dT2 = (q1 * h * (tLlega1 - t.tempT2) + q2 * h * (tLlega2 - t.tempT2) +
                   qRep * h * (this.tReposicion - t.tempT2)) / v2 - pierde2;

      const lim = (x, a, z) => Math.max(a, Math.min(z, x));
      if (!b.has("nivelT1")) t.nivelT1 = lim(t.nivelT1 + d1 / V * 100, 0, 100);
      if (!b.has("nivelT2")) t.nivelT2 = lim(t.nivelT2 + d2 / V * 100, 0, 100);
      if (!b.has("tempT1")) t.tempT1 = lim(t.tempT1 + dT1, 5, 95);
      if (!b.has("tempT2")) t.tempT2 = lim(t.tempT2 + dT2, 5, 95);
    }
  }

  const api = { ProcesoAutomatico };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else raiz.ProcesoPLC = api;
})(typeof window !== "undefined" ? window : globalThis);
