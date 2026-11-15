# Simulación del programa PLC — Torre de enfriamiento Costa Azul

Hito III · Taller de Integración de Competencias Profesionales (EEI-057) · IP Santo Tomás
Profesor: Juan Andrés Vivar Ramírez · Integrantes: Jermain Bascour, Cristian Salas, Yeremi Tobar y Tamae Martinez

Como no pudimos probar el programa en el PLC real (FX3GE-24MR/ES + FX2N-16EX + FX2N-16EYR +
FX3U-4AD), lo ejecutamos en un simulador escrito en Python. El simulador lee el programa en lista
de instrucciones y lo corre ciclo a ciclo, igual que el PLC. Con eso generamos un video que muestra
cómo responde.

## Archivos

| Archivo | Qué contiene |
|---|---|
| `Programa_IL_GXWorks2.txt` | Programa original (líneas 0 a 67). Es la única fuente de la lógica. |
| `simulador.py` | Intérprete del IL, con scan de 10 ms y la semántica del FX. También el tablero y las señales analógicas. |
| `tests/test_logica.py` | Pruebas automáticas (pytest): los 7 casos pedidos y otras pruebas del plan de la Memoria. |
| `guion.py` | Línea de tiempo del video: escenas, acciones del operador, rampas de nivel, temperatura y presión, y verificaciones. |
| `render.py` | Dibuja cada cuadro con Pillow y lo codifica con FFmpeg. Además guarda las capturas. |
| `video_simulacion_PLC_torre.mp4` | Video final: 1920×1080, 30 fps, 2 min 51 s. |
| `capturas/` | Capturas PNG de cada escena: una 2,5 s después de cada paso del guion, más la portada y el cierre. |

## Cómo volver a generarlo

Necesitas Python 3.10 o superior y FFmpeg (`ffmpeg` debe estar en el PATH).

```bash
pip install pillow pytest
python -m pytest -q          # 1) las pruebas deben pasar
python guion.py              # 2) (opcional) corre el guion sin video y muestra las verificaciones
python render.py             # 3) corre las pruebas de nuevo, genera el MP4 y las capturas (~5 min)
python render.py --solo-capturas   # solo las PNG, en ~10 s
```

`render.py` no genera el video si falla alguna prueba de pytest. También se detiene, indicando
la escena, la condición y las líneas del programa involucradas, si alguna verificación del guion no
se cumple.

## Cómo funciona el simulador

- **Instrucciones:** LD, LDI, LDP, AND, ANI, ANDP, OR, ORI, ORP, ANB, ORB, OUT, SET, RST, PLS,
  comparaciones (`LD>`, `AND>=`, `LD<=`, `AND<`…), `OUT T Kn`, MUL, DIV, MOV, DADD, TO, FROM y END.
  Si el archivo trae una instrucción que no está en la lista, el simulador se detiene con error en
  vez de ignorarla.
- **Scan:** cada 10 ms simulados. Primero se toma la imagen de entradas y luego se ejecuta en orden
  de línea. M8000 está siempre en ON, M8002 se activa solo en el primer scan y M8013 es el reloj de 1 s.
- **Flancos:** LDP, ORP, ANDP y PLS guardan memoria propia por instrucción. Comparan con el valor
  del scan anterior, así que el pulso dura un solo ciclo.
- **Temporizadores:** T0 a T199 son de 100 ms y funcionan a la conexión. `K30` = 3,0 s,
  `K300` = 30 s y `K3000` = 5 min. Si la entrada cae, el temporizador se repone.
- **Aritmética de 16 bits como en el FX:** MUL deja el producto en D y D+1; DIV deja el cociente
  en D y el resto en D+1. Así se respeta el escalado de las líneas 2 a 6. Por ejemplo, LIT-01 con
  12 mA: crudo 1600 → 50,0 %.
- **Señales analógicas:** se cargan como valores crudos, igual que en la simulación de GX Works2
  descrita en la Memoria (sección 5). Las de nivel van en D8280/D8281 (0–3200) y las de
  temperatura, caudal y presión en D10–D13 (0–4000), con M100 = ON. El guion las mueve con rampas.
  Un modelo simple de proceso hace que la presión suba cuando corre G3 y que T-3702 se llene
  cuando VA-09 está abierta.

## Escenas del video

| # | Escena | Tiempo |
|---|---|---|
| 1 | Portada | x1 |
| 2 | Partida con S1 (H12; G1 y G3 abren válvula y 3 s después parten sus bombas) y torre con S41 | x1 |
| 3 | Cambio de bomba de G1 con S11: cierra VA-01, abre VA-02 y P-3701B parte 3 s después | x1 |
| 4 | G3 en paralelo con G1: al parar G1 (S13) para G3; al dar marcha (S12) G3 rearranca solo | x1 |
| 5 | T-3702 sobre 40 °C: parte G2 (VA-05, P-3702C) y se activa KA1 | x5 → x1 |
| 6 | T-3701 ≤ 15 %: G1 para, se enciende H7; al volver a 50 % G1 rearranca solo | x10 → x1 |
| 7 | Presión < 8 bar por 30 s: H14 y bocina; S52 silencia la bocina | x5 → x1 |
| 8 | Relleno manual con S51 (VA-09) hasta 80 %; el nivel alto para G1, que rearranca bajo 70 % | x5 → x1 |
| 9 | Emergencia general S00: todo se detiene y no vuelve a partir solo | x1 |
| 10 | Resumen de lo verificado | — |

Cuando el tiempo va acelerado, el encabezado muestra el factor en naranjo (por ejemplo, "x10").

## Observaciones sobre la lógica (sin cambios al programa)

1. **G1 y G3 parten juntos con S1.** Las líneas 14 y 28 empiezan con `LDP M0`, así que el mismo
   flanco de la partida arranca los dos grupos. La Memoria lo dice igual en su prueba 2. Por eso el
   paso "arranque de G3 en paralelo con G1" se muestra al dar partida, y en la escena 4 se comprueba
   la dependencia de G3 respecto de G1.
2. **VA-04 queda abierta (by-pass) sin energía.** La válvula es NA y se energiza para cerrar
   (línea 11). Con la torre deshabilitada o en emergencia, el esquema la muestra abierta.
3. **El relleno manual corta justo en el nivel alto.** Corta al 80 % (línea 62), y ese mismo 80 %
   activa el nivel alto de T-3702 (línea 53), que detiene G1 (línea 13). En la escena 8 se ve: G1
   rearranca solo cuando T-3702 baja de 70 % (línea 18).
4. **H1 a H6 no son salidas del PLC.** Según la Memoria (2.2), se alimentan del relé "en marcha" de
   cada VDF o partidor. En la simulación suponemos que el accionamiento responde y las luces siguen
   a Y000–Y005.
5. **No aparecen en el video la alarma de alta temperatura (5 min), la reposición automática por
   nivel bajo de T-3702, el bloqueo del relleno sobre 70 % ni la parada de G3 por nivel bajo de
   T-3702.** Esos casos están cubiertos por las pruebas de `tests/test_logica.py`.

Los nombres de pulsadores siguen la Memoria del programa (S41 habilitar torre, S51 relleno,
S52 reset). La guía de CADe_SIMU usa nombres abreviados (S4, S6, S7) para las mismas entradas.
