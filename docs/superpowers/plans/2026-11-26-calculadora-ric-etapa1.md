# Calculadora RIC · Etapa 1 — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** App web instalable (PWA) que dimensiona una instalación interior según los Pliegos RIC y exporta cuadro de cargas, unilineal y memoria en PDF.

**Architecture:** Motor de cálculo puro en TypeScript (`src/motor`) con tablas normativas en JSON citadas; UI React que recalcula en vivo desde un store Zustand; persistencia en IndexedDB detrás de una interfaz `Almacen`; informes PDF generados en el cliente.

**Tech Stack:** Vite + React 18 + TypeScript, Zustand, idb-keyval, pdfmake, vite-plugin-pwa, Vitest.

**Spec:** `docs/superpowers/specs/2026-11-26-calculadora-ric-etapa1-design.md`

## Global Constraints

- Interfaz y textos en español; unidades SI; decimales con coma en pantalla y PDF.
- Toda cifra normativa vive en `src/motor/tablas/*.ts` con `fuente` (pliego, tabla/artículo) y `verificado: boolean`.
- Fuentes verificadas (PDF oficiales SEC, DS 8/2019, Res. Ex. 33.877 del 30/12/2020): RIC N°03, N°04, N°10.
- Tensión nominal: monofásico 220 V; trifásico 380 V.
- El motor no importa nada de React ni del navegador.

## Valores normativos (transcritos de los PDF oficiales)

- **RIC03 5.1.2:** sección mínima alimentador 4 mm², subalimentador 2,5 mm².
- **RIC03 5.1.3:** ΔV ≤ 3 % en alimentadores/subalimentadores/conductores; total 5 % (la frase está cortada en el PDF oficial; 5 % → `verificado:false`).
- **RIC03 Tabla 3.1:** factores de demanda de alumbrado. Casa habitación: primeros 3 kW → 1; de 3 a 120 kW → 0,35; sobre 120 kW → 0,25. Hospitales: 50 kW → 0,4, sobre → 0,2. Hoteles y moteles: 20 kW → 0,5, de 20,1 a 100 → 0,4, sobre 100 → 0,3. Bodegas: 12,5 kW → 1, sobre → 0,5. Servicios comunes: 1. Locales comerciales y oficinas: 50 kW → 1, sobre → 0,8. Otro: 1.
- **RIC03 Tabla 3.2:** Fs por n° de viviendas: 1–3 → 1; 4 → 0,95; 5 → 0,92; 6 → 0,90; 7 → 0,89; 8 → 0,88; 9 → 0,87; 10 → 0,85; 11 → 0,84; 12 → 0,83; 13 → 0,82; 14 → 0,81; 15 → 0,79; 16 → 0,78; 17 → 0,77; 18 → 0,76; 19 → 0,75; 20 → 0,74; 21 → 0,73; n > 21 → (15,3 + (n − 21)·0,5)/n.
- **RIC03 6.4:** neutro monofásico = fase; trifásico lineal ≥ fase; no lineal con filtro concentrado ≥ 1,5·fase; distribuido ≥ fase.
- **RIC04 5.4:** sección mínima iluminación 1,5; enchufes 2,5; mixtos 2,5; subalimentadores 2,5; alimentadores 4,0 mm².
- **RIC04 Tabla 4.4:** capacidades (A), ambiente 30 °C. Secciones mm²: 1,5 / 2,5 / 4 / 6 / 10 / 16 / 25 / 35 / 50 / 70 / 95 / 120.
  - 70 °C (H07V, H07Z1, THWN, NYIFY): A1 14/18/24/31/42/56/73/89/108/136/164/188; B1 16/21/28/36/50/68/89/110/134/171/207/239; E 19/24/31/43/60/80/101/126/153/196/238/276.
  - 90 °C (THHN, RV, RV-K, RZ1, RZ1-K): A1 17/23/31/40/54/73/95/117/141/179/216/249; A2 17/22/30/38/51/68/89/109/130/164/197/227; B1 18/24/37/48/66/88/117/144/175/222/269/312; B2 19/24/35/44/60/80/105/128/154/194/233/268; E 19/32/42/54/75/100/127/158/192/246/298/346; F –/–/42/55/77/105/141/176/216/279/342/400; D1 (20 °C) 19/33/42/52/68/89/113/136/159/197/232/263; D2 (20 °C) 23/38/59/74/98/126/161/194/230/282/339/386.
