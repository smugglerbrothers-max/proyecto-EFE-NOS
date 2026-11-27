# Diseño — Unilineal profesional (cambio acotado)

Fecha: 2026-11-27 · Aprobado por el usuario: «Debe ser estilo unilineal» (acepta la propuesta por defecto)

## Intención
El diagrama actual (cajas con texto) no sirve para presentar. Se reemplaza por un unilineal
como el de los proyectos SEC/universitarios: un solo trazo por circuito, símbolos IEC 60617,
leyenda de conductores, puesta a tierra, simbología y cajetín.

## Objetivos
- **Acometida y medición:** red de distribución → empalme con medidor (círculo «kWh»), tipo e In del empalme, y tierra de servicio.
- **Alimentador:** trazo con marcas de conductores (3 en monofásico, 5 en trifásico) y la leyenda
  «2×4 + T 4 mm² THHN · Ø20 · L=10 m · ΔV 1,17 %».
- **Tablero general:** rectángulo segmentado con su nombre.
  - Protección general: interruptor termomagnético con «25 A · 2P» (o 4P).
  - Barra principal y barra de tierra de protección (TP) con su símbolo.
- **Diferenciales:** cada uno con su símbolo (interruptor + toroide «IΔn 30 mA») y su In, del que
  cuelga una sub-barra. Los circuitos sin diferencial cuelgan directo de la barra principal.
- **Circuitos:**
  - Cada uno baja con su interruptor termomagnético «16 A».
  - Al salir del tablero lleva una leyenda vertical: «Cto 3 · Enchufes dormitorios · 2.000 W · 2×2,5 + T 2,5 mm² THHN Ø20 · R».
  - Termina en una flecha.
- **Bloques al pie:** simbología abajo a la izquierda y cajetín abajo a la derecha (proyecto,
  propietario, dirección, comuna, instalador/clase/licencia, lámina «Diagrama unilineal», escala S/E, fecha).
- **Formato:** SVG autónomo (mismo flujo actual: pantalla → PDF apaisado carta), ancho según el n° de circuitos.

## No-objetivos
Varios tableros (subtableros), cuadro de cargas dentro del plano, exportación DWG.

## Enfoques
1. **SVG propio con funciones de símbolos (elegido):** cero dependencias, funciona sin conexión y entra directo al PDF.
2. Librería de diagramas (p. ej. mermaid/elkjs): no tiene símbolos eléctricos y el resultado no parece plano. Descartado.
3. Generar DXF/DWG: útil para CAD, pero no se ve en el PDF ni en el celular. Queda para el futuro.

## Pruebas (TDD)
`src/informes/unilineal.test.ts`:
- Hay un símbolo `sim-tm` por circuito + 1 general, y un `sim-dif` por diferencial.
- Contiene «kWh», «SIMBOLOGÍA», el nombre del proyecto en el cajetín y la leyenda «2×1,5 + T 1,5 mm² THHN Ø16».
- En trifásico, la leyenda del alimentador dice «3×… + N … + T …» y el general es «4P».
- Un circuito sin diferencial cuelga de la barra principal y se marca con una advertencia.
- Escapa los caracteres XML y nunca contiene «NaN» ni «undefined».
