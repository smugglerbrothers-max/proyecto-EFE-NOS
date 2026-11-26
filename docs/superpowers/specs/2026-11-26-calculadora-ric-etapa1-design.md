# Diseño — Calculadora de proyectos eléctricos RIC · Etapa 1

Fecha: 2026-11-26 · Estado: borrador para aprobación

## 1. Intención

Herramienta personal de un ingeniero eléctrico recién egresado para
dimensionar instalaciones eléctricas en Chile según los Pliegos Técnicos RIC
(DS 8/2019 de la SEC) y dejar lista la documentación para la declaración TE1.

- **Para qué:** primero, los proyectos eléctricos que le quedan en la
  universidad; después, los trabajos que ingrese ante la SEC como profesional.
- **No es un producto para vender.** Los ingresos vienen de los proyectos que
  se hacen con la app. No hay cuentas, planes ni cobros.
- **Referencia visual:** la "Calculadora SEC-RIC" de las capturas que entregó
  el usuario (configuración del proyecto, diferenciales, tabla de circuitos,
  panel lateral de cumplimiento, cuadro de cargas Fig. 18.4.1, unilineal y
  exportación a PDF).

## 2. Hoja de ruta (cada etapa se puede usar por sí sola)

| Etapa | Alcance |
|-------|---------|
| **1 (este documento)** | Instalación interior RIC: circuitos, diferenciales, alimentador, empalme, auditoría, cuadro de cargas, unilineal y PDF |
| 2 | Ingreso estilo TE1: checklist de antecedentes, anexos e informe de fotos |
| 3 | Proyectos de iluminación (cálculo luminotécnico por recinto) |
| 4 | RGR (generación residencial / net billing) y lo que aplique del RPTD |
| Futuro | Sincronización en la nube (Supabase) entre equipos |

## 3. Objetivos, no-objetivos y anti-objetivos (Etapa 1)

**Objetivos**
- Ingresar un proyecto de vivienda o local con tablero general y circuitos, y
  obtener al instante corriente, sección, protección, caída de tensión, ducto
  y porcentaje de carga de cada circuito.
- Dimensionar el alimentador y seleccionar el empalme normalizado.
- Mostrar una auditoría normativa: cada advertencia indica qué regla no se
  cumple y el pliego/artículo de donde sale.
- Exportar un PDF con portada y datos del proyecto, cuadro de cargas (formato
  Fig. 18.4.1 del RIC N°18), diagrama unilineal y memoria de cálculo.
- Funcionar en el celular y en el computador, incluso sin internet.

**No-objetivos (Etapa 1)**
- Tableros de distribución en cascada (un tablero general con sus circuitos
  basta para esta etapa; el modelo de datos queda preparado para subtableros).
- Iluminación, TE1, RGR, RPTD y nube (etapas siguientes).
- Planos de planta o dibujo CAD.

**Anti-objetivos (aunque "funcione", sería un fracaso)**
- **Valores normativos inventados.** Cada tabla (capacidad de corriente,
  factores de corrección, secciones mínimas, factores de demanda, empalmes)
  sale transcrita del pliego oficial con la referencia anotada, y el usuario
  la revisa. Si un valor no está verificado, la app lo marca como tal.
- Resultados que no se puedan rastrear: la memoria de cálculo muestra la
  fórmula, los datos de entrada y la tabla usada en cada paso.
- Perder un proyecto: se guarda solo y se puede respaldar en un archivo.

## 4. Enfoques considerados

| Enfoque | Ventajas | Desventajas |
|---------|----------|-------------|
| **A. App web instalable sin conexión (elegido)** | Gratis de publicar; funciona en terreno sin señal; sin servidor que mantener | Los proyectos no se sincronizan solos entre equipos (exportar/importar) |
| B. A + nube (Supabase) | Mismos proyectos en todos los equipos | Login, base de datos y seguridad desde el día uno; la Etapa 1 se demora más |
| C. Excel con macros o programa de escritorio | Conocido | No sirve en el celular; unilineal y PDF pobres. Descartado |

El usuario eligió **A, preparada para crecer a B**: el guardado queda detrás
de una interfaz de almacenamiento, de modo que la nube se agrega después sin
tocar los cálculos ni las pantallas.

## 5. Diseño

### 5.1 Tecnología
- React + TypeScript + Vite; PWA (service worker) para uso sin conexión.
- Estado del proyecto en un store simple (Zustand), recalculado en vivo.
- Guardado en el navegador con IndexedDB; respaldo exportar/importar JSON.
- PDF generado en el dispositivo (pdfmake o @react-pdf/renderer); unilineal
  dibujado como SVG e incrustado en el PDF.
- Pruebas con Vitest. Publicación en Vercel o GitHub Pages.

### 5.2 Módulos
```
src/
  motor/            ← cálculos puros, sin interfaz, 100 % probados
    tablas/         ← datos normativos en JSON, cada uno con su referencia
    circuito.ts     ← corriente, sección, protección, ΔV, ducto, % carga
    alimentador.ts  ← demanda máxima, sección fase/neutro/tierra, ΔV
    empalme.ts      ← selección del empalme normalizado
    auditoria.ts    ← reglas RIC → lista de cumplimientos/advertencias
  datos/            ← modelo del proyecto, almacenamiento (IndexedDB/JSON)
  ui/               ← pantallas
  informes/         ← PDF, cuadro de cargas, unilineal SVG, memoria
```
El motor es el corazón: las etapas 2 a 4 lo reutilizan.