- **RIC04 Tabla 4.6 (fn):** 1–3 cond. → 1; 4–6 → 0,8; 7–24 → 0,7; 25–42 → 0,6; > 42 → 0,5.
- **RIC04 Tabla 4.7 (ft)**, por tramo de ambiente 5-10/11-15/16-20/21-25/26-30/31-35/36-40/41-45/46-50/51-55/56-60 °C:
  - 70 °C: 1,22/1,17/1,12/1,06/1,00/0,94/0,87/0,79/0,71/0,61/0,50.
  - 90 °C aire: 1,15/1,12/1,08/1,04/1,00/0,96/0,91/0,87/0,82/0,76/0,71.
  - 90 °C D1/D2: 1,07/1,04/1,00/0,96/0,93/0,89/0,85/0,80/0,76/0,71/0,65.
- **RIC04 6.2.6:** Ic = It · fn · ft.
- **RIC04 Tabla 4.17:** Ø nominal de ducto (mm) por sección y n° de conductores 1/2/3/4/5: 1,5 → 16/16/16/20/20; 2,5 → 16/16/20/20/20; 4 → 16/16/20/20/25; 6 → 16/16/20/25/25; 10 → 16/20/25/32/32; 16 → 20/25/32/40/40; 25 → 20/32/40/40/50; 35 → 25/32/40/50/50; 50 → 32/40/50/63/63; 70 → 32/50/63/63/75; 95 → 40/50/63/75/100; 120 → 40/63/75/100/100. Se usa también para THHN en mm² (la tabla oficial de THHN, 4.18, viene en AWG) → `verificado:false` para THHN.
- **RIC10 5.1.3.5:** diferencial ≤ 30 mA en todo circuito de alumbrado.
- **RIC10 5.1.3.6:** In diferencial ≥ In del termomagnético aguas arriba, o ≥ Σ In de los termomagnéticos aguas abajo.
- **RIC10 5.1.3.7:** máximo 3 circuitos por diferencial; un diferencial que agrupa más de un circuito no puede operar sobre el 100 % de la instalación.
- **RIC10 5.1.4.1:** In del circuito = protección comercial inmediatamente superior a 1,1·P/V.
- **RIC10 5.1.4.4:** Σ potencias ≤ 0,9 · In · V.
- **RIC10 5.1.4.5 / 5.1.4.6:** potencias por defecto: centro de iluminación 100 W; enchufe 250 W.
- **RIC10 5.2:**
  - Vivienda: empalme ≥ 25 A y alimentador ≥ 4 mm².
  - ≥ 2 circuitos si la superficie es < 30 m², ≥ 3 si es ≥ 30 m².
  - ≥ 1 circuito exclusivo de cocina/lavadero de ≥ 16 A.
  - Horno/cocina eléctrica en circuito independiente de ≥ 16 A.
  - Esquema TN-S.
- **Protecciones comerciales (A):** 6, 10, 16, 20, 25, 32, 40, 50, 63, 80, 100, 125.
- **Empalme:** potencia máxima = In · 220 V (mono) o √3 · 380 · In (tri). Escalones: mono 25/32/40/50/63 A, tri 25/32/40/50/63/80/100/125 A. Tipos y tarifas editables. Solo "25 A mono: A-9/S-9, BT-1" viene de la referencia, y todo marcado `verificado:false`.
- **Resistividad del cobre (Ω·mm²/m):** 0,0178 a 20 °C; a la temperatura de servicio, ρ = 0,0178·(1 + 0,00393·(T − 20)): 70 °C → 0,0213 y 90 °C → 0,0227. Por defecto se usa la de temperatura de servicio (opción conservadora del autor, no normativa).

