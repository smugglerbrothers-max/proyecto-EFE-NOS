# Calculadora RIC

App web instalable para dimensionar instalaciones eléctricas interiores según los
**Pliegos Técnicos RIC** de la SEC (DS 8/2019) y exportar el cuadro de cargas, el
diagrama unilineal y la memoria de cálculo en PDF. Funciona en el celular y en el
computador, también sin internet. Los proyectos se guardan en el propio dispositivo.

## Qué calcula (Etapa 1)

- **Circuitos:** potencia (100 W por centro, 250 W por enchufe), corriente,
  disyuntor, sección, Iz corregida, ΔV, ducto y % de carga.
- **Alimentador:** demanda máxima (Tablas 3.1 y 3.2), protección, secciones de
  fase, neutro y tierra, ducto y ΔV. La sección sube automáticamente hasta cumplir
  ΔV ≤ 3 %.
- **Empalme normalizado.**
- **Auditoría normativa:**
  - Diferenciales: máximo 3 circuitos, 30 mA, Σ In.
  - Mínimos de vivienda.
  - ΔV parcial y total.
  - Balance de fases.
- **PDF:** cuadro de cargas (Fig. 18.4.1), unilineal y memoria con fórmula, datos,
  resultado y fuente de cada paso.

## Fuentes normativas

Las tablas están en `src/motor/tablas/`. Cada dato indica su pliego, tabla o
artículo y si está **verificado** contra el PDF oficial de la SEC
(Res. Ex. 33.877, 30/12/2020).

| Dato | Fuente | Estado |
|------|--------|--------|
| Capacidad de corriente, factores fn y ft, secciones mínimas, ductos | RIC N°04 Tablas 4.4, 4.6, 4.7, 4.17; punto 5.4 | Verificado |
| Factores de demanda y simultaneidad, neutro, ΔV 3 % | RIC N°03 Tablas 3.1, 3.2; 6.4; 5.1.3 | Verificado |
| Potencias por centro, diferenciales, mínimos de vivienda | RIC N°10 5.1.3–5.2 | Verificado |
| ΔV total 5 % | RIC N°03 5.1.3 (texto oficial truncado) | **Revisar** |
| Conductor de protección | IEC 60364-5-54 (falta RIC N°06) | **Revisar** |
| Tabla de empalmes (tipos y tarifas) | Norma de la distribuidora | **Revisar** |
| Ducto para THHN en mm² | Tabla 4.17 (la 4.18 oficial está en AWG) | Aproximación |

## Uso

```bash
npm install
npm run dev        # desarrollo en http://localhost:5173
npm test           # pruebas del motor, datos, interfaz e informes
npm run build      # versión instalable en dist/
```

Para publicarla, sube `dist/` a Vercel, Netlify o GitHub Pages. Al abrirla en el
celular, usa «Agregar a pantalla de inicio».

## Próximas etapas

2. Ingreso estilo TE1 (antecedentes, anexos, fotos)
3. Proyectos de iluminación
4. RGR y RPTD
5. Sincronización en la nube