### 5.3 Modelo de datos (resumen)
- **Proyecto:** nombre, comuna, propietario, dirección, instalador (nombre,
  clase, licencia), empresa, logo, destino, tipo de empalme (monofásico 220 V /
  trifásico 380 V), longitud del alimentador, método de instalación,
  temperatura ambiente, n° de viviendas, cos φ, tipo y aislación del conductor,
  condiciones especiales (recinto de reunión de personas, tendido
  subterráneo, cargas no lineales).
- **Diferencial:** nombre, In, sensibilidad (30 mA por defecto).
- **Circuito:** n°, nombre, tipo (iluminación, enchufes, cocina/lavadero 16 A,
  horno/clima, mixto, otros), n° de portalámparas/enchufes/otros, potencia
  unitaria, fase (R/S/T), diferencial, disyuntor, sección, cable, longitud,
  ubicación. Los valores calculados se pueden sobrescribir a mano; la
  auditoría avisa si el valor manual no cumple.

### 5.4 Cálculos (Etapa 1)
1. **Potencia del circuito:** cantidad × potencia unitaria (con valores por
   defecto por tipo, editables).
2. **Corriente:** I = P / (V · cos φ) monofásico; I = P / (√3 · V · cos φ)
   trifásico.
3. **Protección:** menor calibre normalizado con In ≥ Ib, y coordinación
   Ib ≤ In ≤ Iz.
4. **Sección:** menor sección con Iz ≥ In, usando la capacidad de corriente
   del RIC N°04 según método de instalación, corregida por temperatura y
   agrupamiento; respeta las secciones mínimas por tipo de circuito.
5. **Caída de tensión:** ΔV = 2·L·I·ρ / S (monofásico) o √3·L·I·ρ / S
   (trifásico), comparada con los límites del RIC (circuito, alimentador y
   total).
6. **Ducto:** diámetro mínimo según n° y sección de conductores y el
   porcentaje de ocupación del pliego.
7. **Demanda máxima y alimentador:** factores de demanda del RIC aplicados a
   la potencia instalada → corriente, protección general, sección
   fase/neutro/tierra, ducto y ΔV del alimentador.
8. **Empalme:** menor empalme normalizado cuya capacidad cubre la demanda
   (tipo, potencia nominal y máxima, tarifa), con tabla editable.
9. **Balance de fases** en trifásico, con advertencia de desequilibrio.
10. **Auditoría:** máx. circuitos por diferencial, puntos por circuito,
    secciones mínimas, ΔV, Ib ≤ In ≤ Iz, diferencial ≥ suma de los circuitos
    (o la regla que fije el pliego) y otras reglas del RIC N°10/N°05.

### 5.5 Pantallas
Escritorio: igual que la referencia (configuración arriba, diferenciales,
tabla de circuitos con desplazamiento horizontal y panel lateral fijo con
Cumplimiento RIC, Empalme, Alimentador, Balance de fases y Auditoría).
Celular: los circuitos se muestran como tarjetas plegables en vez de tabla y
el panel lateral pasa a un resumen fijo abajo.

```
┌ Calculadora RIC ─ [Mis proyectos][Guardar][Exportar/Importar][PDF] ┐
│ Configuración del proyecto ...................... │ Cumplimiento ✓ │
│ Diferenciales  [D1 40A][D2 40A] [+]               │ Empalme 25 A   │
│ Circuitos [+Ilum][+Ench][+Cocina][+Horno][+Otros] │ Alimentador    │
│ N° Nombre Tipo Port Ench ... ΔV% %Carga           │ Auditoría      │
└───────────────────────────────────────────────────┴────────────────┘
```

### 5.6 Verificación
- Cada función del motor tiene pruebas con casos resueltos a mano. El primer
  caso es el proyecto de las capturas (6 circuitos, 8,7 kW instalados,
  5,0 kW de demanda, empalme 25 A, alimentador 4 mm², ΔV 1,21 %): la app debe
  reproducir esas cifras o explicar con la norma por qué difiere.
- Las tablas normativas se revisan contra el PDF oficial de cada pliego antes
  de darlas por buenas (marca "verificado" en el JSON).

## 6. Decisiones que tomé yo (revísalas)
1. Pliegos RIC vigentes de la SEC (DS 8/2019) como única fuente; nada de la
   antigua NCh Elec. 4/2003.
2. Etapa 1 limitada a tablero general + circuitos; subtableros después.
3. Tabla de empalmes editable, porque cada distribuidora (Enel, CGE, etc.)
   tiene la suya; parto con la de la referencia (A-9, S-9...).
4. Valores por defecto de potencia por tipo de circuito editables en la
   configuración.
5. Interfaz completa en español y unidades SI.
6. Publicación gratuita en Vercel (ya conectado) bajo una URL que solo tú
   compartes.

## 7. Queda a criterio de quien construya
Librería de PDF concreta, estilos visuales, organización interna de
componentes y la forma exacta de las tarjetas en el celular.