## Review Focus

1. Cargas que ninguna sección soporta (p. ej. 30 kW en un circuito monofásico): el motor devuelve `seccion: null` y una falla de auditoría, sin excepción ni NaN.
2. Entradas vacías, cero o negativas (longitud 0, cos φ 0, potencia negativa): se tratan como inválidas con mensaje y sin NaN en la UI ni en el PDF.
3. Valores sobrescritos a mano que no cumplen (sección menor que la requerida o In > Iz): se respetan y la auditoría los marca.
4. Un proyecto guardado con un esquema viejo o un JSON importado corrupto: la importación lo rechaza con mensaje y no borra el proyecto actual.
5. Temperatura ambiente fuera de la Tabla 4.7 (< 5 °C o > 60 °C): advertencia y uso del tramo extremo, sin bloquear.

---

### Task 1: Andamiaje del proyecto

**Files:** Create `package.json`, `vite.config.ts`, `tsconfig.json`, `index.html`, `src/main.tsx`, `src/App.tsx`, `.gitignore`. Test: `src/motor/humo.test.ts`.

- [ ] Crear el proyecto Vite React-TS e instalar las dependencias del Tech Stack.
- [ ] Prueba de humo `expect(1+1).toBe(2)`; `npx vitest run` → PASS; `npm run build` → OK.
- [ ] Commit `chore: andamiaje Vite + React + TS + Vitest`.

### Task 2: Tablas normativas

**Files:** Create `src/motor/tablas/{tipos,ric03,ric04,ric10,protecciones,empalmes}.ts`. Test: `src/motor/tablas/tablas.test.ts`.

**Produces:**
- `type Metodo = 'A1'|'A2'|'B1'|'B2'|'D1'|'D2'|'E'|'F'`
- `type Aislacion = 70|90`
- `SECCIONES: number[]`
- `capacidad(sec, metodo, aisl): number|null`
- `factorTemperatura(tAmb, aisl, metodo): {f:number, fueraDeRango:boolean}`
- `factorAgrupamiento(n): number`
- `diametroDucto(sec, nCond): number|null`
- `FACTORES_DEMANDA: Record<TipoConsumidor, {hastaKW:number, factor:number}[]>`
- `factorSimultaneidad(n): number`
- `SECCION_MINIMA: Record<TipoCircuito|'alimentador'|'subalimentador', number>`
- `PROTECCIONES: number[]`
- `EMPALMES: Empalme[]`
- `LIMITES_DV = {alimentador:3, total:5}`
- `CONDUCTORES: Record<string, Aislacion>` (THHN → 90, THWN → 70, NYIFY → 70, H07V → 70, RV-K → 90, RZ1-K → 90)

- [ ] Prueba: `capacidad(2.5,'B1',90)===24`, `capacidad(4,'B1',90)===37`, `capacidad(1.5,'B1',70)===16`, `capacidad(1.5,'F',90)===null`, `factorTemperatura(30,90,'B1').f===1`, `factorTemperatura(38,70,'B1').f===0.87`, `factorAgrupamiento(5)===0.8`, `diametroDucto(2.5,3)===20`, `factorSimultaneidad(25)` ≈ (15.3+2)/25, `factorSimultaneidad(4)===0.95`.
- [ ] Ejecutar la prueba → FAIL; transcribir las tablas de la sección «Valores normativos» con `fuente`/`verificado`; volver a ejecutar → PASS.
- [ ] Commit.

### Task 3: Cálculo de circuito

**Files:** Create `src/motor/modelo.ts`, `src/motor/circuito.ts`. Test: `src/motor/circuito.test.ts`.

