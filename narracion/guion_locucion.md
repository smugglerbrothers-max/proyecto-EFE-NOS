# Guion de locución

Cada frase tiene un identificador. Para usar su propia voz, graben cada frase en un
archivo con ese nombre dentro de `narracion/grabada/` (por ejemplo `e02_01.wav`, también
sirve .mp3, .m4a u .ogg) y vuelvan a correr `python render.py`. El video se ajusta solo
a la duración de cada grabación; las frases que no estén grabadas usan la voz sintética.
Lo que va entre paréntesis aparece en pantalla, pero no hace falta decirlo.

| Id | Inicio | Escena | Texto |
|---|---|---|---|
| `e01_01` | 0:00.8 | 1 | Simulación del programa PLC de la torre de enfriamiento de Costa Azul. Como no pudimos probarlo en el equipo real, ejecutamos el programa ciclo a ciclo, igual que el PLC. |
| `e02_01` | 0:10.4 | 2 | Partimos con los estanques al 60 %, el agua a 30 °C y todo detenido. |
| `e02_02` | 0:14.9 | 2 | Al pulsar S1, el PLC enciende H12. Con el mismo pulso parten G1 y G3: primero se abren VA-01 y VA-07 (líneas 8, 14, 19, 28 y 31). |
| `e02_03` | 0:22.6 | 2 | Tres segundos después parten las bombas P-3701A y P-3702E (líneas 21–22 y 33–34). |
| `e02_04` | 0:27.4 | 2 | Con S41 habilitamos la torre: se abre VA-03, se cierra el by-pass VA-04, se enciende H13 y parte el ventilador (líneas 9, 11 y 12). |
| `e03_01` | 0:36.9 | 3 | Al girar S11, el PLC cierra VA-01, detiene P-3701A y abre VA-02 (líneas 19 y 20). |
| `e03_02` | 0:42.8 | 3 | Tres segundos después parte P-3701B. Las dos bombas nunca funcionan juntas (líneas 22 y 24). |
| `e04_01` | 0:48.4 | 4 | G3 trabaja en paralelo con G1: su permiso exige que G1 esté en marcha (línea 27). |
| `e04_02` | 0:52.5 | 4 | Si detenemos G1 con S13, G3 también se detiene (líneas 14 y 29). |
| `e04_03` | 0:55.7 | 4 | Al dar marcha con S12, G1 parte con la bomba B y G3 rearranca solo (líneas 14, 28 y 30). |
| `e05_01` | 1:00.7 | 5 | Ahora calentamos el agua de T-3702. Aceleramos el tiempo x5. |
| `e05_02` | 1:05.4 | 5 | Sobre 40 °C, el PLC pide recirculación: parte G2, abre VA-05 y activa KA1 (líneas 39 a 44 y 66). |
| `e05_03` | 1:11.5 | 5 | Tres segundos después parte P-3702C. KA1 baja G1 y G3 a segunda velocidad para no sobrecargar la torre. |
| `e06_01` | 1:18.5 | 6 | Simulamos que T-3701 se vacía. Tiempo acelerado x10. |
| `e06_02` | 1:23.0 | 6 | Con 15 % o menos, G1 se detiene y se enciende H7. G3 se detiene con él (líneas 13, 15, 27 y 50). |
| `e06_03` | 1:27.7 | 6 | El estanque se recupera, pero G1 espera hasta llegar a 50 % (línea 16). |
| `e06_04` | 1:31.7 | 6 | Al llegar a 50 %, G1 rearranca solo y G3 lo sigue (líneas 14, 16 y 30). |
| `e07_01` | 1:36.4 | 7 | Ahora simulamos una caída de presión: PIT-01 baja a 6 bar. |
| `e07_02` | 1:40.4 | 7 | El PLC espera 30 segundos bajo 8 bar antes de dar la alarma (línea 37). Aceleramos x5. |
| `e07_03` | 1:45.6 | 7 | Se cumplen los 30 segundos: se enciende H14 y suena la bocina (líneas 38 y 58). |
| `e07_04` | 1:49.5 | 7 | Con S52 reconocemos la alarma: la bocina se calla, pero H14 sigue encendida (líneas 56 a 58). |
| `e07_05` | 1:54.5 | 7 | Al normalizar la presión, H14 se apaga. G3 nunca se detuvo, para no dejar sin agua al condensador. |
| `e08_01` | 2:00.9 | 8 | Ahora rellenamos T-3702 a mano. Está en 60 %, bajo el límite de 70 %. |
| `e08_02` | 2:06.6 | 8 | Pulsamos S51 y el PLC abre VA-09 con agua de osmosis (líneas 61 y 63). Tiempo x5. |
| `e08_03` | 2:12.0 | 8 | Al 80 % se cierra VA-09. Ese nivel también es alto: se enciende H10 y G1 se detiene (líneas 13, 53 y 62). |
| `e08_04` | 2:17.9 | 8 | G3 sigue sacando agua de T-3702 y el nivel baja (línea 27). |
| `e08_05` | 2:21.9 | 8 | Bajo 70 %, G1 rearranca solo (línea 18). |
| `e09_01` | 2:26.2 | 9 | Al soltar S00 nada parte solo: hay que dar partida de nuevo con S1. |
| `e09_02` | 2:30.6 | 9 | Accionamos la emergencia general S00: se detienen todas las bombas y el ventilador, y las válvulas quedan sin energía, en reposo (líneas 7 y 8). |
| `e10_01` | 2:39.2 | 10 | En resumen, todas las comprobaciones resultaron correctas. La lógica se tomó tal cual del programa, sin modificarla. |
