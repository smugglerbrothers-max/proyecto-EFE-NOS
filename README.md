# UMBRAL — Bestiario de las Sombras

Juego de captura y combate de criaturas por turnos, con estética de **horror mitológico**.
Hecho en HTML5 + JavaScript puro, sin dependencias: **abre `index.html` en el navegador y juega** (PC o celular).

## Características

- **102 criaturas** de mitologías de todo el mundo (34 linajes × 3 etapas).
- **3 etapas de evolución**: forma inicial → evoluciona al **nivel 9** → evoluciona al **nivel 18**, con una escena de evolución animada.
- **10 tipos** con tabla de efectividad: Sombra, Sangre, Hueso, Abismo, Infierno, Plaga, Espectro, Bestia, Tormenta, Locura.
- **Batallas animadas**: embestidas, zarpazos con estelas, proyectiles, rayos cargados, auras, sacudidas de pantalla, destellos, números de daño, críticos y desmayos con humo.
- **Sistema de reflejos**: al atacar o recibir un ataque aparece un anillo que se cierra; pulsa **Z / Espacio** o **toca la pantalla** cuando coincida con el círculo punteado:
  - Atacando: «¡Bien!» ×1,15 · «¡PERFECTO!» ×1,35 (y más probabilidad de crítico).
  - Defendiendo: «¡Bloqueo!» −25 % · «¡BLOQUEO PERFECTO!» −50 %.
  - Se puede desactivar en Menú → Opciones.
- Captura con **sellos** (cera, sangre, negro), estados alterados (sangrado, veneno, quemado, terror), subida de nivel y aprendizaje de ataques.
- Mundo explorable con 6 zonas, oscuridad iluminada por tu farol, altares de curación, tienda, 4 guardianes de paso, 4 entrenadores opcionales y jefe final.
- Bestiario, Osario (caja para más de 6 criaturas), guardado automático en el navegador.
- Controles táctiles en pantalla para jugar en el celular.

## Controles

| Acción | Teclado | Celular |
|---|---|---|
| Moverse / navegar | Flechas o WASD | Cruceta |
| Hablar / aceptar / reflejos | Z, Espacio o Enter | A (o tocar la pantalla) |
| Volver / menú | X o Esc | B / ☰ |

## Archivos

- `index.html` — el juego.
- `galeria.html` — galería animada de las 102 criaturas.
- `js/data.js` — tipos, ataques, linajes de criaturas y objetos.
- `js/art.js` — dibujo procedural y animación de las criaturas.
- `js/battle.js` — sistema de batalla animado.
- `js/world.js` — mapa, zonas, personajes.
- `js/main.js` — escenas, menús, evolución, guardado.

## Usar imágenes propias para las criaturas

Cada criatura se dibuja por código. Para reemplazar una por una ilustración:

1. Guarda un PNG con fondo transparente, mirando a la **derecha**, en `assets/criaturas/<id>.png` (ejemplo: `assets/criaturas/cerbero_3.png`).
2. Agrega el id a la lista en `assets/criaturas/sprites.js`.

Los ids tienen la forma `linaje_etapa` (por ejemplo `chupacabra_1`, `chupacabra_2`, `chupacabra_3`).

## Las 102 criaturas

| # | Etapa 1 | Nv 9 → Etapa 2 | Nv 18 → Etapa 3 | Tipos | Mitología |
|---|---|---|---|---|---|
| 1 | Chispín | Ifrit | Sultán Ifrit | Infierno | Arabia |
| 2 | Ahuizín | Ahuizotl | Ahuizotl Tlaloque | Abismo | Azteca |
| 3 | Basilisquín | Régulo | Basilisco | Plaga | Europa |
| 4 | Chupín | Chupacabra | Desangrador | Sangre / Bestia | Puerto Rico / México |
| 5 | Cadejito | Cadejo | Cadejo Negro | Sombra | Centroamérica |
| 6 | Gulito | Gul | Gul Devorasepulcros | Hueso / Sombra | Arabia |
| 7 | Graznilla | Harpía | Celeno | Tormenta / Sangre | Grecia |
| 8 | Nahualito | Nahual | Tecuani | Sombra / Bestia | Mesoamérica |
| 9 | Cascorín | Tikbalang | Tikbalang Señor | Tormenta / Locura | Filipinas |
| 10 | Bakuín | Baku | Baku Devorasueños | Locura / Bestia | Japón |
| 11 | Krakín | Krakenhol | Kraken Primigenio | Abismo | Escandinavia |
| 12 | Nuckín | Desollado | Nuckelavee | Abismo / Plaga | Escocia |
| 13 | Lamiela | Lamia | Empusa Reina | Sangre / Plaga | Grecia |
| 14 | Lagrimilla | Llorona | Cihuacóatl | Espectro / Abismo | México |
| 15 | Ammitín | Ammut | Ammit Devoradora | Abismo / Bestia | Egipto |
| 16 | Hilacha | Tsuchigumo | Jorōgumo | Plaga / Sombra | Japón |
| 17 | Túmulo | Draugr | Draugr Rey | Hueso / Abismo | Escandinavia |
| 18 | Escamín | Rahab | Leviatán | Abismo / Tormenta | Hebrea |
| 19 | Sollozo | Bean Sídhe | Banshee Plañidera | Espectro / Locura | Irlanda |
| 20 | Moroi | Strigoi | Strigoi Mort | Sangre / Sombra | Rumanía |
| 21 | Huesín | Osario | Gashadokuro | Hueso / Espectro | Japón |
| 22 | Silbín | Tunche | Tunche del Monte | Espectro / Sombra | Amazonía |
| 23 | Cuellín | Nukekubi | Rokurokubi | Locura / Espectro | Japón |
| 24 | Tiyanak | Manananggal | Aswang | Sangre / Espectro | Filipinas |
| 25 | Duermevela | Pesadilla | Mara | Locura / Sombra | Germánico |
| 26 | Astilla | Wendigo | Wíndigo Voraz | Bestia / Hueso | Algonquino |
| 27 | Serpelina | Gorgónide | Euríale | Plaga / Locura | Grecia |
| 28 | Lobezno | Garm | Fenrir | Bestia / Tormenta | Escandinavia |
| 29 | Mantiquín | Mantícora | Martyaxwar | Bestia / Plaga | Persia |
| 30 | Quimerín | Quimera | Quimera Tifónica | Infierno / Plaga | Grecia |
| 31 | Tzitzín | Tzitzimitl | Tzitzimime Estelar | Hueso / Tormenta | Azteca |
| 32 | Cancerbín | Ortro | Cerbero | Infierno / Bestia | Grecia |
| 33 | Becerro | Molok | Moloch | Infierno / Hueso | Canaán |
| 34 | Lodín | Mušḫuššu | Tiamat | Abismo / Sombra | Mesopotamia |

Iniciales: **Chispín** (Infierno), **Ahuizín** (Abismo) y **Basilisquín** (Plaga). Infierno vence a Plaga, Plaga vence a Abismo, Abismo vence a Infierno.