**Produces:**
- `modelo.ts`: tipos `Proyecto`, `Diferencial`, `Circuito`, `TipoCircuito = 'iluminacion'|'enchufes'|'cocina'|'horno'|'mixto'|'otros'`.
- `Circuito` tiene `{id, nombre, tipo, portalamparas, enchufes, otros, potenciaUnitOtros, fase:'R'|'S'|'T'|'RST', diferencialId, disyuntorManual?, seccionManual?, conductor, longitud, ubicacion}`.
- `calcularCircuito(c: Circuito, p: Proyecto): ResultadoCircuito`, que devuelve `{potencia, centros, ib, inMin, in, seccionMin, seccion, iz, dvVolt, dvPct, ducto, pctCarga, errores: string[]}`.

Reglas:
- Potencia = 100·portalámparas + 250·enchufes + otros·potenciaUnitOtros.
- Corriente: ib = P/(V·cosφ).
- Protección: inMin = protección ≥ 1,1·ib; para cocina y horno, mínimo 16.
- Sección: menor sección ≥ mínima por tipo, con Ic = It·fn·ft ≥ in.
- ΔV = 2·L·ib·ρ/S (en trifásico √3), con ρ según la temperatura de servicio.
- Ducto con 3 conductores (fase, neutro y tierra; en trifásico 5).
- %carga = ib/in·100.

- [ ] Prueba, caso de la captura (220 V, cosφ 1, B1, 30 °C, THHN, 10 m):
  - 6 portalámparas → potencia 600, in 10, seccion 1.5, pctCarga 27 (redondeado), ducto 16.
  - 8 enchufes → potencia 2000, seccion 2.5, ducto 20, ib ≈ 9.09.
  - Horno con otros 1×3000 → in 16, pctCarga 85.
  - dvPct del horno = 2·10·13.636·0.0227/2.5/220·100 ≈ 1.13 (±0.01).
- [ ] Prueba: 30 kW monofásico (otros) → `seccion===null`, `errores` no vacío, sin NaN.
- [ ] Prueba: longitud 0 → dvPct 0; cosφ 0 → error "cos φ inválido".
- [ ] Prueba: `seccionManual 1.5` en un circuito de enchufes → se usa 1.5 y `errores` incluye la sección mínima.
- [ ] Implementar; PASS; commit.

### Task 4: Alimentador, empalme y auditoría

**Files:** Create `src/motor/alimentador.ts`, `src/motor/empalme.ts`, `src/motor/auditoria.ts`, `src/motor/index.ts`. Tests: `src/motor/{alimentador,empalme,auditoria}.test.ts`.

**Consumes:** Task 3.

**Produces:**
- `calcularAlimentador(p, circuitos: ResultadoCircuito[]): ResultadoAlimentador` → `{potInstalada, demanda, factorDemanda, fs, ib, in, seccionFase, seccionNeutro, seccionTierra, ducto, dvPct}`.
  - Demanda por tramos de la Tabla 3.1 × Fs de la Tabla 3.2.
  - Tierra = fase hasta 16 mm²; 16 entre 16 y 35; fase/2 sobre 35. Es la regla IEC 60364-5-54; la marco `verificado:false` porque RIC N°06 no está descargado.
- `seleccionarEmpalme(p, demandaKW): Empalme|null`, con mínimo 25 A en vivienda.
- `auditar(p, rc, ra): Hallazgo[]`, con `Hallazgo = {nivel:'error'|'aviso', regla:string, mensaje:string}`.
- `calcularProyecto(p): ResultadoProyecto` → `{circuitos, alimentador, empalme, hallazgos, balance}`.

- [ ] Prueba alimentador, caso captura (6 circuitos, 8700 W, casa habitación, 1 vivienda): demanda 4995 W, ib ≈ 22.70, in 25, seccionFase 4, neutro 4, tierra 4, dvPct ≈ 2·10·22.70·0.0227/4/220·100.
- [ ] Prueba empalme: 4995 W mono → 25 A (5,5 kVA); 12 kW mono → 63 A; 30 kW mono → null + hallazgo.
- [ ] Prueba auditoría:
  - 4 circuitos en un diferencial → error RIC10 5.1.3.7.
  - Vivienda ≥ 30 m² con 2 circuitos → error RIC10 5.2 b.
  - Sin circuito de cocina → error 5.2 d.
  - Σ In aguas abajo > In diferencial → error 5.1.3.6.
  - Diferencial único con todos los circuitos (más de uno) → error 5.1.3.7.
  - ΔV alimentador > 3 % → error RIC03 5.1.3.
  - Caso captura → 0 errores.
