// Fechas ISO (YYYY-MM-DD) en UTC, sin zona horaria. Replica ze/Be del original.

export const sumarDias = (fecha, n) =>
  new Date(Date.UTC(+fecha.slice(0, 4), +fecha.slice(5, 7) - 1, +fecha.slice(8, 10)) + n * 864e5).toISOString().slice(0, 10);

/** Índice 0=lunes … 6=domingo. */
export const diaSemana = (fecha) => (new Date(fecha + 'T12:00:00Z').getUTCDay() + 6) % 7;

/** Máscara del original: 7 caracteres lunes→domingo, '1' = día libre. Por defecto '0000011'. */
export function esLibre(fecha, mascara = '0000011', feriados = new Set()) {
  return mascara[diaSemana(fecha)] === '1' || feriados.has(fecha);
}

/** Avanza (n>0) o retrocede (n<0) n días hábiles. Idéntico a Be() del original. */
export function sumarDiasHabiles(fecha, n, mascara = '0000011', feriados = new Set()) {
  let f = fecha, k = Math.abs(n);
  const paso = n < 0 ? -1 : 1;
  while (k > 0) { f = sumarDias(f, paso); if (!esLibre(f, mascara, feriados)) k--; }
  return f;
}

export const lunesDe = (fecha) => sumarDias(fecha, -diaSemana(fecha));

/** Ventana trisemanal: semana de `fecha` + 2 siguientes (lunes a domingo). */
export function ventanaTrisemanal(fecha) {
  const l = lunesDe(fecha);
  return [0, 1, 2].map((i) => ({ desde: sumarDias(l, 7 * i), hasta: sumarDias(l, 7 * i + 6) }));
}

/** Combina fecha y hora 'HH:MM[:SS]'; si fin<=inicio, el fin cae al día siguiente (turno nocturno). */
export function intervalo(fecha, horaIni, horaFin) {
  if (!horaIni || !horaFin) return null;
  const ini = `${fecha}T${horaIni.slice(0, 5)}`;
  const fin = `${horaFin.slice(0, 5) <= horaIni.slice(0, 5) ? sumarDias(fecha, 1) : fecha}T${horaFin.slice(0, 5)}`;
  return { ini, fin };
}

export const seSolapan = (a, b) => a.ini < b.fin && b.ini < a.fin;
