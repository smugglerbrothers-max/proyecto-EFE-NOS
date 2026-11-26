/** Número con coma decimal (es-CL). Devuelve '—' para null/NaN. */
export function num(n: number | null | undefined, dec = 2): string {
  if (n == null || !Number.isFinite(n)) return '—';
  // Redondeo «escolar»: 4,995 → 5,00 (evita que el error binario lo deje en 4,99).
  const f = 10 ** dec;
  n = Math.round(n * f * (1 + Math.sign(n) * 1e-12)) / f;
  return n.toLocaleString('es-CL', { minimumFractionDigits: dec, maximumFractionDigits: dec });
}
export const secc = (s: number | null | undefined) => (s == null ? '—' : num(s, s % 1 ? 1 : 0));
/** Lee un número de un input; vacío o inválido → 0. */
export const leer = (v: string) => {
  const n = Number(v.replace(',', '.'));
  return Number.isFinite(n) ? n : 0;
};