- [ ] Prueba balance trifásico: desequilibrio > 20 % → aviso (umbral propio, marcado como criterio del autor).
- [ ] Implementar; PASS; commit.

### Task 5: Persistencia

**Files:** Create `src/datos/almacen.ts`, `src/datos/serializar.ts`. Test: `src/datos/serializar.test.ts`.

**Produces:**
- `interface Almacen { listar(): Promise<ResumenProyecto[]>; cargar(id): Promise<Proyecto|null>; guardar(p): Promise<void>; borrar(id): Promise<void> }`
- `almacenIndexedDB` (idb-keyval).
- `exportarJSON(p): string` con `{version:1, proyecto}`.
- `importarJSON(txt): {ok:true, proyecto}|{ok:false, error:string}`.
- `proyectoEjemplo(): Proyecto` (el de las capturas).

- [ ] Prueba: ida y vuelta conserva el proyecto; JSON inválido, versión desconocida o falta `circuitos` → `ok:false` con mensaje.
- [ ] Implementar; PASS; commit.

### Task 6: Interfaz principal

**Files:**
- Create `src/estado.ts` (store Zustand con el proyecto + `calcularProyecto` memoizado).
- Create `src/ui/{Encabezado,ConfigProyecto,Diferenciales,TablaCircuitos,TarjetasCircuitos,PanelResumen,MisProyectos}.tsx` y `src/ui/estilos.css`.
- Test: `src/ui/app.test.tsx` (Testing Library + jsdom).

Comportamiento: el layout de la spec §5.5. Bajo 768 px, las tarjetas reemplazan la tabla y el resumen pasa abajo. Autoguardado con debounce de 1 s. Los botones agregar/eliminar diferencial y circuito usan los presets por tipo. Números con coma.

- [ ] Prueba: con el proyecto de ejemplo cargado, la pantalla muestra «8,70 kW», «5,00 kW» y «25 A»; al agregar un 4.º circuito al Diferencial 1 aparece el hallazgo 5.1.3.7.
- [ ] Implementar; PASS; revisión visual con Playwright a 1280 px y 390 px (capturas a scratchpad); commit.

### Task 7: Informes PDF

**Files:** Create `src/informes/{unilineal,cuadroCargas,memoria,pdf}.ts`. Test: `src/informes/informes.test.ts`.

**Produces:**
- `unilinealSVG(p, r): string` (empalme → protección general → barra → diferenciales → circuitos, como la captura).
- `filasCuadroCargas(p, r): string[][]` (columnas de la Fig. 18.4.1 de la captura).
- `memoria(p, r): {titulo, pasos: {formula, datos, resultado, fuente}[]}[]`.
- `generarPDF(p, r): Promise<Blob>`, apaisado carta: cuadro de cargas, unilineal, memoria.

- [ ] Prueba: `filasCuadroCargas` del ejemplo tiene 6 filas + TOTALES con «8700»; el SVG contiene «EMPALME 25 A» y los 6 nombres de circuito; la memoria del alimentador cita «RIC N°03 Tabla 3.1».
- [ ] Implementar; el botón «Exportar PDF» descarga el archivo; verificar con Playwright que se descarga un PDF > 10 KB; commit.

### Task 8: PWA y publicación

**Files:** Modify `vite.config.ts` (vite-plugin-pwa, manifest «Calculadora RIC»); create `public/icono.svg`; README con uso y fuentes.

- [ ] `npm run build` + `npx vite preview`; Playwright: carga, pasa a offline, recarga → la app abre.
- [ ] Commit, push.
- [ ] Desplegar en Vercel (si el conector lo permite; si no, dejar instrucciones en el README).
