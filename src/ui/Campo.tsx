import type { ReactNode } from 'react';

export function Campo({ etiqueta, children, ancho }: { etiqueta: string; children: ReactNode; ancho?: 'corto' }) {
  return (
    <label className={`campo ${ancho ?? ''}`}>
      <span>{etiqueta}</span>
      {children}
    </label>
  );
}
