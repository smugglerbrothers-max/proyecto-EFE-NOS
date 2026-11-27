import { useMemo } from 'react';
import type { ResultadoProyecto } from '../motor';
import { useProyecto } from '../estado';
import { unilinealSVG } from '../informes/unilineal';

export function Unilineal({ r }: { r: ResultadoProyecto }) {
  const p = useProyecto((s) => s.proyecto);
  // El SVG se arma con todo el texto escapado (ver informes/unilineal.ts).
  const svg = useMemo(() => unilinealSVG(p, r), [p, r]);
  return (
    <section className="tarjeta" data-testid="unilineal">
      <h2>Diagrama unilineal</h2>
      <div className="unilineal" dangerouslySetInnerHTML={{ __html: svg }} />
    </section>
  );
}
